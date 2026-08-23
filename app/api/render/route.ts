import {NextResponse} from 'next/server';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {renderMedia, selectComposition} from '@remotion/renderer';
import {baseIgDmReelProps, defaultClock, defaultReceiver} from '../../../src/data/defaultProps';
import {buildEventsFromScript} from '../../../src/lib/scriptToEvents';
import {generateRequestSchema, igDmReelPropsSchema} from '../../../src/types';

// Headless Chrome + ffmpeg need a real Node.js process, not the Edge runtime.
export const runtime = 'nodejs';
// Video rendering is slow; give it the most headroom the plan allows.
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const BUNDLE_DIR = path.join(process.cwd(), 'remotion-bundle');

const isServerlessSandbox = () => Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

/**
 * Locally, Remotion manages its own downloaded Chrome Headless Shell. On
 * Vercel's serverless Node runtime there's no such binary available, so we
 * fall back to a Lambda-compatible prebuilt Chromium instead.
 */
const getBrowserExecutable = async (): Promise<string | null> => {
	if (!isServerlessSandbox()) return null;

	// @sparticuz/chromium only unpacks its bundled glibc-compat shared
	// libraries (nss, nspr, etc.) and points LD_LIBRARY_PATH at them when its
	// own env-var check thinks it's running inside AWS Lambda (it looks for
	// AWS_EXECUTION_ENV / AWS_LAMBDA_JS_RUNTIME, both checked at import time).
	// Vercel's Node runtime never sets either, even though it's a Lambda-like
	// sandbox, so that setup step silently gets skipped: the `chromium`
	// binary is there, but its dynamic loader can't resolve its dependencies.
	// Node reports that as a bare "Closed with 127 signal", not a helpful
	// missing-library error. Setting the var ourselves before the module
	// loads makes @sparticuz/chromium run its own intended setup, exactly as
	// its own Netlify integration (a similarly non-Lambda serverless host)
	// does. Node's own major version decides which of its two library sets
	// applies, rather than guessing which Vercel image is in use.
	const nodeMajor = Number(process.versions.node.split('.')[0]);
	process.env.AWS_LAMBDA_JS_RUNTIME ??= nodeMajor >= 20 ? 'nodejs20.x' : 'nodejs18.x';

	const chromium = (await import('@sparticuz/chromium')).default;
	return chromium.executablePath();
};

export async function POST(request: Request) {
	if (!fs.existsSync(BUNDLE_DIR)) {
		return NextResponse.json(
			{
				error:
					'Remotion bundle not found. Run "npm run build" (or "npm run bundle:remotion") before starting the server.',
			},
			{status: 500},
		);
	}

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return NextResponse.json({error: 'Request body must be JSON.'}, {status: 400});
	}

	const parsedRequest = generateRequestSchema.safeParse(body);
	if (!parsedRequest.success) {
		return NextResponse.json({error: parsedRequest.error.issues[0]?.message ?? 'Invalid request.'}, {status: 400});
	}

	const {theme, receiverName, receiverUsername, clock, messages} = parsedRequest.data;

	const inputProps = igDmReelPropsSchema.parse({
		...baseIgDmReelProps,
		theme,
		clock: clock || defaultClock,
		receiver: {
			...defaultReceiver,
			name: receiverName,
			username: receiverUsername || defaultReceiver.username,
		},
		events: buildEventsFromScript(messages),
	});

	const outputLocation = path.join(
		os.tmpdir(),
		`ig-dm-reel-${Date.now()}-${Math.random().toString(36).slice(2)}.mp4`,
	);

	try {
		const browserExecutable = await getBrowserExecutable();
		const chromiumOptions = browserExecutable ? ({gl: 'swangle'} as const) : undefined;

		const composition = await selectComposition({
			serveUrl: BUNDLE_DIR,
			id: 'IgDmReel',
			inputProps,
			browserExecutable,
			chromiumOptions,
		});

		await renderMedia({
			composition,
			serveUrl: BUNDLE_DIR,
			codec: 'h264',
			outputLocation,
			inputProps,
			browserExecutable,
			chromiumOptions,
		});

		const videoBuffer = fs.readFileSync(outputLocation);
		return new NextResponse(new Uint8Array(videoBuffer), {
			status: 200,
			headers: {
				'Content-Type': 'video/mp4',
				'Content-Disposition': 'attachment; filename="ig-dm-reel.mp4"',
				'Content-Length': String(videoBuffer.length),
			},
		});
	} catch (err) {
		console.error('Render failed', err);
		return NextResponse.json({error: err instanceof Error ? err.message : 'Render failed.'}, {status: 500});
	} finally {
		fs.rm(outputLocation, {force: true}, () => {});
	}
}
