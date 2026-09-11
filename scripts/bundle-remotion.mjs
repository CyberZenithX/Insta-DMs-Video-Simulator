import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {isLocalRenderEnabled} from './local-render-enabled.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');
const outDir = path.join(rootDir, 'remotion-bundle');

if (!isLocalRenderEnabled()) {
	// Remotion Lambda is configured for this Vercel build
	// (REMOTION_LAMBDA_FUNCTION_NAME set) — production renders on AWS Lambda
	// from its own separately-deployed S3 site (npm run lambda:deploy-site),
	// never from this bundle. Building it anyway would ship a Remotion
	// webpack bundle, @sparticuz/chromium, and the native compositor into the
	// Vercel function for a code path (renderLocally() in
	// app/api/render/route.ts) that never runs there. See
	// next.config.js / scripts/local-render-enabled.mjs for the matching
	// file-tracing exclusion.
	fs.rmSync(outDir, {recursive: true, force: true});
	console.log(
		'Skipping Remotion bundle: REMOTION_LAMBDA_FUNCTION_NAME is set on Vercel, so the local-render fallback is pruned from this build.',
	);
	process.exit(0);
}

// Imported lazily, after the skip check above, so a Lambda-only Vercel build
// never even loads @remotion/bundler.
const {bundle} = await import('@remotion/bundler');

fs.rmSync(outDir, {recursive: true, force: true});

await bundle({
	entryPoint: path.join(rootDir, 'src', 'index.ts'),
	outDir,
	onProgress: (progress) => {
		process.stdout.write(`\rBundling Remotion project for server-side rendering... ${progress}%`);
	},
});

// bundle() copies public/ into <outDir>/public, but renderMedia/selectComposition
// serve a local-directory serveUrl verbatim at root (no public/ merging) — while
// staticFile() always returns unprefixed paths like "/avatar-demo.svg". Flatten
// public/ into the bundle root too so both forms resolve.
const publicDir = path.join(outDir, 'public');
if (fs.existsSync(publicDir)) {
	fs.cpSync(publicDir, outDir, {recursive: true});
}

console.log(`\nRemotion bundle written to ${outDir}`);
