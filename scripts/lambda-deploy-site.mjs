// Bundles the Remotion project and uploads it to S3, where the Lambda
// function reads it from at render time. Re-run this after any change under
// src/ or public/ — the deployed serveUrl is a snapshot, not a live reload.
//
// Requires REMOTION_AWS_ACCESS_KEY_ID / REMOTION_AWS_SECRET_ACCESS_KEY set in
// the shell environment.
//
//   REMOTION_AWS_ACCESS_KEY_ID=... REMOTION_AWS_SECRET_ACCESS_KEY=... \
//     npm run lambda:deploy-site -- --region=us-east-1

import {deploySite, getOrCreateBucket} from '@remotion/lambda';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');

const regionArg = process.argv.find((a) => a.startsWith('--region='));
const region = regionArg ? regionArg.split('=')[1] : 'us-east-1';

const {bucketName} = await getOrCreateBucket({region});

const {serveUrl} = await deploySite({
	entryPoint: path.join(rootDir, 'src', 'index.ts'),
	bucketName,
	region,
	siteName: 'insta-dm-reel',
	options: {
		onBundleProgress: (progress) => {
			process.stdout.write(`\rBundling... ${progress}%`);
		},
		onUploadProgress: ({totalFiles, filesUploaded}) => {
			process.stdout.write(`\rUploading... ${filesUploaded}/${totalFiles} files`);
		},
	},
});

console.log(`\n\nSite deployed: ${serveUrl}`);
console.log('\nSet this in Vercel (and in your local .env for testing):');
console.log(`REMOTION_LAMBDA_SERVE_URL=${serveUrl}`);
console.log(`REMOTION_LAMBDA_REGION=${region}`);
