import React from 'react';
import {StatusBar} from './StatusBar';
import {DmHeader} from './DmHeader';
import {layout, colors} from '../tokens';
import {computeChromeHeightPx, computeHeaderStartPx} from '../lib/chrome';
import type {IgDmReelProps, SafeZones} from '../types';

export const PhoneFrame: React.FC<{
	frameWidthPx: number;
	frameHeightPx: number;
	receiver: IgDmReelProps['receiver'];
	clock: string;
	backgroundCss?: string;
	safeZones: SafeZones;
	children: React.ReactNode;
}> = ({frameWidthPx, frameHeightPx, receiver, clock, backgroundCss, safeZones, children}) => {
	const statusBarHeightPx = frameWidthPx * layout.statusBarHeight;
	const headerStartPx = computeHeaderStartPx(frameWidthPx, frameHeightPx, safeZones);
	const chromeHeightPx = computeChromeHeightPx(frameWidthPx, frameHeightPx, safeZones);

	return (
		<div
			style={{
				position: 'absolute',
				left: 0,
				top: 0,
				width: frameWidthPx,
				height: frameHeightPx,
				overflow: 'hidden',
				background: backgroundCss ?? colors.chatBackground,
			}}
		>
			<StatusBar frameWidthPx={frameWidthPx} clock={clock} />
			{/* Blank space clearing Instagram's own Reels-viewer chrome — see
			    computeHeaderStartPx. Nothing to paint here: PhoneFrame's own
			    background above already shows through. */}
			<div style={{height: headerStartPx - statusBarHeightPx}} />
			<DmHeader frameWidthPx={frameWidthPx} receiver={receiver} />
			<div
				style={{
					position: 'relative',
					width: '100%',
					height: frameHeightPx - chromeHeightPx,
					overflow: 'hidden',
				}}
			>
				{children}
			</div>
		</div>
	);
};
