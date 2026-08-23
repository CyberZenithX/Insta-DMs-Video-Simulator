# Progress

Status as of the session ending 2026-08-23.

## Latest

PR #3 (compositor binaries, browser-launch fix, receiver-name validation, session docs) **merged**. The one thing it couldn't verify from this sandbox — whether the browser-launch fix actually works on real Vercel infrastructure — is still open; see "Immediate next step."

New this round, on top of that: **the render experience itself**.

1. **The UI gave no feedback during a render** beyond static "Rendering… this can take a minute" text — for a script that legitimately takes tens of seconds, that reads as hung. `/api/render` now streams newline-delimited JSON progress events instead of buffering the whole response, and the page renders a live progress bar from them: stage label, frame count, percentage, and a `~Ns left` estimate (forwarded straight from `renderMedia`'s own remaining-time calculation, not computed by hand). Verified by actually driving the UI in a real browser (Playwright) and screenshotting the bar mid-render, not just reading the code.
2. **One redundant browser launch removed.** `selectComposition` and `renderMedia` each launched their own headless Chrome; now one is opened via `openBrowser()` and shared between both. A real reduction in work, not a tuned parameter — `concurrency`/`jpegQuality` were deliberately left alone, since guessing wrong on those risks OOM on Vercel's fixed memory budget and can't be verified against real Vercel infrastructure from here. The saving should be more pronounced on Vercel (where launching `@sparticuz/chromium` means decompressing a bundled binary on every cold start) than it appeared locally.

This landed as PR #4 — see "Where things stand."

## Where things stand

| | |
|---|---|
| Working branch | `claude/references-instagram-screenshots-d36atz` |
| Base branch | `main` |
| PR #1 | [merged](https://github.com/CyberZenithX/Insta-DMs-Video-Simulator/pull/1) — reference images through the web UI |
| PR #2 | [merged](https://github.com/CyberZenithX/Insta-DMs-Video-Simulator/pull/2) — typing fix + avatar-path fix |
| PR #3 | [merged](https://github.com/CyberZenithX/Insta-DMs-Video-Simulator/pull/3) — compositor-binaries fix, browser-launch fix, receiver-name validation fix, session docs |
| PR #4 | **[open](https://github.com/CyberZenithX/Insta-DMs-Video-Simulator/pull/4), needs merge + redeploy** — streamed render progress + the shared-browser speed fix |
| Working tree | clean, everything pushed |

**Before starting new work: check whether PR #4 has merged.** If it has and you need to push to this branch again, rebase onto current `main` first — do not push onto the old head. This has now happened three times (after PR #1, PR #2, and PR #3); see `decisions.md` → "The branch keeps getting reused after its PR merges."

## Immediate next step

1. Merge PR #4.
2. Redeploy on Vercel.
3. On the live site: fill in the default script, click **Generate MP4**, and watch for two things at once:
   - **Does the browser launch at all?** This is the still-unconfirmed fix from PR #3. If you see `Failed to launch the browser process! ... Closed with 127 signal`, that fix didn't hold — dig into whether Vercel's underlying image actually matches AL2023 (try forcing `nodejs18.x`/AL2 instead of the auto-detected version, or pin an older `@sparticuz/chromium`). A *different* error means that part worked and something else broke.
   - **Does the progress bar move?** Confirms the streamed-response change works through Vercel's serverless/edge layer in production, which — like the browser-launch fix — could only be verified locally, not against real Vercel infrastructure.
4. Confirm a valid MP4 downloads, with no stranded typing bubbles and messages in chronological order (PR #2's fix, last confirmed working via local rendering, not yet on the live site either).
5. Only after all of the above holds is the full pipeline — compositor, browser launch, streamed progress, typing/ordering — confirmed end to end on Vercel. Everything under "Not verified" below is downstream of this.

## Done and verified

- **Reference screenshots** committed to `references/` — all geometry and theme colors are calibrated against them.
- **Remotion composition** (`IgDmReel`) renders a scripted DM conversation: typing bubbles that morph into messages, spring-driven scroll, scroll-position-sampled gradient, image-based emoji, reaction badges. Second composition `SafeZoneGrid` for calibration.
- **Full-bleed layout fix.** The mockup previously rendered at 76% width, left-aligned, baking a permanent blank strip into every export. Now fills the frame edge to edge. Verified by rendering stills before/after.
- **9 theme presets**, selectable via a `theme` prop. Verified each renders; sent-bubble contrast checked against every themed backdrop.
- **Frame determinism** re-confirmed after the layout changes — two renders of the same frame are byte-identical.
- **The typing/ordering fix**, rendered against the exact deployed default script at the frames that previously showed the bug: one typing bubble as the newest stack item, none stranded, chronological order correct.
- **The compositor-binaries fix**, verified against the built trace manifest: the native `remotion` binary and all seven `libav*.so` are present, the local Chrome Headless Shell contributes 0 bytes, function size 93.8MB.
- **The browser-launch fix**, verified against the installed `@sparticuz/chromium` package directly (before/after `LD_LIBRARY_PATH` behavior). **Still not verified against a real Vercel container** — see "Immediate next step."
- **The receiver-name validation fix**, verified by re-reading the request payload against `generateRequestSchema`.
- **Streamed render progress**, verified two ways: (1) a real `POST /api/render` showing events flow `0 → 1` across the correct stage sequence with a valid MP4 as the final payload, and (2) actually driving the UI in a real browser (Playwright) and screenshotting the progress bar mid-render — frame counts, percentage, and ETA all live-updating, reverting cleanly to the idle button on completion.
- **The shared-browser speed fix**, verified by successful local renders after the change (same correctness, one less browser launch). The actual time saving is expected to show up more on Vercel than locally — not independently measurable from this sandbox.
- **Local render pipeline** (`npm run build && npm start`, then real `POST /api/render` calls) produces valid, playable MP4s.
- **Typecheck** clean throughout.

## Not verified / open

- **PR #4 hasn't merged or redeployed yet** — see "Immediate next step."
- **Nothing about the render pipeline has been confirmed on an actual Vercel deploy yet** — compositor binaries, browser launch, streamed progress, and shared-browser reuse were all built and verified locally/against real Vercel constraints (trace manifests, package logic, function size limits) but never against a live Vercel container, because this sandbox's network proxy blocks `vercel.app` (confirmed by testing directly — 403 on the CONNECT tunnel). Every fix in PRs #3 and #4 is theoretically sound and locally verified, but "click Generate MP4 on the live site" is still the one step nothing has substituted for.
- **`background` prop is currently inert** for every `kind`, discovered while writing `spec.md`. Not a regression from this work, not yet fixed — see `decisions.md`.
- **`/api/render` is unauthenticated.** Script length is capped (40 messages × 280 chars) as a basic guardrail, but there's no auth or rate limiting — and a render is now a longer-lived streaming connection per request, which is a slightly larger resource footprint per abuse attempt than the old buffered version.
- **`maxDuration = 300` may not be what's actually in effect.** Hobby caps function duration at 60s and rejects deploys above that. Worth confirming which plan this is on.
- **Transitive CVEs.** Remotion is pinned at 4.0.290; `extract-zip`, `webpack`, and `ws` have known advisories that only clear by bumping the whole toolchain to 4.0.515+. Left pinned deliberately — build/dev-time paths, not attacker-reachable.
- **Remotion licensing.** Dual-licensed; companies above certain revenue/headcount thresholds need a paid license. See https://remotion.dev/license.
- **Sent bubbles sit where Instagram's icon rail lands.** A product call, not resolved.
- **No automated tests.** Verification is manual still/video rendering (and, now, one manual Playwright UI pass).
- **Emoji coverage is thin.** Only 👀 💀 🔥 🤷 😂 are vendored. Any other emoji 404s mid-render — no fallback.
- **Avatar is a placeholder**, no upload path in the UI.
- **UI covers a subset of props** — see `spec.md` → "The web app." Reactions, custom backgrounds, spring tuning, and safe-zone tweaking are Studio/CLI-only.
- **No further render-speed optimization attempted beyond the shared-browser fix.** `concurrency` and `jpegQuality` are both real levers but weren't touched — see `decisions.md` for why.

## Suggested next steps

1. Merge PR #4, redeploy, confirm **Generate MP4** works on the live site with a moving progress bar and no browser-launch error — closes out every remaining unknown from PRs #3 and #4 at once.
2. Confirm which Vercel plan this is on and whether `maxDuration = 300` is actually in effect.
3. Add auth or rate limiting to `/api/render` before sharing the deployed URL further.
4. Decide what to do about the inert `background` prop (fix it or retire it) and the icon-rail overlap — both are product calls now that the technical picture is clear.
5. If render time still matters after confirming the shared-browser fix's real-world effect, the next lever is `concurrency` — but tune it live against Vercel's actual memory limits, not by guessing.
