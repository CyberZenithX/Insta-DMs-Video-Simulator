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

import {deployFunction} from '@remotion/lambda';

const regionArg = process.argv.find((a) => a.startsWith('--region='));
const region = regionArg ? regionArg.split('=')[1] : 'us-east-1';

const {functionName, alreadyExisted} = await deployFunction({
	region,
	timeoutInSeconds: 120,
	memorySizeInMb: 2048,
	createCloudWatchLogGroup: true,
});

console.log(alreadyExisted ? 'Function already existed:' : 'Function deployed:');
console.log(functionName);
console.log('\nSet this in Vercel (and in your local .env for testing):');
console.log(`REMOTION_LAMBDA_FUNCTION_NAME=${functionName}`);
console.log(`REMOTION_LAMBDA_REGION=${region}`);
