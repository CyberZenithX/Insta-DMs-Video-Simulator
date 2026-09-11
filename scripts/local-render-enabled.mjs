// Shared gate: does this build need the local (in-process) Remotion renderer?
//
// Off only when deploying to Vercel with Remotion Lambda configured
// (REMOTION_LAMBDA_FUNCTION_NAME set — the same env var
// app/api/render/route.ts's isLambdaConfigured() checks at runtime). In that
// case production never executes renderLocally(): every request goes down
// the Lambda branch instead. Shipping @sparticuz/chromium, the native
// compositor binaries, and the bundled Remotion project for a code path that
// never runs is what was inflating the deployed function to ~94MB.
//
// Keyed off the same env var route.ts already checks, so this self-
// configures — there's no separate setting to keep in sync, and a
// deployment that unsets Lambda gets the local renderer back automatically
// on its next build.
//
// `npm run dev` / `next start` are unaffected either way: this only
// controls what next.config.js tells Vercel's file tracer to package into
// the deployed function, and whether scripts/bundle-remotion.mjs bothers
// building remotion-bundle/ — not what Node can resolve from node_modules
// on disk locally.
export const isLocalRenderEnabled = () => !(process.env.VERCEL && process.env.REMOTION_LAMBDA_FUNCTION_NAME);
