import React from 'react';
import {Img, staticFile} from 'remotion';
import {interFontFamily} from '../lib/font';
import {initialFromName, isAbsoluteAssetUrl} from '../lib/initials';
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

/**
 * The same magenta-to-indigo the old static public/avatar-demo.svg used
 * (its linearGradient ran x1,y1=0%,0% to x2,y2=100%,100%, i.e. top-left to
 * bottom-right, which is CSS's 135deg).
 */
const avatarGradient = 'linear-gradient(135deg, #D500C3 0%, #5A50FB 100%)';

/**
 * The receiver's picture: their own image when `receiver.avatar` is set,
 * otherwise a gradient circle carrying the first letter of their name.
 *
 * The generated form is the default. The old behaviour was a single static
 * file with the letter "J" baked into its markup, so every conversation
 * showed a "J" no matter who it was with. Generating it here also means the
 * header stops depending on a public/ asset at all in the common case —
 * worth noting given progress.md records avatar-demo.svg as one of the two
 * files that silently failed to upload to the S3 site and 404'd mid-render.
 *
 * Pure in its props and independent of `frame`, so the determinism contract
 * (CLAUDE.md) holds: the same receiver always produces the same pixels.
 */
const Avatar: React.FC<{
	receiver: IgDmReelProps['receiver'];
	sizePx: number;
}> = ({receiver, sizePx}) => {
	const shared = {
		width: sizePx,
		height: sizePx,
		borderRadius: '50%',
		flexShrink: 0,
	} as const;

	if (receiver.avatar) {
		return (
			<Img
				// A bare public/-relative filename needs staticFile() to resolve
				// under Studio, the <Player> preview, local rendering and
				// Lambda's sites/<name>/-prefixed S3 site alike (see
				// src/data/defaultProps.ts). An already-complete URL — what the
				// web UI's avatar field accepts — must NOT go through it, since
				// staticFile() would prefix it into a broken path.
				src={isAbsoluteAssetUrl(receiver.avatar) ? receiver.avatar : staticFile(receiver.avatar)}
				style={{...shared, objectFit: 'cover'}}
			/>
		);
	}

	return (
		<div
			style={{
				...shared,
				background: avatarGradient,
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'center',
				fontFamily: interFontFamily,
				fontWeight: 700,
				// 0.45 of the diameter, matching the old SVG's 90px glyph in its
				// own 200px viewBox, so swapping the file for this changes the
				// letter but not its weight on the page.
				fontSize: sizePx * 0.45,
				color: '#FFFFFF',
				// A name with no letter or digit at all yields '', leaving a
				// plain gradient circle rather than a stray placeholder glyph.
				lineHeight: 1,
				userSelect: 'none',
			}}
		>
			{initialFromName(receiver.name)}
		</div>
	);
};

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
			<Avatar receiver={receiver} sizePx={avatarSize} />
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
