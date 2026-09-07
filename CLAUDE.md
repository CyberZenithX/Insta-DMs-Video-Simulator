# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A fake-Instagram-DM **Reel generator**. `src/` is a Remotion project that animates a scripted DM conversation as a 1080×1920 video; `app/` is a Next.js UI wrapped around it (live preview + a "Generate MP4" button that renders server-side). Deploy target is Vercel. Actual rendering happens one of two ways — see "Two render backends" below.

## Commands

```bash
npm run dev              # Next.js dev server (UI + /api/render)
npm run build            # bundle:remotion, THEN next build — order matters
npm start                # serve the production build (requires npm run build first)
npm run bundle:remotion  # rebuild only the Remotion bundle that /api/render serves
npm run studio           # Remotion Studio — visual timeline/props editor for the composition
npm run typecheck        # tsc --noEmit

npm run lambda:print-policies    # print the exact IAM policy JSON for this Remotion version
npm run lambda:deploy-function   # deploy (or reuse) the AWS Lambda function that renders frames
npm run lambda:deploy-site       # bundle src/ and upload it to S3; run again after any src/ change
```

`/api/render` reads a pre-built bundle from `remotion-bundle/` on disk. If that directory is missing the route returns a 500 telling you to build. After changing anything under `src/`, re-run `npm run bundle:remotion` or the API will keep serving the stale bundle — the Next dev server will not pick up composition changes on its own. **This bundle is only used by local-render mode** — Lambda mode reads the separately-deployed S3 site instead, so a `src/` change also needs `npm run lambda:deploy-site` re-run before it shows up there.

The three `lambda:*` scripts need `REMOTION_AWS_ACCESS_KEY_ID`/`REMOTION_AWS_SECRET_ACCESS_KEY` set in the shell (an IAM user with the policy from `lambda:print-policies`) — never commit these. See `spec.md` → "Environment variables (Lambda mode)" for the full list of what the deployed app itself needs, or `AWS_LAMBDA_SETUP.md` for the full step-by-step account setup (doubles as an AWS primer).

### There are no tests

No test framework is configured and there is no `npm test`. Verification is done by rendering and looking at the output:

```bash
# single frame — the fastest way to check a layout/color change
npx remotion still src/index.ts IgDmReel out.png --frame=250

# with overridden props
echo '{"theme":"sweets"}' > /tmp/props.json
npx remotion still src/index.ts IgDmReel out.png --frame=250 --props=/tmp/props.json

# full video
npm run render:cli -- src/index.ts IgDmReel out.mp4
```

`SafeZoneGrid` is a second composition that renders a calibration grid plus the regions Instagram's own UI covers — render it when changing anything positional.

## Architecture

### The determinism contract

**Every visual is a pure function of `frame`.** No timers, no animation-driving effects, no randomness. Two renders of the same frame are byte-identical (this has been verified and is worth preserving). If you find yourself reaching for `useEffect` or `Date.now()` to move something, that's the wrong layer — derive it from `frame` instead.

### Layout pipeline

`TimelineEvent[]` → `buildSlots()` → `computeFrameLayout(frame)` → `RenderRow[]` → `<Bubble>` (all in `src/lib/timeline.ts`).

Two things about this are non-obvious:

- **Slots, not messages.** A `typing` event and the `them` message that follows it collapse into one *slot* with two *phases*. The bubble morphs from three-dots into the real message in place — the stack doesn't grow by one and shrink by one.
- **One spring drives two things.** The newest bubble's entrance/resize *and* the scroll retarget are lerped by the same spring value `v`. `computeFrameLayout` computes the stack's cumulative bottom "before" and "after" the current event and interpolates between the two scroll targets. This is deliberate: the stack shift and the bubble pop are one motion. Don't split them into independently-timed animations.

### Text measurement gates rendering

Bubble size is measured, not guessed: canvas `measureText` → greedy word wrap → bubble dimensions → cumulative stack position → scroll offset. Every downstream number depends on it, so **the font must be loaded before any measuring happens**. `useInterFontReady()` (`src/lib/font.ts`) holds Remotion's `delayRender` until self-hosted Inter is ready, and `IgDmReel` renders a black frame until then. Removing that gate silently corrupts all layout.

### Geometry is calibrated, not designed

`src/tokens.ts` holds ratios measured off `references/dm-real.jpeg` (a real Instagram DM screenshot at 1080px wide). Treat those numbers as measurements — if a bubble looks wrong, re-check against the reference image rather than nudging values by eye. `references/reels-overlay.jpg` is the equivalent reference for where Instagram's floating Reels UI sits.

### Full-bleed, and `safeZones` is informational only

The composition fills the entire 1080×1920 canvas like a real screen recording. `safeZones` describes where Instagram's like/comment/share rail and caption float *on top of* a posted Reel — it is consumed only by `SafeZoneGrid` for calibration. It must **not** be used to shrink the rendered canvas; doing so bakes a permanent blank strip into the exported video (this was a real bug, see `decisions.md`).

### Color

One master gradient is sampled per-bubble by that bubble's *live viewport position* each frame (`src/gradient.ts`), so sent bubbles shift color as they scroll rather than each being flatly tinted. Themes (`src/themes.ts`, sampled from Instagram's own Theme picker) swap the stops for both the chat backdrop and the bubbles — but sent bubbles use a **darkened** copy of the theme's stops, or they'd blend invisibly into a same-hue background.

### Emoji are images, not font glyphs

The system emoji font is bypassed. `src/emoji/parse.ts` tokenizes emoji out of message text and maps each to a Noto Color Emoji filename by codepoint (`👀` → `emoji_u1f440.png`), served from `public/emoji/`. **Adding an emoji to a script requires adding the matching PNG** — otherwise it 404s mid-render and the render fails. Only a handful are currently vendored.

### Two render backends

`/api/render` (`app/api/render/route.ts`) picks its render backend at request time based on one env var, `REMOTION_LAMBDA_FUNCTION_NAME`:

- **Set → Lambda mode.** `renderMediaOnLambda()` (from `@remotion/lambda/client` — deliberately *not* the full `@remotion/lambda`, which pulls in `@remotion/renderer`/`@remotion/bundler` types) kicks off an async render on AWS Lambda and returns in well under a second. The client then polls `GET /api/render/progress`, which is equally fast. **No request in this whole flow — not the Vercel function, not the browser's fetch — ever needs to stay open for as long as the render takes.** This is what actually solves "a render can take minutes, but nothing should have to wait on one open connection for minutes," rather than just making the wait more legible (that was the NDJSON-streaming fallback below, solved at the UI layer only).
- **Unset → local-render mode** (the original design, still what `npm run dev` uses without any AWS setup). Renders in-process using `@remotion/renderer` directly against the bundle in `remotion-bundle/`, streaming NDJSON progress over one held-open connection — this is the thing Lambda mode exists to avoid needing in production, but it's a fine fallback for local iteration.

Both branches build the same `IgDmReelProps` from the same request body first (theme/receiver/clock/messages → `buildEventsFromScript()` → validated against `igDmReelPropsSchema`) — the branch only decides how that gets rendered, not what. `@remotion/renderer` and `@sparticuz/chromium` are dynamically imported *inside* the local-render branch specifically so that Lambda mode's cold start never evaluates them at all.

Lambda deploys are managed by `scripts/lambda-deploy-function.mjs` / `scripts/lambda-deploy-site.mjs`, run manually (never as part of `npm run build`) — see the Commands section above and `spec.md` for the full env var contract.

### Next.js layer — five load-bearing gotchas (local-render mode)

These only apply when local-render mode is in play — either because Lambda isn't configured, or because you're running `npm run dev`. They're all fixes for real failures; changing them will break the build or the render:

1. **Anything imported by `app/api/render/route.ts` must not import the `remotion` React barrel.** That's why `src/data/defaultProps.ts` hardcodes `'/avatar-demo.svg'` instead of calling `staticFile()`. Violating this fails the Next server build with `React.createContext is undefined`.
2. **`serverComponentsExternalPackages`** (`next.config.js`) keeps `@remotion/renderer` and `@sparticuz/chromium` out of webpack — bundling mangles their CDP/websocket and native code.
3. **`scripts/bundle-remotion.mjs` flattens `public/` into the bundle root.** `bundle()` nests assets under `public/`, but a local-directory `serveUrl` is served verbatim at root while `staticFile()` returns unprefixed paths. Without the flatten, every asset 404s at render time.
4. **`outputFileTracingIncludes`** keeps Vercel from pruning two things out of the deployed function: `remotion-bundle/`, and Remotion's **compositor binaries**. The compositor package's `index.js` is only `exports.dir = __dirname` — the renderer requires it to get a directory, then reads `remotion`, `ffmpeg`, and ~22MB of `libav*.so` from that path at runtime. The tracer keeps the JS shim and prunes every binary, and the function dies with `ENOENT ... /compositor-linux-x64-gnu/remotion`.
5. **`outputFileTracingExcludes` drops `node_modules/.remotion/`.** Rendering locally makes Remotion download its own Chrome Headless Shell there (~243MB). On Vercel the browser is `@sparticuz/chromium`, so that copy is dead weight and would push the function past Vercel's 250MB limit. Keep the deployed function around ~94MB.

Browser selection is environment-sensitive: locally Remotion uses its own managed Chrome; when `VERCEL`/`AWS_LAMBDA_FUNCTION_NAME` is set it falls back to `@sparticuz/chromium`.

### Shared timing between preview and render

`src/lib/scriptToEvents.ts` turns a plain `{from, text}[]` script into a timed event list (typing beats + length-scaled read pauses). Both `app/page.tsx` (live preview) and `app/api/render/route.ts` (server render) call it, so the preview can't drift from the output. Keep it that way — don't reimplement timing on one side.

The web UI exposes only a subset of `IgDmReelProps` (theme, receiver, clock, message script). `background`, `safeZones`, `scrollAnchor`, `spring`, and reaction events are reachable only through Remotion Studio or the CLI.
