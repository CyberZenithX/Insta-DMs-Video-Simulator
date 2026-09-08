import {geometry} from '../tokens';
import {createMeasurer, wrapMessageText, WrappedLine} from './textMeasure';
import {interFontFamily} from './font';
import type {SafeZones} from '../types';

export type BubbleLayout = {
	lines: WrappedLine[];
	widthPx: number;
	heightPx: number;
	fontSizePx: number;
	lineHeightPx: number;
	paddingHPx: number;
	paddingVPx: number;
};

const FONT_WEIGHT = 400;

/**
 * Computes exact pixel dimensions for a message bubble at a given frame
 * width. This is the single source of truth for bubble size: the scroll
 * stack layout and the painted bubble both call this, so they can never
 * disagree.
 *
 * `from` and `safeZones` narrow the cap for a received bubble specifically:
 * received bubbles are left-anchored (see `bubbleXRange`), so a bubble's
 * *width* is what determines whether its right edge reaches the icon rail —
 * unlike a sent bubble, whose right *anchor position* is capped instead
 * (its width was already safely inside `maxBubbleWidth` either way). Capping
 * width instead of clamping the rendered box after the fact keeps the
 * bubble's box and its wrapped text in agreement — this is the one place
 * that decides how many characters fit per line, so anything downstream
 * (height, stack position, scroll target) is already correct rather than
 * needing a second, separate clip.
 */
export const computeBubbleLayout = (
	text: string,
	frameWidthPx: number,
	from: 'me' | 'them',
	safeZones: SafeZones,
): BubbleLayout => {
	const fontSizePx = frameWidthPx * geometry.fontSize;
	const lineHeightPx = frameWidthPx * geometry.lineHeight;
	const paddingHPx = frameWidthPx * geometry.bubblePaddingH;
	const paddingVPx = frameWidthPx * geometry.bubblePaddingV;
	const maxBubbleWidthPx = frameWidthPx * geometry.maxBubbleWidth;

	let effectiveMaxBubbleWidthPx = maxBubbleWidthPx;
	if (from === 'them') {
		// The rail's own boundary, minus a small clearance gutter, minus how
		// far a reaction badge can overhang past this bubble's right edge if
		// one ever lands on it (reactions are separate events that can be
		// added to any message, so this can't be conditional on whether this
		// particular message currently has one).
		const safeRightEdgePx =
			frameWidthPx * safeZones.railX -
			frameWidthPx * geometry.safeEdgeClearance -
			frameWidthPx * geometry.reactionBadgeSize * (1 - geometry.reactionBadgeInset);
		const receivedLeftPx = frameWidthPx * geometry.receivedLeftOffset;
		effectiveMaxBubbleWidthPx = Math.max(0, Math.min(maxBubbleWidthPx, safeRightEdgePx - receivedLeftPx));
	}

	const maxTextWidthPx = effectiveMaxBubbleWidthPx - paddingHPx * 2;
	const emojiSizePx = fontSizePx * 1.15;

	const measurer = createMeasurer(interFontFamily, FONT_WEIGHT, fontSizePx, 0);
	const wrap = wrapMessageText(text, measurer, maxTextWidthPx, emojiSizePx);

	const widthPx = wrap.contentWidthPx + paddingHPx * 2;
	const heightPx = paddingVPx * 2 + wrap.lines.length * lineHeightPx;

	return {
		lines: wrap.lines,
		widthPx,
		heightPx,
		fontSizePx,
		lineHeightPx,
		paddingHPx,
		paddingVPx,
	};
};

export const typingBubbleSize = (frameWidthPx: number) => ({
	widthPx: frameWidthPx * geometry.typingBubbleWidth,
	heightPx: frameWidthPx * geometry.singleLineBubbleHeight,
});
