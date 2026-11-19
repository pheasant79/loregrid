# Repository and delivery layout

Loregrid has three different concerns. They are deliberately kept separate:

1. The Git repository contains readable source code, public examples, tests, schemas,
   build scripts, documentation, and license notices.
2. `dist/` contains generated build output and is not a source directory. It is ignored
   by Git and can be recreated with `pnpm build`.
3. Customer trees, progress, queues, notes, and backups are user data. They must not be
   committed to the public repository.

## Repository

```text
loregrid/
├── src/                 TypeScript application, graph algorithms, renderer and worker
├── public/              Hosted assets and the explicitly curated public-tree catalog
├── data/
│   ├── examples/        Fictional example trees
│   ├── templates/       Starter templates to copy
│   └── compatibility/   V1 fixture used to test migration
├── schema/              JSON schemas for tree and public-catalog formats
├── tests/               Unit tests, browser workflows and visual fixtures
├── scripts/             Validation, migration, benchmark and customer-build commands
├── docs/                User, format, privacy, publishing and architecture documentation
├── prompts/             Optional prompts for authoring tree JSON
├── index.html           Vite development entry
├── package.json         Commands and development dependencies
├── LICENSE              Loregrid and preserved upstream MIT terms
└── THIRD_PARTY_NOTICES.md
```

The `data/` subfolders are source materials, not a user library. `public/trees/` is
reserved for deliberately published JSON trees listed by `public/tree-catalog.json`.
The current catalog is empty. Personal or customer trees belong outside the source repo;
at runtime, users add JSON files through the application.

## Customer delivery

`pnpm build:customer -- path/to/customer-tree.json` creates:

```text
dist/customer-delivery/
├── Loregrid.html          The single application entry; algorithms are bundled inside it
├── 使用说明.txt           Short customer-facing opening, backup and privacy instructions
├── trees/
│   └── <customer-file>.json
├── loregrid-delivery.json  Version and entry manifest
├── LICENSE
└── THIRD_PARTY_NOTICES.md
```

The package is intentionally understandable without exposing the development tree.
`Loregrid.html` is the executable application; `trees/` is the original content backup,
not an automatically scanned folder. The current browser application stores imported
trees and progress in browser-local storage. It does not silently read or write arbitrary
folders, upload personal data, or provide cloud synchronization.

For a repository checkout, use `pnpm dev` and open the Vite URL. For a customer package,
double-click `Loregrid.html`. Do not ask a customer to open the repository's root
`index.html` or to run development commands.
