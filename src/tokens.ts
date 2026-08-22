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
