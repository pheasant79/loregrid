# Loregrid

**Explore a subject as a visual map of learning goals and prerequisites.**

[简体中文](docs/README.zh-CN.md) · [Documentation index](docs/README.md) · [Data format](docs/data-format.md) · [Privacy](docs/privacy.md)

![The 155-node All overview of Loregrid's computer science sample tree](docs/assets/loregrid-preview-en.jpg)

*The 155-node example in All view. Each column is a learning stage; zoom in to inspect individual topics and prerequisites.*

Loregrid is an offline-first, open-source viewer for paged learning trees. Each tree has focused pages and one **All** view. Required prerequisites connect topics, including across pages, without forcing a subject into one linear course.

Search a tree, inspect relationships, build a learning queue, and keep personal progress. Loregrid is general-purpose: it does not prescribe a discipline, curriculum, institution, or study schedule.

## Use the ready app

For ordinary use, open [Releases](https://github.com/pheasant79/loregrid/releases)
and download the **`Loregrid-v…-offline.zip`** attachment. Extract the entire ZIP
and open `index.html` in the extracted folder. Read `使用说明-START-HERE.txt`
for folder access and backup instructions.

**Code → Download ZIP** also works: extract it and open
[`index.html`](index.html) in the top-level folder. (Cloning the repository works too.) It is the prepared offline
application: it opens directly in a current Chromium or Firefox browser and does not
require Node.js, pnpm, Vite, a server, or an account.

The app starts with one fictional example bundled into the HTML. Opening the file directly
does not scan nearby folders. To add trees, either import JSON files from the Tree library
menu, or choose the repository's `data/` folder in a browser that supports folder access
and grant access so Loregrid can read `data/trees/`. See the [Chinese user guide](docs/README.zh-CN.md)
or the [English documentation index](docs/README.md).

## Build and develop

Only contributors who change the TypeScript source need Node.js 20+ and pnpm:

```powershell
pnpm install
pnpm dev
```

To regenerate the ready app after source changes:

```powershell
pnpm build
```

The command writes the disposable build to `dist/index.html` and refreshes the tracked
ready app at the root `index.html`. `dist/` is ignored; the root `index.html` is the
handoff file. The development HTML template lives in `src/index.html`.

`pnpm package:release` builds an allowlisted user package under `dist/`, containing
the ready app, the two distributed examples, an empty progress folder, instructions,
and license notices. Personal trees and progress are never copied into that package.

## Explore a tree

1. In Chromium, open the upper-left **⋯** menu and choose **Choose data folder**, then select `data/`
   (not `data/trees/`) and grant access. After access is granted, Loregrid reads `data/trees/`
   at startup while permission remains available. Use **Reconnect data folder** if permission
   expires and **Reload data folder** after editing a tree while the app is open.
2. To use a tree without connecting a folder, import one or more V1 or V2 JSON files manually.
   This also works in browsers without folder access, including Firefox.
3. Choose a page, or select **All** to see the whole active tree.
4. Select topics to inspect prerequisites, add learning goals to the queue, and record progress.

Each imported tree keeps its own page, queue, completion state, and notes.

## Your files and progress

Tree definitions live in `data/trees/`; AI or another authoring tool edits those JSON files.
Loregrid reads them but never changes the tree definition. Completion, queue, and private
notes are separate progress JSON files in `data/progress/` when the `data/` folder is
connected. Browser-local storage remains a working cache. In unsupported browsers, use
manual import and progress backup/restore. Progress updates are timestamped so reconnecting
does not silently replace the newer saved copy with an older one.

Loregrid has no account, backend, cloud sync, or telemetry. Browser data is not shared across devices or browser profiles, and clearing browser data may remove it. Keep your source JSON and export progress backups for anything important. See [privacy and storage](docs/privacy.md).

To create a tree, copy [`docs/templates/minimal-template-v2.json`](docs/templates/minimal-template-v2.json), read the [tree format guide](docs/data-format.md), then place the generated JSON in `data/trees/` and validate it:

```powershell
pnpm validate -- path/to/tree.json
```

## Project map

| Location | Purpose |
| --- | --- |
| `src/` | Application, graph model, layout, renderer, and Worker |
| `data/trees/` | Example trees and user/AI-authored tree JSON |
| `data/progress/` | Per-tree progress JSON; personal files are Git-ignored |
| `docs/templates/` | Starter JSON template |
| `schema/` | JSON schema for tree data |
| `scripts/`, `tests/` | Validation tools and automated tests |
| `docs/` | Guides and technical references |
| `index.html` | Tracked, ready-to-open offline application |
| `dist/` | Disposable generated build output; recreated by `pnpm build` |

See the [repository layout](docs/repository-layout.md) for details.

## Development

```powershell
pnpm check
pnpm test
pnpm validate -- data/trees/loregrid-demo.json
pnpm build
```

For browser tests, run `pnpm test:e2e`. For synthetic graph measurements, run `pnpm benchmark`. Read [architecture](docs/architecture.md), [performance notes](docs/performance.md), and [contributing](.github/CONTRIBUTING.md).

## License and attribution

Loregrid is distributed under the MIT License and retains required upstream and third-party notices. See [`LICENSE`](LICENSE), [third-party notices](docs/legal/THIRD_PARTY_NOTICES.md), and the [YART source map](docs/yart-source-map.md).
