import React from 'react';
import {interpolate} from 'remotion';
import type {RenderRow} from '../lib/timeline';
import {bubbleXRange} from '../lib/timeline';
import {bubbleGradientCss} from '../gradient';
import {colors, geometry, fontFamilyFallback} from '../tokens';
import {interFontFamily} from '../lib/font';
import type {WrappedLine} from '../lib/textMeasure';
import {EmojiImage} from '../emoji/EmojiText';

const WrappedLineView: React.FC<{line: WrappedLine; fontSizePx: number}> = ({line, fontSizePx}) => (
	<div style={{whiteSpace: 'pre'}}>
		{line.map((unit, i) => {
			if (unit.kind === 'emoji') {
				return <EmojiImage key={i} file={unit.file} fontSizePx={fontSizePx} alt={unit.value} />;
			}
			return <React.Fragment key={i}>{unit.text}</React.Fragment>;
		})}
	</div>
);

const TypingDots: React.FC<{frame: number; fps: number; sizePx: number; opacity: number}> = ({
	frame,
	fps,
	sizePx,
	opacity,
}) => {
	const dotSize = sizePx;
	return (
		<div style={{display: 'flex', alignItems: 'center', gap: dotSize * 0.9, opacity}}>
			{[0, 1, 2].map((i) => {
				const phase = (frame / fps) * 3.4 - i * 0.55;
				const bounce = (Math.sin(phase * Math.PI * 2) + 1) / 2;
				const scale = 0.55 + bounce * 0.45;
				const dotOpacity = 0.45 + bounce * 0.55;
				return (
					<div
						key={i}
						style={{
							width: dotSize,
							height: dotSize,
							borderRadius: '50%',
							backgroundColor: colors.receivedText,
							opacity: dotOpacity,
							transform: `scale(${scale})`,
						}}
					/>
				);
			})}
		</div>
	);
};

export const Bubble: React.FC<{
	row: RenderRow;
	frame: number;
	fps: number;
	frameWidthPx: number;
	chatViewportHeightPx: number;
	scrollOffsetPx: number;
}> = ({row, frame, fps, frameWidthPx, chatViewportHeightPx, scrollOffsetPx}) => {
	const [left] = bubbleXRange(row, frameWidthPx);
	const topViewport = row.top - scrollOffsetPx;
	const radiusPx = frameWidthPx * geometry.bubbleRadius;

	const scale = 0.55 + 0.45 * row.entrance.v;
	const opacity = interpolate(row.entrance.v, [0, 1], [0, 1], {
		extrapolateLeft: 'clamp',
		extrapolateRight: 'clamp',
	});
	const translateYPx = frameWidthPx * 0.025 * (1 - row.entrance.v);
	const transformOrigin = row.from === 'me' ? 'bottom right' : 'bottom left';

	let background: string;
	let textColor = colors.receivedText;

	if (row.content.kind === 'typing') {
		background = colors.receivedBubble;
	} else if (row.content.kind === 'transition') {
		background = colors.receivedBubble;
	} else if (row.from === 'me') {
		const tTop = topViewport / chatViewportHeightPx;
		const tBottom = (row.bottom - scrollOffsetPx) / chatViewportHeightPx;
		background = bubbleGradientCss(tTop, tBottom);
	} else {
		background = colors.receivedBubble;
	}

	const dotSizePx = frameWidthPx * geometry.typingDotSize;

	return (
		<div
			style={{
				position: 'absolute',
				left,
				top: topViewport,
				width: row.widthPx,
				height: row.heightPx,
				borderRadius: radiusPx,
				background,
				opacity,
				transform: `translateY(${translateYPx}px) scale(${scale})`,
				transformOrigin,
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'center',
				boxSizing: 'border-box',
				overflow: 'hidden',
			}}
		>
			{row.content.kind === 'typing' && (
				<TypingDots frame={frame} fps={fps} sizePx={dotSizePx} opacity={1} />
			)}

			{row.content.kind === 'message' &&
				(() => {
					const {phase} = row.content;
					return (
						<div
							style={{
								width: '100%',
								height: '100%',
								boxSizing: 'border-box',
								padding: `${phase.paddingVPx}px ${phase.paddingHPx}px`,
								display: 'flex',
								flexDirection: 'column',
								justifyContent: 'center',
								fontFamily: `${interFontFamily}, ${fontFamilyFallback}`,
								fontWeight: 400,
								fontSize: phase.fontSizePx,
								lineHeight: `${phase.lineHeightPx}px`,
								color: textColor,
							}}
						>
							{phase.lines.map((line, i) => (
								<WrappedLineView key={i} line={line} fontSizePx={phase.fontSizePx} />
							))}
						</div>
					);
				})()}

			{row.content.kind === 'transition' &&
				(() => {
					const {v, to} = row.content;
					return (
						<>
							<div
								style={{
									position: 'absolute',
									inset: 0,
									display: 'flex',
									alignItems: 'center',
									justifyContent: 'center',
								}}
							>
								<TypingDots frame={frame} fps={fps} sizePx={dotSizePx} opacity={1 - v} />
							</div>
							<div
								style={{
									position: 'absolute',
									inset: 0,
									boxSizing: 'border-box',
									padding: `${to.paddingVPx}px ${to.paddingHPx}px`,
									display: 'flex',
									flexDirection: 'column',
									justifyContent: 'center',
									fontFamily: `${interFontFamily}, ${fontFamilyFallback}`,
									fontWeight: 400,
									fontSize: to.fontSizePx,
									lineHeight: `${to.lineHeightPx}px`,
									color: textColor,
									opacity: v,
								}}
							>
								{to.lines.map((line, i) => (
									<WrappedLineView key={i} line={line} fontSizePx={to.fontSizePx} />
								))}
							</div>
						</>
					);
				})()}
		</div>
	);
};
