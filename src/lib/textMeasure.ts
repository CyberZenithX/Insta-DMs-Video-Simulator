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
 * Splits a single word that is itself wider than the line box into chunks
 * that each fit, mirroring CSS `overflow-wrap: break-word`.
 *
 * Greedy word wrap alone can only break *between* words, so one long
 * unbroken token (a pasted URL is the everyday case) produced a line wider
 * than maxWidthPx. The bubble is sized to at most maxWidthPx, so that line
 * then ran past the bubble's edge and was silently cut off by its
 * `overflow: hidden` — text lost, off the side of the frame.
 *
 * Iterates code points rather than UTF-16 units so a surrogate pair is never
 * split into two halves.
 */
const breakOversizedWord = (
	text: string,
	measureText: (s: string) => number,
	maxWidthPx: number,
): WrapUnit[] => {
	const chunks: WrapUnit[] = [];
	let current = '';

	for (const char of Array.from(text)) {
		const candidate = current + char;
		// `current !== ''` guarantees progress: a single character wider than
		// the line box still gets emitted rather than looping forever.
		if (current !== '' && measureText(candidate) > maxWidthPx) {
			chunks.push({kind: 'word', text: current, width: measureText(current)});
			current = char;
		} else {
			current = candidate;
		}
	}

	if (current !== '') {
		chunks.push({kind: 'word', text: current, width: measureText(current)});
	}

	return chunks;
};

/**
 * Wraps message text (with emoji already tokenised) into lines that fit
 * within maxWidthPx, using greedy word wrap with emoji treated as atomic
 * square glyphs of side `emojiSizePx`. Leading/trailing whitespace on each
 * wrapped line is dropped, matching normal CSS text wrapping. A word too
 * wide to fit on a line of its own is broken mid-word (see above).
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
			const width = measurer.measureText(part);

			if (!isSpace && width > maxWidthPx) {
				units.push(...breakOversizedWord(part, measurer.measureText, maxWidthPx));
				continue;
			}

			units.push({
				kind: isSpace ? 'space' : 'word',
				text: part,
				width,
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
