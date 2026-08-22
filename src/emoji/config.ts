/**
 * Single source of truth for where emoji image assets live. Swap the whole
 * set (e.g. to a different style) by changing this one constant — every
 * consumer resolves through it via `staticFile`.
 */
export const EMOJI_ASSET_DIR = 'emoji';
export const EMOJI_ASSET_EXT = 'png';
