import React from 'react';
import type {ReactionRender} from '../lib/reactions';
import {parseMessageText} from '../emoji/parse';
import {EmojiImage} from '../emoji/EmojiText';
import {geometry} from '../tokens';

export const ReactionBadge: React.FC<{reaction: ReactionRender; side: 'me' | 'them'}> = ({
	reaction,
	side,
}) => {
	const tokens = parseMessageText(reaction.emoji);
	const emojiToken = tokens.find((t) => t.type === 'emoji');
	const inset = reaction.sizePx * geometry.reactionBadgeInset;
	const left = side === 'me' ? reaction.x - reaction.sizePx + inset : reaction.x - inset;

	return (
		<div
			style={{
				position: 'absolute',
				left,
				top: reaction.y - reaction.sizePx * 0.55,
				width: reaction.sizePx,
				height: reaction.sizePx,
				borderRadius: '50%',
				backgroundColor: '#1C1C1E',
				border: '2px solid #000000',
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'center',
				opacity: reaction.opacity,
				transform: `scale(${reaction.scale})`,
				transformOrigin: 'center',
				boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
			}}
		>
			{emojiToken && emojiToken.type === 'emoji' ? (
				<EmojiImage file={emojiToken.file} fontSizePx={reaction.sizePx * 0.6} alt={reaction.emoji} />
			) : null}
		</div>
	);
};
