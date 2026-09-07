# Setting up AWS Lambda for this project

This walks you through connecting real AWS infrastructure so `/api/render` can render on Remotion Lambda instead of the local fallback — the thing that removes the "keep a connection open for minutes" ceiling (see `decisions.md` → "Remotion Lambda, not client-side rendering or a hard length cap").

It's written as two things at once: a runbook you can follow top to bottom your first time, and a reference on the AWS concepts involved, so the vocabulary keeps making sense the next time you touch AWS for something unrelated to this project. The concept explanations are in their own paragraphs — skim past them once you've done this a few times.

**Time:** ~30-40 minutes the first time, mostly waiting on AWS console pages to load. **Cost:** effectively $0 at hobby volume — see "What this actually costs" near the end, which explains why that's true rather than just asserting it.

---

## The concepts, once, up front

**AWS account.** One AWS account is one billing relationship and one pool of resources. When you sign up you get a special user called the **root user** (identified by the email you signed up with) that can do *anything*, including closing the account or changing billing — which is exactly why you never use it day to day. The very first thing you do in a new account is create a less-powerful user for actual work. That's IAM.

**IAM (Identity and Access Management).** AWS's permission system. Three things in it matter here:
- A **user** is an identity with credentials (a password for console login, or *access keys* for programmatic/API access) that *has permissions*.
- A **policy** is a JSON document listing exactly which actions are allowed on which resources — e.g. "may create S3 buckets whose name starts with `remotionlambda-`, and nothing else." Policies are attached to users or roles; they don't do anything by themselves.
- A **role** is like a user but nobody logs into it directly — instead, some other AWS service (here, Lambda itself) is allowed to *assume* it, temporarily borrowing its permissions to do its job. The IAM **user** you create below is *you*, deploying from your terminal. The IAM **role** is *the Lambda function itself*, needing permission to read/write S3 while it's running.

**Lambda.** AWS's "run this code without managing a server" product — you upload a function, AWS runs it on demand (scaling to zero when idle, to many parallel copies under load), and you're billed per millisecond actually spent running. Remotion Lambda uses this to split a video render across many short-lived function invocations that run in parallel, instead of one process rendering frames one at a time — that's *why* it's fast regardless of video length, and why nothing has to hold a connection open while it works.

**S3 (Simple Storage Service).** AWS's file storage. Remotion Lambda uses one S3 **bucket** (a top-level storage container, globally-unique-named) for two things: hosting the bundled version of this project's `src/` that the Lambda function actually renders from, and storing each render's output MP4 once finished.

**Region.** AWS runs in many physical data-center clusters worldwide (`us-east-1` = Virginia, `eu-west-1` = Ireland, etc.). Everything you create — the Lambda function, the S3 bucket — lives in one region, and things in different regions can't directly reference each other. Pick one region and use it consistently for this whole setup; which one mostly affects latency (pick near your users) and, marginally, price.

**Free tier.** Two different things share this name, worth telling apart because one expires and one doesn't:
- Lambda's free tier (1,000,000 requests + 400,000 GB-seconds of compute per month) is a **permanent** part of AWS's pricing, not a trial.
- S3's free tier (5GB storage, 20,000 GET + 2,000 PUT requests/month) applies only for an account's **first 12 months**. After that, S3 is billed from the first byte — though at the volume this project produces, that's fractions of a cent.

---

## Step 1 — Get an AWS account

If you already have one, skip to Step 2.

1. Go to the AWS sign-up page and create an account with your email. AWS asks for a credit card even to use free-tier services — this is identity verification, not a commitment to spend; nothing here should generate a charge (see "What this actually costs").
2. Once signed in, look at the top-right of the console — it should show your account/root email. Leave this identity alone from here on; every step below happens as an IAM user instead.

## Step 2 — Create the IAM user you'll deploy as

This is *you*, from your terminal, running the two `lambda:deploy-*` scripts.

1. In the AWS Console, go to **IAM → Users → Create user**.
2. Name it something recognizable, e.g. `remotion-deployer`. You do **not** need console access (a password) for this user — it only needs programmatic access keys, added in Step 3 — so you can skip the "Enable console access" option if the wizard offers it.
3. On the permissions step, choose **Attach policies directly**, then **Create inline policy** (or create a new customer-managed policy — either works; inline is simpler for a single-purpose user like this).
4. Get the exact policy JSON from this project rather than typing it by hand:
   ```bash
   npm run lambda:print-policies
   ```
   Copy everything under **"Attach to the IAM user you deploy with"** — paste it into the policy's JSON editor.
5. Name the policy (e.g. `remotion-deploy-policy`) and finish creating the user.

*Why a custom policy instead of an AWS-managed one like `AdministratorAccess`?* This is the **principle of least privilege** — the user can only do the specific S3/Lambda/IAM actions Remotion Lambda needs (scoped to resource names starting with `remotionlambda-`/`remotion-render-`), not arbitrary things in your account. If these credentials ever leaked, the blast radius is small.

## Step 3 — Generate access keys for that user

1. Open the `remotion-deployer` user you just made → **Security credentials** tab → **Access keys** → **Create access key**.
2. AWS will ask what you're using this for — choose **Command Line Interface (CLI)** or **Application running outside AWS** (wording varies by console version; either is fine here — you just want a plain access key + secret, not an SSO/temporary credential flow).
3. **Copy both the Access Key ID and Secret Access Key immediately** — the secret is shown exactly once and can't be retrieved again later (you'd have to delete this key and make a new one).

Keep these somewhere like a password manager. **Never commit them to git** — this repo's `.gitignore` already excludes `.env`/`.env*.local` for exactly this reason.

## Step 4 — Create the Lambda execution role

This is the role *the Lambda function itself* assumes while running — separate from the user above, which is *you* deploying it.

1. **IAM → Roles → Create role.**
2. Trusted entity type: **AWS service**. Use case: **Lambda**. (Picking "Lambda" here is what makes AWS automatically write the correct trust policy — the document saying "the Lambda service is allowed to assume this role" — you don't write that JSON by hand.)
3. On the permissions step, skip attaching a managed policy for now (you'll add the exact one as an inline policy next) — just continue.
4. **Name the role exactly `remotion-lambda-role`.** This isn't a style choice — the IAM user's own policy (Step 2) only grants `iam:PassRole` for that literal name, so a differently-named role will fail with a permissions error the first time you deploy.
5. Create the role, then open it → **Add permissions → Create inline policy → JSON tab**.
6. From the same `npm run lambda:print-policies` output as before, copy everything under **"Attach to the 'remotion-lambda-role' execution role"** and paste it in.
7. Name and save the policy.

## Step 5 — Deploy the function and the site

From your terminal, in this project, with the Step 3 keys set as environment variables for just this command:

```bash
REMOTION_AWS_ACCESS_KEY_ID=<your access key id> \
REMOTION_AWS_SECRET_ACCESS_KEY=<your secret access key> \
npm run lambda:deploy-function -- --region=us-east-1
```

This creates the actual Lambda function (or reuses it if one already exists for this Remotion version/region). It prints `REMOTION_LAMBDA_FUNCTION_NAME` and `REMOTION_LAMBDA_REGION` — save both.

```bash
REMOTION_AWS_ACCESS_KEY_ID=<your access key id> \
REMOTION_AWS_SECRET_ACCESS_KEY=<your secret access key> \
npm run lambda:deploy-site -- --region=us-east-1
```

This bundles `src/` (the same composition code the local renderer uses) and uploads it to S3 — creating the bucket automatically if needed. It prints `REMOTION_LAMBDA_SERVE_URL`. Save it too.

Use the **same `--region=`** for both commands — a function in one region can't be pointed at a site bundle in another.

*Re-run `lambda:deploy-site` any time you change anything under `src/`* — it's a snapshot upload, not a live connection to your local files. `lambda:deploy-function` only needs re-running after upgrading the `@remotion/lambda` version pinned in `package.json`.

## Step 6 — Connect Vercel to it

In your Vercel project → **Settings → Environment Variables**, add all five:

| Variable | Value |
|---|---|
| `REMOTION_LAMBDA_FUNCTION_NAME` | printed by `lambda:deploy-function` |
| `REMOTION_LAMBDA_SERVE_URL` | printed by `lambda:deploy-site` |
| `REMOTION_LAMBDA_REGION` | whatever you passed as `--region=` |
| `REMOTION_AWS_ACCESS_KEY_ID` | the Step 3 access key |
| `REMOTION_AWS_SECRET_ACCESS_KEY` | the Step 3 secret |

Redeploy (Vercel usually does this automatically on an env var change; trigger one manually if not). `/api/render` checks for `REMOTION_LAMBDA_FUNCTION_NAME` at request time — once it's set, every render goes through Lambda instead of the local in-process fallback.
→ Verify: open the deployed site, fill in a script, click **Generate MP4**. The progress bar should move within a couple of seconds and finish with a downloaded MP4.

---

## What you actually built

- **One Lambda function**, named `remotion-render-4-0-290-mem2048mb-disk2048mb-120sec` (Remotion derives the name from the Remotion version plus the memory/disk/timeout settings `scripts/lambda-deploy-function.mjs` passes — that's not a random suffix, it's deterministic and will change if any of those numbers change) that Remotion invokes many times in parallel per render, each instance handling a slice of the video's frames, plus one instance that stitches the pieces into the final MP4.
- **One S3 bucket** (`remotionlambda-<region>-<random>`) holding the site bundle (from `lambda:deploy-site`) and every render's output.
- **One IAM role** (`remotion-lambda-role`) the function assumes to read/write that bucket.
- **One IAM user** (`remotion-deployer`) whose only job is running the two deploy scripts when you need to update the function or the site — it's not used at render time at all.

Rendering itself never touches Vercel's compute beyond the sub-second calls to *start* a render and *poll* its status (`renderMediaOnLambda`, `getRenderProgress`) — the actual video encoding happens entirely inside AWS Lambda.

## What this actually costs

At the volume a demo/hobby tool generates (renders measured in seconds of Lambda compute, files measured in megabytes), this sits comfortably inside Lambda's permanent free tier and S3's negligible byte cost. The honest caveat: this is "effectively free," not contractually guaranteed free forever the way a fixed-price plan is — it's a real pay-per-use service, it's just that hobby-scale usage rounds to nothing.

To keep an eye on it as you go:
- **AWS Console → Billing and Cost Management → Bills** shows current-month spend, broken down by service.
- **Billing and Cost Management → Budgets** lets you set an alert (e.g. "email me if I'm ever forecast to exceed $1 this month") — worth setting once and forgetting.

## Cleaning up (if you ever want to)

- **Delete the Lambda function:** `AWS Console → Lambda → Functions →` select it → **Delete**. (Or reuse `deployFunction`'s sibling `deleteFunction` from `@remotion/lambda` in a throwaway script, if you'd rather stay in code.)
- **Empty and delete the S3 bucket:** `AWS Console → S3 →` select the `remotionlambda-*` bucket → **Empty** (S3 won't let you delete a non-empty bucket) → then **Delete**.
- **Delete the IAM role and user** once nothing references them: `IAM → Roles` / `IAM → Users`.

Nothing here bills you for existing while idle except S3 storage of whatever's already in the bucket (pennies), so there's no urgency — but it's good practice to remove infrastructure you're not using.

## Troubleshooting

**`Rate Exceeded.`** on a render request — this is AWS Lambda's own throttling error (`TooManyRequestsException`), not a mistake in the setup steps above. `renderMediaOnLambda()` fans a render out across many concurrent Lambda invocations (easily 50-200+ for a few seconds of video), and a brand-new AWS account often starts with a concurrent-execution / invoke-rate quota well below that — AWS raises it automatically after the account has some usage history, usually within a day or two, but there's no guaranteed timeline. Two ways to fix it:
- **Wait, or request a quota increase now:** `AWS Console → Service Quotas → AWS Lambda → Concurrent executions` (the same console page shows your current limit) — request an increase to the standard 1000 for the region you deployed to.
- **Immediate workaround, no AWS wait required:** set `REMOTION_LAMBDA_FRAMES_PER_LAMBDA` (e.g. `20`) in the same place you set the other five Lambda env vars. This raises how many frames each Lambda invocation renders, which lowers how many invocations run concurrently — trading render speed for staying under a low quota. Raise the number until renders stop throttling; there's no single right value, it depends on your account's actual quota and the video's frame count.

**`UnrecognizedClientException`** on a render request — the access key/secret pair is wrong, or hasn't propagated yet (AWS credentials can take a few seconds to become valid right after creation). Double-check what's actually set in Vercel's env vars, including for stray whitespace from a copy-paste.

**`AccessDenied` / permission errors during deploy** — almost always the IAM user's policy doesn't match what `lambda:print-policies` currently prints (e.g. you attached it before a Remotion version bump changed the required actions). Re-run the script and re-paste the **user** policy (not the role policy) onto the `remotion-deployer` user.

**`iam:PassRole` denied specifically** — the execution role isn't named exactly `remotion-lambda-role`. Rename it or recreate it with the exact name; there's no way to adjust the trailing wildcard in the user policy short of hand-editing it.

**Render starts but never finishes / `Failed to launch the browser process`** — this project already worked through the equivalent issue for the *local-render* fallback on Vercel (see `decisions.md` → the `AWS_LAMBDA_JS_RUNTIME` entry); Remotion Lambda itself ships its own correctly-configured Chromium layer, so this specific failure mode shouldn't recur here, but if it does, check the function's CloudWatch logs first (`AWS Console → CloudWatch → Log groups → /aws/lambda/remotion-render-...`) — they're the actual error, everything surfaced to `/api/render/progress` is a summary of them.

**Nothing in this guide matches what you're seeing** — `getRenderProgress`'s `errors` array (surfaced by `/api/render/progress`) carries the real underlying message; that's the first place to look before re-reading AWS's own docs, since it's specific to what actually happened.

## Security habits worth keeping

- Never use root-account access keys for anything — the whole point of Step 2's IAM user is to avoid ever generating root keys at all.
- Rotate the `remotion-deployer` access key occasionally (create a new one, update Vercel, delete the old one) — same reasoning as rotating any long-lived credential.
- If a key ever leaks (committed to git, pasted somewhere public), delete it immediately in `IAM → Users → remotion-deployer → Security credentials` and issue a new one — deleting is instant and free, and there's no "undo" a leak.
- The scoped policy from Step 2 is doing real work: even if these specific keys leaked, they can't touch anything outside `remotionlambda-*`/`remotion-render-*` resources. Don't widen it to `AdministratorAccess` for convenience.
