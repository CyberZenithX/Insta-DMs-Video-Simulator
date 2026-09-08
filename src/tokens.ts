/**
 * Design tokens measured from references/dm-real.jpeg at 1080px wide.
 * Geometry is expressed as ratios of frame width so the composition
 * survives a resolution change (§1 of the spec).
 */

export const colors = {
	chatBackground: '#000000',
	receivedBubble: '#262626',
	receivedText: '#FFFFFF',
	inputPill: '#262626',
	inputPlaceholder: '#8E8E8E',
	cameraButton: '#3797F0',
	metaText: '#A8A8A8',
} as const;

/** Sent-bubble master gradient stops, t=0 top of chat viewport, t=1 bottom. */
export const sentGradientStops: {t: number; color: string}[] = [
	{t: 0, color: '#D500C3'},
	{t: 0.55, color: '#7F31F6'},
	{t: 1, color: '#5A50FB'},
];

export const geometry = {
	/** Bubble corner radius, uniform on all four corners regardless of height. */
	bubbleRadius: 0.0509,
	/** Max bubble width. */
	maxBubbleWidth: 0.699,
	/** Sent bubble right margin. */
	sentRightMargin: 0.0213,
	/** Received bubble left offset (clears the avatar column). */
	receivedLeftOffset: 0.1454,
	/** Bubble vertical padding (top + bottom, each). */
	bubblePaddingV: 0.0259,
	/** Bubble horizontal padding (left + right, each). */
	bubblePaddingH: 0.0278,
	/** Text line height. */
	lineHeight: 0.05,
	/** Font size. */
	fontSize: 0.0389,
	/** Single-line bubble height (padding*2 + one line height). */
	singleLineBubbleHeight: 0.1019,
	/** Vertical gap between consecutive bubbles in the stack. */
	bubbleGap: 0.014,
	/** Avatar diameter for the receiver's grouped messages. */
	avatarSize: 0.0389,
	/** Width of the three-dot typing bubble (height matches singleLineBubbleHeight). */
	typingBubbleWidth: 0.16,
	/** Diameter of each dot in the typing bubble. */
	typingDotSize: 0.0139,
	/**
	 * Extra breathing room kept beyond `safeZones.railX` itself when
	 * constraining bubble geometry — a bubble's edge shouldn't touch the
	 * rail's boundary pixel-for-pixel, it should clear it with room to spare.
	 */
	safeEdgeClearance: 0.012,
	/**
	 * Reaction badge diameter and corner inset, as fractions of frame width /
	 * the badge's own size. Shared between reactions.ts (which places the
	 * badge) and timeline.ts (which has to know how far a badge can overhang
	 * past its target bubble's edge when keeping that bubble clear of the
	 * icon rail) — duplicating these as separate magic numbers in each file
	 * would let the safety margin and the actual badge silently drift apart.
	 */
	reactionBadgeSize: 0.09,
	reactionBadgeInset: 0.32,
	/**
	 * How far above its anchor point (the target bubble's bottom edge) a
	 * reaction badge's own top sits, as a fraction of the badge's size — so
	 * the remaining `1 - this` fraction is how far the badge hangs *below*
	 * that edge. The stack layout needs this too: a reacted bubble needs
	 * extra room reserved after it, or the next bubble in the stack lands
	 * right on top of the badge (see the `bubbleGap` usage in timeline.ts).
	 */
	reactionBadgeVerticalOffset: 0.55,
} as const;

/**
 * Phone-window chrome. The mockup fills the full video frame edge to edge
 * (like a real screen recording), not just the safeZones-derived box — see
 * PhoneFrame.tsx.
 */
export const layout = {
	statusBarHeight: 0.045,
	headerHeight: 0.078,
} as const;

export const fontFamilyFallback =
	'"Inter", -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif';
