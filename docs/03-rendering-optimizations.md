# Rendering Optimizations

Video rendering loops execute 30 to 60 times a second. Slow code leads to extremely long export times. This codebase applies several strict optimization patterns for local and AWS Remotion rendering.

## 1. Zero Layout Thrashing (The `translate3d` Rule)
Components in Remotion are painted in Headless Chromium. Changing standard DOM properties like `left`, `top`, `width`, or `height` on every single frame causes the browser to trigger a full document reflow.

- **The Fix**: `Bubble.tsx` and `ReactionBadge.tsx` use `position: absolute; left: 0; top: 0` and are exclusively positioned dynamically via `transform: translate3d(x, y, 0) scale(s)`.
- **Why?**: CSS Transforms are GPU-accelerated and offloaded to the compositor thread. This keeps layout calculation times near zero.
- **Future Rule**: Never animate `top`, `left`, `margin`, or `padding`. Always use `transform`.

## 2. Text Pre-measurement
Rendering long wrapping text inside `div`s is very slow if Chromium has to compute the line breaks natively every frame.
- **Solution (`textMeasure.ts`)**: We use a hidden `<canvas>` `measureText()` context to pre-calculate line widths, break arrays of text into discrete `WrappedLine` items, and statically render them. The layout bounds are determined immediately before the animation loop even starts.

## 3. Memoization
Even though we avoid layout thrashing, React's render phase itself requires CPU time.
- All non-animated inner components (e.g., `WrappedLineView`, `TypingDots`) are wrapped in `React.memo`. If their internal static props don't change, they skip reconciliation.

## 4. Hardware Render Scripts
If you are rendering locally, use the dedicated hardware-acceleration scripts defined in `package.json`:
- **Mac**: `npm run render:local:mac` (Uses `h264-videotoolbox`)
- **PC**: `npm run render:local:pc` (Uses `h264-nvenc`)
This offloads the final FFmpeg `x264` stitching process from the CPU to the GPU.
