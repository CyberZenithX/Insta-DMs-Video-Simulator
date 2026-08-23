# Decisions

Why things are the way they are. Most of these look arbitrary from the outside and were expensive to arrive at — check here before "cleaning up" something in this list.

## Composition

### Everything is a pure function of `frame`

No timers, no effects driving animation, no randomness anywhere in the render path. This is what makes two renders of the same frame byte-identical, which in turn is what makes visual regressions detectable at all. It's the constraint the whole `src/lib/timeline.ts` design exists to satisfy.

### Typing and its message are one slot, not two

A `typing` event and the `them` message following it collapse into a single slot with two phases. The alternative — a typing bubble that unmounts and a message bubble that mounts — makes the stack grow then shrink, which reads as a visible jolt. As phases, the bubble resizes and crossfades in place.

### A typing event has no independent lifetime — pair it or drop it

This follows directly from the above, and it is the rule that keeps the stack correct. **A typing event is only ever a preamble to a message bubble's entrance.** Nothing else retires it: a slot whose only phase is `typing` stays visible for every subsequent frame, and `durationSec` is not read by `buildSlots` at all. So a typing event that cannot be paired with a following `them` message must produce **no slot at all**. Rendering it "just in case" strands a dots bubble in the stack permanently.

Pairing is resolved by **lookahead** — for each typing event, find the next message event and keep the pairing only if that message is from `them`. It must not be done with a mutable "pending typing" pointer. That was the original implementation and it shipped two distinct visible bugs, because the pointer was only cleared on the `them` branch:

- **Stranded dots.** Next message from `me` → merge branch skipped → pointer never cleared → the typing slot never received its message phase and its bubble sat among older messages for the rest of the video. `buildEventsFromScript` emitted a typing beat before *every* message, so a normal 4-message script stranded two; `demoEvents` stranded three.
- **Out-of-order messages.** The stale pointer stayed live, so a much later `them` message merged into a typing slot from earlier in the array and rendered at the wrong stack position. In `demoEvents` this put "the notification bug thing" (t=3.6) above "seen what 👀" (t=2.3).

The lookahead rule also covers, with no extra code, a dangling typing event with nothing after it and the earlier of two consecutive typing events. Slots are sorted by first-phase frame so stack order is order of appearance, not order of message time — a merged slot enters the stack when its *typing* phase starts.

### You never see your own typing indicator

Real Instagram doesn't show you your own typing bubble in your own chat, so a `me` typing beat is **pacing only**: it advances the timeline without drawing anything. The typing event schema carries an optional `from` (default `'them'`) to make that explicit rather than inferred.

`buildEventsFromScript` still *spends* the same beat before a `me` message — you were composing it — so removing the bubble left pacing byte-for-byte unchanged. Don't "fix" the asymmetry by emitting `me` typing bubbles again; that is the bug above.

### One spring drives both the bubble and the scroll

The newest bubble's entrance/resize and the scroll retarget are interpolated by the same spring value. Two independently-timed animations, however carefully tuned, drift apart and read as two separate events. `computeFrameLayout` computes the stack's cumulative bottom both before and after the current event and lerps between the two scroll targets with that one value.

### Layout is measured, not estimated

Canvas `measureText` drives wrap → bubble size → stack position → scroll offset. Estimating character widths was never attempted because every downstream number compounds the error.

The consequence is a hard ordering requirement: **font before measurement**. `useInterFontReady()` holds `delayRender` until self-hosted Inter loads, and the composition renders black until then. It looks like a removable loading gate. It isn't — remove it and every bubble is silently mis-sized.

### Inter is self-hosted, not fetched from Google Fonts

A render-time CDN dependency is a flaky foundation for a pipeline whose whole value proposition is determinism, and the headless render target has no guaranteed trusted path to the CDN. The woff2 files live in `public/fonts/`.

### Emoji are PNG assets, not font glyphs

System emoji fonts vary by platform and render host, which breaks determinism and makes output look different depending on where it rendered. Emoji are tokenized out of message text and substituted with Noto Color Emoji PNGs keyed by codepoint.

The tradeoff, worth knowing before writing scripts: **an emoji without a vendored asset fails the render.** There's no fallback path. Only a handful are currently in `public/emoji/`.

### Geometry is ratios of frame width, calibrated from a real screenshot

`src/tokens.ts` numbers are measurements taken off `references/dm-real.jpeg` at 1080px, expressed as ratios so a resolution change doesn't invalidate them. They're data, not design choices — when something looks off, re-measure against the reference rather than nudging by eye.

## The full-bleed fix

### The bug

The mockup rendered at `phoneWidthRatio = 0.76`, pinned to `left: 0`, leaving ~24% of the canvas as opaque background — baked permanently into the exported video pixels.

The original intent was that Instagram's floating like/comment/share rail would cover that gutter once posted. But that reasoning doesn't survive contact with reality: Instagram draws its chrome *on top of* a full-bleed video, it doesn't fill in blank space you leave for it. Anywhere the floating UI isn't drawn — the upload preview screen, a shared file, the grid — the strip is just visibly missing content. It also contradicted the composition's own calibration comment, which correctly described the geometry as measured at full 1080px width.

### The fix, and the invariant it establishes

The composition now fills the whole canvas like a real screen recording. **`safeZones` is informational only** — consumed by `SafeZoneGrid` to visualize where Instagram's chrome lands, never to shrink the canvas. If you find yourself multiplying the canvas width by a safe-zone value, that's the bug coming back.

### What this doesn't solve

Right-aligned sent bubbles now occupy roughly the same region as Instagram's icon rail. This is a genuine tension with no clean answer: bubbles hard against the right edge is what the real reference screenshot shows, but that's also exactly where the rail floats. Left as-is (favoring authenticity) and flagged rather than silently traded away. `SafeZoneGrid` visualizes the overlap.

### A side effect nobody has hit yet: `background` is currently inert

`<Background background={background} />` renders first in `IgDmReel`, correctly, for all four `kind`s. But `<PhoneFrame>` renders immediately after it — full-bleed as of this fix, and opaque (`colors.chatBackground` for `theme: 'none'`, a theme gradient otherwise) — so it paints over the entire canvas on every frame. `background`'s pixels are never visible, in any configuration, including `kind: 'solid'` with `theme: 'none'`: `chatBackground` is a hardcoded token, not `background.value`, so even that "trivial" case doesn't pass through.

This was true the moment full-bleed shipped and nobody has needed to touch `background` since, so it's undiscovered rather than accepted. Not fixed here because the right fix isn't obvious: either `PhoneFrame`'s classic-mode fill should defer to `background.value` instead of the hardcoded token, or `background` should be retired as a prop now that `theme` covers the real use case. Whoever picks this up should decide which, not silently wire one in.

## Themes

### Sampled, not eyeballed

The 9 gradients were extracted by pixel-sampling top/middle/bottom of each swatch in a screenshot of Instagram's Theme picker, not matched by eye.

### Sent bubbles use a *darkened* copy of the theme gradient

Bubbles sample the same master gradient as the backdrop behind them — the trick that makes them shift color as they scroll. Against the classic flat-black chat that reads fine. Against a themed background of the same hue, the bubble effectively disappears: same color, same position, no visible pill, just floating text.

This was caught by actually looking at a render, not by reading the code — the logic is "correct" in both cases. Fixed by darkening the theme's stops ~45% for bubbles only, which preserves the hue and the scroll-tinted motion while restoring contrast. `theme: 'none'` keeps the original hand-tuned magenta→purple→blue stops and the flat black background.

## Web layer

### Next.js over a bare preview page

Chosen so the live `@remotion/player` preview and real MP4 rendering could live in one deployable app, which is what was actually asked for.

Worth knowing: **Vercel is not Remotion's recommended cloud render target** — that's Remotion Lambda (AWS) or Cloud Run. Rendering video means running headless Chrome and encoding frames, which fights serverless execution-time and binary-size limits. This works, but it's the community pattern, not the blessed one. If render reliability becomes a problem, migrating `/api/render` to Remotion Lambda is the escape hatch rather than fighting Vercel's limits.

### Bundle at build time, not per request

`scripts/bundle-remotion.mjs` runs during `npm run build` so `/api/render` only has to serve an existing bundle. Bundling per request would add ~10s to every call. The cost is that `src/` changes require a re-bundle — the Next dev server won't pick them up on its own.

### Timing logic is shared, deliberately

`src/lib/scriptToEvents.ts` is called by both the live preview and the render route. Two implementations of "how long is the typing beat" would drift, and the preview silently lying about the output is the worst possible failure for this tool.

### Six fixes that look like cruft but aren't

Each of these is a real failure that was hit and diagnosed:

1. **`defaultProps.ts` stores the avatar as a plain root path instead of calling `staticFile()`.** Anything the API route imports must not pull in the `remotion` React barrel — the Next server build dies with `React.createContext is undefined`.

   The asset path then differs by context, and all three must keep working: the Next `<Player>` preview and `/api/render` (whose bundle has `public/` flattened into it) both serve `public/` at root, so `/avatar-demo.svg` is right for them; **Studio and the `remotion` CLI set `window.remotion_staticBase` and need `staticFile()`**, which returns a prefixed path. `Root.tsx` is the Studio/CLI entry point and may import the barrel, so it applies `staticFile()` there. An earlier version hardcoded the bare path everywhere on the incorrect assumption that `staticFile()` resolves to it — the deployed site was fine, but Studio and CLI renders showed a broken avatar.
2. **`serverComponentsExternalPackages`** for `@remotion/renderer` and `@sparticuz/chromium`. Webpack bundling mangles their CDP/websocket layer — the symptom was a cryptic `t.mask is not a function` at render time.
3. **The `public/` flatten in `bundle-remotion.mjs`.** `bundle()` writes assets under `<outDir>/public/`, but a local-directory `serveUrl` is served verbatim from root, while `staticFile()` returns unprefixed paths. Mismatch means every asset 404s mid-render. Copying `public/` up to the bundle root satisfies both.
4. **`outputFileTracingIncludes`.** The bundle is read via `fs` at runtime, not imported, so Next's tracer can't discover it and Vercel prunes it from the deployed function.

   The same include also carries **Remotion's compositor** — the native Rust binary plus ffmpeg/ffprobe and ~22MB of `libav*.so` that do the actual frame extraction and encoding. `@remotion/compositor-linux-x64-gnu/index.js` is literally `exports.dir = __dirname`: the renderer requires the package only to learn a directory, then reads the executables from that path. So the tracer follows the require, keeps the 25-byte shim, prunes every binary, and the deployed function fails at render time with `ENOENT: ... /compositor-linux-x64-gnu/remotion`. Only the **gnu** build is included — Vercel's Node runtime is glibc x64, and the musl build would add ~24MB to a function that already carries Chromium.

5. **`getBrowserExecutable` sets `AWS_LAMBDA_JS_RUNTIME` itself before importing `@sparticuz/chromium`.** Surfaced by a live-site render failing with a bare `Failed to launch the browser process! ... Closed with 127 signal: null` — no filename, no missing-library name, nothing actionable in the message itself.

   `@sparticuz/chromium`'s own module-load code decides whether it's inside a Lambda-like sandbox by checking `AWS_EXECUTION_ENV` / `AWS_LAMBDA_JS_RUNTIME` (`build/helper.js`), and only if one of those is set does it extract its bundled glibc-compat shared libraries (`libnss3.so`, `libnspr4.so`, and the rest of `al2023.tar.br`) and point `LD_LIBRARY_PATH` at them (`build/index.js`, top-level, and again inside `executablePath()`). Vercel's Node runtime never sets either var, even though it *is* a Lambda-like sandbox — confirmed by reproducing it locally: importing the package with those env vars unset extracts `chromium` itself but never touches `/tmp/al2023/lib`, so the binary exists but its dynamic loader can't resolve its own dependencies. That's exactly what "closed with signal 127 and no other detail" looks like from Node's side — the child process never gets far enough to say what's missing.

   The package's own README points at exactly this pattern for Netlify (a similarly non-native Lambda serverless host): the integrator sets the env var itself so the package's existing Lambda-detection logic runs as designed, rather than the package trying to guess. `getBrowserExecutable` does the same — sets `AWS_LAMBDA_JS_RUNTIME` (keyed off `process.versions.node`'s major version, not a guess at which Vercel image is live) before the dynamic `import('@sparticuz/chromium')`, since the check that matters runs at module-load time. Verified by reproducing the before/after directly against the installed package: unset, `LD_LIBRARY_PATH` never gets set and `/tmp/al2023/lib` never gets created; with the var forced, both happen and the extracted directory contains `libnss3.so` et al. **Not yet confirmed against an actual Vercel redeploy** — see `progress.md`.

6. **`outputFileTracingExcludes` drops `node_modules/.remotion/`.** Rendering locally makes Remotion download its own Chrome Headless Shell into that directory — 122 files, ~243MB. Vercel doesn't use it (the browser there is `@sparticuz/chromium`), and shipping both would take the function from ~94MB to ~337MB, well past Vercel's 250MB uncompressed limit. A Vercel build doesn't normally trigger the download, so this is belt-and-braces — but the failure mode it prevents is a deploy that breaks only after someone happens to render locally before pushing, which is a miserable thing to debug.

   Worth knowing the limit is real and the headroom is not huge: Chromium (~61MB) plus the compositor (~23MB) is most of the ~94MB budget already.

### Render progress is a raw NDJSON stream, not SSE or a polling endpoint

The render UI needed a real progress bar — the previous "Rendering… this can take a minute" gave no sense of how long a tens-of-seconds wait would actually be. `RenderMediaOnProgress` already gives everything needed (`renderedFrames`, `progress`, `renderEstimatedTime`); the only question was how to get it from a single server request/response into the browser.

Two more conventional options were passed over:

- **A separate job-status endpoint** (`POST` to start, `GET` to poll progress, `GET` to fetch the result) needs server-side job state to survive between requests. Vercel serverless functions don't share memory across invocations, so this would need external storage (KV, a database) purely to hold progress for the duration of one render — real infrastructure for a problem that doesn't need it.
- **Server-Sent Events** are the standard tool for one-way server→client progress, but the payload here ends in one large binary (the MP4) that has to reach the client anyway, on the *same* request that reported progress on it — otherwise you're back to a second request and the job-state problem above.

Instead, `/api/render` returns one chunked HTTP response, streamed as newline-delimited JSON: stage/progress events as they happen, then the finished MP4 as a final base64-encoded line. `app/page.tsx` reads `res.body.getReader()` and buffers to newlines. This needs no server-side state at all — the entire "job" lives in the lifetime of one HTTP request — and needs no new infrastructure. The 400-validation path is untouched: invalid requests are still rejected before the stream ever opens, so they stay a plain synchronous JSON error.

The one thing this couldn't be verified against is Vercel's edge/CDN layer actually forwarding a chunked response promptly rather than buffering it — that's real infrastructure behavior, not application logic, and this sandbox can't reach `vercel.app` to check. If the progress bar doesn't move on the live site despite the browser launching and the render completing, that's the first thing to check — not the streaming code itself.

### Speed: only the redundant browser launch was touched

`selectComposition` and `renderMedia` each open their own headless browser by default — one call was doing two full Chrome launches for one render. Sharing a single instance via `openBrowser()` + `puppeteerInstance` removes one of them. This is safe to make unilaterally: it's strictly less work for identical output, not a quality/resource tradeoff.

`concurrency` (parallel rendering pages) and `jpegQuality` (per-frame JPEG encode quality) are the other two real levers, and both were deliberately left at Remotion's defaults. Both are tradeoffs, not pure wins: pushing `concurrency` up speeds rendering only if there's spare CPU/memory to do it with, and guessing wrong risks OOM-killing the function outright — worse than slow — on a memory budget (see the ~94MB *function size* budget above, which is a different constraint from the runtime memory `concurrency` would actually compete for, but the same theme: Vercel's limits are real and can't be tuned against blind). Lowering `jpegQuality` trades visible output quality for speed, which is a decision for whoever's actually watching the rendered video, not a default to silently change. Neither could be verified against real Vercel resource limits from this sandbox — tune these live, watching actual function memory/duration, not by guessing a number and hoping.

### Remotion pinned at 4.0.290 despite known CVEs

`extract-zip`, `webpack`, and `ws` carry advisories that only clear by bumping the whole Remotion toolchain to 4.0.515+. Left pinned to avoid destabilizing a render pipeline that had just been debugged into working. These are build/dev-time code paths, not exposed to arbitrary attacker input. Revisit deliberately, with time to re-verify renders afterward — not as a drive-by upgrade.

## Repository

### `main` was created from the feature branch's root commit

The repo had **zero branches** when this work started, so the feature branch became the de facto default and there was nothing to open a PR against.

First attempt created `main` as a true empty orphan branch; GitHub rejected the PR outright — no shared history. Fixed by resetting `main` to the feature branch's root commit (`be48984`, the reference images) and force-pushing, so the two share ancestry. Safe in this specific case because `main` was seconds old and nothing else could have been based on it. **Not** a pattern to repeat on a branch anyone else might have pulled.

### The branch keeps getting reused after its PR merges — check before pushing

This has happened twice: PR #1 merged, then a docs commit (`a124720`) got pushed straight onto the now-merged branch. PR #2 merged, then a fix commit (`30af321`, the compositor binaries) got pushed the same way. Both times the new commit was real, wanted work — just landed on stale history with no PR watching it.

Both were resolved the same way: `git rebase origin/main`, force-push (safe — the only unmerged content is the commit being rebased, and nothing else can be based on a branch this short-lived), open a new PR. Before pushing to `claude/references-instagram-screenshots-d36atz` for *any* reason, check whether its last PR already merged (`gh pr list --state merged` or the equivalent API call). If it has, rebase onto current `main` first — don't push onto the stale head and assume the next PR will sort itself out.
