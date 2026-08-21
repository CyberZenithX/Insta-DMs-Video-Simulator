import {geometry} from '../tokens';
import {createMeasurer, wrapMessageText, WrappedLine} from './textMeasure';
import {interFontFamily} from './font';

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
 */
export const computeBubbleLayout = (text: string, frameWidthPx: number): BubbleLayout => {
	const fontSizePx = frameWidthPx * geometry.fontSize;
	const lineHeightPx = frameWidthPx * geometry.lineHeight;
	const paddingHPx = frameWidthPx * geometry.bubblePaddingH;
	const paddingVPx = frameWidthPx * geometry.bubblePaddingV;
	const maxBubbleWidthPx = frameWidthPx * geometry.maxBubbleWidth;
	const maxTextWidthPx = maxBubbleWidthPx - paddingHPx * 2;
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
