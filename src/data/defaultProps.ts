import type {IgDmReelProps} from '../types';

// This module is imported from both the Remotion bundle (browser context)
// and the Next.js API route (plain Node context, no React) — it must stay
// free of any import from the `remotion` package's React-bearing barrel, or
// Next's server build crashes with "React.createContext is undefined".
// `/avatar-demo.svg` is what `staticFile('avatar-demo.svg')` resolves to
// outside a browser `window.remotion_staticBase` context anyway.

export const defaultSafeZones = {
	topEnd: 0.06,
	railX: 0.79,
	railTop: 0.38,
	railBottom: 0.96,
	bottomStart: 0.82,
};

export const defaultReceiver: IgDmReelProps['receiver'] = {
	name: 'Jordan',
	username: '@jordan.codes',
	avatar: '/avatar-demo.svg',
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
