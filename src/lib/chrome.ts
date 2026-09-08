import type {SafeZones} from '../types';
import {layout} from '../tokens';

/**
 * Where DmHeader starts, in pixels from the top of the frame.
 *
 * Instagram's own Reels-viewer chrome (back arrow, title, icons) floats
 * over the top of a posted Reel at a fixed screen position — this is what
 * safeZones.topEnd has described since it was introduced, even though
 * nothing used it for anything but SafeZoneGrid's calibration overlay until
 * now. This composition's own DmHeader used to start right after the
 * status bar regardless, which happened to sit entirely underneath that
 * overlay: the name and avatar were never visible on a real posted Reel,
 * only in a bare render. The status bar itself is unaffected — it already
 * clears topEnd on its own.
 */
export const computeHeaderStartPx = (
	frameWidthPx: number,
	frameHeightPx: number,
	safeZones: SafeZones,
): number => Math.max(frameWidthPx * layout.statusBarHeight, frameHeightPx * safeZones.topEnd);

/**
 * Height of the phone chrome (status bar + the topEnd clearance above the
 * header, if any + the header itself), in pixels, before the scrollable
 * chat content begins.
 *
 * Single source of truth for that boundary: PhoneFrame.tsx (which paints
 * it — the header's position and the chat viewport's clipping box both
 * come from here) and IgDmReel.tsx (which needs the same number to size
 * chatViewportHeightPx for the scroll math) must agree, or bubbles end up
 * positioned assuming a chat area that doesn't match where PhoneFrame
 * actually clips content — the same failure mode `computeBubbleLayout`
 * already exists to prevent for bubble size specifically.
 */
export const computeChromeHeightPx = (
	frameWidthPx: number,
	frameHeightPx: number,
	safeZones: SafeZones,
): number => computeHeaderStartPx(frameWidthPx, frameHeightPx, safeZones) + frameWidthPx * layout.headerHeight;
