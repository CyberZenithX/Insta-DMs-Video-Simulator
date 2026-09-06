# Progress

Status as of the session ending 2026-09-06.

## Latest

**Remotion Lambda added as the primary render backend**, replacing the render-duration ceiling entirely rather than just making the wait more legible (which is what the streamed-progress bar from the previous round did). See `decisions.md` → "Remotion Lambda, not client-side rendering or a hard length cap" for the full reasoning.

`/api/render` now branches on one env var, `REMOTION_LAMBDA_FUNCTION_NAME`:

- **Set → Lambda mode.** `renderMediaOnLambda()` kicks off an async render on AWS Lambda and returns in well under a second, regardless of script length. The client polls a new `GET /api/render/progress` endpoint (also always fast) until done, then downloads directly from the S3 URL it returns — the video is never proxied through the Next.js app at all.
- **Unset → local-render mode**, unchanged from before — this is what `npm run dev` still uses without any AWS setup, and remains a real fallback, not dead code.

Three new scripts (`npm run lambda:print-policies` / `lambda:deploy-function` / `lambda:deploy-site`) drive the one-time AWS setup, run manually by whoever has AWS credentials — never as part of `npm run build`.

**This is the biggest gap in verification so far, and it's an honest one: no successful Lambda render has actually happened yet.** What *has* been verified, concretely:

- Every function signature, the exact IAM policy JSON, and the credential env var names were pulled from the actually-installed `@remotion/lambda`/`@remotion/lambda-client` packages — not from memory or docs that could be stale for this pinned version. (This caught a real thing: this version's `@remotion/cli` has no `lambda` subcommand at all, unlike what generic Remotion docs describe — the deploy scripts call the programmatic API directly instead of shelling out to a CLI that doesn't exist here.)
- The Lambda code branch was proven to *activate* correctly: a request with deliberately-fake AWS credentials returned AWS's own real `UnrecognizedClientException` in ~0.4 seconds — proof the branch fires, calls real AWS infrastructure, and fails cleanly rather than crashing. It also proved this sandbox's network *can* reach AWS's API, unlike `vercel.app`.
- The untouched local-render fallback was re-tested end-to-end after the refactor (dynamic imports, function extraction) and still produces valid MP4s exactly as before.
- Full clean build, typecheck, and trace-manifest inspection all pass.

What's *not* verified because it requires a real AWS account this sandbox doesn't have: an actual `deployFunction`/`deploySite` run, a real render actually completing on Lambda, a real `getRenderProgress` poll loop reaching `done: true` with a working `outputFile` URL. See "Immediate next step."

## Where things stand

| | |
|---|---|
| Working branch | `claude/references-instagram-screenshots-d36atz` |
| Base branch | `main` |
| PR #1 | [merged](https://github.com/CyberZenithX/Insta-DMs-Video-Simulator/pull/1) — reference images through the web UI |
| PR #2 | [merged](https://github.com/CyberZenithX/Insta-DMs-Video-Simulator/pull/2) — typing fix + avatar-path fix |
| PR #3 | [merged](https://github.com/CyberZenithX/Insta-DMs-Video-Simulator/pull/3) — compositor-binaries fix, browser-launch fix, receiver-name validation fix, session docs |
| PR #4 | [merged](https://github.com/CyberZenithX/Insta-DMs-Video-Simulator/pull/4) — streamed render progress + the shared-browser speed fix |
| PR #5 | **not yet opened** — Remotion Lambda backend, this round's work. Code complete and pushed to the branch; open it before merging. |
| Working tree | clean, everything pushed |

**Before starting new work: check whether the branch's most recent PR has merged.** If it has and you need to push to this branch again, rebase onto current `main` first — do not push onto the old head. This has now happened three times (after PR #1, PR #2, and PR #3); see `decisions.md` → "The branch keeps getting reused after its PR merges."

## Immediate next step

This is a two-track next step — the AWS side needs a human with an AWS account (or credentials handed to a session that can act on them), the deploy side is otherwise fully scripted:

1. **Get AWS credentials.** Create an IAM user, attach the policy from `npm run lambda:print-policies` (the "user policy" half), generate access keys. Separately, create an IAM role named exactly `remotion-lambda-role` with the "role policy" half of that same script's output, trusted by `lambda.amazonaws.com`.
2. **Run the two deploy scripts** with `REMOTION_AWS_ACCESS_KEY_ID`/`REMOTION_AWS_SECRET_ACCESS_KEY` set: `npm run lambda:deploy-function` then `npm run lambda:deploy-site`. Each prints the env vars the app needs.
3. **Set those env vars on Vercel** (`REMOTION_LAMBDA_FUNCTION_NAME`, `REMOTION_LAMBDA_SERVE_URL`, `REMOTION_LAMBDA_REGION`, plus the two `REMOTION_AWS_*` credential vars) and redeploy.
4. **Click Generate MP4 on the live site.** This is the first real end-to-end test of the entire Lambda path — deploy, trigger, poll, download — none of which has run against real infrastructure yet.
5. Separately, still unconfirmed from the last two rounds and not superseded by this one: the browser-launch fix and the streamed-progress fallback both still only matter if Lambda *isn't* configured, or if step 1–4 above hasn't happened yet. If this deployment ships without AWS set up, those are still the open questions — see the PR #3/#4 history in git log for what they were.

If a session with real (ideally scoped/temporary) AWS credentials picks this up, steps 1–4 can be done directly rather than handed to a human — the deploy scripts and routes are already written and waiting.

## Done and verified

- **Reference screenshots** committed to `references/` — all geometry and theme colors are calibrated against them.
- **Remotion composition** (`IgDmReel`) renders a scripted DM conversation: typing bubbles that morph into messages, spring-driven scroll, scroll-position-sampled gradient, image-based emoji, reaction badges. Second composition `SafeZoneGrid` for calibration.
- **Full-bleed layout fix.** Verified by rendering stills before/after.
- **9 theme presets**, selectable via a `theme` prop. Verified each renders; sent-bubble contrast checked against every themed backdrop.
- **Frame determinism** re-confirmed after the layout changes — two renders of the same frame are byte-identical.
- **The typing/ordering fix**, rendered against the exact deployed default script at the frames that previously showed the bug.
- **The compositor-binaries fix**, verified against the built trace manifest.
- **The browser-launch fix**, verified against the installed `@sparticuz/chromium` package directly. **Still not verified against a real Vercel container.**
- **The receiver-name validation fix**, verified by re-reading the request payload against `generateRequestSchema`.
- **Streamed render progress** (local-render mode), verified via a real render and a real Playwright UI pass.
- **The shared-browser speed fix**, verified by successful local renders after the change; actual time saving on Vercel specifically not independently measurable from this sandbox.
- **The Remotion Lambda code path**, verified as far as this sandbox can: real package signatures/policies/CLI surface, the branch activating and failing cleanly against fake credentials, the local fallback unaffected by the refactor, full build/typecheck clean. **Not verified: an actual successful render.**
- **Local render pipeline** (`npm run build && npm start`, then real `POST /api/render` calls) produces valid, playable MP4s.
- **Typecheck** clean throughout, including after this round's route.ts restructuring (dynamic imports, function extraction to share logic between the two render modes).

## Not verified / open

- **No AWS deploy or real Lambda render has happened yet** — see "Immediate next step." This is the load-bearing unknown right now; everything else in this list is secondary to it.
- **Nothing about the *local-render* pipeline has been confirmed on an actual Vercel deploy either** — compositor binaries, browser launch, streamed progress, shared-browser reuse were all built and verified locally/against real Vercel constraints (trace manifests, package logic, function size limits) but never against a live Vercel container, because this sandbox's network proxy blocks `vercel.app`. Only matters if a deployment ships without Lambda configured.
- **`background` prop is currently inert** for every `kind`, discovered while writing `spec.md`. Not a regression from this work, not yet fixed — see `decisions.md`.
- **`/api/render` is unauthenticated on both modes.** Lambda mode changes the abuse-cost shape (a bad actor now costs AWS-Lambda-seconds instead of Vercel-function-seconds) but doesn't remove the problem. Script length is still capped (40 messages × 280 chars) as the only guardrail.
- **`maxDuration = 300` may not be what's actually in effect** in local-render mode. Hobby caps function duration at 60s and rejects deploys above that. Doesn't matter in Lambda mode, where this route returns in under a second regardless.
- **Transitive CVEs**, now a larger surface: `npm install @remotion/lambda` pulled in the full AWS SDK v3 client set, and `npm audit` now reports 44 advisories (up from 15) — not independently triaged yet, same "left pinned deliberately, revisit with time to re-verify" posture as the existing Remotion-version CVEs below.
- **Remotion licensing.** Dual-licensed; companies above certain revenue/headcount thresholds need a paid license. See https://remotion.dev/license. (Also worth checking Remotion Lambda's own licensing terms specifically — it may differ from the core library.)
- **Sent bubbles sit where Instagram's icon rail lands.** A product call, not resolved.
- **No automated tests.** Verification is manual still/video rendering.
- **Emoji coverage is thin.** Only 👀 💀 🔥 🤷 😂 are vendored.
- **Avatar is a placeholder**, no upload path in the UI.
- **UI covers a subset of props** — see `spec.md` → "The web app."
- **`concurrency`/`jpegQuality` still untouched** — see `decisions.md`. Now double-relevant: these apply to `renderMediaOnLambda` too (it accepts both), and Lambda's memory/CPU limits are a different, real budget from Vercel's — still shouldn't be tuned blind.
- **S3 lifecycle/expiry for rendered outputs** is whatever Remotion Lambda's own deploy sets up by default — not reviewed or overridden here. Worth checking once real renders exist, so old output doesn't quietly accumulate storage cost.

## Suggested next steps

1. Get AWS credentials into a session (human-driven or handed to an agent) and actually run steps 1–4 under "Immediate next step" — this is the one thing that turns "should work, verified against real package internals" into "works."
2. Once a real render succeeds, decide whether to keep the local-render fallback long-term or whether Lambda-only (with a clear error if unconfigured) is simpler to maintain going forward.
3. Add auth or rate limiting to `/api/render` — matters more now, not less, since Lambda mode makes a single request cheaper to fire off and forget for an attacker (the response is instant either way; only actual compute happens later, off the requester's connection).
4. Decide what to do about the inert `background` prop and the icon-rail overlap — both are product calls now that the technical picture is clear.
5. Triage the new CVE surface from `@remotion/lambda`'s AWS SDK dependencies, on the same "deliberately, with time to re-verify" timeline as the existing ones.
