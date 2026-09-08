# Progress

Status as of the session ending 2026-09-08.

## Latest

**Remotion Lambda is live and has rendered real video** — the big unknown from the last handoff is resolved. The user ran `AWS_LAMBDA_SETUP.md` end to end, and the first real render surfaced two production bugs (both root-caused and fixed this round), plus a debug pass surfaced four more. One of the two production fixes has **not actually reached the deployed Lambda site yet** — see "Immediate next step," this is the load-bearing item right now.

### Bug 1 — `Rate Exceeded.` on every render (fixed, merged, deployed)

AWS's own `TooManyRequestsException`, not a setup mistake. `renderMediaOnLambda()` fans a render out across many concurrent Lambda invocations (uncapped, easily 50-200+), and this AWS account's `Concurrent executions` quota is **10** (confirmed via AWS Service Quotas console — new accounts start well below the 1000 default until AWS's automated review raises it). Fixed by adding an optional `REMOTION_LAMBDA_FRAMES_PER_LAMBDA` env var (`app/api/render/route.ts`), which raises frames-per-invocation to lower the concurrent-invocation count. **The user has this set to `1500` in Vercel right now.** Once AWS approves the quota increase (requested, pending as of this writing), lower or unset it to restore full parallelism — check AWS Service Quotas before assuming it's still needed. PR #6, merged.

### Bug 2 — avatar 404 on Lambda (code fixed and merged; **deploy not confirmed** — see below)

`src/data/defaultProps.ts` baked `receiver.avatar` in as a root-relative path (`/avatar-demo.svg`). That resolves fine for local-render mode (its bundle flattens `public/` into the bundle root), but on Lambda the deployed site lives under an S3 prefix (`sites/<name>/...`), so the root-relative path resolved against the *bucket root* instead and 404'd. Fixed by storing the bare filename and resolving it through `staticFile()` in `DmHeader.tsx` (the one place that's actually in browser context and safe to import `remotion`) instead of in the shared Node-context props file. PR #7, merged.

**This fix has not been verified live.** Probed the bucket directly again just now (it's publicly listable):

```
404  sites/insta-dm-reel/public/avatar-demo.svg
404  sites/insta-dm-reel/public/emoji/emoji_u1f440.png
200  sites/insta-dm-reel/bundle.js   (Last-Modified: 2026-09-07T22:01:01Z)
```

`bundle.js`'s timestamp matches the deploy from *before* PR #7 merged — **no `lambda:deploy-site` run has happened since**, so the fix is sitting in `main` unused. Separately, and this may or may not still be true after a fresh deploy: the *previous* deploy (the one at that same timestamp) was already missing these exact two files out of the nine in `public/` — `avatar-demo.svg` (487 B) and `emoji_u1f440.png` (3,976 B) — while every other `public/` file uploaded fine. Both are committed and intact in the repo (checked directly). Likely a stale/cached bundler run rather than anything wrong with the files themselves; see "Immediate next step" for what to check.

### Four more bugs found in a dedicated debug pass, not yet merged (PR #8, open against `main`)

Verified by actually installing deps and rendering — this project has no test suite. Two could take a render down entirely, matching the exact `cancelRender()` mechanism that caused Bug 2 above:

1. **Un-vendored emoji.** Only 5 of the emoji Noto could produce are vendored as PNGs, but the UI accepts arbitrary text. Reproduced: an unvendored emoji 404'd and killed the render. Fixed — `parseMessageText` now only emits an emoji token for a file listed in a new `VENDORED_EMOJI_FILES` manifest; anything else falls back to plain text.
2. **Long unbroken tokens** (a pasted URL is the realistic case) overflowed the bubble and were clipped off-frame — greedy word-wrap only breaks *between* words. Fixed with mid-word breaking, code-point-safe.
3. **Silent stream truncation** in `app/page.tsx` — if the NDJSON stream ended without a `done`/`error` event, the UI just reset as if it had succeeded, no video, no error shown.
4. **`revokeObjectURL` race** on the finished-download path in `app/page.tsx` — ran synchronously against the click that starts the save.

Full writeup, before/after, and verification steps are in the PR body. `mergeable_state: clean` as of this writing.

## Where things stand

| | |
|---|---|
| Working branch | `claude/rate-exceeded-video-gen-6ifwcm` |
| Base branch | `main` — **this is now correct**, see the "Repository" gotcha below, it was not always the case |
| PR #5 | merged — Remotion Lambda backend (merged into the *wrong* base branch, see below) |
| PR #6 | merged — `Rate Exceeded` fix (also merged into the wrong base) |
| PR #7 | merged — avatar-404 code fix (also merged into the wrong base) |
| PR #8 | **open**, not yet merged/reviewed, base is correctly `main` — the four-bug debug-pass fix |
| Working tree | clean, everything pushed |

**Repository gotcha, now resolved but worth knowing about:** this repo's GitHub *default branch* had somehow been set to `claude/references-instagram-screenshots-d36atz`, not `main` — PRs #5, #6, and #7 all auto-targeted it as a result, while `main` sat one PR behind (missing PR #5 entirely) with no one noticing, because GitHub happily let all three PRs merge into the "wrong" branch without complaint. **If Vercel's production deployment tracks `main` specifically, none of PRs #5/#6/#7 were ever live until this session force-merged the gap** (`git merge origin/claude/references-instagram-screenshots-d36atz` into `main`, pushed directly — content-only merge, no conflicts, verified `main` had zero unique commits to lose first). PR #8 was opened correctly against `main`.

**Before starting new work:**
1. Confirm which branch Vercel's production deployment actually tracks. If it's not `main`, find out why and fix that first — everything above assumes `main` is what matters.
2. Confirm GitHub's repo-level default branch is now `main` (Settings → Branches). It was not, as of the start of this session; I don't have access to check whether anyone has changed it since.
3. Check whether PR #8 has merged before pushing to `claude/rate-exceeded-video-gen-6ifwcm` again — if it has, rebase onto current `main` first. This exact mistake (pushing follow-up commits onto a branch whose PR had already merged) happened twice already this session alone; see `decisions.md` → "The branch keeps getting reused after its PR merges."

## Immediate next step

1. **Merge PR #8** (or address any review feedback first) — https://github.com/CyberZenithX/Insta-DMs-Video-Simulator/pull/8
2. **Redeploy the Lambda site**: `REMOTION_AWS_ACCESS_KEY_ID=... REMOTION_AWS_SECRET_ACCESS_KEY=... npm run lambda:deploy-site -- --region=us-east-1`. This carries both PR #7's `staticFile()` fix and PR #8's emoji/wrap fixes — none of it is live yet.
3. **Verify the deploy actually uploaded everything**, don't just trust the script's exit code — that's what went wrong last time. The bucket allows public listing, which made this easy to check from outside AWS:
   ```
   curl -s "https://remotionlambda-useast1-zaeqs176y5.s3.us-east-1.amazonaws.com/?list-type=2&prefix=sites/insta-dm-reel/public/&max-keys=50"
   ```
   Confirm all 9 files under `public/` appear (`avatar-demo.svg`, 5× `emoji/*.png`, 3× `fonts/*.woff2`), not just 7. If `avatar-demo.svg` or `emoji_u1f440.png` are missing again, it's not a code bug — check for a stale `node_modules/.cache` (Remotion's bundler cache) before assuming anything else, and see the "Latest" section above for the previous investigation.
4. **Generate an actual video from the live site** — an emoji, a long/URL-like message, and the default avatar all in one script — and visually confirm all three render correctly. This closes the loop that's been open since Bug 2.
5. **Check the AWS Lambda concurrent-execution quota increase.** If AWS has approved it (Service Quotas console, `us-east-1`, "Concurrent executions"), lower or remove `REMOTION_LAMBDA_FRAMES_PER_LAMBDA` from Vercel — it's currently capping every render's parallelism as a workaround for a 10-execution limit that may no longer apply.
6. Confirm GitHub's default branch setting is `main` (see the Repository gotcha above) so future PRs don't repeat this.

## Done and verified

- Everything from the previous handoff (composition, 9 themes, full-bleed fix, determinism, local-render pipeline, streamed progress) — unchanged and not re-verified this round except where noted below.
- **A real Lambda render actually completing** — the thing every previous handoff flagged as the load-bearing unknown. Confirmed via a real `POST /api/render` against the live Vercel deployment (per the user), and independently via a from-scratch local install + build + end-to-end `POST /api/render` in this sandbox, producing a valid, playable MP4.
- **`Rate Exceeded` root-caused against the actual AWS Service Quotas page**, not guessed — the account's `Concurrent executions` value (10) was read directly from the quota console output the user provided.
- **Avatar-404 root-caused against the real deployed S3 site**, not guessed — the bucket allows public listing and every claim above (`404` vs `200`, which exact files, timestamps) came from `curl` against the real bucket, not documentation or assumption.
- **The four debug-pass bugs**, each reproduced first (confirmed failing) and re-verified after the fix, using a real local install: `npm run typecheck`, `npm run build`, and an end-to-end `POST /api/render` all pass; the demo frame renders **byte-identical** before and after (md5 match), reconfirming the determinism contract wasn't disturbed.
- **Input validation** re-checked directly against the running server: empty script, 41 messages, empty message text, invalid theme, and a non-JSON body all fail closed with clear messages.
- **The `main`/default-branch divergence**, fixed and verified with `git merge-base --is-ancestor` / diff-stat checks before touching anything, specifically to confirm `main` had no unique content that a merge could lose.

## Not verified / open

- **The Lambda-site redeploy carrying PR #7 + #8's fixes has not happened** — see "Immediate next step," this is the single most important open item.
- **Whether the AWS concurrent-execution quota increase has been approved** — check before assuming `REMOTION_LAMBDA_FRAMES_PER_LAMBDA=1500` is still necessary.
- **Whether Vercel's production deployment tracks `main`** — never independently confirmed this session; the whole "PRs merged into the wrong branch" incident was only caught because the user asked to "push to main," not because anyone verified the deploy source first.
- **Emoji coverage is still thin** — only 5 vendored. The debug-pass fix makes an unvendored emoji *safe* (falls back to text) but doesn't add coverage. Real coverage means either vendoring more PNGs or a webfont — left as a product decision, see PR #8's body.
- **Lambda progress polling has no timeout** (`for (;;)` in `app/page.tsx`). A stalled render spins the UI forever. Left alone deliberately — any timeout risks cutting off a legitimately long render, and the right bound is a product call, not a technical one.
- Everything listed as open in the previous handoff and not mentioned above is presumably still open (inert `background` prop, no auth/rate limiting on `/api/render`, transitive CVEs, Remotion licensing, sent-bubble/icon-rail overlap, no automated tests, avatar has no upload path, UI covers a subset of props, `concurrency`/`jpegQuality` untouched, S3 lifecycle/expiry not reviewed) — none of it was revisited this round.

## Suggested next steps

1. Work through "Immediate next step" above in order — steps 1-4 close the loop on real bugs already found; step 5 avoids paying an unnecessary throughput tax; step 6 prevents the branch confusion from recurring.
2. Decide the emoji-coverage question (vendor more PNGs vs. webfont) — now an explicit open decision, not a silent gap.
3. Add a timeout/backoff policy to the Lambda progress-polling loop, once there's a view on what "too long" means for this product.
4. Everything else from the previous handoff's suggested-next-steps that's still unaddressed (auth/rate limiting on `/api/render`, the inert `background` prop, CVE triage).
