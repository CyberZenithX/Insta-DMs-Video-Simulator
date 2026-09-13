// Deriving the header avatar's letter from the receiver's name.
//
// Deliberately free of any import from the `remotion` barrel: this is shared
// logic, and src/data/defaultProps.ts's rule (see its header comment) applies
// to anything the Next.js API route might end up pulling in.

/**
 * The letter shown in the generated avatar — the first actual *letter or
 * digit* in the name, uppercased.
 *
 * Iterating with for...of walks the string by code point rather than by UTF-16
 * code unit, so a name starting with an emoji ("❤️Noor") can't yield half of a
 * surrogate pair. Emoji, punctuation and whitespace are skipped rather than
 * shown, since the emoji here would be a system-font glyph — exactly what
 * src/emoji/parse.ts exists to keep out of rendered output.
 *
 * `\p{L}` covers non-Latin scripts too, so "عائشة" → "ع" and "Аня" → "А"
 * rather than falling through to the empty fallback.
 *
 * Returns '' when the name holds no letter or digit at all (empty, or emoji
 * only) — the caller renders the plain gradient circle in that case, which
 * reads as intentional in a way a "?" would not.
 */
export const initialFromName = (name: string): string => {
	for (const char of name.trim()) {
		if (/\p{L}|\p{N}/u.test(char)) {
			// toUpperCase(), never toLocaleUpperCase(): the locale-aware form
			// reads the host's locale, so a Turkish-locale machine maps "i" to
			// "İ" while Lambda's C locale maps it to "I". That would make the
			// same props render differently in two places, breaking the
			// determinism contract (CLAUDE.md) for no gain — the scripts that
			// actually distinguish these cases have no uppercase forms anyway.
			return char.toUpperCase();
		}
	}
	return '';
};

/**
 * Whether `receiver.avatar` is already a complete URL, rather than a
 * public/-relative filename that staticFile() has to resolve.
 *
 * staticFile() prefixes whatever it's given, so handing it "https://..."
 * produces a broken path. The UI lets people paste a real image URL, so both
 * shapes have to round-trip. blob: is deliberately absent — it only resolves
 * inside the browser tab that created it, so it would preview and then fail
 * the actual render.
 */
export const isAbsoluteAssetUrl = (value: string): boolean =>
	/^(https?:\/\/|data:)/i.test(value);
