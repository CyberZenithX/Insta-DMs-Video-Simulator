import {useEffect, useState} from 'react';
import {continueRender, delayRender, staticFile} from 'remotion';

/**
 * Inter is self-hosted (public/fonts) rather than fetched from Google Fonts
 * at render time — a render-time CDN dependency is a flaky thing to build
 * a deterministic pipeline on, and text measurement below needs the real
 * metrics loaded before it can run.
 */
export const interFontFamily = 'Insta DM Inter';

const FONT_FACES = [
	{weight: 400, file: 'Inter-400.woff2'},
	{weight: 600, file: 'Inter-600.woff2'},
	{weight: 700, file: 'Inter-700.woff2'},
] as const;

let injected = false;

const ensureFontFacesInjected = () => {
	if (injected || typeof document === 'undefined') return;
	const style = document.createElement('style');
	style.textContent = FONT_FACES.map(
		({weight, file}) => `
		@font-face {
			font-family: '${interFontFamily}';
			font-style: normal;
			font-weight: ${weight};
			src: url('${staticFile(`fonts/${file}`)}') format('woff2');
			font-display: block;
		}
	`,
	).join('\n');
	document.head.appendChild(style);
	injected = true;
};

/**
 * Blocks Remotion frame capture until Inter has finished loading. Must be
 * mounted once near the composition root — text measurement (and therefore
 * bubble layout) is only correct once the real font metrics are available.
 */
export const useInterFontReady = (): boolean => {
	const [ready, setReady] = useState(false);

	useEffect(() => {
		const handle = delayRender('Loading self-hosted Inter font for deterministic text measurement');
		ensureFontFacesInjected();

		Promise.all(FONT_FACES.map(({weight}) => document.fonts.load(`${weight} 40px "${interFontFamily}"`)))
			.then(() => document.fonts.ready)
			.then(() => {
				setReady(true);
				continueRender(handle);
			})
			.catch((err) => {
				console.error('Failed to load Inter font', err);
				continueRender(handle);
			});
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	return ready;
};
