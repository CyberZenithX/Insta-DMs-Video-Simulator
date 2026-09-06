import {NextResponse} from 'next/server';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {baseIgDmReelProps, defaultClock, defaultReceiver} from '../../../src/data/defaultProps';
import {buildEventsFromScript} from '../../../src/lib/scriptToEvents';
import {generateRequestSchema, igDmReelPropsSchema} from '../../../src/types';
import type {GenerateRequest, IgDmReelProps} from '../../../src/types';
import type {AwsRegion} from '@remotion/lambda/client';

// Headless Chrome + ffmpeg need a real Node.js process, not the Edge runtime.
export const runtime = 'nodejs';
// Video rendering is slow; give it the most headroom the plan allows. Only
// matters for the local-render fallback below — the Lambda path returns in
// well under a second regardless of how long the render itself takes.
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const BUNDLE_DIR = path.join(process.cwd(), 'remotion-bundle');

/**
 * Render capacity, in order of preference:
 *
 * 1. Remotion Lambda, if configured (REMOTION_LAMBDA_FUNCTION_NAME set). The
 *    render runs on AWS Lambda, parallelized across many short invocations —
 *    this route only has to kick it off (sub-second) and return an id to
 *    poll. See /api/render/progress. This is what removes the "keep the
 *    connection open for however long the render takes" ceiling entirely:
 *    no single request, on Vercel or in the browser, needs to stay open for
 *    more than a couple of seconds.
 * 2. Local in-process rendering (the original design), when Lambda isn't
 *    configured — e.g. `npm run dev` without AWS set up. This still streams
 *    NDJSON progress and can take tens of seconds to minutes on a long
 *    script; see decisions.md for why that's a real ceiling on Vercel.
 *
 * @remotion/renderer and @sparticuz/chromium are only ever imported inside
 * renderLocally(), dynamically — so when Lambda is configured, this route
 * never loads them at all. They're a meaningful amount of code to evaluate
 * on a cold start, for capacity this route won't use.
 */
const isLambdaConfigured = () => Boolean(process.env.REMOTION_LAMBDA_FUNCTION_NAME);

const buildInputProps = (parsed: GenerateRequest): IgDmReelProps => {
	const {theme, receiverName, receiverUsername, clock, messages} = parsed;
	return igDmReelPropsSchema.parse({
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
};

const renderOnLambda = async (inputProps: IgDmReelProps) => {
	const {renderMediaOnLambda} = await import('@remotion/lambda/client');

	const functionName = process.env.REMOTION_LAMBDA_FUNCTION_NAME as string;
	const serveUrl = process.env.REMOTION_LAMBDA_SERVE_URL;
	const region = process.env.REMOTION_LAMBDA_REGION as AwsRegion | undefined;

	if (!serveUrl || !region) {
		throw new Error(
			'REMOTION_LAMBDA_FUNCTION_NAME is set but REMOTION_LAMBDA_SERVE_URL / REMOTION_LAMBDA_REGION are not. All three must be set together — see scripts/lambda-deploy-site.mjs.',
		);
	}

	const {renderId, bucketName} = await renderMediaOnLambda({
		region,
		functionName,
		serveUrl,
		composition: 'IgDmReel',
		inputProps,
		codec: 'h264',
		privacy: 'public',
	});

	return NextResponse.json({mode: 'lambda', renderId, bucketName, functionName, region});
};

/**
 * One line of NDJSON per event: {"type":"stage",...} | {"type":"progress",...}
 * | {"type":"done",...} | {"type":"error",...}. The client reads the response
 * body as a stream and renders a progress bar from it — a plain buffered
 * fetch() has nothing to show until the whole render (which can run for tens
 * of seconds) has already finished.
 */
type RenderEvent =
	| {type: 'stage'; stage: 'launching' | 'resolving' | 'rendering' | 'stitching'; totalFrames?: number}
	| {type: 'progress'; renderedFrames: number; encodedFrames: number; totalFrames: number; progress: number; estimatedRemainingMs: number}
	| {type: 'done'; dataBase64: string}
	| {type: 'error'; error: string};

const renderLocally = async (inputProps: IgDmReelProps) => {
	if (!fs.existsSync(BUNDLE_DIR)) {
		return NextResponse.json(
			{
				error:
					'Remotion bundle not found. Run "npm run build" (or "npm run bundle:remotion") before starting the server.',
			},
			{status: 500},
		);
	}

	const {openBrowser, renderMedia, selectComposition} = await import('@remotion/renderer');

	const isServerlessSandbox = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

	// Locally, Remotion manages its own downloaded Chrome Headless Shell. On
	// Vercel's serverless Node runtime there's no such binary available, so we
	// fall back to a Lambda-compatible prebuilt Chromium instead.
	const getBrowserExecutable = async (): Promise<string | null> => {
		if (!isServerlessSandbox) return null;

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

	const outputLocation = path.join(
		os.tmpdir(),
		`ig-dm-reel-${Date.now()}-${Math.random().toString(36).slice(2)}.mp4`,
	);

	const stream = new ReadableStream<Uint8Array>({
		async start(controller) {
			const encoder = new TextEncoder();
			const send = (event: RenderEvent) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));

			let browser: Awaited<ReturnType<typeof openBrowser>> | undefined;
			try {
				const browserExecutable = await getBrowserExecutable();
				const chromiumOptions = browserExecutable ? ({gl: 'swangle'} as const) : undefined;

				send({type: 'stage', stage: 'launching'});
				// Opened once and reused for both calls below — selectComposition
				// and renderMedia each launch their own browser by default, and a
				// cold headless-Chrome launch is a meaningful fraction of total
				// render time on a fresh serverless invocation.
				browser = await openBrowser('chrome', {browserExecutable, chromiumOptions});

				send({type: 'stage', stage: 'resolving'});
				const composition = await selectComposition({
					serveUrl: BUNDLE_DIR,
					id: 'IgDmReel',
					inputProps,
					puppeteerInstance: browser,
					browserExecutable,
					chromiumOptions,
				});

				send({type: 'stage', stage: 'rendering', totalFrames: composition.durationInFrames});
				await renderMedia({
					composition,
					serveUrl: BUNDLE_DIR,
					codec: 'h264',
					outputLocation,
					inputProps,
					puppeteerInstance: browser,
					browserExecutable,
					chromiumOptions,
					onProgress: (p) => {
						send({
							type: 'progress',
							renderedFrames: p.renderedFrames,
							encodedFrames: p.encodedFrames,
							totalFrames: composition.durationInFrames,
							progress: p.progress,
							estimatedRemainingMs: p.renderEstimatedTime,
						});
						if (p.stitchStage === 'muxing') {
							send({type: 'stage', stage: 'stitching'});
						}
					},
				});

				const videoBuffer = fs.readFileSync(outputLocation);
				send({type: 'done', dataBase64: videoBuffer.toString('base64')});
			} catch (err) {
				console.error('Render failed', err);
				send({type: 'error', error: err instanceof Error ? err.message : 'Render failed.'});
			} finally {
				await browser?.close({silent: true}).catch(() => {});
				fs.rm(outputLocation, {force: true}, () => {});
				controller.close();
			}
		},
	});

	return new NextResponse(stream, {
		status: 200,
		headers: {
			'Content-Type': 'application/x-ndjson; charset=utf-8',
			'Cache-Control': 'no-store',
		},
	});
};

export async function POST(request: Request) {
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

	const inputProps = buildInputProps(parsedRequest.data);

	if (isLambdaConfigured()) {
		try {
			return await renderOnLambda(inputProps);
		} catch (err) {
			console.error('Failed to start Lambda render', err);
			return NextResponse.json(
				{error: err instanceof Error ? err.message : 'Failed to start render.'},
				{status: 500},
			);
		}
	}

	return renderLocally(inputProps);
}
