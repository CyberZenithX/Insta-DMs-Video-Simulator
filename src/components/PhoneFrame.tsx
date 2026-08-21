import React from 'react';
import {StatusBar} from './StatusBar';
import {DmHeader} from './DmHeader';
import {layout, colors} from '../tokens';
import type {IgDmReelProps} from '../types';

export const PhoneFrame: React.FC<{
	frameWidthPx: number;
	frameHeightPx: number;
	receiver: IgDmReelProps['receiver'];
	clock: string;
	backgroundCss?: string;
	children: React.ReactNode;
}> = ({frameWidthPx, frameHeightPx, receiver, clock, backgroundCss, children}) => {
	const chromeHeightPx = frameWidthPx * (layout.statusBarHeight + layout.headerHeight);

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
