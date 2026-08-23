# Spec

The functional contract: what this system does and the exact shape of its inputs and outputs. For *why* it's shaped this way, see `decisions.md`. For commands and internal architecture, see `CLAUDE.md`.

## What it produces

A 1080×1920, 60fps video of a scripted two-person Instagram DM conversation — typing indicators, message bubbles, an optional double-tap-style emoji reaction, all scrolling and animating deterministically from a `TimelineEvent[]` script. Two ways to get one:

- **`IgDmReel`** — the Remotion composition. Render via Studio, the CLI, or the web app's `/api/render`.
- **`SafeZoneGrid`** — a calibration composition: a measurement grid plus overlays showing where Instagram's own Reels UI (top bar, icon rail, caption) lands on top of a posted video. Render this after any positional change to `IgDmReel`.

## `IgDmReelProps`

The full prop shape (`src/types.ts`, `igDmReelPropsSchema`). The web UI exposes a subset — see below.

| Field | Type | Notes |
|---|---|---|
| `events` | `TimelineEvent[]` | The script. See below. |
| `receiver` | `{name, username, avatar, activeNow}` | `avatar` is a path/URL; `activeNow: true` shows "Active now" instead of `username` in the header. |
| `clock` | `string` | Status bar time, e.g. `"9:41"`. Free text, not validated as a real time. |
| `background` | `{kind: 'solid'\|'gradient'\|'image'\|'video', value: string}` | **Currently has no visible effect on the output, for any `kind`.** Fully implemented (`src/components/Background.tsx`), but rendered *behind* `PhoneFrame`, which is opaque and full-bleed and paints over it completely — `theme: 'none'` uses the hardcoded `colors.chatBackground` token, not `background.value`. See `decisions.md`. |
| `theme` | `'none' \| 'default' \| 'berry' \| 'sweets' \| 'unicorn' \| 'maple' \| 'sushi' \| 'rocket' \| 'lollipop' \| 'shadow'` | Overrides `background` and the sent-bubble gradient. `'none'` uses `background` plus the hand-tuned magenta→purple→blue gradient. |
| `safeZones` | `{topEnd, railX, railTop, railBottom, bottomStart}` | Each a 0–1 fraction of frame width/height. **Informational only** — consumed by `SafeZoneGrid`, never used to size `IgDmReel`'s own canvas. |
| `scrollAnchor` | `number` (0–1) | Target scroll position: fraction of the chat viewport height that stays below the newest bubble. |
| `spring` | `{damping, mass, stiffness}` | Drives both the newest bubble's entrance and the scroll retarget — see `decisions.md`. |
| `tailSec` | `number` | Seconds held after the last event before the video ends. Feeds `calculateIgDmReelMetadata`'s `durationInFrames`. |

Default values (Studio's `defaultProps`, and the base the web app builds from): `src/data/defaultProps.ts` + `src/data/demoEvents.ts`.

## `TimelineEvent`

A discriminated union on `type` (`src/types.ts`), sorted by `startSec` before layout.

- **`message`** — `{type: 'message', id, from: 'me'|'them', text, startSec}`. `text` may contain emoji (see the emoji constraint below).
- **`typing`** — `{type: 'typing', id, from?: 'me'|'them' (default 'them'), durationSec, startSec}`. **Only a `'them'` typing event can produce a visible bubble**, and only when the *next* message event (by `startSec` order) is also `from: 'them'` — it morphs into that message. Every other case (a `'me'` typing event, a `'them'` typing event followed by a `'me'` message, one with nothing after it, or an earlier one of two in a row) is pacing-only and renders nothing. See `decisions.md` → "A typing event has no independent lifetime."
- **`reaction`** — `{type: 'reaction', id, targetId, emoji, startSec}`. `targetId` must match a `message` event's `id`; the reaction badge pops in at that bubble's outer lower corner from `startSec` onward, for the rest of the video (no auto-dismiss).

## Themes (`src/themes.ts`)

Nine presets sampled from a screenshot of Instagram's own DM Theme picker — `default`, `berry`, `sweets`, `unicorn`, `maple`, `sushi`, `rocket`, `lollipop`, `shadow` — plus `'none'`. Each preset is 3 gradient stops (`{t: 0|0.5|1, color}`). Selecting one recolors the entire chat backdrop with those stops, and recolors sent bubbles with a **45%-darkened** copy of the same stops (`BUBBLE_DARKEN_FACTOR`) so they stay legible against a same-hue background.

## Canvas constants (`src/constants.ts`)

`WIDTH = 1080`, `HEIGHT = 1920`, `FPS = 60`. Fixed — not exposed as a prop anywhere.

## Emoji constraint

Any emoji used in `text` must have a matching PNG in `public/emoji/`, named by Noto Color Emoji convention (`👀` → `emoji_u1f440.png`). An emoji with no matching asset 404s mid-render and **fails the render** — there is no fallback glyph. Currently vendored: 👀 💀 🔥 🤷 😂 (`src/emoji/config.ts` names the asset dir; `src/emoji/parse.ts` does codepoint → filename).

## The web app

### `GET /`

The generator UI. Client-side state for: `theme`, `receiverName`, `receiverUsername`, `clock`, and a message list (`{from, text}[]`, edited via add/remove/edit rows). These feed a live `@remotion/player` preview using `buildEventsFromScript()` for timing, and — unmodified — become the body of the render request. Everything in `IgDmReelProps` *not* listed here (`background`, `safeZones`, `scrollAnchor`, `spring`, `reaction` events, per-message custom timing) is fixed at the `baseIgDmReelProps` defaults; reaching those requires Studio or the CLI.

### `POST /api/render`

Request body (`generateRequestSchema`, `src/types.ts`):

```ts
{
  theme: ThemeName;                 // one of the 10 values above
  receiverName: string;             // 1–40 chars
  receiverUsername?: string;        // ≤40 chars, defaults to '@jordan.codes'
  clock?: string;                   // ≤8 chars, defaults to '9:41'
  messages: {from: 'me'|'them'; text: string}[];  // 1–40 items, each text 1–280 chars
}
```

Server behavior:
1. Validate the body against `generateRequestSchema`. Fails closed with `400` and the first Zod issue message on any violation — nothing renders on invalid input.
2. Turn `messages` into a full `TimelineEvent[]` via `buildEventsFromScript()` (`src/lib/scriptToEvents.ts`) — the same function the live preview uses, so preview and output can't drift. A `'them'` message gets a preceding typing beat (1.2s, +0.15s gap); a `'me'` message spends an equivalent beat but draws no bubble (see the `typing` constraint above). Read pause after each message: `min(1.6, 0.5 + 0.02 × text.length)` seconds.
3. Merge with `baseIgDmReelProps` + `defaultReceiver` (name/username overridden from the request), validate the assembled object against `igDmReelPropsSchema`.
4. `selectComposition` + `renderMedia` against the pre-built bundle at `remotion-bundle/` (must exist — built by `npm run bundle:remotion`, part of `npm run build`). Browser: `@sparticuz/chromium` when `VERCEL` or `AWS_LAMBDA_FUNCTION_NAME` is set, otherwise Remotion's own local browser.

Response: `200` with `Content-Type: video/mp4`, `Content-Disposition: attachment; filename="ig-dm-reel.mp4"`, raw MP4 bytes. `500` with `{error: string}` on any render failure (bundle missing, browser launch failure, encode failure, etc.).

No authentication. No rate limiting beyond the length caps above.

## Out of scope

- No persistence — nothing is saved server-side; each `/api/render` call is stateless in, MP4 out.
- No account system, no saved scripts, no share links.
- No video/image/gradient chat backgrounds from the UI (schema allows it, nothing wires it up).
- No custom avatar upload — fixed to `public/avatar-demo.svg`.
- No automated tests. Verification is manual: render a still or a full video and look at it.
