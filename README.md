# Loregrid 2.0.0-rc.9

Loregrid is an open-source workspace for exploring and building **paged learning trees**: visual maps that help people understand what they can learn, what depends on what, and how separate topics fit into a larger subject. It is intended for self-directed learning, study plans, and other knowledge maps where relationships matter more than a flat checklist. It is not tied to one discipline, school, course length, or research method.

A Loregrid tree is one subject map made up of pages. Each page presents a focused part of that map; **All** brings its pages together into one overview. A prerequisite can point to a node on another page, so the map can stay organized without hiding cross-topic dependencies. A tree can have several starting points and several endpoints; it does not need one artificial root or a single linear route.

When using a tree, you can browse its pages, inspect relationships, search across the whole tree, build a personal learning queue, and record completion and private notes. Those records are kept separately for each tree in the current browser profile, so using one tree does not overwrite another tree's progress. Loregrid runs as a static web application and can also be built as a self-contained HTML file for offline use; it has no account system, backend, or cloud synchronization.

This repository contains both the application and the tools for working with tree data. The TypeScript source and readable algorithms live under `src/`; example, starter-template, and compatibility JSON files live under `data/`; a customer-ready package is generated under `dist/`. The built-in demo is fictional sample content, not a required curriculum. You can start with it, import your own V1/V2 JSON tree, or create one from the template. See [`docs/repository-layout.md`](docs/repository-layout.md) for what belongs in each folder.

**Start here:** [Chinese guide](docs/README.zh-CN.md) · [Repository layout](docs/repository-layout.md) · [Customer delivery](docs/customer-delivery.md) · [Privacy and storage](docs/privacy.md)

## Open or build

- Customer use: open `Loregrid.html` in the generated `dist/customer-delivery/` folder.
- Source development: Node.js 20+ and pnpm; run `pnpm install` then `pnpm dev`.
- Build a customer folder with a supplied tree: `pnpm build:customer -- path/to/tree.json`.

The repository-root `index.html` is a Vite development entry, not the customer launch instruction. Loregrid has no backend or cloud sync; user trees and progress are stored in the browser profile. Read the privacy guide before relying on that storage.

This is a versioned application release candidate. The regular build bundles a fictional starter tree and can open the user's V1 or V2 files. The application is a general tool; customer-specific content is optional. To create a standalone file with an agreed tree already embedded:

```powershell
pnpm build:customer -- local-data\customer-tree.json
```

This validates and embeds that tree into `dist/index.html`, then assembles a handoff folder at
`dist/customer-delivery/`. The handoff folder has a clear `Loregrid.html` entry, the original
tree under `trees/`, a Chinese quick-start, a delivery manifest and license notices. The
generated folder contains the selected tree and must be treated as private; `dist/` and
`local-data/` are ignored by Git. See [`docs/customer-delivery.md`](docs/customer-delivery.md).

## What is different

- Each tab is a real subgraph with its own layout, not a filter that merely dims unrelated nodes.
- Cross-tab required prerequisites appear as proxy nodes. Selecting one opens the source tab and centers the canonical node.
- **All** contains every real node exactly once and is laid out separately.
- `required`, `recommended`, and `related` relations have distinct semantics.
- Multiple roots, leaves, and optional milestones are supported.
- Progress and private notes stay separate from public tree definitions.
- Existing `learning-tech-tree/v1` JSON and legacy progress can be read and upgraded.
- The production build is one self-contained HTML file, including the layout Worker.
- The lower-right tree library combines the bundled starter, locally imported JSON files, and trees listed in the public catalog. Local trees are stored in this browser's IndexedDB. Public tree metadata is refreshed at startup; a public tree is downloaded and validated only when opened, then cached in IndexedDB for offline use. Its catalog is `public/tree-catalog.json` in the source tree (published as `tree-catalog.json` alongside the app). Add public V2 trees under `public/trees/` and list them in that catalog using `id`, `title`, and a JSON `url` relative to the catalog, with an optional `fileName`. The catalog schema is [`schema/public-tree-catalog.schema.json`](schema/public-tree-catalog.schema.json). Builds can point to a different catalog with `LOREGRID_PUBLIC_TREE_CATALOG_URL`. The repository catalog starts empty because no public tree submissions have been approved. Each tree keeps its own pages, queue, completion records, and notes; even imported files sharing a tree ID have separate local progress.

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

When hosted over HTTP(S), the app also fetches the configured public catalog at startup. Public trees appear beside local trees, are downloaded only when selected, and are cached locally after validation. The starter and local trees remain usable if the network is unavailable. Opening the single-file app with `file:` skips remote requests; public trees previously cached in that browser remain available.

Browsers cannot silently scan arbitrary folders. Adding a file does not watch or modify its original disk copy; a changed file can be imported as another local entry. Keep the source JSON and export progress backups. To embed a tree in the application instead, use the customer build command above.

Build a double-clickable offline file:

```powershell
pnpm build
```

The result is `dist/index.html`. Its footer shows the exact build version (`2.0.0-rc.9`). It has no runtime npm dependency, account, backend, API key, telemetry, or CDN requirement. `pnpm build` creates the general application with starter content; `pnpm build:customer -- <tree.json>` replaces `dist/index.html` with a build containing the selected tree and assembles the customer folder described above. Distribute `Loregrid.html`, `使用说明.txt`, `trees/`, `LICENSE` and `THIRD_PARTY_NOTICES.md` from that folder.

## Data and migration

The public format is `loregrid/tree-v2`. Start from [`data/examples/loregrid-demo.json`](data/examples/loregrid-demo.json) or copy [`data/templates/minimal-template-v2.json`](data/templates/minimal-template-v2.json), then read [`docs/data-format.md`](docs/data-format.md).

```powershell
pnpm validate -- data/examples/loregrid-demo.json
pnpm migrate -- data/compatibility/learning-tech-tree-v1-template.json data/migrated-tree.json
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
