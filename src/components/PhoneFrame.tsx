import React from 'react';
import {StatusBar} from './StatusBar';
import {DmHeader} from './DmHeader';
import {layout, colors} from '../tokens';
import type {IgDmReelProps} from '../types';

export const PHONE_WIDTH_RATIO = layout.phoneWidthRatio;

export const PhoneFrame: React.FC<{
	frameWidthPx: number;
	frameHeightPx: number;
	receiver: IgDmReelProps['receiver'];
	clock: string;
	children: React.ReactNode;
}> = ({frameWidthPx, frameHeightPx, receiver, clock, children}) => {
	const phoneWidthPx = frameWidthPx * layout.phoneWidthRatio;
	const topPx = frameHeightPx * layout.phoneTop;
	const cornerPx = phoneWidthPx * layout.phoneCornerRadius;
	const phoneHeightPx = frameHeightPx - topPx;
	const chromeHeightPx = phoneWidthPx * (layout.statusBarHeight + layout.headerHeight);

	return (
		<div
			style={{
				position: 'absolute',
				left: 0,
				top: topPx,
				width: phoneWidthPx,
				height: phoneHeightPx,
				borderRadius: `${cornerPx}px ${cornerPx}px 0 0`,
				overflow: 'hidden',
				backgroundColor: colors.chatBackground,
			}}
		>
			<StatusBar frameWidthPx={phoneWidthPx} clock={clock} />
			<DmHeader frameWidthPx={phoneWidthPx} receiver={receiver} />
			<div
				style={{
					position: 'relative',
					width: '100%',
					height: phoneHeightPx - chromeHeightPx,
					overflow: 'hidden',
				}}
			>
				{children}
			</div>
		</div>
	);
};
