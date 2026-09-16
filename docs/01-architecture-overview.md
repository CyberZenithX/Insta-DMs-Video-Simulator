# Architecture Overview

This project simulates Instagram Direct Messages (DMs) dynamically as a video using [Remotion](https://www.remotion.dev/). It converts a script of chat events into a programmatic layout, calculating bounds, safe zones, text wrapping, and scrolling animations dynamically.

## Core Stack
- **Remotion**: Drives the video frame generation and timeline logic.
- **React**: Handles declarative UI rendering (for individual chat bubbles, backgrounds, headers).
- **TypeScript**: Strictly typed structures ensuring reliable event handling.

## Directory Structure
- `src/compositions/`
  - `IgDmReel.tsx`: The primary composition. It aggregates events, determines the timeline duration, computes layout data per frame (`computeFrameLayout`), and loops over the rendered rows to spit out `<Bubble />`s and `<ReactionBadge />`s.
- `src/components/`
  - **`Bubble.tsx`**: Renders a single chat bubble. Includes support for "typing dots", emoji parsing, and message transitions. (Optimized for performance using `translate3d`).
  - **`PhoneFrame.tsx`**: The main viewport, including standard iPhone/Instagram UI overlays (Status Bar, DMs header).
- `src/lib/`
  - **`timeline.ts`**: The mathematical core for calculating frame-by-frame positional layout.
  - **`reactions.ts`**: Physics simulations for double-tap emoji reactions.
  - **`bubbleLayout.ts` / `textMeasure.ts`**: Pre-calculates exact dimensions and line breaks of text using an off-screen canvas context, bypassing the slow DOM text wrap logic during the frame-render loop.

## The Entry Point
`src/index.ts` loads `src/Root.tsx`, which registers the `IgDmReel` composition. When Remotion runs (either locally via CLI or via `@remotion/lambda`), it evaluates `calculateIgDmReelMetadata` to figure out the duration of the video based on the chat timeline, and then renders the composition for each frame.
