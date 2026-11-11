# Loregrid

Loregrid is a paged, offline learning technology tree. It keeps the useful static-web delivery of Learning Tech Tree while replacing the original single-canvas viewer with independent branch pages, an independently laid out **All** view, cross-page prerequisite proxies, global search, local progress, and a layered graph layout running in a Web Worker.

> Alpha software. The data format is versioned, but UI and layout details may still change before the first stable release.

## What is different

- Each tab is a real subgraph with its own layout, not a filter that merely dims unrelated nodes.
- Cross-tab required prerequisites appear as proxy nodes. Selecting one opens the source tab and centers the canonical node.
- **All** contains every real node exactly once and is laid out separately.
- `required`, `recommended`, and `related` relations have distinct semantics.
- Multiple roots, leaves, and optional milestones are supported.
- Progress and private notes stay separate from public tree definitions.
- Existing `learning-tech-tree/v1` JSON and legacy progress can be read and upgraded.
- The production build is one self-contained HTML file, including the layout Worker.

Loregrid is inspired by the clarity of YART's paged research-tree experience, but it does not include RimWorld code, integration, or art assets. See [third-party notices](THIRD_PARTY_NOTICES.md) and the [source mapping](docs/yart-source-map.md).

## Try it locally

Requirements: Node.js 20 or newer and npm/pnpm.

```powershell
pnpm install
pnpm dev
```

Open the printed local URL. The default fictional demo covers four pages and several cross-page dependencies.

Build a double-clickable offline file:

```powershell
pnpm build
```

The result is `dist/index.html`. It has no runtime npm dependency, account, backend, API key, telemetry, or CDN requirement.

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

Tree definitions are public content. Completion state and notes are local browser data and can be exported separately. Do not commit progress backups, real identities, credentials, private paths, unpublished material, or personal trees. Put personal trees in ignored `local-data/`. See [`docs/privacy.md`](docs/privacy.md).

## License

The original Learning Tech Tree MIT license remains in [`LICENSE`](LICENSE). New Loregrid work is contributed under the same license. Substantive YART-inspired layout adaptation retains its separate MIT notice in [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).
