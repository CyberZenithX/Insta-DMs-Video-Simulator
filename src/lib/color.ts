export const hexToRgb = (hex: string): [number, number, number] => {
	const clean = hex.replace('#', '');
	const r = parseInt(clean.slice(0, 2), 16);
	const g = parseInt(clean.slice(2, 4), 16);
	const b = parseInt(clean.slice(4, 6), 16);
	return [r, g, b];
};

export const rgbToHex = (r: number, g: number, b: number): string => {
	const toHex = (v: number) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0');
	return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

/** Scales a hex color's RGB channels toward black by `factor` (0 = unchanged, 1 = black). */
export const darkenHex = (hex: string, factor: number): string => {
	const [r, g, b] = hexToRgb(hex);
	const k = 1 - factor;
	return rgbToHex(r * k, g * k, b * k);
};
