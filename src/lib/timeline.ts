import {spring} from 'remotion';
import type {TimelineEvent, TypingEvent, SpringConfig as SpringConfigType, SafeZones} from '../types';
import {computeBubbleLayout, typingBubbleSize} from './bubbleLayout';
import {geometry} from '../tokens';
import {lerp} from './math';
import type {WrappedLine} from './textMeasure';

type SpringConfig = SpringConfigType;

type TypingPhase = {
	kind: 'typing';
	frame: number;
	widthPx: number;
	heightPx: number;
};

type MessagePhase = {
	kind: 'message';
	frame: number;
	text: string;
	lines: WrappedLine[];
	widthPx: number;
	heightPx: number;
	fontSizePx: number;
	lineHeightPx: number;
	paddingHPx: number;
	paddingVPx: number;
};

type Phase = TypingPhase | MessagePhase;

export type Slot = {
	/** Identity used for reaction targeting: the message id once resolved, or the typing id until then. */
	id: string;
	from: 'me' | 'them';
	phases: Phase[];
	/**
	 * Whether a reaction event targets this slot, anywhere in the script —
	 * not whether one is currently visible on screen. Known up front from the
	 * event list, so the stack can reserve room for the badge's overhang from
	 * the moment this slot is created, rather than the next bubble jumping
	 * down the instant the reaction pops in (nothing would drive that jump
	 * with a spring, unlike every other layout change here).
	 */
	hasReaction: boolean;
};

/**
 * Turns the raw event list into stack slots. A `typing` event and the `them`
 * message it precedes become a single slot with two phases, so the real
 * bubble can "replace it in place" (§4/§5 of the spec) instead of the stack
 * growing by one and shrinking by one.
 *
 * A typing event is *only* a preamble to a message bubble's entrance — it has
 * no independent lifetime, and nothing else can retire it (a typing-only slot
 * stays visible for every subsequent frame). So a typing event that cannot be
 * paired with a following `them` message must produce no slot at all, rather
 * than being stranded in the stack forever. Pairing is resolved by lookahead
 * to the next message event; an earlier implementation carried a mutable
 * "pending typing" pointer that was never cleared when the next message came
 * from `me`, which both stranded dots bubbles mid-stack and let a much later
 * `them` message merge into a stale slot and render out of order.
 */
export const buildSlots = (
	events: TimelineEvent[],
	fps: number,
	frameWidthPx: number,
	safeZones: SafeZones,
): Slot[] => {
	const sorted = [...events].sort((a, b) => a.startSec - b.startSec);

	const reactedMessageIds = new Set(
		sorted.filter((ev): ev is Extract<TimelineEvent, {type: 'reaction'}> => ev.type === 'reaction').map((ev) => ev.targetId),
	);

	const nextMessageIndex = (afterIndex: number): number => {
		for (let j = afterIndex + 1; j < sorted.length; j++) {
			if (sorted[j].type === 'message') return j;
		}
		return -1;
	};

	// Map of message index -> the typing event that morphs into it. Only a
	// 'them' typing event immediately preceding a 'them' message qualifies;
	// everything else (a 'me' typing beat, a dangling typing event with no
	// message after it, an earlier of two consecutive typing events) is
	// dropped and contributes timing only.
	const typingForMessage = new Map<number, TypingEvent>();

	sorted.forEach((ev, i) => {
		if (ev.type !== 'typing') return;
		if ((ev.from ?? 'them') !== 'them') return;

		const mi = nextMessageIndex(i);
		if (mi === -1) return;

		const message = sorted[mi];
		if (message.type !== 'message' || message.from !== 'them') return;

		// If two typing events target the same message, the latest one wins.
		typingForMessage.set(mi, ev);
	});

	const slots: Slot[] = [];

	sorted.forEach((ev, i) => {
		if (ev.type !== 'message') return;

		const layout = computeBubbleLayout(ev.text, frameWidthPx, ev.from, safeZones);
		const messagePhase: MessagePhase = {
			kind: 'message',
			frame: Math.round(ev.startSec * fps),
			text: ev.text,
			lines: layout.lines,
			widthPx: layout.widthPx,
			heightPx: layout.heightPx,
			fontSizePx: layout.fontSizePx,
			lineHeightPx: layout.lineHeightPx,
			paddingHPx: layout.paddingHPx,
			paddingVPx: layout.paddingVPx,
		};

		const hasReaction = reactedMessageIds.has(ev.id);

		const typing = typingForMessage.get(i);
		if (!typing) {
			slots.push({id: ev.id, from: ev.from, phases: [messagePhase], hasReaction});
			return;
		}

		const {widthPx, heightPx} = typingBubbleSize(frameWidthPx);
		slots.push({
			id: ev.id,
			from: ev.from,
			phases: [
				{kind: 'typing', frame: Math.round(typing.startSec * fps), widthPx, heightPx},
				messagePhase,
			],
			hasReaction,
		});
	});

	// Stack order is order of appearance, which for a merged slot is when its
	// typing phase enters — not when its message lands.
	return slots.sort((a, b) => a.phases[0].frame - b.phases[0].frame);
};

export type RenderRow = {
	id: string;
	from: 'me' | 'them';
	top: number;
	bottom: number;
	widthPx: number;
	heightPx: number;
	content:
		| {kind: 'typing'}
		| {kind: 'message'; phase: MessagePhase}
		| {kind: 'transition'; v: number; from: TypingPhase; to: MessagePhase};
	entrance: {v: number; isEntering: boolean};
};

export type FrameLayout = {
	rows: RenderRow[];
	scrollOffsetPx: number;
};

const phaseIndexAt = (slot: Slot, atFrame: number): number => {
	let idx = -1;
	for (let i = 0; i < slot.phases.length; i++) {
		if (slot.phases[i].frame <= atFrame) {
			idx = i;
		} else {
			break;
		}
	}
	return idx;
};

const dimsAt = (slot: Slot, phaseIdx: number): {widthPx: number; heightPx: number} => {
	if (phaseIdx < 0) return {widthPx: 0, heightPx: 0};
	const p = slot.phases[phaseIdx];
	return {widthPx: p.widthPx, heightPx: p.heightPx};
};

/**
 * Computes every visible slot's position, size, and animation state for a
 * single frame. The scroll offset and the newest slot's entrance/resize are
 * driven by the exact same spring value (§5's "critical rule"): the stack
 * shift and the bubble pop are one motion, not two independently-timed ones.
 */
export const computeFrameLayout = (
	slots: Slot[],
	frame: number,
	fps: number,
	frameWidthPx: number,
	viewportHeightPx: number,
	scrollAnchor: number,
	springConfig: SpringConfig,
): FrameLayout => {
	const gapPx = frameWidthPx * geometry.bubbleGap;
	// How far a reaction badge hangs below its target bubble's bottom edge
	// (see ReactionBadge.tsx) — reserved as extra room after any slot a
	// reaction targets, or the next bubble in the stack lands on top of it.
	const reactionOverhangPx =
		frameWidthPx * geometry.reactionBadgeSize * (1 - geometry.reactionBadgeVerticalOffset);

	type GlobalEvent = {frame: number; slotIndex: number; phaseIndex: number};
	const globalEvents: GlobalEvent[] = [];
	slots.forEach((slot, slotIndex) => {
		slot.phases.forEach((phase, phaseIndex) => {
			globalEvents.push({frame: phase.frame, slotIndex, phaseIndex});
		});
	});
	globalEvents.sort((a, b) => a.frame - b.frame);

	const activeEvents = globalEvents.filter((e) => e.frame <= frame);
	if (activeEvents.length === 0) {
		return {rows: [], scrollOffsetPx: 0};
	}
	const currentEvent = activeEvents[activeEvents.length - 1];
	const v = spring({frame: frame - currentEvent.frame, fps, config: springConfig});

	const visibleSlotIndices = slots
		.map((_, i) => i)
		.filter((i) => phaseIndexAt(slots[i], frame) >= 0);

	let cursorTop = 0;
	const rows: RenderRow[] = [];

	for (const si of visibleSlotIndices) {
		const slot = slots[si];
		const curPhaseIdx = phaseIndexAt(slot, frame);
		const isAffected = si === currentEvent.slotIndex && curPhaseIdx === currentEvent.phaseIndex;

		let widthPx: number;
		let heightPx: number;
		let entranceV = 1;
		let transitionV = 1;

		if (isAffected) {
			const prev = dimsAt(slot, curPhaseIdx - 1);
			const next = dimsAt(slot, curPhaseIdx);
			widthPx = lerp(prev.widthPx, next.widthPx, v);
			heightPx = lerp(prev.heightPx, next.heightPx, v);
			if (curPhaseIdx === 0) {
				entranceV = v;
			} else {
				transitionV = v;
			}
		} else {
			const dims = dimsAt(slot, curPhaseIdx);
			widthPx = dims.widthPx;
			heightPx = dims.heightPx;
		}

		const top = cursorTop;
		const bottom = top + heightPx;
		cursorTop = bottom + gapPx + (slot.hasReaction ? reactionOverhangPx : 0);

		const phase = slot.phases[curPhaseIdx];
		const prevPhase = curPhaseIdx > 0 ? slot.phases[curPhaseIdx - 1] : null;

		let content: RenderRow['content'];
		if (isAffected && curPhaseIdx > 0 && prevPhase && prevPhase.kind === 'typing' && phase.kind === 'message') {
			content = {kind: 'transition', v: transitionV, from: prevPhase, to: phase};
		} else if (phase.kind === 'typing') {
			content = {kind: 'typing'};
		} else {
			content = {kind: 'message', phase};
		}

		rows.push({
			id: slot.id,
			from: slot.from,
			top,
			bottom,
			widthPx,
			heightPx,
			content,
			entrance: {v: entranceV, isEntering: isAffected && curPhaseIdx === 0},
		});
	}

	const computeCumulativeBottom = (mode: 'before' | 'after'): number => {
		let top = 0;
		let lastBottom = 0;
		let any = false;

		for (const si of visibleSlotIndices) {
			const slot = slots[si];
			const curPhaseIdx = phaseIndexAt(slot, frame);
			const isAffected = si === currentEvent.slotIndex && curPhaseIdx === currentEvent.phaseIndex;

			let h: number;
			if (isAffected) {
				if (mode === 'before') {
					if (curPhaseIdx === 0) continue;
					h = dimsAt(slot, curPhaseIdx - 1).heightPx;
				} else {
					h = dimsAt(slot, curPhaseIdx).heightPx;
				}
			} else {
				h = dimsAt(slot, curPhaseIdx).heightPx;
			}

			const bTop = top;
			const bBottom = bTop + h;
			top = bBottom + gapPx + (slot.hasReaction ? reactionOverhangPx : 0);
			lastBottom = bBottom;
			any = true;
		}

		return any ? lastBottom : 0;
	};

	const scrollTarget = (bottom: number) => Math.max(0, bottom - scrollAnchor * viewportHeightPx);
	const scrollBefore = scrollTarget(computeCumulativeBottom('before'));
	const scrollAfter = scrollTarget(computeCumulativeBottom('after'));
	const scrollOffsetPx = lerp(scrollBefore, scrollAfter, v);

	return {rows, scrollOffsetPx};
};

/**
 * Horizontal [left, right] extent of a row's bubble in frame-pixel space.
 *
 * A sent bubble is right-anchored — its width grows leftward from a fixed
 * right edge — so keeping it clear of the icon rail means capping that
 * anchor's position, not its width (which is already safely inside
 * `maxBubbleWidth`; see `computeBubbleLayout`). A received bubble is the
 * opposite: left-anchored, so its width is what was already capped upstream
 * to keep its (derived) right edge clear — nothing to clamp here.
 */
export const bubbleXRange = (row: RenderRow, frameWidthPx: number, safeZones: SafeZones): [number, number] => {
	if (row.from === 'me') {
		const uncappedRight = frameWidthPx * (1 - geometry.sentRightMargin);
		const safeRightEdgePx = frameWidthPx * safeZones.railX - frameWidthPx * geometry.safeEdgeClearance;
		const right = Math.min(uncappedRight, safeRightEdgePx);
		return [right - row.widthPx, right];
	}
	const left = frameWidthPx * geometry.receivedLeftOffset;
	return [left, left + row.widthPx];
};

/** Last frame at which any event still has visible motion, before the tail. */
export const lastActiveFrame = (events: TimelineEvent[], fps: number): number => {
	let last = 0;
	for (const ev of events) {
		const startFrame = Math.round(ev.startSec * fps);
		if (ev.type === 'typing') {
			last = Math.max(last, startFrame + Math.round(ev.durationSec * fps));
		} else if (ev.type === 'message') {
			last = Math.max(last, startFrame);
		} else if (ev.type === 'reaction') {
			last = Math.max(last, startFrame);
		}
	}
	return last;
};
