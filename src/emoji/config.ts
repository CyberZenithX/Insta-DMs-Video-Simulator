/**
 * Single source of truth for where emoji image assets live. Swap the whole
 * set (e.g. to a different style) by changing this one constant — every
 * consumer resolves through it via `staticFile`.
 */
export const EMOJI_ASSET_DIR = 'emoji';
export const EMOJI_ASSET_EXT = 'png';

/**
 * The emoji assets actually vendored in `public/emoji/`. **Keep in sync with
 * that directory** — one entry per file, without the extension.
 *
 * This list is what stops an un-vendored emoji from reaching `<Img>`.
 * Remotion's `<Img>` retries a failed load and then calls `cancelRender()`,
 * so a single emoji with no matching PNG can take an entire render down, and
 * paints a broken-image glyph in the frames before it does. `parseMessageText`
 * therefore only emits an emoji token for files listed here; anything else
 * stays plain text and renders as a normal glyph.
 *
 * Adding a PNG without adding it here is the safe direction to get wrong (the
 * emoji renders as text). Adding it here without the PNG is not.
 */
export const VENDORED_EMOJI_FILES: ReadonlySet<string> = new Set([
	'emoji_u1f440', // 👀
	'emoji_u1f480', // 💀
	'emoji_u1f525', // 🔥
	'emoji_u1f602', // 😂
	'emoji_u1f937', // 🤷
]);
