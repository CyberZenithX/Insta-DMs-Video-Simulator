import React, {useMemo} from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import type {CalculateMetadataFunction} from 'remotion';
import type {IgDmReelProps, ReactionEvent} from '../types';
import {useInterFontReady} from '../lib/font';
import {buildSlots, computeFrameLayout, lastActiveFrame} from '../lib/timeline';
import {computeReactions} from '../lib/reactions';
import {layout} from '../tokens';
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
	const {events, receiver, clock, background, scrollAnchor, spring: springConfig} = props;
	const frame = useCurrentFrame();
	const {width, height, fps} = useVideoConfig();
	const fontReady = useInterFontReady();

	const reactionEvents = useMemo(
		() => events.filter((e): e is ReactionEvent => e.type === 'reaction'),
		[events],
	);

	// All phone-interior geometry (§3) was measured as ratios of the phone
	// screen's own width, not the outer video canvas — the phone is a
	// cropped-in window at layout.phoneWidthRatio of the frame (§6), so
	// bubbles/text/chrome must be sized off phoneWidthPx or they overflow
	// the clipped phone edge.
	const phoneWidthPx = width * layout.phoneWidthRatio;

	const slots = useMemo(() => {
		if (!fontReady) return [];
		return buildSlots(events, fps, phoneWidthPx);
	}, [events, fps, phoneWidthPx, fontReady]);

	const chromeHeightPx = phoneWidthPx * (layout.statusBarHeight + layout.headerHeight);
	const phoneTopPx = height * layout.phoneTop;
	const chatViewportHeightPx = height - phoneTopPx - chromeHeightPx;

	const frameLayout = useMemo(
		() => computeFrameLayout(slots, frame, fps, phoneWidthPx, chatViewportHeightPx, scrollAnchor, springConfig),
		[slots, frame, fps, phoneWidthPx, chatViewportHeightPx, scrollAnchor, springConfig],
	);

	const reactions = useMemo(
		() => computeReactions(reactionEvents, frameLayout, frame, fps, phoneWidthPx),
		[reactionEvents, frameLayout, frame, fps, phoneWidthPx],
	);

	if (!fontReady) {
		return <AbsoluteFill style={{backgroundColor: '#000000'}} />;
	}

	return (
		<AbsoluteFill>
			<Background background={background} />
			<PhoneFrame frameWidthPx={width} frameHeightPx={height} receiver={receiver} clock={clock}>
				{frameLayout.rows.map((row) => (
					<Bubble
						key={row.id}
						row={row}
						frame={frame}
						fps={fps}
						frameWidthPx={phoneWidthPx}
						chatViewportHeightPx={chatViewportHeightPx}
						scrollOffsetPx={frameLayout.scrollOffsetPx}
					/>
				))}
				{reactions.map((reaction) => (
					<ReactionBadge key={reaction.id} reaction={reaction} side={reaction.targetFrom} />
				))}
			</PhoneFrame>
		</AbsoluteFill>
	);
};
