/// <reference lib="webworker" />
import { layoutGraph } from '../core/layout';
import type { GraphView, LayoutResult } from '../core/types';

type Request = { id: number; view: GraphView; cacheKey: string };
type Response = { id: number; result?: LayoutResult; error?: string; cached?: boolean };

const cache = new Map<string, LayoutResult>();

self.onmessage = (event: MessageEvent<Request>) => {
  const { id, view, cacheKey } = event.data;
  try {
    const cached = cache.get(cacheKey);
    if (cached) {
      self.postMessage({ id, result: cached, cached: true } satisfies Response);
      return;
    }
    const result = layoutGraph(view);
    cache.set(cacheKey, result);
    self.postMessage({ id, result } satisfies Response);
  } catch (error) {
    self.postMessage({ id, error: error instanceof Error ? error.message : String(error) } satisfies Response);
  }
};

export {};
