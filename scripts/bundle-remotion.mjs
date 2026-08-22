import {bundle} from '@remotion/bundler';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');
const outDir = path.join(rootDir, 'remotion-bundle');

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
