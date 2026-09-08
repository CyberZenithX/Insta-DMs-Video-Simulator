import type {IgDmReelProps} from '../types';

// This module is imported from both the Remotion bundle (browser context)
// and the Next.js API route (plain Node context, no React) — it must stay
// free of any import from the `remotion` package's React-bearing barrel, or
// Next's server build crashes with "React.createContext is undefined".
//
// So `receiver.avatar` is stored as a bare public/-relative filename, not a
// resolved URL — DmHeader.tsx (browser context, already imports `remotion`)
// is the sole reader of it and resolves it through staticFile() at the point
// of use. That's deliberate, not incidental: staticFile() is the one thing
// that resolves correctly in every context this value flows through —
// Remotion Studio, the Next.js <Player> preview, local in-process rendering
// (remotion-bundle/, with public/ flattened into its root — see
// bundle-remotion.mjs), and a Remotion Lambda deploy, whose site lives under
// an S3 prefix (`sites/<name>/...`), not the bucket root. A hardcoded
// root-relative path like `/avatar-demo.svg` looked correct locally but
// silently resolved against the S3 bucket's own root on Lambda, 404ing.

export const defaultAvatarFile = 'avatar-demo.svg';

// railX/railTop were re-measured against a real posted Reel (a screenshot
// of this app's own output, viewed on Instagram) rather than trusted as
// originally estimated, using the video's own top edge (found by scanning
// for the black-OS-chrome-to-content transition) as the pixel origin, and
// cross-checked against where this composition's own clock text landed
// relative to it before trusting anything derived from that origin:
//
// - railX: the heart/comment/share icons' own leftmost pixels sit at
//   x=961/965/962 of a 1080-wide frame (0.890/0.893/0.891) — comfortably
//   right of the previous 0.79, which was costing sent bubbles ~125px of
//   real, safe width for no reason. Using the minimum (0.890) of the three,
//   the widest/leftmost-reaching icon decides the boundary, not an average
//   that could still let some other icon poke past it.
// - railTop: the heart icon's own top edge sits at 0.505 of frame height,
//   not the previous 0.38 — that excluded an extra 0.125 (240px) of
//   vertical space above the rail that nothing actually occupies.
// - railBottom (0.96) was checked too and left alone: the last real
//   element (a small audio-attribution icon) bottoms out at 0.901, so the
//   existing value already has slack rather than being wrong.
//
// Note railTop/railBottom are consumed only by SafeZoneGrid's calibration
// overlay right now — the bubble-clearance fix in bubbleLayout.ts/
// timeline.ts constrains horizontal position unconditionally (regardless of
// vertical position), not only within [railTop, railBottom]. So this
// correction fixes the calibration reference itself; it doesn't by itself
// change what a bubble is allowed to do. Making the horizontal constraint
// apply *only* within this vertical band (freeing up full width above/
// below it) is a separate, larger change with a real tradeoff — bubble
// width would stop being a fixed, frame-independent fact about a message
// and start depending on scroll position, which is exactly what "Text
// measurement gates rendering" (CLAUDE.md) and the measured-once layout
// pipeline currently assume never happens.
export const defaultSafeZones = {
	topEnd: 0.06,
	railX: 0.89,
	railTop: 0.505,
	railBottom: 0.96,
	bottomStart: 0.82,
};

export const defaultReceiver: IgDmReelProps['receiver'] = {
	name: 'Jordan',
	username: '@jordan.codes',
	avatar: defaultAvatarFile,
	activeNow: true,
};

/** Everything in IgDmReelProps that isn't part of a message script or theme. */
export const baseIgDmReelProps: Omit<IgDmReelProps, 'events' | 'receiver' | 'clock' | 'theme'> = {
	background: {kind: 'solid', value: '#0B0B0F'},
	safeZones: defaultSafeZones,
	scrollAnchor: 0.75,
	spring: {damping: 20, mass: 0.6, stiffness: 180},
	tailSec: 2.5,
};

export const defaultClock = '9:41';
