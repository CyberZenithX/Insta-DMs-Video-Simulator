export type LocalRenderState = 
  | { stage: 'launching' }
  | { stage: 'resolving' }
  | { stage: 'rendering'; renderedFrames: number; encodedFrames: number; totalFrames: number; progress: number; estimatedRemainingMs: number }
  | { stage: 'stitching' }
  | { stage: 'done'; outputFile: string }
  | { stage: 'error'; error: string };

const globalStore = global as typeof globalThis & {
	__LOCAL_RENDER_STORE__?: Map<string, LocalRenderState>;
};

const store = globalStore.__LOCAL_RENDER_STORE__ ?? new Map<string, LocalRenderState>();
globalStore.__LOCAL_RENDER_STORE__ = store;

export const getLocalRenderState = (id: string) => store.get(id);
export const setLocalRenderState = (id: string, state: LocalRenderState) => store.set(id, state);
