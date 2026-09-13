// Deploys (or re-uses) the AWS Lambda function that actually renders frames.
// Run once per region, and again after upgrading the @remotion/lambda version
// pinned in package.json — the deployed function's Remotion version must
// match this project's, or renders fail with a version-mismatch error.
//
// Requires REMOTION_AWS_ACCESS_KEY_ID / REMOTION_AWS_SECRET_ACCESS_KEY (an
// IAM user with the policy from `npm run lambda:print-policies`) set in the
// shell environment. Never put these in a committed file.
//
//   REMOTION_AWS_ACCESS_KEY_ID=... REMOTION_AWS_SECRET_ACCESS_KEY=... \
//     npm run lambda:deploy-function -- --region=us-east-1
//
// Optional tuning flags: --timeout=<seconds> --memory=<MB> --disk=<MB>.
//
// IMPORTANT: all three of those values are encoded in the deployed function's
// *name* (remotion-render-<version>-mem<M>mb-disk<D>mb-<T>sec). Changing any
// of them therefore deploys a brand-new function rather than updating the
// existing one, and REMOTION_LAMBDA_FUNCTION_NAME has to be repointed at the
// new name before the change takes effect. This script prints every other
// Remotion function it finds in the region afterwards so stale ones are
// visible.

import {deployFunction, getFunctions} from '@remotion/lambda';

const flag = (name, fallback) => {
	const arg = process.argv.find((a) => a.startsWith(`--${name}=`));
	if (!arg) return fallback;
	const value = arg.slice(name.length + 3);
	if (typeof fallback === 'number') {
		const n = Number(value);
		if (!Number.isInteger(n) || n <= 0) {
			throw new Error(`--${name} must be a positive integer, got "${value}".`);
		}
		return n;
	}
	return value;
};

const region = flag('region', 'us-east-1');

// The main function has to stay alive for the *entire* render — it fans the
// frames out to the renderer invocations, waits for every chunk, then stitches
// them. So this timeout is a hard ceiling on total render wall time, not on
// any one step, and each renderer invocation separately has to finish its own
// chunk within it. At 120s (the previous value here) a ~68s 1080x1920 reel
// could not finish under any frames-per-lambda setting: small chunks need more
// concurrency than a fresh AWS account's quota allows, and large chunks blow
// the renderer's own budget. 900s is AWS Lambda's maximum, and costs nothing
// extra — Lambda bills for time actually used, so a render that finishes in
// 90s is billed the same under a 900s timeout as under a 120s one.
const timeoutInSeconds = flag('timeout', 900);
// Lambda allocates CPU in proportion to memory, so this is really a speed
// dial. 2048MB is Remotion's recommended cost/speed sweet spot; raising it
// makes each chunk finish sooner, which matters more than usual when a low
// concurrency quota forces few, long chunks.
const memorySizeInMb = flag('memory', 2048);
// Ephemeral /tmp, where each renderer writes its chunk and the main function
// assembles the final MP4. Anything above 512MB is billed, so this stays at
// Remotion's default unless a longer video needs more.
const diskSizeInMb = flag('disk', 2048);

const {functionName, alreadyExisted} = await deployFunction({
	region,
	timeoutInSeconds,
	memorySizeInMb,
	diskSizeInMb,
	createCloudWatchLogGroup: true,
});

console.log(alreadyExisted ? 'Function already existed:' : 'Function deployed:');
console.log(functionName);
console.log(`  timeout ${timeoutInSeconds}s · memory ${memorySizeInMb}MB · disk ${diskSizeInMb}MB`);
console.log('\nSet this in Vercel (and in your local .env for testing):');
console.log(`REMOTION_LAMBDA_FUNCTION_NAME=${functionName}`);
console.log(`REMOTION_LAMBDA_REGION=${region}`);

// A settings change renames the function, so the old one is still sitting
// there and REMOTION_LAMBDA_FUNCTION_NAME is still pointing at it. Say so
// explicitly rather than letting the next render quietly use the old settings.
const others = (await getFunctions({region, compatibleOnly: false})).filter(
	(f) => f.functionName !== functionName,
);

if (others.length > 0) {
	console.log(
		`\nHeads up — ${others.length} other Remotion function(s) exist in ${region}:`,
	);
	for (const f of others) {
		console.log(`  ${f.functionName}  (timeout ${f.timeoutInSeconds}s · memory ${f.memorySizeInMb}MB)`);
	}
	console.log(
		'\nRenders keep using whichever one REMOTION_LAMBDA_FUNCTION_NAME names, so update it\n' +
			'above before re-testing. Delete the stale ones once nothing points at them:\n' +
			`  npx remotion lambda functions rm <name> --region=${region}`,
	);
}
