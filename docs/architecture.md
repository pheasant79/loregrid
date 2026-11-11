# Architecture

Loregrid is a static TypeScript application built by Vite into one offline HTML file.

## Data flow

1. `normalizeTree` accepts `loregrid/tree-v2` or migrates `learning-tech-tree/v1` in memory.
2. `validateTree` checks IDs, references, safe URLs, and required-edge cycles.
3. `buildGraphView` creates either one tab graph with prerequisite proxies or the canonical All graph.
4. `layout.worker.ts` caches and computes a layered layout outside the UI thread.
5. `GraphRenderer` draws grid/edges/minimap on Canvas and visible nodes in a virtualized DOM layer backed by a spatial index.
6. `LoregridApp` coordinates tabs, search, details, import/export, language, and local progress.

## Identity

- `node.id` is the stable business identity.
- `GraphViewNode.viewId` identifies a concrete rendering instance.
- In All and the node's own tab, real nodes use the canonical ID.
- A cross-tab prerequisite proxy uses `proxy:<tabId>:<nodeId>` and retains the canonical `nodeId` plus `targetTabId`.

## Layout

Required edges determine rank. Long edges are split through temporary dummy nodes, layers are reordered with repeated barycentric sweeps, and nodes are compactly placed. Recommended and related edges are routed after primary placement and do not affect rank. Coordinates are output only; they are not stored in tree data.

## Rendering and scale

Canvas draws the background, edges, and minimap. DOM buttons provide readable text, keyboard focus, and node interactions. A spatial grid returns only nodes near the viewport. Zoom level controls label detail. Layout is cancellable by terminating and recreating the Worker.

The 10,000-node target is a pressure test, not a hard limit or a promise that All remains at 60 FPS. Page interaction is the primary performance budget.
