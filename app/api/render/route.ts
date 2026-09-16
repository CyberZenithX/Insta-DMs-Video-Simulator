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

	setLocalRenderState(renderId, {stage: 'launching'});

	// Execute rendering in the background (fire-and-forget)
	(async () => {
		let browser: Awaited<ReturnType<typeof openBrowser>> | undefined;
		try {
			const browserExecutable = await getBrowserExecutable();
			const chromiumOptions = browserExecutable ? ({gl: 'swangle'} as const) : undefined;

			setLocalRenderState(renderId, {stage: 'launching'});
			browser = await openBrowser('chrome', {browserExecutable, chromiumOptions});

			setLocalRenderState(renderId, {stage: 'resolving'});
			const composition = await selectComposition({
				serveUrl: BUNDLE_DIR,
				id: 'IgDmReel',
				inputProps,
				puppeteerInstance: browser,
				browserExecutable,
				chromiumOptions,
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

