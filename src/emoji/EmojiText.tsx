import React from 'react';
import {Img, staticFile} from 'remotion';
import {parseMessageText} from './parse';
import {EMOJI_ASSET_DIR, EMOJI_ASSET_EXT} from './config';

export const EmojiImage: React.FC<{file: string; fontSizePx: number; alt: string}> = ({
	file,
	fontSizePx,
	alt,
}) => {
	const size = fontSizePx * 1.15;
	return (
		<Img
			src={staticFile(`${EMOJI_ASSET_DIR}/${file}.${EMOJI_ASSET_EXT}`)}
			alt={alt}
			style={{
				width: size,
				height: size,
				display: 'inline-block',
				verticalAlign: '-0.2em',
				objectFit: 'contain',
			}}
		/>
	);
};

/**
 * Renders message text with emoji codepoints substituted for local image
 * assets (see EMOJI_ASSET_DIR) instead of relying on the system emoji font,
 * which renders inconsistently across render platforms.
 */
export const EmojiText: React.FC<{text: string; fontSizePx: number}> = ({text, fontSizePx}) => {
	const tokens = parseMessageText(text);
	return (
		<>
			{tokens.map((token, i) =>
				token.type === 'text' ? (
					<React.Fragment key={i}>{token.value}</React.Fragment>
				) : (
					<EmojiImage key={i} file={token.file} fontSizePx={fontSizePx} alt={token.value} />
				),
			)}
		</>
	);
};
