import type {TimelineEvent} from '../types';

export type ScriptMessage = {from: 'me' | 'them'; text: string; reaction?: string};

const TYPING_DURATION_SEC = 1.2;
const TYPING_GAP_SEC = 0.15;
const BASE_READ_PAUSE_SEC = 0.5;
const PER_CHAR_PAUSE_SEC = 0.02;
const MAX_READ_PAUSE_SEC = 1.6;
/**
 * How far into a message's own read pause its reaction pops in, as a
 * fraction of that pause — not a fixed delay, so a short message's reaction
 * can't land after the *next* message's typing beat has already started.
 */
const REACTION_DELAY_FRACTION = 0.5;

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
			// Only `them` gets a visible typing indicator — you don't see your
			// own in your own chat. The beat before a `me` message is still
			// spent (you were composing it), so pacing is identical either way.
			if (message.from === 'them') {
				events.push({
					type: 'typing',
					id: `typing-${i}`,
					from: 'them',
					startSec: cursor,
					durationSec: TYPING_DURATION_SEC,
				});
			}
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

		if (message.reaction) {
			events.push({
				type: 'reaction',
				id: `reaction-${i}`,
				targetId: `msg-${i}`,
				emoji: message.reaction,
				startSec: cursor + readPause * REACTION_DELAY_FRACTION,
			});
		}

		cursor += readPause;
	});

	return events;
};
