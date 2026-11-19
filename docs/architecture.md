# Architecture at a glance

Loregrid is a TypeScript application with no UI framework. Vite builds it into a
standalone offline HTML file.

## How a tree reaches the screen

1. `normalizeTree` reads V2 data or migrates V1 data in memory.
2. `validateTree` checks identifiers, references, safe URLs, and dependency cycles.
3. `buildGraphView` creates a page graph or the canonical All graph.
4. `layout.worker.ts` computes layout outside the main UI thread.
5. `GraphRenderer` draws edges on Canvas and visible node controls in the DOM.
6. `LoregridApp` connects navigation, search, details, import/export, and progress.

## Local tree library and progress

`TreeLibrary` stores imported trees in IndexedDB. Small catalog records let startup list
trees without loading every graph. The app loads the selected tree; original files stay
unchanged.

Each imported file has its own library entry. Progress keys include the entry key and tree
ID so separate files with the same ID do not share state. Queues, notes, favorites,
presets, and page selection restore independently.

This is browser storage, not folder scanning or synchronization. If persistent storage is
unavailable, the app warns that imported trees last only for the current session.

## Graph identity

- `node.id` is the stable identity in the tree file.
- `GraphViewNode.viewId` identifies one visible graph instance.
- Real nodes keep their canonical ID in All and on their own page.
- A cross-page prerequisite proxy uses `proxy:<tabId>:<nodeId>` and points to the
  canonical node.

## Layout and rendering

Required relationships determine rank. Long edges use temporary layout nodes; crossing
reduction and compaction place the graph. Recommended and related links are routed after
primary placement.

Canvas handles the background, links, and minimap. DOM buttons provide readable labels,
keyboard focus, and node interactions. A spatial index limits work to the visible area.
Zoom changes the amount of node detail.

The 10,000-node fixture is a performance target, not a node limit or a promise that an
All view stays at 60 FPS. See [performance notes](performance.md).
