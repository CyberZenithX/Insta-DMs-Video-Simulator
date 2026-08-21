import {spring} from 'remotion';
import type {TimelineEvent, SpringConfig as SpringConfigType} from '../types';
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
};

/**
 * Turns the raw event list into stack slots. A `typing` event followed by
 * the next `them` message becomes a single slot with two phases, so the
 * real bubble can "replace it in place" (§4/§5 of the spec) instead of the
 * stack growing by one and shrinking by one.
 */
export const buildSlots = (events: TimelineEvent[], fps: number, frameWidthPx: number): Slot[] => {
	const sorted = [...events].sort((a, b) => a.startSec - b.startSec);
	const slots: Slot[] = [];
	let pendingThemTyping: Slot | null = null;

	for (const ev of sorted) {
		const startFrame = Math.round(ev.startSec * fps);

		if (ev.type === 'typing') {
			const {widthPx, heightPx} = typingBubbleSize(frameWidthPx);
			const slot: Slot = {
				id: ev.id,
				from: 'them',
				phases: [{kind: 'typing', frame: startFrame, widthPx, heightPx}],
			};
			slots.push(slot);
			pendingThemTyping = slot;
			continue;
		}

		if (ev.type === 'message') {
			const layout = computeBubbleLayout(ev.text, frameWidthPx);
			const messagePhase: MessagePhase = {
				kind: 'message',
				frame: startFrame,
				text: ev.text,
				lines: layout.lines,
				widthPx: layout.widthPx,
				heightPx: layout.heightPx,
				fontSizePx: layout.fontSizePx,
				lineHeightPx: layout.lineHeightPx,
				paddingHPx: layout.paddingHPx,
				paddingVPx: layout.paddingVPx,
			};

			if (ev.from === 'them' && pendingThemTyping) {
				pendingThemTyping.phases.push(messagePhase);
				pendingThemTyping.id = ev.id;
				pendingThemTyping = null;
				continue;
			}

			slots.push({id: ev.id, from: ev.from, phases: [messagePhase]});
		}
	}

	return slots;
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
		cursorTop = bottom + gapPx;

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
			top = bBottom + gapPx;
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

/** Horizontal [left, right] extent of a row's bubble in frame-pixel space. */
export const bubbleXRange = (row: RenderRow, frameWidthPx: number): [number, number] => {
	if (row.from === 'me') {
		const right = frameWidthPx * (1 - geometry.sentRightMargin);
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
