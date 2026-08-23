# Progress

Status as of the session ending 2026-08-23.

## Latest

The app is **deployed and live on Vercel**. Three real bugs have now been found by actually using the deployed site (not just by reading code):

1. **Typing indicators stranded permanently in the message stack**, and — same root cause — **messages rendered out of chronological order**. See `decisions.md` → "A typing event has no independent lifetime." Fixed.
2. **`/api/render` failed on Vercel with `ENOENT ... compositor-linux-x64-gnu/remotion`.** Next's file tracer was pruning Remotion's native compositor binary from the deployed function. Fixed, and verified against the actual build trace manifest (not just "should work") that the binary ships and the function measures 93.8MB against Vercel's 250MB limit.
3. **`/api/render` failed on Vercel with `Failed to launch the browser process! ... Closed with 127 signal: null`.** Root-caused to `@sparticuz/chromium` never extracting its bundled glibc-compat shared libraries (`libnss3.so`, `libnspr4.so`, ...) or setting `LD_LIBRARY_PATH` on Vercel, because its own Lambda-sandbox detection keys off env vars (`AWS_EXECUTION_ENV` / `AWS_LAMBDA_JS_RUNTIME`) that Vercel's Node runtime never sets. Fixed by setting `AWS_LAMBDA_JS_RUNTIME` ourselves before importing the package — see `decisions.md` → "Six fixes that look like cruft but aren't", item 5. Verified locally against the installed package (before: `LD_LIBRARY_PATH` never set, libs never extracted; after: both happen) — **not yet confirmed against an actual Vercel redeploy.**

Also fixed a smaller, purely-web-layer bug found by reading `app/page.tsx` against the server's validation schema: clearing the **Receiver name** field left the live preview showing the fallback name (`Jordan`) but sent an empty string to `/api/render`, which the schema rejects (`min(1)`) — so **Generate MP4** would 400 with a confusing error even though the preview looked fine. Fixed by applying the same fallback before the request is sent. Also added `maxLength` to the receiver name/username/clock inputs so they can't silently exceed what the schema allows (40/40/8 chars) and get rejected only at submit time.

**None of the three render-pipeline fixes have been confirmed on the live site yet** — all are sitting in an open PR. See "Immediate next step" below before doing anything else.

## Where things stand

| | |
|---|---|
| Working branch | `claude/references-instagram-screenshots-d36atz` |
| Base branch | `main` |
| PR #1 | [merged](https://github.com/CyberZenithX/Insta-DMs-Video-Simulator/pull/1) — reference images through the web UI |
| PR #2 | [merged](https://github.com/CyberZenithX/Insta-DMs-Video-Simulator/pull/2) — typing fix + avatar-path fix |
| PR #3 | **[open](https://github.com/CyberZenithX/Insta-DMs-Video-Simulator/pull/3), needs merge + redeploy** — the compositor-binaries fix, the browser-launch (`AWS_LAMBDA_JS_RUNTIME`) fix, and the receiver-name validation fix |
| Working tree | clean, everything pushed |

**Before starting new work: check whether PR #3 has merged.** If it has and you need to push to this branch again, rebase onto current `main` first — do not push onto the old head. This has already happened twice; see `decisions.md` → "The branch keeps getting reused after its PR merges."

## Immediate next step

1. Merge PR #3.
2. Redeploy on Vercel (or wait for auto-deploy if connected).
3. On the live site: fill in the default script, click **Generate MP4**, confirm a valid MP4 downloads with no stranded typing bubbles and messages in chronological order.
4. If it still fails to launch the browser, check the error message shape first — a *different* error than the `Closed with 127 signal` one means the `AWS_LAMBDA_JS_RUNTIME` fix worked and something else is wrong; the same error means dig further into whether Vercel's underlying image actually matches AL2023 (try forcing `nodejs18.x`/AL2 instead, or pin an older `@sparticuz/chromium`).
5. Only after Generate MP4 actually produces a playable file is server-side rendering confirmed end to end. Everything under "Not verified" below is downstream of this.

## Done and verified

- **Reference screenshots** committed to `references/` — all geometry and theme colors are calibrated against them.
- **Remotion composition** (`IgDmReel`) renders a scripted DM conversation: typing bubbles that morph into messages, spring-driven scroll, scroll-position-sampled gradient, image-based emoji, reaction badges. Second composition `SafeZoneGrid` for calibration.
- **Full-bleed layout fix.** The mockup previously rendered at 76% width, left-aligned, baking a permanent blank strip into every export. Now fills the frame edge to edge. Verified by rendering stills before/after.
- **9 theme presets**, selectable via a `theme` prop. Verified each renders; sent-bubble contrast checked against every themed backdrop.
- **Frame determinism** re-confirmed after the layout changes — two renders of the same frame are byte-identical.
- **The typing/ordering fix**, rendered against the exact deployed default script at the frames that previously showed the bug: one typing bubble as the newest stack item, none stranded, chronological order correct.
- **The compositor-binaries fix**, verified against the built trace manifest: the native `remotion` binary and all seven `libav*.so` are present, the local Chrome Headless Shell contributes 0 bytes, function size 93.8MB.
- **The browser-launch fix**, verified against the installed `@sparticuz/chromium` package directly: without `AWS_LAMBDA_JS_RUNTIME` set, `LD_LIBRARY_PATH` is never touched and `/tmp/al2023/lib` (containing `libnss3.so`, `libnspr4.so`, etc.) never gets created; with it set the way `getBrowserExecutable` now sets it, both happen. Not yet verified against a real Vercel container — see "Immediate next step."
- **The receiver-name validation fix**, verified by re-reading the request payload against `generateRequestSchema` — an empty name now falls back the same way client-side as it already did server-side, so the two can't disagree.
- **Local render pipeline** (`npm run build && npm start`, then real `POST /api/render` calls) produces valid, playable MP4s.
- **Typecheck** clean throughout.

## Not verified / open

- **PR #3 hasn't merged or redeployed yet** — see "Immediate next step."
- **The browser-launch fix hasn't been confirmed on an actual Vercel deploy.** It's verified against the real `@sparticuz/chromium` package logic locally, but Vercel's exact underlying OS image (whether it's actually close enough to AL2023 for those shared libraries to satisfy the binary's other dependencies too) is unconfirmed. If `Closed with 127 signal` still shows up after this deploys, that's the next thing to check.
- **`background` prop is currently inert** for every `kind`, discovered while writing `spec.md`. Not a regression from today's work, not yet fixed — see `decisions.md`. Nobody has hit this yet because nothing in the UI or defaults exercises a non-default `background` while `theme` is also set.
- **`/api/render` is unauthenticated.** Anyone with the URL can trigger a real, slow, compute-costing render. Script length is capped (40 messages × 280 chars) as a basic guardrail, but there's no auth or rate limiting.
- **`maxDuration = 300` may not be what's actually in effect.** Hobby caps function duration at 60s and rejects deploys above that. If the project deployed successfully on Hobby, the effective value is lower than the code says — worth confirming which plan this is on.
- **Transitive CVEs.** Remotion is pinned at 4.0.290; `extract-zip`, `webpack`, and `ws` have known advisories that only clear by bumping the whole toolchain to 4.0.515+. Left pinned deliberately — build/dev-time paths, not attacker-reachable. Worth doing, not urgent.
- **Remotion licensing.** Dual-licensed; companies above certain revenue/headcount thresholds need a paid license. See https://remotion.dev/license.
- **Sent bubbles sit where Instagram's icon rail lands.** Inherent tension in any full-bleed fake-DM reel — authenticity vs. clearing Instagram's chrome. Flagged, not resolved; a product call, not a technical one.
- **No automated tests.** Verification is manual still/video rendering.
- **Emoji coverage is thin.** Only 👀 💀 🔥 🤷 😂 are vendored. Any other emoji 404s mid-render — no fallback.
- **Avatar is a placeholder**, no upload path in the UI.
- **UI covers a subset of props** — see `spec.md` → "The web app." Reactions, custom backgrounds, spring tuning, and safe-zone tweaking are Studio/CLI-only.

## Suggested next steps

1. Merge PR #3, redeploy, confirm **Generate MP4** works on the live site — closes the largest remaining unknown.
2. Confirm which Vercel plan this is on and whether `maxDuration = 300` is actually in effect.
3. Add auth or rate limiting to `/api/render` before sharing the deployed URL further.
4. Decide what to do about the inert `background` prop (fix it or retire it) and the icon-rail overlap — both are product calls now that the technical picture is clear.
