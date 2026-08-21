import emojiRegex from 'emoji-regex';

export type TextToken = {type: 'text'; value: string};
export type EmojiToken = {
	type: 'emoji';
	value: string;
	codepoints: number[];
	/** Filename (without extension) matching Noto Color Emoji's convention. */
	file: string;
};
export type MessageToken = TextToken | EmojiToken;

const VARIATION_SELECTOR_16 = 0xfe0f;

/**
 * Converts a raw emoji grapheme cluster into Noto Color Emoji's filename
 * convention, e.g. "❤️" -> "emoji_u2764", "👍🏽" -> "emoji_u1f44d_1f3fd".
 * Noto drops the U+FE0F text/emoji variation selector from filenames.
 */
const toNotoFile = (codepoints: number[]): string => {
	const kept = codepoints.filter((cp) => cp !== VARIATION_SELECTOR_16);
	return `emoji_u${kept.map((cp) => cp.toString(16)).join('_')}`;
};

/**
 * Splits message text into plain-text and emoji tokens. Emoji tokens carry
 * their codepoint sequence and the asset filename to render instead of
 * relying on the system emoji font (see EMOJI_ASSET_DIR).
 */
export const parseMessageText = (text: string): MessageToken[] => {
	const regex = emojiRegex();
	const tokens: MessageToken[] = [];
	let lastIndex = 0;

	for (const match of text.matchAll(regex)) {
		const index = match.index ?? 0;
		if (index > lastIndex) {
			tokens.push({type: 'text', value: text.slice(lastIndex, index)});
		}
		const value = match[0];
		const codepoints = Array.from(value).map((ch) => ch.codePointAt(0) ?? 0);
		tokens.push({type: 'emoji', value, codepoints, file: toNotoFile(codepoints)});
		lastIndex = index + value.length;
	}

	if (lastIndex < text.length) {
		tokens.push({type: 'text', value: text.slice(lastIndex)});
	}

	return tokens;
};

/** All distinct Noto asset filenames (no extension) referenced by a string. */
export const collectEmojiFiles = (text: string): string[] => {
	const files = new Set<string>();
	for (const token of parseMessageText(text)) {
		if (token.type === 'emoji') {
			files.add(token.file);
		}
	}
	return Array.from(files);
};
