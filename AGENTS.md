# Repository guidance

Loregrid is a general, paged learning-tech-tree viewer and versioned data format. It is not a RimWorld mod and must not hard-code a discipline, institution, degree duration, or research method.

## Architecture

- Use TypeScript native modules and the existing Vite build. Do not add a UI framework without an explicit architecture decision.
- Keep public tree data, normalized graph views, layout, rendering, and private progress as separate modules.
- `required` edges affect unlock state and rank; multiple required prerequisites mean AND.
- `recommended` edges are directed but non-gating. `related` edges are non-directional in product semantics and do not determine rank.
- Every node belongs to one primary tab. Tab views may add prerequisite proxies; All must contain one canonical real node per business node.
- Node coordinates are computed, never authored in data. Optional group/order/stage values are hints only.
- Preserve Worker layout, viewport culling, stable IDs, and offline single-file output.

## Compatibility and safety

- Continue reading `learning-tech-tree/v1` and `learning-tech-progress/v1` unless a versioned migration decision replaces them.
- Treat imported JSON as untrusted. Render user text with text nodes, allow only HTTP(S) external URLs, limit notes/text, and never execute imported HTML or script.
- There is no node hard limit. Values beyond 10,000 may warn, but must not be rejected solely for size.
- Keep personal trees, notes, progress, credentials, private paths, task records, generated reports, and temporary benchmark output out of public commits.
- Preserve `LICENSE`, `THIRD_PARTY_NOTICES.md`, and `docs/yart-source-map.md`. YART-owned textures may be reused when their MIT notice is retained and the source is documented. Do not copy RimWorld game-owned assets or game-specific source into the standalone web application.

## Verification

Run checks appropriate to the change:

```powershell
pnpm check
pnpm test
pnpm validate -- data/loregrid-demo.json
pnpm build
pnpm test:e2e
pnpm benchmark
```

Do not claim a browser, performance, accessibility, or licensing check passed unless it was actually run. Do not push, publish, enable Pages, create a Release, or open an upstream PR unless the user explicitly authorizes it.
