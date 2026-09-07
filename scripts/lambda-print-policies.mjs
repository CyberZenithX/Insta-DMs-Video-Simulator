// Prints the exact IAM policy JSON this installed version of @remotion/lambda
// expects, straight from the package — not copy-pasted from docs that can
// drift out of sync with the pinned version.
//
//   npm run lambda:print-policies

import {getUserPolicy, getRolePolicy} from '@remotion/lambda/policies';

console.log('=== Attach to the IAM user you deploy with (inline policy) ===\n');
console.log(getUserPolicy());
console.log('\n=== Attach to the "remotion-lambda-role" execution role (inline policy) ===\n');
console.log(getRolePolicy());
console.log(
	'\nThe role must be named exactly "remotion-lambda-role" — the user policy above only grants iam:PassRole for that exact name.',
);
