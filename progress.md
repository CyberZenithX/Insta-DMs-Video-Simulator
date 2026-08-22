# Progress

Status as of the session ending 2026-08-22.

## Latest

**The app is deployed and working on Vercel.** The initial `404: NOT_FOUND` was project configuration, not code — a clean-clone `npm run build` reproduced green locally.

Since deploying, one bug was found and fixed: **typing indicators stranded permanently in the message stack** (`buildSlots` paired typing events with a mutable pointer that was never cleared when the next message came from `me`). The same root cause also rendered messages out of chronological order. See `decisions.md` → "A typing event has no independent lifetime" for the rule that replaced it. Fixed in `e765a67`; **redeploy to pick it up.**

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

**Server-side MP4 rendering on Vercel has still not been confirmed end to end.** The site loads and the live preview works, but the `/api/render` path — which is where `@sparticuz/chromium` actually activates — has not been exercised on real Vercel infrastructure. Before relying on it:

- Click **Generate MP4** on the deployed site once, with the function logs open.
- Check the `/api/render` function's **max duration**. A render alone took 15–28s locally, before Lambda cold-start on top. `maxDuration = 300` is set in code, but Hobby caps it at 60 and rejects the deploy above that — so if it deployed on Hobby, the value in code is not what is in effect.
- Check function **memory** — headless Chrome wants 1–2GB.

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

1. Redeploy to pick up the typing fix, then click **Generate MP4** once with function logs open — that closes out the largest remaining unknown.
2. Add auth or rate limiting to `/api/render` before sharing any deployed URL.
3. Decide the icon-rail overlap question — it's a product call, not a technical one.
