// Shared gate: does this build need the local (in-process) Remotion renderer?
//
// The app supports both AWS Lambda and local in-process rendering.
// Local rendering requires remotion-bundle/ and @sparticuz/chromium (on Vercel),
// totaling ~94MB in function size (well within Vercel's 250MB limit).
export const isLocalRenderEnabled = () => !process.env.DISABLE_LOCAL_RENDER;

