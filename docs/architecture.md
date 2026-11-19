# Architecture

Loregrid is a static TypeScript application built by Vite into one offline HTML file.

## Data flow

1. `normalizeTree` accepts `loregrid/tree-v2` or migrates `learning-tech-tree/v1` in memory.
2. `validateTree` checks IDs, references, safe URLs, and required-edge cycles.
3. `buildGraphView` creates either one tab graph with prerequisite proxies or the canonical All graph.
4. `layout.worker.ts` caches and computes a layered layout outside the UI thread.
5. `GraphRenderer` draws grid/edges/minimap on Canvas and visible nodes in a virtualized DOM layer backed by a spatial index.
6. `LoregridApp` coordinates tabs, search, details, import/export, language, and local progress.

## Local tree library

`TreeLibrary` stores normalized, validated imported trees in IndexedDB. Its `catalog` store holds lightweight metadata separately from the `trees` store; startup lists metadata and reads only the selected tree. Original disk files remain unchanged. The built-in tree has a stable local key; each new imported file receives its own entry key. Identical reimports with the same filename and tree content reuse the existing entry.

The lower-right picker is collapsible, searchable and internally scrollable. It switches the active tree; it does not introduce collections or merge different trees. All and combined pages remain scoped to the active tree. localStorage progress keys include the library entry key as well as the data's tree ID, preventing files with duplicate IDs from sharing progress accidentally. Queues, notes, favorites, page presets and the last selected page restore independently. Existing pre-library progress is copied only to the first matching entry; legacy storage is retained.

Storage failure leaves session-only imports usable with a warning. This is browser-local persistence, not filesystem discovery or synchronization. Browser storage policies also apply to the standalone `file:` build.

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
