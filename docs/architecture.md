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

`TreeLibrary` keeps a browser cache of imported trees in IndexedDB. When a user-selected
data folder is available, the app reads `trees/*.json` at startup or on explicit refresh
and updates cached definitions by stable tree ID and source filename. Tree files remain
read-only to the app.

Progress is separate from tree definitions. It is stored in browser storage and mirrored
to `progress/<tree-id>.progress.json` when folder write permission is available. Update
timestamps resolve which copy is newer after a disconnected session. Invalid disk
progress is not overwritten automatically. The folder workflow requires unique tree IDs;
duplicate IDs in one folder are reported and the duplicate file is skipped. A malformed
tree file is reported independently while other valid files continue loading. Browsers
without local folder access retain manual JSON import and progress backup/restore.

The app does not continuously watch folders. It reads once on startup when permission is
available and on user request. Removing a source JSON removes its folder-backed library
entry on the next successful sync; its browser progress remains available if the tree is
imported again.

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
