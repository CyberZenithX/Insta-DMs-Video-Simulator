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
	
	// Retry up to 3 times for Windows EBUSY locks
	for (let i = 0; i < 3; i++) {
		try {
			return JSON.parse(fs.readFileSync(p, 'utf-8')) as LocalRenderState;
		} catch (err: any) {
			if (i === 2) return undefined;
			// wait 10ms
			const start = Date.now();
			while (Date.now() - start < 10) {} 
		}
	}
	return undefined;
};

// Simple write queue to prevent overlapping async writes and EBUSY locks
const writeQueue = new Map<string, LocalRenderState>();
const isWriting = new Set<string>();

export const setLocalRenderState = async (id: string, state: LocalRenderState) => {
	writeQueue.set(id, state);
	if (isWriting.has(id)) return;

	isWriting.add(id);
	try {
		while (writeQueue.has(id)) {
			const latestState = writeQueue.get(id)!;
			writeQueue.delete(id);
			
			const p = getStatePath(id);
			const tempPath = `${p}.tmp`;
			
			// Use async fs to avoid blocking the Node event loop (preventing Remotion hangs)
			await fs.promises.writeFile(tempPath, JSON.stringify(latestState), 'utf-8');
			// Atomic rename prevents read corruption when polling
			await fs.promises.rename(tempPath, p);
		}
	} catch (err) {
		console.error('Failed to write local render state:', err);
	} finally {
		isWriting.delete(id);
	}
};
