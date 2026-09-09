import React, {useMemo} from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import type {CalculateMetadataFunction} from 'remotion';
import type {IgDmReelProps, ReactionEvent} from '../types';
import {useInterFontReady} from '../lib/font';
import {buildSlots, computeFrameLayout, lastActiveFrame} from '../lib/timeline';
import {computeReactions} from '../lib/reactions';
import {computeChromeHeightPx} from '../lib/chrome';
import {colors, sentGradientStops} from '../tokens';
import {themeGradients, themeBackgroundCss, themeBubbleStops} from '../themes';
import {FPS, WIDTH, HEIGHT} from '../constants';
import {Background} from '../components/Background';
import {PhoneFrame} from '../components/PhoneFrame';
import {Bubble} from '../components/Bubble';
import {ReactionBadge} from '../components/ReactionBadge';

export const calculateIgDmReelMetadata: CalculateMetadataFunction<IgDmReelProps> = ({props}) => {
	const lastFrame = lastActiveFrame(props.events, FPS);
	const durationInFrames = Math.max(1, lastFrame + Math.round(props.tailSec * FPS));
	return {durationInFrames, fps: FPS, width: WIDTH, height: HEIGHT};
};

export const IgDmReel: React.FC<IgDmReelProps> = (props) => {
	const {events, receiver, clock, background, theme, scrollAnchor, spring: springConfig, safeZones} = props;
	const frame = useCurrentFrame();
	const {width, height, fps} = useVideoConfig();
	const fontReady = useInterFontReady();

	const reactionEvents = useMemo(
		() => events.filter((e): e is ReactionEvent => e.type === 'reaction'),
		[events],
	);

	// The mockup is a full-bleed screen recording: all phone-interior
	// geometry (§3) was measured as ratios of the real screenshot's own
	// width (1080px, see tokens.ts), so it's sized off the full frame
	// width, not a cropped-in window. safeZones now also constrains where
	// bubbles and the header can sit (see bubbleLayout.ts, timeline.ts,
	// lib/chrome.ts) — but only ever repositions content within the full
	// canvas, never shrinks the canvas itself.
	const phoneWidthPx = width;

	const bubbleGradientStops =
		theme === 'none' ? sentGradientStops : themeBubbleStops(themeGradients[theme]);
	const chatBackgroundCss =
		theme === 'none' ? colors.chatBackground : themeBackgroundCss(themeGradients[theme]);

	const slots = useMemo(() => {
		if (!fontReady) return [];
		return buildSlots(events, fps, phoneWidthPx, safeZones);
	}, [events, fps, phoneWidthPx, fontReady, safeZones]);

	const chromeHeightPx = computeChromeHeightPx(phoneWidthPx, height, safeZones);
	const chatViewportHeightPx = height - chromeHeightPx;

	const frameLayout = useMemo(
		() => computeFrameLayout(slots, frame, fps, phoneWidthPx, chatViewportHeightPx, scrollAnchor, springConfig),
		[slots, frame, fps, phoneWidthPx, chatViewportHeightPx, scrollAnchor, springConfig],
	);

	const reactions = useMemo(
		() => computeReactions(reactionEvents, frameLayout, frame, fps, phoneWidthPx, safeZones),
		[reactionEvents, frameLayout, frame, fps, phoneWidthPx, safeZones],
	);

	if (!fontReady) {
		return <AbsoluteFill style={{backgroundColor: '#000000'}} />;
	}

	return (
		<AbsoluteFill>
			<Background background={background} />
			<PhoneFrame
				frameWidthPx={width}
				frameHeightPx={height}
				receiver={receiver}
				clock={clock}
				backgroundCss={chatBackgroundCss}
				safeZones={safeZones}
			>
				{frameLayout.rows.map((row) => (
					<Bubble
						key={row.id}
						row={row}
						frame={frame}
						fps={fps}
						frameWidthPx={phoneWidthPx}
						chatViewportHeightPx={chatViewportHeightPx}
						scrollOffsetPx={frameLayout.scrollOffsetPx}
						gradientStops={bubbleGradientStops}
						safeZones={safeZones}
					/>
				))}
				{reactions.map((reaction) => (
					<ReactionBadge key={reaction.id} reaction={reaction} side={reaction.targetFrom} />
				))}
			</PhoneFrame>
		</AbsoluteFill>
	);
};
