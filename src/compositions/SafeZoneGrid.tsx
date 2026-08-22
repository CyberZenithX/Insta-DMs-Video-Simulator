import React from 'react';
import {AbsoluteFill, useVideoConfig} from 'remotion';
import type {SafeZoneGridProps} from '../types';
import {interFontFamily, useInterFontReady} from '../lib/font';

const RULE_STEP = 0.05;

const GridLabel: React.FC<{
	text: string;
	x: number;
	y: number;
	fontSizePx: number;
	color: string;
}> = ({text, x, y, fontSizePx, color}) => (
	<div
		style={{
			position: 'absolute',
			left: x,
			top: y,
			fontFamily: interFontFamily,
			fontWeight: 700,
			fontSize: fontSizePx,
			color,
			backgroundColor: 'rgba(0,0,0,0.55)',
			padding: `${fontSizePx * 0.12}px ${fontSizePx * 0.28}px`,
			borderRadius: fontSizePx * 0.2,
			whiteSpace: 'nowrap',
			lineHeight: 1,
		}}
	>
		{text}
	</div>
);

export const SafeZoneGrid: React.FC<SafeZoneGridProps> = ({
	safeZones,
	background,
	gridColor,
	labelColor,
	overlayColor,
}) => {
	const {width, height} = useVideoConfig();
	const fontReady = useInterFontReady();
	const fontSizePx = width * 0.024;

	if (!fontReady) {
		return <AbsoluteFill style={{backgroundColor: background}} />;
	}

	const steps = Math.round(1 / RULE_STEP) - 1;
	const hLines = Array.from({length: steps}, (_, i) => (i + 1) * RULE_STEP);
	const vLines = Array.from({length: steps}, (_, i) => (i + 1) * RULE_STEP);

	return (
		<AbsoluteFill style={{backgroundColor: background}}>
			{/* Safe-zone overlay */}
			<div
				style={{
					position: 'absolute',
					left: 0,
					top: 0,
					width: '100%',
					height: height * safeZones.topEnd,
					backgroundColor: overlayColor,
				}}
			/>
			<div
				style={{
					position: 'absolute',
					left: width * safeZones.railX,
					top: height * safeZones.railTop,
					width: width * (1 - safeZones.railX),
					height: height * (safeZones.railBottom - safeZones.railTop),
					backgroundColor: overlayColor,
				}}
			/>
			<div
				style={{
					position: 'absolute',
					left: 0,
					top: height * safeZones.bottomStart,
					width: '100%',
					height: height * (1 - safeZones.bottomStart),
					backgroundColor: overlayColor,
				}}
			/>

			{/* Grid lines */}
			{hLines.map((t) => (
				<div
					key={`h-${t}`}
					style={{
						position: 'absolute',
						left: 0,
						top: height * t,
						width: '100%',
						height: 2,
						backgroundColor: gridColor,
						opacity: 0.5,
					}}
				/>
			))}
			{vLines.map((t) => (
				<div
					key={`v-${t}`}
					style={{
						position: 'absolute',
						top: 0,
						left: width * t,
						height: '100%',
						width: 2,
						backgroundColor: gridColor,
						opacity: 0.5,
					}}
				/>
			))}

			{/* Labels */}
			{hLines.map((t) => (
				<GridLabel
					key={`hl-${t}`}
					text={t.toFixed(2)}
					x={width * 0.01}
					y={height * t + 6}
					fontSizePx={fontSizePx}
					color={labelColor}
				/>
			))}
			{vLines.map((t) => (
				<GridLabel
					key={`vl-${t}`}
					text={t.toFixed(2)}
					x={width * t + 6}
					y={height * 0.01}
					fontSizePx={fontSizePx}
					color={labelColor}
				/>
			))}
		</AbsoluteFill>
	);
};
