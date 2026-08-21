import React from 'react';
import {Img} from 'remotion';
import {interFontFamily} from '../lib/font';
import {layout, colors} from '../tokens';
import type {IgDmReelProps} from '../types';

const PhoneIcon: React.FC<{sizePx: number}> = ({sizePx}) => (
	<svg width={sizePx} height={sizePx} viewBox="0 0 24 24" fill="none">
		<path
			d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.9 21 3 13.1 3 3.5c0-.6.4-1 1-1h3.4c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.4 0 .8-.3 1L6.6 10.8Z"
			fill="white"
		/>
	</svg>
);

const VideoIcon: React.FC<{sizePx: number}> = ({sizePx}) => (
	<svg width={sizePx} height={sizePx} viewBox="0 0 24 24" fill="none">
		<rect x="2" y="6" width="14" height="12" rx="2.5" fill="white" />
		<path d="M18 10.2 22 7.5v9l-4-2.7v-3.6Z" fill="white" />
	</svg>
);

const Chevron: React.FC<{sizePx: number}> = ({sizePx}) => (
	<svg width={sizePx} height={sizePx} viewBox="0 0 24 24" fill="none">
		<path
			d="M15.5 4 7 12.5 15.5 21"
			stroke="white"
			strokeWidth="2.4"
			strokeLinecap="round"
			strokeLinejoin="round"
		/>
	</svg>
);

export const DmHeader: React.FC<{
	frameWidthPx: number;
	receiver: IgDmReelProps['receiver'];
}> = ({frameWidthPx, receiver}) => {
	const heightPx = frameWidthPx * layout.headerHeight;
	const avatarSize = heightPx * 0.62;
	const iconSize = heightPx * 0.36;
	const chevronSize = heightPx * 0.4;

	return (
		<div
			style={{
				height: heightPx,
				width: '100%',
				display: 'flex',
				alignItems: 'center',
				paddingLeft: frameWidthPx * 0.045,
				paddingRight: frameWidthPx * 0.045,
				boxSizing: 'border-box',
				gap: frameWidthPx * 0.03,
			}}
		>
			<Chevron sizePx={chevronSize} />
			<Img
				src={receiver.avatar}
				style={{
					width: avatarSize,
					height: avatarSize,
					borderRadius: '50%',
					objectFit: 'cover',
					flexShrink: 0,
				}}
			/>
			<div style={{display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0}}>
				<div
					style={{
						fontFamily: interFontFamily,
						fontWeight: 700,
						fontSize: heightPx * 0.28,
						color: '#FFFFFF',
						whiteSpace: 'nowrap',
						overflow: 'hidden',
						textOverflow: 'ellipsis',
					}}
				>
					{receiver.name}
				</div>
				<div
					style={{
						fontFamily: interFontFamily,
						fontWeight: 400,
						fontSize: heightPx * 0.19,
						color: colors.metaText,
						whiteSpace: 'nowrap',
						overflow: 'hidden',
						textOverflow: 'ellipsis',
					}}
				>
					{receiver.activeNow ? 'Active now' : receiver.username}
				</div>
			</div>
			<div style={{display: 'flex', alignItems: 'center', gap: frameWidthPx * 0.045}}>
				<PhoneIcon sizePx={iconSize} />
				<VideoIcon sizePx={iconSize * 1.15} />
			</div>
		</div>
	);
};
