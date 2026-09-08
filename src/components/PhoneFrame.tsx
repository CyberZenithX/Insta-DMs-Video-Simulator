import React from 'react';
import {StatusBar} from './StatusBar';
import {DmHeader} from './DmHeader';
import {colors} from '../tokens';
import {computeChromeHeightPx, computeChromeStartPx} from '../lib/chrome';
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
	const chromeStartPx = computeChromeStartPx(frameHeightPx, safeZones);
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
			{/* Blank space clearing Instagram's own Reels-viewer chrome — see
			    computeChromeStartPx. Nothing to paint here: PhoneFrame's own
			    background above already shows through. Both the status bar and
			    the header sit below this, not just the header — Instagram's
			    overlay covers the whole top band, not only where the header is. */}
			<div style={{height: chromeStartPx}} />
			<StatusBar frameWidthPx={frameWidthPx} clock={clock} />
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
