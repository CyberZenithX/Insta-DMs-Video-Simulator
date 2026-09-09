import type {SafeZones} from '../types';
import {layout} from '../tokens';

/**
 * Where the whole phone chrome block (status bar + header) starts, in
 * pixels from the top of the frame.
 *
 * Instagram's own Reels-viewer chrome (back arrow, title, icons) floats
 * over the top of a posted Reel at a fixed screen position — this is what
 * safeZones.topEnd has described since it was introduced, even though
 * nothing used it for anything but SafeZoneGrid's calibration overlay
 * until now. Both the status bar ("9:41", signal/battery) and the header
 * (avatar, name, username) used to start at y=0 regardless, which put the
 * whole block underneath that overlay on a real posted Reel — invisible in
 * a bare render, since nothing draws Instagram's own chrome there.
 *
 * Moving the *entire* block down (not just the header) is deliberate: a
 * status bar sitting above the header but still inside Instagram's own
 * overlay would look like a stray clock digit floating over "Reels" —
 * worse than the original bug, not better.
 */
export const computeChromeStartPx = (frameHeightPx: number, safeZones: SafeZones): number =>
	frameHeightPx * safeZones.topEnd;

/**
 * Height of the phone chrome (the topEnd clearance above it + status bar +
 * header), in pixels, before the scrollable chat content begins.
 *
 * Single source of truth for that boundary: PhoneFrame.tsx (which paints
 * it — the chrome block's position and the chat viewport's clipping box
 * both come from here) and IgDmReel.tsx (which needs the same number to
 * size chatViewportHeightPx for the scroll math) must agree, or bubbles
 * end up positioned assuming a chat area that doesn't match where
 * PhoneFrame actually clips content — the same failure mode
 * `computeBubbleLayout` already exists to prevent for bubble size
 * specifically.
 */
export const computeChromeHeightPx = (
	frameWidthPx: number,
	frameHeightPx: number,
	safeZones: SafeZones,
): number =>
	computeChromeStartPx(frameHeightPx, safeZones) +
	frameWidthPx * (layout.statusBarHeight + layout.headerHeight);
