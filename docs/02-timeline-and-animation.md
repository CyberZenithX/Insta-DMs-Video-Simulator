# Timeline and Animations

Because video rendering requires pixel-perfect determinism across parallel execution (like on AWS Lambda where frames are split into chunks), we **do not use React State (`useState`, `useEffect`)** for animations.

Everything is driven mathematically by `useCurrentFrame()`.

## Event Parsing (`buildSlots`)
In `src/lib/timeline.ts`, the script array (containing `typing` and `message` events) is merged into a single array of `Slot`s via the `buildSlots` function.
- A "Slot" represents a vertical space in the stack. 
- If someone is typing and then sends a message, it is condensed into a *single* Slot with two "phases": `typing` and `message`. This allows the text bubble to seamlessly scale/morph out of the typing dots indicator instead of jumping down.

## Frame Layout (`computeFrameLayout`)
Each frame, `computeFrameLayout` iterates through all visible Slots.
- It calculates their `heightPx`, accumulating the vertical height to establish the layout's total stack height.
- It uses Remotion's `spring()` function based on `useCurrentFrame()` to smoothly transition values (e.g., expanding height from `typing` to `message`).
- **Scroll Position**: As bubbles pop in and expand, the total bottom edge extends. `scrollOffsetPx` is interpolated smoothly alongside the bubble expansion so the newest bubble always anchors perfectly to the bottom of the visible viewport (via `scrollAnchor`).

## Double Tap Reactions (`computeReactions`)
Handled in `src/lib/reactions.ts`. It parses `reaction` events and computes spring animations mapping the emoji to the right or left corner of the targeted `row.id`. The badge overshoots and scales into place using a bouncier spring config (`stiffness: 260, damping: 11`).
