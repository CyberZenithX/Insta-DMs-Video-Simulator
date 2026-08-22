/** @type {import('next').NextConfig} */
const nextConfig = {
	// The pre-bundled Remotion project (built by `npm run bundle:remotion`) is
	// read from disk at render time via fs, not via import/require, so Next's
	// file tracer can't discover it on its own — it has to be told explicitly
	// or Vercel will prune it from the deployed function.
	experimental: {
		outputFileTracingIncludes: {
			'/api/render': ['./remotion-bundle/**'],
		},
		// @remotion/renderer's browser/CDP layer (ws, and friends) breaks when
		// webpack tries to bundle it for the serverless function — keep it a
		// normal Node require() instead.
		serverComponentsExternalPackages: ['@remotion/renderer', '@sparticuz/chromium'],
	},
};

// package.json has "type": "module", so this file is loaded as ESM.
export default nextConfig;
