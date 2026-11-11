import type { GraphView, LayoutResult } from '../core/types';
import { layoutGraph } from '../core/layout';
import LayoutWorker from '../worker/layout.worker?worker&inline';

type WorkerResponse = { id: number; result?: LayoutResult; error?: string };

export class LayoutService {
  private worker: Worker | null;
  private sequence = 0;
  private pending = new Map<number, { resolve: (value: LayoutResult) => void; reject: (reason: Error) => void }>();
  private localCache = new Map<string, LayoutResult>();

  constructor() {
    this.worker = this.canUseWorker() ? this.createWorker() : null;
  }

  request(view: GraphView, treeVersion: string): Promise<LayoutResult> {
    const id = ++this.sequence;
    const cacheKey = `layout-v1:${treeVersion}:${view.key}:${fingerprint(view)}`;
    if (!this.worker) {
      return new Promise((resolve) => {
        window.setTimeout(() => {
          const cached = this.localCache.get(cacheKey);
          if (cached) resolve(cached);
          else {
            const result = layoutGraph(view);
            this.localCache.set(cacheKey, result);
            resolve(result);
          }
        }, 0);
      });
    }
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.worker?.postMessage({ id, view, cacheKey });
    });
  }

  cancel(): void {
    this.worker?.terminate();
    this.pending.forEach(({ reject }) => reject(new Error('Layout cancelled.')));
    this.pending.clear();
    this.worker = this.canUseWorker() ? this.createWorker() : null;
  }

  destroy(): void {
    this.worker?.terminate();
    this.pending.clear();
  }

  private createWorker(): Worker {
    const worker = new LayoutWorker();
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const pending = this.pending.get(event.data.id);
      if (!pending) return;
      this.pending.delete(event.data.id);
      if (event.data.result) pending.resolve(event.data.result);
      else pending.reject(new Error(event.data.error ?? 'Layout failed.'));
    };
    worker.onerror = (event) => {
      const error = new Error(event.message || 'Layout worker failed.');
      this.pending.forEach(({ reject }) => reject(error));
      this.pending.clear();
    };
    return worker;
  }

  private canUseWorker(): boolean {
    return typeof Worker !== 'undefined' && window.location.protocol !== 'file:';
  }
}

function fingerprint(view: GraphView): string {
  let hash = 2166136261;
  const update = (value: string): void => {
    for (let cursor = 0; cursor < value.length; cursor += 1) {
      hash ^= value.charCodeAt(cursor);
      hash = Math.imul(hash, 16777619);
    }
  };
  view.nodes.forEach((node) => update(`${node.viewId}\u0000${node.title}\u0000${node.tabId}\u0000${node.layout?.groupId ?? ''}\u0000${node.layout?.stage ?? ''}\u0000${node.layout?.order ?? ''}`));
  view.edges.forEach((edge) => update(`${edge.id}\u0000${edge.source}\u0000${edge.target}\u0000${edge.type}`));
  return (hash >>> 0).toString(36);
}
