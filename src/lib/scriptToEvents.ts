import type {TimelineEvent} from '../types';

export type ScriptMessage = {from: 'me' | 'them'; text: string};

const TYPING_DURATION_SEC = 1.2;
const TYPING_GAP_SEC = 0.15;
const BASE_READ_PAUSE_SEC = 0.5;
const PER_CHAR_PAUSE_SEC = 0.02;
const MAX_READ_PAUSE_SEC = 1.6;

/**
 * Turns a plain from/text script into a full timeline: a typing beat before
 * every message but the first, then a read pause scaled to message length.
 * Deterministic — no randomness — so the same script always renders the
 * same way.
 */
export const buildEventsFromScript = (messages: ScriptMessage[]): TimelineEvent[] => {
	const events: TimelineEvent[] = [];
	let cursor = 0;

	messages.forEach((message, i) => {
		if (i > 0) {
			events.push({
				type: 'typing',
				id: `typing-${i}`,
				startSec: cursor,
				durationSec: TYPING_DURATION_SEC,
			});
			cursor += TYPING_DURATION_SEC + TYPING_GAP_SEC;
		}

		events.push({
			type: 'message',
			id: `msg-${i}`,
			from: message.from,
			text: message.text,
			startSec: cursor,
		});

		const readPause = Math.min(
			MAX_READ_PAUSE_SEC,
			BASE_READ_PAUSE_SEC + message.text.length * PER_CHAR_PAUSE_SEC,
		);
		cursor += readPause;
	});

	return events;
};
