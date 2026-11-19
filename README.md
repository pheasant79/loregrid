# Loregrid

**Explore a subject as a visual map of learning goals and prerequisites.**

[简体中文](docs/README.zh-CN.md) · [Documentation index](docs/README.md) · [Data format](docs/data-format.md) · [Privacy](docs/privacy.md)

![The 155-node All overview of Loregrid's computer science sample tree](docs/assets/loregrid-preview-en.jpg)

*A full-tree view of the 155-node example. Fit the map to see its shape, then zoom in to read individual topics.*

Loregrid is an offline-first, open-source viewer for paged learning trees. Each tree has focused pages and one **All** view. Required prerequisites connect topics, including across pages, without forcing a subject into one linear course.

Search a tree, inspect relationships, build a learning queue, and keep personal progress. Loregrid is general-purpose: it does not prescribe a discipline, curriculum, institution, or study schedule.

## Run locally

There is no hosted demo or downloadable release yet. Run the app on your computer:

**Requirements:** Node.js 20+ and pnpm.

```powershell
git clone https://github.com/pheasant79/loregrid.git
cd loregrid
pnpm install
pnpm dev
```

Open the local address printed in the terminal. Loregrid starts with a fictional example. Core features work without an account or network access.

To create a standalone offline HTML file:

```powershell
pnpm build
```

Open `dist/index.html`. Build output is generated locally and is not committed.

## Explore a tree

1. Open the tree library in the lower-right corner.
2. Add one or more V1 or V2 JSON files.
3. Choose a page, or select **All** to see the whole active tree.
4. Select topics to inspect prerequisites, add learning goals to the queue, and record progress.

Each imported tree keeps its own page, queue, completion state, and notes.

## Your files and progress

Tree definitions are JSON files. Importing a tree copies it into this browser; it does not edit or monitor the original file. Progress and private notes are stored separately in the browser.

Loregrid has no account, backend, cloud sync, or telemetry. Browser data is not shared across devices or browser profiles, and clearing browser data may remove it. Keep your source JSON and export progress backups for anything important. See [privacy and storage](docs/privacy.md).

To create a tree, copy [`data/templates/minimal-template-v2.json`](data/templates/minimal-template-v2.json), read the [tree format guide](docs/data-format.md), then validate the file:

```powershell
pnpm validate -- path/to/tree.json
```

## Project map

| Location | Purpose |
| --- | --- |
| `src/` | Application, graph model, layout, renderer, and Worker |
| `data/examples/` | Fictional learning trees |
| `data/templates/` | Starter JSON files |
| `data/compatibility/` | Legacy-format test data |
| `public/`, `schema/` | Optional public catalog, schemas, and web assets |
| `scripts/`, `tests/` | Validation tools and automated tests |
| `docs/` | Guides and technical references |
| `dist/` | Generated build output; recreated by `pnpm build` |

See the [repository layout](docs/repository-layout.md) for details.

## Development

```powershell
pnpm check
pnpm test
pnpm validate -- data/examples/loregrid-demo.json
pnpm build
```

For browser tests, run `pnpm test:e2e`. For synthetic graph measurements, run `pnpm benchmark`. Read [architecture](docs/architecture.md), [performance notes](docs/performance.md), and [contributing](CONTRIBUTING.md).

## License and attribution

Loregrid is distributed under the MIT License and retains required upstream and third-party notices. See [`LICENSE`](LICENSE), [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md), and the [YART source map](docs/yart-source-map.md).
