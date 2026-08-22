/**
 * Instagram DM "Theme" background gradients (chat > Theme picker), sampled
 * from a screenshot of the picker. Selecting a theme recolors the whole
 * chat backdrop and the sent-bubble master gradient together, same as the
 * real app.
 */

import {darkenHex} from './lib/color';

export type GradientStop = {t: number; color: string};

export const themeGradients = {
	default: [
		{t: 0, color: '#7C0EBB'},
		{t: 0.5, color: '#4836AE'},
		{t: 1, color: '#105FBC'},
	],
	berry: [
		{t: 0, color: '#1759EB'},
		{t: 0.5, color: '#8C0EEB'},
		{t: 1, color: '#E33537'},
	],
	sweets: [
		{t: 0, color: '#E692B3'},
		{t: 0.5, color: '#A498EA'},
		{t: 1, color: '#1ACFEC'},
	],
	unicorn: [
		{t: 0, color: '#E04DD1'},
		{t: 0.5, color: '#8F33D6'},
		{t: 1, color: '#673ECB'},
	],
	maple: [
		{t: 0, color: '#9D0E4E'},
		{t: 0.5, color: '#BB4344'},
		{t: 1, color: '#C39410'},
	],
	sushi: [
		{t: 0, color: '#DF645C'},
		{t: 0.5, color: '#E18465'},
		{t: 1, color: '#E3A76B'},
	],
	rocket: [
		{t: 0, color: '#E69F13'},
		{t: 0.5, color: '#E64646'},
		{t: 1, color: '#9351B5'},
	],
	lollipop: [
		{t: 0, color: '#E76567'},
		{t: 0.5, color: '#B239A0'},
		{t: 1, color: '#6F59BE'},
	],
	shadow: [
		{t: 0, color: '#66098B'},
		{t: 0.5, color: '#5325CE'},
		{t: 1, color: '#605AD4'},
	],
} as const satisfies Record<string, GradientStop[]>;

export type ThemeKey = keyof typeof themeGradients;
export type ThemeName = ThemeKey | 'none';

/** Vertical CSS gradient for a theme's stops, top of frame to bottom. */
export const themeBackgroundCss = (stops: GradientStop[]): string =>
	`linear-gradient(180deg, ${stops.map((s) => `${s.color} ${(s.t * 100).toFixed(2)}%`).join(', ')})`;

/**
 * Sent bubbles sample the same live gradient as the backdrop behind them
 * (§ "same master gradient" trick), which reads fine against the classic
 * flat-black chat but makes a themed bubble nearly disappear into its own
 * matching background. Darkening the theme's stops keeps the same hue and
 * scroll-tinted motion while giving the bubble enough contrast to still
 * read as a distinct pill.
 */
export const BUBBLE_DARKEN_FACTOR = 0.45;
export const themeBubbleStops = (stops: GradientStop[]): GradientStop[] =>
	stops.map((s) => ({t: s.t, color: darkenHex(s.color, BUBBLE_DARKEN_FACTOR)}));
