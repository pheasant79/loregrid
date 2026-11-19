# Contributing

Keep changes scoped and preserve Loregrid's offline, framework-free architecture. Public examples must be fictional or independently authorized and must not include progress, personal notes, private paths, credentials, or unpublished work.

For data contributions, use stable IDs and `loregrid/tree-v2`. Mark only genuine prerequisites as `required`; use `recommended` or `related` for non-gating context. Nodes need a clear learning scope and, when practical, an observable outcome. Do not copy entire copyrighted curricula or imply institutional endorsement.

Before submitting code or data, run:

```powershell
pnpm check
pnpm test
pnpm validate -- data/examples/loregrid-demo.json
pnpm build
```

Run `pnpm test:e2e` for UI changes and `pnpm benchmark` for graph/layout changes. Preserve the original license and all applicable third-party notices.
