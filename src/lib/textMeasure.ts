import {parseMessageText} from '../emoji/parse';

export type WrapUnit =
	| {kind: 'word'; text: string; width: number}
	| {kind: 'space'; text: string; width: number}
	| {kind: 'emoji'; value: string; file: string; width: number};

export type WrappedLine = WrapUnit[];

export type WrapResult = {
	lines: WrappedLine[];
	/** Widest line, in px, used to size the bubble (capped by maxWidthPx by construction). */
	contentWidthPx: number;
};

let measureCtx: CanvasRenderingContext2D | null = null;

const getCtx = (): CanvasRenderingContext2D => {
	if (measureCtx) return measureCtx;
	const canvas = document.createElement('canvas');
	const ctx = canvas.getContext('2d');
	if (!ctx) {
		throw new Error('2D canvas context unavailable for text measurement');
	}
	measureCtx = ctx;
	return ctx;
};

/**
 * A canvas-backed word measurer for one exact font configuration. Used both
 * to wrap message text into lines and to size bubbles, so the number we use
 * to lay out the scroll stack always matches what gets painted.
 */
export const createMeasurer = (
	fontFamily: string,
	weight: number,
	sizePx: number,
	letterSpacingPx = 0,
) => {
	const ctx = getCtx();
	const font = `${weight} ${sizePx}px ${fontFamily}`;

	const measureText = (str: string): number => {
		ctx.font = font;
		// letterSpacing is supported in modern Chromium (Remotion's render target).
		(ctx as CanvasRenderingContext2D & {letterSpacing?: string}).letterSpacing =
			`${letterSpacingPx}px`;
		const metrics = ctx.measureText(str);
		const spacingContribution = str.length > 0 ? letterSpacingPx * str.length : 0;
		return metrics.width + spacingContribution;
	};

	return {measureText};
};

/**
 * Wraps message text (with emoji already tokenised) into lines that fit
 * within maxWidthPx, using greedy word wrap with emoji treated as atomic
 * square glyphs of side `emojiSizePx`. Leading/trailing whitespace on each
 * wrapped line is dropped, matching normal CSS text wrapping.
 */
export const wrapMessageText = (
	text: string,
	measurer: {measureText: (s: string) => number},
	maxWidthPx: number,
	emojiSizePx: number,
): WrapResult => {
	const tokens = parseMessageText(text);
	const units: WrapUnit[] = [];

	for (const token of tokens) {
		if (token.type === 'emoji') {
			units.push({kind: 'emoji', value: token.value, file: token.file, width: emojiSizePx});
			continue;
		}
		const parts = token.value.match(/\s+|\S+/g) ?? [];
		for (const part of parts) {
			const isSpace = /^\s+$/.test(part);
			units.push({
				kind: isSpace ? 'space' : 'word',
				text: part,
				width: measurer.measureText(part),
			});
		}
	}

	const lines: WrappedLine[] = [];
	let current: WrapUnit[] = [];
	let currentWidth = 0;

	const trimTrailingSpace = (line: WrapUnit[]) => {
		while (line.length > 0 && line[line.length - 1].kind === 'space') {
			line.pop();
		}
	};

	for (const unit of units) {
		if (unit.kind === 'space' && current.length === 0) {
			// Drop leading whitespace at the start of a line.
			continue;
		}

		const wouldOverflow = currentWidth + unit.width > maxWidthPx;

		if (wouldOverflow && current.length > 0) {
			trimTrailingSpace(current);
			lines.push(current);
			current = [];
			currentWidth = 0;
			if (unit.kind === 'space') {
				continue;
			}
		}

		current.push(unit);
		currentWidth += unit.width;
	}

	trimTrailingSpace(current);
	if (current.length > 0 || lines.length === 0) {
		lines.push(current);
	}

	let contentWidthPx = 0;
	for (const line of lines) {
		const w = line.reduce((sum, u) => sum + u.width, 0);
		contentWidthPx = Math.max(contentWidthPx, w);
	}

	return {lines, contentWidthPx: Math.min(contentWidthPx, maxWidthPx)};
};
