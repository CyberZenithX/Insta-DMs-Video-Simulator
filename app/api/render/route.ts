import {NextResponse} from 'next/server';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {baseIgDmReelProps, defaultClock, defaultReceiver} from '../../../src/data/defaultProps';
import {buildEventsFromScript} from '../../../src/lib/scriptToEvents';
import {buildInitialAvatarDataUrl} from '../../../src/lib/avatar';
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
 *    render runs on AWS Lambda, parallelized across many short invocations.
 * 2. Local in-process rendering, when Lambda isn't configured — e.g.
 *    `npm run dev` without AWS set up. The render runs as a background task
 *    in the Node process.
 *
 * Both paths return a JSON response immediately with a renderId and
 * bucketName. The client polls /api/render/progress for status updates.
 * This design ensures no single HTTP request needs to stay open for the
 * duration of a render.
 *
 * @remotion/renderer and @sparticuz/chromium are only ever imported inside
 * renderLocally(), dynamically — so when Lambda is configured, this route
 * never loads them at all.
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
			avatar: buildInitialAvatarDataUrl(receiverName),
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

	// Left unset, Remotion fans a render out across as many concurrent Lambda
	// invocations as it estimates are useful — easily 50-200+ for a few
	// seconds of video. A brand-new AWS account's default concurrent-execution
	// (and invoke-TPS) quota is often far below that until AWS's automated
	// review raises it, so that fan-out gets throttled at the API level with
	// `Rate Exceeded.` before a single frame renders. Setting
	// REMOTION_LAMBDA_FRAMES_PER_LAMBDA raises frames-per-invocation, which
	// lowers the invocation count proportionally, trading render speed for
	// staying under a low quota. See AWS_LAMBDA_SETUP.md's Troubleshooting
	// section.
	const framesPerLambdaEnv = process.env.REMOTION_LAMBDA_FRAMES_PER_LAMBDA;
	const framesPerLambda = framesPerLambdaEnv ? Number(framesPerLambdaEnv) : undefined;
	if (framesPerLambdaEnv && (!Number.isInteger(framesPerLambda) || (framesPerLambda as number) <= 0)) {
		throw new Error('REMOTION_LAMBDA_FRAMES_PER_LAMBDA must be a positive integer.');
	}

	const {renderId, bucketName} = await renderMediaOnLambda({
		region,
		functionName,
		serveUrl,
		composition: 'IgDmReel',
		inputProps,
		codec: 'h264',
		privacy: 'public',
		...(framesPerLambda ? {framesPerLambda} : {}),
		// 1 browser tab per Lambda invocation. Keeps the per-invocation memory
		// well under 2 GB and — more importantly on a fresh AWS account —
		// dramatically reduces the Lambda:InvokeFunction TPS the orchestrator
		// emits, preventing TooManyRequestsException ("Rate Exceeded") errors.
		concurrencyPerLambda: 1,
	});

	return NextResponse.json({mode: 'lambda', renderId, bucketName, functionName, region});
};

const renderLocally = async (inputProps: IgDmReelProps) => {
	if (!fs.existsSync(BUNDLE_DIR)) {
		return NextResponse.json(
			{error: 'Local render bundle not found. Run "npm run build" (or "npm run bundle:remotion") before rendering locally.'},
			{status: 500},
		);
	}

	const {openBrowser, renderMedia, selectComposition} = await import('@remotion/renderer');
	const {setLocalRenderState} = await import('../../../src/lib/localRenderStore');

	const isServerlessSandbox = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
	const renderId = `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;

	const getBrowserExecutable = async (): Promise<string | null> => {
		if (!isServerlessSandbox) return null;
		const nodeMajor = Number(process.versions.node.split('.')[0]);
		process.env.AWS_LAMBDA_JS_RUNTIME ??= nodeMajor >= 20 ? 'nodejs20.x' : 'nodejs18.x';
		const chromium = (await import('@sparticuz/chromium')).default;
		return chromium.executablePath();
	};

	const outputLocation = path.join(os.tmpdir(), `${renderId}.mp4`);

	// Write initial state SYNCHRONOUSLY so the file is guaranteed on disk
	// before the HTTP response is returned and the client starts polling.
	// If this were async there's a race window where the first poll hits
	// before the write completes → "Local render not found" 404.
	const stateFilePath = path.join(os.tmpdir(), `${renderId}-state.json`);
	fs.writeFileSync(stateFilePath, JSON.stringify({stage: 'launching'}), 'utf-8');

	// Execute rendering in the background (fire-and-forget)
	(async () => {
		let browser: Awaited<ReturnType<typeof openBrowser>> | undefined;
		try {
			const browserExecutable = await getBrowserExecutable();
			const chromiumOptions = browserExecutable ? ({gl: 'swangle'} as const) : undefined;

			browser = await openBrowser('chrome', {browserExecutable, chromiumOptions});

			setLocalRenderState(renderId, {stage: 'resolving'});
			const composition = await selectComposition({
				serveUrl: BUNDLE_DIR,
				id: 'IgDmReel',
				inputProps,
				puppeteerInstance: browser,
				browserExecutable,
				chromiumOptions,
				timeoutInMilliseconds: 120_000, // 2 min — low-end machines can take 60s+ to evaluate the bundle
			});

			setLocalRenderState(renderId, {
				stage: 'rendering',
				renderedFrames: 0,
				encodedFrames: 0,
				totalFrames: composition.durationInFrames,
				progress: 0,
				estimatedRemainingMs: 0,
			});

			await renderMedia({
				composition,
				serveUrl: BUNDLE_DIR,
				codec: 'h264',
				imageFormat: 'jpeg',
				jpegQuality: 80,
				x264Preset: isServerlessSandbox ? 'ultrafast' : undefined,
				outputLocation,
				inputProps,
				puppeteerInstance: browser,
				browserExecutable,
				chromiumOptions,
				muted: true,
				hardwareAcceleration: isServerlessSandbox ? undefined : 'if-possible',
				concurrency: isServerlessSandbox ? 1 : undefined,
				timeoutInMilliseconds: 120_000, // 2 min per-frame timeout — prevents Remotion's default 30s from killing slow renders
				onProgress: (p) => {
					setLocalRenderState(renderId, {
						stage: p.stitchStage === 'muxing' ? 'stitching' : 'rendering',
						renderedFrames: p.renderedFrames,
						encodedFrames: p.encodedFrames,
						totalFrames: composition.durationInFrames,
						progress: p.progress,
						estimatedRemainingMs: p.renderEstimatedTime,
					});
				},
			});

			const downloadUrl = `/api/render/download?file=${encodeURIComponent(outputLocation)}`;
			setLocalRenderState(renderId, {stage: 'done', outputFile: downloadUrl});
		} catch (err) {
			console.error('Local render background task failed', err);
			setLocalRenderState(renderId, {stage: 'error', error: err instanceof Error ? err.message : 'Render failed.'});
		} finally {
			await browser?.close({silent: true}).catch(() => {});
		}
	})();

	return NextResponse.json({
		mode: 'local',
		renderId,
		bucketName: 'local',
	});
};

export async function GET() {
	return NextResponse.json({
		lambdaConfigured: isLambdaConfigured(),
		localBundleAvailable: fs.existsSync(BUNDLE_DIR),
	});
}

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

	const {renderBackend} = parsedRequest.data;
	const inputProps = buildInputProps(parsedRequest.data);

	if (renderBackend === 'local') {
		return renderLocally(inputProps);
	}

	if (renderBackend === 'lambda') {
		if (!isLambdaConfigured()) {
			return NextResponse.json(
				{error: 'AWS Lambda rendering is not configured on this server.'},
				{status: 400},
			);
		}
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

