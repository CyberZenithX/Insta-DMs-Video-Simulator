import {spring} from 'remotion';
import type {ReactionEvent} from '../types';
import type {FrameLayout} from './timeline';
import {bubbleXRange} from './timeline';

export type ReactionRender = {
	id: string;
	targetId: string;
	targetFrom: 'me' | 'them';
	emoji: string;
	x: number;
	y: number;
	scale: number;
	opacity: number;
	sizePx: number;
};

/** Bouncier than the bubble spring by design — a reaction should overshoot like a double-tap heart. */
const REACTION_SPRING_CONFIG = {damping: 11, mass: 0.5, stiffness: 260};

/**
 * Places a popped-in emoji badge at the outer lower corner of its target
 * bubble (the corner away from the wall it's pinned to), the way a
 * double-tap reaction lands on Instagram.
 */
export const computeReactions = (
	reactionEvents: ReactionEvent[],
	frameLayout: FrameLayout,
	frame: number,
	fps: number,
	frameWidthPx: number,
): ReactionRender[] => {
	const sizePx = frameWidthPx * 0.09;
	const results: ReactionRender[] = [];

	for (const ev of reactionEvents) {
		const startFrame = Math.round(ev.startSec * fps);
		if (frame < startFrame) continue;

		const row = frameLayout.rows.find((r) => r.id === ev.targetId);
		if (!row) continue;

		const [left, right] = bubbleXRange(row, frameWidthPx);
		const x = row.from === 'me' ? left : right;
		const y = row.bottom - frameLayout.scrollOffsetPx;

		const v = spring({frame: frame - startFrame, fps, config: REACTION_SPRING_CONFIG});

		results.push({
			id: ev.id,
			targetId: row.id,
			targetFrom: row.from,
			emoji: ev.emoji,
			x,
			y,
			scale: v,
			opacity: Math.min(1, v / 0.6),
			sizePx,
		});
	}

	return results;
};
