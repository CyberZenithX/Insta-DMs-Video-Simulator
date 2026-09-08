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

/**
 * Display form of the same set — actual emoji characters, for a UI picker
 * (the reaction picker in app/page.tsx, and the request-body validation in
 * src/types.ts) that wants something to show and pick rather than a
 * filename. A reaction badge with an un-vendored emoji doesn't fail the
 * render the way an inline message emoji does (ReactionBadge just renders an
 * empty circle), but it's a UI bug either way — so this list is what's
 * actually offered as choices, not merely what's *allowed*.
 *
 * Keep in exact sync with VENDORED_EMOJI_FILES above: same five emoji, same
 * count, every entry here has a corresponding file there and vice versa.
 */
export const VENDORED_REACTION_EMOJIS = ['👀', '💀', '🔥', '😂', '🤷'] as const;
