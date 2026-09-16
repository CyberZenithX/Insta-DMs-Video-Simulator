import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export type LocalRenderState = 
  | { stage: 'launching' }
  | { stage: 'resolving' }
  | { stage: 'rendering'; renderedFrames: number; encodedFrames: number; totalFrames: number; progress: number; estimatedRemainingMs: number }
  | { stage: 'stitching' }
  | { stage: 'done'; outputFile: string }
  | { stage: 'error'; error: string };

const getStatePath = (id: string) => path.join(os.tmpdir(), `${id}-state.json`);

export const getLocalRenderState = (id: string): LocalRenderState | undefined => {
	const p = getStatePath(id);
	if (!fs.existsSync(p)) return undefined;
	try {
		return JSON.parse(fs.readFileSync(p, 'utf-8')) as LocalRenderState;
	} catch {
		return undefined;
	}
};

export const setLocalRenderState = (id: string, state: LocalRenderState) => {
	fs.writeFileSync(getStatePath(id), JSON.stringify(state), 'utf-8');
};
