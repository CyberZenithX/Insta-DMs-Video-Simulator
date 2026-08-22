import React from 'react';
import {interFontFamily} from '../lib/font';
import {layout} from '../tokens';

const SignalBars: React.FC<{sizePx: number}> = ({sizePx}) => (
	<svg width={sizePx} height={sizePx * 0.7} viewBox="0 0 20 14" fill="none">
		<rect x="0" y="9" width="3.5" height="5" rx="0.8" fill="white" />
		<rect x="5.5" y="6.5" width="3.5" height="7.5" rx="0.8" fill="white" />
		<rect x="11" y="3.5" width="3.5" height="10.5" rx="0.8" fill="white" />
		<rect x="16.5" y="0" width="3.5" height="14" rx="0.8" fill="white" />
	</svg>
);

const Wifi: React.FC<{sizePx: number}> = ({sizePx}) => (
	<svg width={sizePx} height={sizePx * 0.75} viewBox="0 0 20 15" fill="none">
		<path
			d="M10 14.2c.9 0 1.7-.75 1.7-1.7 0-.94-.76-1.7-1.7-1.7-.94 0-1.7.76-1.7 1.7 0 .95.76 1.7 1.7 1.7Z"
			fill="white"
		/>
		<path
			d="M5.8 9.2a6 6 0 0 1 8.4 0l1.6-1.65a8.3 8.3 0 0 0-11.6 0L5.8 9.2Z"
			fill="white"
		/>
		<path
			d="M2.4 5.7a10.9 10.9 0 0 1 15.2 0l1.65-1.7a13.2 13.2 0 0 0-18.5 0l1.65 1.7Z"
			fill="white"
		/>
	</svg>
);

const Battery: React.FC<{sizePx: number}> = ({sizePx}) => (
	<svg width={sizePx} height={sizePx * 0.48} viewBox="0 0 25 12" fill="none">
		<rect x="0.75" y="0.75" width="20.5" height="10.5" rx="2.5" stroke="white" strokeOpacity="0.5" />
		<rect x="2.25" y="2.25" width="17.5" height="7.5" rx="1.5" fill="white" />
		<rect x="22" y="4" width="2" height="4" rx="1" fill="white" fillOpacity="0.5" />
	</svg>
);

export const StatusBar: React.FC<{frameWidthPx: number; clock: string}> = ({
	frameWidthPx,
	clock,
}) => {
	const heightPx = frameWidthPx * layout.statusBarHeight;
	const iconSize = heightPx * 0.34;

	return (
		<div
			style={{
				height: heightPx,
				width: '100%',
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'space-between',
				paddingLeft: frameWidthPx * 0.045,
				paddingRight: frameWidthPx * 0.045,
				boxSizing: 'border-box',
				color: '#FFFFFF',
			}}
		>
			<div
				style={{
					fontFamily: interFontFamily,
					fontWeight: 600,
					fontSize: heightPx * 0.42,
					letterSpacing: -0.2,
				}}
			>
				{clock}
			</div>
			<div style={{display: 'flex', alignItems: 'center', gap: iconSize * 0.35}}>
				<SignalBars sizePx={iconSize} />
				<Wifi sizePx={iconSize} />
				<Battery sizePx={iconSize * 1.25} />
			</div>
		</div>
	);
};
