/** @type {import('next').NextConfig} */
const nextConfig = {
	// The pre-bundled Remotion project (built by `npm run bundle:remotion`) is
	// read from disk at render time via fs, not via import/require, so Next's
	// file tracer can't discover it on its own — it has to be told explicitly
	// or Vercel will prune it from the deployed function.
	experimental: {
		outputFileTracingIncludes: {
			'/api/render': [
				'./remotion-bundle/**',
				// Remotion's compositor ships a native binary (`remotion`), ffmpeg/
				// ffprobe, and ~22MB of libav*.so. Its index.js is only
				// `exports.dir = __dirname` — the renderer requires it to get a
				// directory and then reads those files by path at runtime. So the
				// tracer keeps index.js and prunes every actual binary, and the
				// function dies with ENOENT on .../compositor-linux-x64-gnu/remotion.
				//
				// Vercel's Node runtime is glibc x64, so only the gnu build is
				// needed; the musl build would add ~24MB to a function that already
				// carries @sparticuz/chromium.
				'./node_modules/@remotion/compositor-linux-x64-gnu/**',
			],
		},
		outputFileTracingExcludes: {
			// When Remotion renders locally it downloads its own Chrome Headless
			// Shell into node_modules/.remotion (~243MB). On Vercel the browser is
			// @sparticuz/chromium instead, so that copy is dead weight — and
			// shipping both would push the function past Vercel's 250MB limit.
			// A Vercel build doesn't normally trigger the download, but exclude it
			// so a stray local copy can never leak into the deployed function.
			'/api/render': ['**/node_modules/.remotion/**'],
		},
		// @remotion/renderer's browser/CDP layer (ws, and friends) breaks when
		// webpack tries to bundle it for the serverless function — keep it a
		// normal Node require() instead.
		serverComponentsExternalPackages: ['@remotion/renderer', '@sparticuz/chromium'],
	},
};

// package.json has "type": "module", so this file is loaded as ESM.
export default nextConfig;
