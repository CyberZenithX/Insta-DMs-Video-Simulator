# Progress

Status as of the session ending 2026-08-22.

## Latest

The app is **deployed and live on Vercel**. Two real bugs were found by actually using the deployed site (not just by reading code) and both are fixed:

1. **Typing indicators stranded permanently in the message stack**, and — same root cause — **messages rendered out of chronological order**. See `decisions.md` → "A typing event has no independent lifetime."
2. **`/api/render` failed on Vercel with `ENOENT ... compositor-linux-x64-gnu/remotion`.** Next's file tracer was pruning Remotion's native compositor binary from the deployed function. Fixed, and verified against the actual build trace manifest (not just "should work") that the binary ships and the function measures 93.8MB against Vercel's 250MB limit.

**Neither fix has been confirmed on the live site yet** — both are sitting in an open PR. See "Immediate next step" below before doing anything else.

## Where things stand

| | |
|---|---|
| Working branch | `claude/references-instagram-screenshots-d36atz` |
| Base branch | `main` |
| PR #1 | [merged](https://github.com/CyberZenithX/Insta-DMs-Video-Simulator/pull/1) — reference images through the web UI |
| PR #2 | [merged](https://github.com/CyberZenithX/Insta-DMs-Video-Simulator/pull/2) — typing fix + avatar-path fix |
| PR #3 | **[open](https://github.com/CyberZenithX/Insta-DMs-Video-Simulator/pull/3), needs merge + redeploy** — the compositor-binaries fix |
| Working tree | clean, everything pushed |

**Before starting new work: check whether PR #3 has merged.** If it has and you need to push to this branch again, rebase onto current `main` first — do not push onto the old head. This has already happened twice; see `decisions.md` → "The branch keeps getting reused after its PR merges."

## Immediate next step

1. Merge PR #3.
2. Redeploy on Vercel (or wait for auto-deploy if connected).
3. On the live site: fill in the default script, click **Generate MP4**, confirm a valid MP4 downloads with no stranded typing bubbles and messages in chronological order.
4. Only after that succeeds is server-side rendering actually confirmed end to end. Everything under "Not verified" below is downstream of this.

## Done and verified

- **Reference screenshots** committed to `references/` — all geometry and theme colors are calibrated against them.
- **Remotion composition** (`IgDmReel`) renders a scripted DM conversation: typing bubbles that morph into messages, spring-driven scroll, scroll-position-sampled gradient, image-based emoji, reaction badges. Second composition `SafeZoneGrid` for calibration.
- **Full-bleed layout fix.** The mockup previously rendered at 76% width, left-aligned, baking a permanent blank strip into every export. Now fills the frame edge to edge. Verified by rendering stills before/after.
- **9 theme presets**, selectable via a `theme` prop. Verified each renders; sent-bubble contrast checked against every themed backdrop.
- **Frame determinism** re-confirmed after the layout changes — two renders of the same frame are byte-identical.
- **The typing/ordering fix**, rendered against the exact deployed default script at the frames that previously showed the bug: one typing bubble as the newest stack item, none stranded, chronological order correct.
- **The compositor-binaries fix**, verified against the built trace manifest: the native `remotion` binary and all seven `libav*.so` are present, the local Chrome Headless Shell contributes 0 bytes, function size 93.8MB.
- **Local render pipeline** (`npm run build && npm start`, then real `POST /api/render` calls) produces valid, playable MP4s.
- **Typecheck** clean throughout.

## Not verified / open

- **PR #3 hasn't merged or redeployed yet** — see "Immediate next step."
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
