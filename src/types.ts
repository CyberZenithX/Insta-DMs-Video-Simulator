import {z} from 'zod';
import {zColor} from '@remotion/zod-types';

export const messageEventSchema = z.object({
	type: z.literal('message'),
	id: z.string(),
	from: z.enum(['me', 'them']),
	text: z.string(),
	startSec: z.number().min(0),
});

export const typingEventSchema = z.object({
	type: z.literal('typing'),
	id: z.string(),
	durationSec: z.number().min(0),
	startSec: z.number().min(0),
});

export const reactionEventSchema = z.object({
	type: z.literal('reaction'),
	id: z.string(),
	targetId: z.string(),
	emoji: z.string(),
	startSec: z.number().min(0),
});

export const eventSchema = z.discriminatedUnion('type', [
	messageEventSchema,
	typingEventSchema,
	reactionEventSchema,
]);

export type MessageEvent = z.infer<typeof messageEventSchema>;
export type TypingEvent = z.infer<typeof typingEventSchema>;
export type ReactionEvent = z.infer<typeof reactionEventSchema>;
export type TimelineEvent = z.infer<typeof eventSchema>;

export const receiverSchema = z.object({
	name: z.string(),
	username: z.string(),
	avatar: z.string(),
	activeNow: z.boolean(),
});

export const backgroundSchema = z.object({
	kind: z.enum(['solid', 'gradient', 'image', 'video']),
	value: z.string(),
});

/** Keep in sync with the keys of themeGradients in themes.ts, plus 'none'. */
export const themeSchema = z.enum([
	'none',
	'default',
	'berry',
	'sweets',
	'unicorn',
	'maple',
	'sushi',
	'rocket',
	'lollipop',
	'shadow',
]);

export const safeZonesSchema = z.object({
	topEnd: z.number().min(0).max(1),
	railX: z.number().min(0).max(1),
	railTop: z.number().min(0).max(1),
	railBottom: z.number().min(0).max(1),
	bottomStart: z.number().min(0).max(1),
});

export const springConfigSchema = z.object({
	damping: z.number().min(0),
	mass: z.number().min(0.01),
	stiffness: z.number().min(0),
});

export type SpringConfig = z.infer<typeof springConfigSchema>;

export const igDmReelPropsSchema = z.object({
	events: z.array(eventSchema),
	receiver: receiverSchema,
	clock: z.string(),
	background: backgroundSchema,
	theme: themeSchema,
	safeZones: safeZonesSchema,
	scrollAnchor: z.number().min(0).max(1),
	spring: springConfigSchema,
	tailSec: z.number().min(0),
});

export type IgDmReelProps = z.infer<typeof igDmReelPropsSchema>;

export const safeZoneGridPropsSchema = z.object({
	safeZones: safeZonesSchema,
	background: zColor(),
	gridColor: zColor(),
	labelColor: zColor(),
	overlayColor: zColor(),
});

export type SafeZoneGridProps = z.infer<typeof safeZoneGridPropsSchema>;
