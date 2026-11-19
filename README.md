# Loregrid 2.0.0-rc.9

Loregrid is a paged, offline learning technology tree. It keeps the useful static-web delivery of Learning Tech Tree while replacing the original single-canvas viewer with independent pages, an independently laid out **All** view, cross-page prerequisite proxies, global search, local progress, and a layered graph layout running in a Web Worker.

This is a versioned application release candidate. The regular build bundles a fictional starter tree and can open the user's V1 or V2 files. The application is a general tool; customer-specific content is optional. To create a standalone file with an agreed tree already embedded:

```powershell
pnpm build:customer -- local-data\customer-tree.json
```

This validates and embeds that tree into `dist/index.html`, then assembles a handoff folder at `dist/customer-delivery/` containing the versioned HTML and license notices. The generated file contains the selected tree and must be treated as private; `dist/` and `local-data/` are ignored by Git. Progress and notes remain local to the browser and can be backed up separately.

## What is different

- Each tab is a real subgraph with its own layout, not a filter that merely dims unrelated nodes.
- Cross-tab required prerequisites appear as proxy nodes. Selecting one opens the source tab and centers the canonical node.
- **All** contains every real node exactly once and is laid out separately.
- `required`, `recommended`, and `related` relations have distinct semantics.
- Multiple roots, leaves, and optional milestones are supported.
- Progress and private notes stay separate from public tree definitions.
- Existing `learning-tech-tree/v1` JSON and legacy progress can be read and upgraded.
- The production build is one self-contained HTML file, including the layout Worker.
- The lower-right tree library lists previously added JSON files. Each tree keeps its own pages, queue, completion records, and notes; even imported files sharing a tree ID have separate local progress.

Loregrid is inspired by the clarity of YART's paged research-tree experience. It does not include RimWorld code, integration, or game-owned art; YART-owned textures are retained under their MIT notice. See [third-party notices](THIRD_PARTY_NOTICES.md) and the [source mapping](docs/yart-source-map.md).

The [YART behavior comparison](docs/yart-parity.md) tracks implemented interactions and remaining layout differences. Shift-click appends a prerequisite chain, Alt-click prioritizes it, and Ctrl-click replaces the queue with it. Right-click opens the same queue actions. Reordering preserves prerequisite order; removing a prerequisite also removes its queued dependents. Completed learning records are unaffected by queue removal.

The layout uses dependency ranks, shared long-edge trunks, crossing optimization, spring/PAV placement and chain shaping. Stage labels color and group the existing dependency columns but do not create artificial ranks or spacing. This is a TypeScript adaptation informed by YART, not a line-by-line port; output positions are not guaranteed to match the mod. See the [local performance evidence](docs/performance.md), including dense and hub fixtures.

## Try it locally

Requirements: Node.js 20 or newer and npm/pnpm.

```powershell
pnpm install
pnpm dev
```

Open the printed local URL. The bundled fictional starter is sample content, separate from the application features. Use **Add tree** in the top-left menu, or **Add JSON trees** in the lower-right tree library, to select one or more V1/V2 JSON files. Added trees are copied into this browser's IndexedDB and remain available after reloading. The compact selector opens a searchable, height-limited scrolling list; it never adds a second cross-tree All view. Each tree's All contains only its own pages.

Browsers cannot silently scan arbitrary folders. Adding a file does not watch or modify its original disk copy; a changed file can be imported as another local entry. Keep the source JSON and export progress backups. To embed a tree in the application instead, use the customer build command above.

Build a double-clickable offline file:

```powershell
pnpm build
```

The result is `dist/index.html`. Its footer shows the exact build version (`2.0.0-rc.9`). It has no runtime npm dependency, account, backend, API key, telemetry, or CDN requirement. `pnpm build` creates the general application with starter content; `pnpm build:customer -- <tree.json>` replaces `dist/index.html` with a build containing the selected tree and assembles the shareable files in `dist/customer-delivery/`. Distribute the general HTML with `LICENSE` and `THIRD_PARTY_NOTICES.md` too.

## Data and migration

The public format is `loregrid/tree-v2`. Start from [`data/loregrid-demo.json`](data/loregrid-demo.json) and read [`docs/data-format.md`](docs/data-format.md).

```powershell
pnpm validate -- data/my-tree.json
pnpm migrate -- data/old-tree.json data/new-tree.json
```

Opening V1 in the UI performs the same migration in memory without changing the source file.

## Checks

```powershell
pnpm check
pnpm test
pnpm test:e2e
pnpm benchmark
pnpm build
```

The benchmark creates 1,000, 5,000, and 10,000-node trees in memory; it does not publish or retain personal data. Chromium and Firefox are configured for Playwright. Standard Windows browser locations or `PLAYWRIGHT_CHROMIUM_EXECUTABLE` / `PLAYWRIGHT_FIREFOX_EXECUTABLE` can be used when managed browsers are unavailable.

## Privacy

Tree definitions may contain private content. Added trees, completion state and notes remain local browser data and can be exported separately. Clearing browser data also removes the saved tree library. Do not commit progress backups, real identities, credentials, private paths, unpublished material, or personal trees. Put personal trees in ignored `local-data/`. See [`docs/privacy.md`](docs/privacy.md).

## License

The original Learning Tech Tree MIT license remains in [`LICENSE`](LICENSE). New Loregrid work is contributed under the same license. Substantive YART-inspired layout adaptation retains its separate MIT notice in [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).
