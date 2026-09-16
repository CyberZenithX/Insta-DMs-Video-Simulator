import {NextResponse} from 'next/server';
import type {AwsRegion} from '@remotion/lambda/client';

// A status check against AWS, not a render — this always returns in well
// under a second regardless of how the render itself is going, which is the
// whole point: the client polls this repeatedly instead of holding one
// long-lived request open.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
	const functionName = process.env.REMOTION_LAMBDA_FUNCTION_NAME;
	const region = process.env.REMOTION_LAMBDA_REGION as AwsRegion | undefined;

	const {searchParams} = new URL(request.url);
	const renderId = searchParams.get('renderId');
	const bucketName = searchParams.get('bucketName');

	if (!renderId || !bucketName) {
		return NextResponse.json({error: 'renderId and bucketName query params are required.'}, {status: 400});
	}

	if (bucketName === 'local') {
		const {getLocalRenderState} = await import('../../../../src/lib/localRenderStore');
		const state = getLocalRenderState(renderId);
		
		if (!state) {
			return NextResponse.json({error: 'Local render not found.'}, {status: 404});
		}

		return NextResponse.json({
			done: state.stage === 'done',
			overallProgress: state.stage === 'done' ? 1 : state.stage === 'error' ? 0 : ('progress' in state ? state.progress : 0),
			framesRendered: 'renderedFrames' in state ? state.renderedFrames : 0,
			fatalErrorEncountered: state.stage === 'error',
			errors: state.stage === 'error' ? [state.error] : [],
			outputFile: state.stage === 'done' ? state.outputFile : null,
		});
	}

	if (!functionName || !region) {
		return NextResponse.json({error: 'Remotion Lambda is not configured on this deployment.'}, {status: 500});
	}

	try {
		const {getRenderProgress} = await import('@remotion/lambda/client');
		const progress = await getRenderProgress({renderId, bucketName, functionName, region});

		return NextResponse.json({
			done: progress.done,
			overallProgress: progress.overallProgress,
			framesRendered: progress.framesRendered,
			fatalErrorEncountered: progress.fatalErrorEncountered,
			errors: progress.errors.map((e) => e.message),
			outputFile: progress.outputFile,
		});
	} catch (err) {
		console.error('Failed to fetch render progress', err);
		return NextResponse.json(
			{error: err instanceof Error ? err.message : 'Failed to fetch render progress.'},
			{status: 500},
		);
	}
}
