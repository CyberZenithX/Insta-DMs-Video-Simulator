import React from 'react';
import {Composition} from 'remotion';
import {IgDmReel, calculateIgDmReelMetadata} from './compositions/IgDmReel';
import {SafeZoneGrid} from './compositions/SafeZoneGrid';
import {igDmReelPropsSchema, safeZoneGridPropsSchema} from './types';
import {demoEvents} from './data/demoEvents';
import {baseIgDmReelProps, defaultReceiver, defaultClock, defaultSafeZones} from './data/defaultProps';
import {FPS, WIDTH, HEIGHT} from './constants';

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
					...baseIgDmReelProps,
					events: demoEvents,
					receiver: defaultReceiver,
					clock: defaultClock,
					theme: 'none',
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
