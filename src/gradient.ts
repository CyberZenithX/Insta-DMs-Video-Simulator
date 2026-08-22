import type {GradientStop} from './themes';
import {hexToRgb, rgbToHex} from './lib/color';

const sortedRgbStops = (stops: GradientStop[]) =>
	stops
		.slice()
		.sort((a, b) => a.t - b.t)
		.map((stop) => ({t: stop.t, rgb: hexToRgb(stop.color)}));

/**
 * Interpolates a gradient's stops in sRGB space at position t, where t=0 is
 * the top of the chat viewport and t=1 is the bottom.
 */
export const colourAt = (stops: GradientStop[], t: number): string => {
	const sorted = sortedRgbStops(stops);
	const clamped = Math.min(1, Math.max(0, t));

	if (clamped <= sorted[0].t) {
		const [r, g, b] = sorted[0].rgb;
		return rgbToHex(r, g, b);
	}

	for (let i = 0; i < sorted.length - 1; i++) {
		const a = sorted[i];
		const b = sorted[i + 1];
		if (clamped >= a.t && clamped <= b.t) {
			const span = b.t - a.t || 1;
			const localT = (clamped - a.t) / span;
			const r = a.rgb[0] + (b.rgb[0] - a.rgb[0]) * localT;
			const g = a.rgb[1] + (b.rgb[1] - a.rgb[1]) * localT;
			const bl = a.rgb[2] + (b.rgb[2] - a.rgb[2]) * localT;
			return rgbToHex(r, g, bl);
		}
	}

	const last = sorted[sorted.length - 1].rgb;
	return rgbToHex(last[0], last[1], last[2]);
};

/**
 * Builds a CSS linear-gradient for a bubble spanning [tTop, tBottom] of the
 * chat viewport, sampling the master gradient at a fixed number of internal
 * stops so the visible slice curves the same way the master gradient does.
 */
export const bubbleGradientCss = (
	stops: GradientStop[],
	tTop: number,
	tBottom: number,
	samples = 6,
): string => {
	const stopsCss: string[] = [];
	for (let i = 0; i <= samples; i++) {
		const localT = i / samples;
		const t = tTop + (tBottom - tTop) * localT;
		const pct = (localT * 100).toFixed(2);
		stopsCss.push(`${colourAt(stops, t)} ${pct}%`);
	}
	return `linear-gradient(180deg, ${stopsCss.join(', ')})`;
};
