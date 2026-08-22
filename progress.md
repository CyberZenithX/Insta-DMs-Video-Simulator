# Progress

Status as of the session ending 2026-08-22.

## Where things stand

| | |
|---|---|
| Working branch | `claude/references-instagram-screenshots-d36atz` |
| Base branch | `main` — points at the root commit (`be48984`, reference images only) |
| Open PR | [#1](https://github.com/CyberZenithX/Insta-DMs-Video-Simulator/pull/1) — all four commits, not yet reviewed or merged |
| Working tree | clean, everything pushed |

Commits on the branch, oldest first:

1. `be48984` — reference screenshots (`references/`)
2. `bf5ce4e` — the Remotion DM Reel animator
3. `b45afbb` — full-bleed layout fix + the 9 Instagram theme presets
4. `5899513` — Next.js web UI + `/api/render` MP4 endpoint

## Done and verified

- **Reference screenshots** committed to `references/` — all geometry and theme colors are calibrated against them.
- **Remotion composition** (`IgDmReel`) renders a scripted DM conversation: typing bubbles that morph into messages, spring-driven scroll, scroll-position-sampled gradient, image-based emoji, reaction badges. Second composition `SafeZoneGrid` for calibration.
- **Full-bleed layout fix.** The mockup previously rendered at 76% width, left-aligned, baking a permanent blank strip into every export (visible anywhere outside the live Reels feed). Now fills the frame edge to edge. Verified by rendering stills before/after.
- **9 theme presets** (Default, Berry, Sweets, Unicorn, Maple, Sushi, Rocket, Lollipop, Shadow) sampled from a screenshot of Instagram's Theme picker, selectable via a `theme` prop. Verified each renders; sent-bubble contrast checked against every themed backdrop.
- **Frame determinism** re-confirmed after the layout changes — two renders of the same frame are byte-identical.
- **Web UI + render API.** `npm run build && npm start`, then real `POST /api/render` calls produced valid, playable MP4s: ~15s for a 2-message script, ~28s for the 4-message default. Invalid input (empty script) correctly rejected with 400 before any render starts.
- **Typecheck** clean throughout.

## Not verified / open

**Vercel deployment has never actually been run.** The `@sparticuz/chromium` code path only activates when `VERCEL`/`AWS_LAMBDA_FUNCTION_NAME` is set, so it could not be exercised from the dev sandbox. This is the single biggest unknown. Before relying on it:

- Raise the `/api/render` function's **max duration** — a render alone took 15–28s locally, before Lambda cold-start on top. Default Hobby limits (10s) will not work. `maxDuration = 300` is set in code but the plan has to allow it.
- Raise function **memory** — headless Chrome wants 1–2GB.
- Do one real test render with function logs open.

Other open items, roughly by priority:

- **`/api/render` is unauthenticated.** Anyone with the URL can trigger a real, slow, compute-costing render. Script length is capped (40 messages × 280 chars) as a basic guardrail, but there's no auth or rate limiting.
- **Transitive CVEs.** Remotion is pinned at 4.0.290; `extract-zip`, `webpack`, and `ws` have known advisories that only clear by bumping the whole Remotion toolchain to 4.0.515+. Left pinned deliberately to avoid destabilizing the just-fixed render pipeline. These are build/dev-time paths, not exposed to attacker input — worth doing, not urgent.
- **Remotion licensing.** Remotion is dual-licensed; companies above certain revenue/headcount thresholds need a paid license. Worth checking against your situation — see https://remotion.dev/license.
- **Sent bubbles sit where Instagram's icon rail lands.** Right-aligned bubbles occupy roughly the same region as the like/comment/share column on a posted Reel (`SafeZoneGrid` shows the overlap). This tension is inherent to any full-bleed fake-DM reel — authentic framing vs. clearing Instagram's chrome. Flagged, not resolved; resolving it means deliberately trading away some realism.
- **No automated tests.** Verification is manual still/video rendering.
- **Emoji coverage is thin.** Only a handful of Noto PNGs are vendored in `public/emoji/`. Any emoji without a matching asset fails the render — there's no fallback.
- **Avatar is a placeholder.** `public/avatar-demo.svg`, with no upload path in the UI.
- **UI covers a subset of props.** Reactions, custom backgrounds, spring tuning, and safe-zone tweaking are Studio/CLI-only.

## Suggested next steps

1. Deploy the PR branch to Vercel and do one real end-to-end render with logs open — this is the only way to close out the largest unknown.
2. Add auth or rate limiting to `/api/render` before sharing any deployed URL.
3. Decide the icon-rail overlap question — it's a product call, not a technical one.
