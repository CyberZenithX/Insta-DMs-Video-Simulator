import React from 'react';
import {Composition, staticFile} from 'remotion';
import {IgDmReel, calculateIgDmReelMetadata} from './compositions/IgDmReel';
import {SafeZoneGrid} from './compositions/SafeZoneGrid';
import {igDmReelPropsSchema, safeZoneGridPropsSchema} from './types';
import {demoEvents} from './data/demoEvents';
import {FPS, WIDTH, HEIGHT} from './constants';

const defaultSafeZones = {
	topEnd: 0.06,
	railX: 0.79,
	railTop: 0.38,
	railBottom: 0.96,
	bottomStart: 0.82,
};

export const RemotionRoot: React.FC = () => {
	return (
		<>
			<Composition
				id="IgDmReel"
				component={IgDmReel}
				calculateMetadata={calculateIgDmReelMetadata}
				schema={igDmReelPropsSchema}
				durationInFrames={300}
				fps={FPS}
				width={WIDTH}
				height={HEIGHT}
				defaultProps={{
					events: demoEvents,
					receiver: {
						name: 'Jordan',
						username: '@jordan.codes',
						avatar: staticFile('avatar-demo.svg'),
						activeNow: true,
					},
					clock: '9:41',
					background: {kind: 'solid', value: '#0B0B0F'},
					theme: 'none',
					safeZones: defaultSafeZones,
					scrollAnchor: 0.75,
					spring: {damping: 20, mass: 0.6, stiffness: 180},
					tailSec: 2.5,
				}}
			/>
			<Composition
				id="SafeZoneGrid"
				component={SafeZoneGrid}
				schema={safeZoneGridPropsSchema}
				durationInFrames={150}
				fps={FPS}
				width={WIDTH}
				height={HEIGHT}
				defaultProps={{
					safeZones: defaultSafeZones,
					background: '#101014',
					gridColor: '#FFFFFF',
					labelColor: '#FFFFFF',
					overlayColor: 'rgba(255,30,30,0.35)',
				}}
			/>
		</>
	);
};
