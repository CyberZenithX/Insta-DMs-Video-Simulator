import React from 'react';
import {Img, Video} from 'remotion';
import type {IgDmReelProps} from '../types';

export const Background: React.FC<{background: IgDmReelProps['background']}> = ({background}) => {
	const fill: React.CSSProperties = {
		position: 'absolute',
		inset: 0,
		width: '100%',
		height: '100%',
	};

	if (background.kind === 'solid') {
		return <div style={{...fill, backgroundColor: background.value}} />;
	}
	if (background.kind === 'gradient') {
		return <div style={{...fill, background: background.value}} />;
	}
	if (background.kind === 'image') {
		return <Img src={background.value} style={{...fill, objectFit: 'cover'}} />;
	}
	return <Video src={background.value} style={{...fill, objectFit: 'cover'}} muted />;
};
