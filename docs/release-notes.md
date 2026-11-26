# Loregrid change summary

## v2.1.0 — documentation

- Chinese-first project homepage and English counterpart with real overview and workflow screenshots.
- Separate user/developer guides, FAQ, and corrected AI authoring prompts using the unified data folder.
- Clear entry, storage and upgrade instructions, including the older v2.0.0 upgrade path.

## v2.1.0 — app updates and rendering

- Click the bottom-left version or **⋯ → Check for updates** for stable release notes and downloads.
- Optional daily startup checks; default offline, explicit network-error states, and no learning-data upload.
- Current-tree progress backup and upgrade instructions that preserve `data/`.
- Release packaging produces both the full offline ZIP and a standalone update HTML.
- Improved low-zoom node contrast, translucent completed fills, rounded outlines and background-grid visibility.
- Preserved endpoint-based completion gradients while improving low-zoom connection rendering; layout regression coverage expanded.

Loregrid is an offline-first viewer for paged learning trees. The repository currently
contains its TypeScript source, fictional examples, JSON schemas, tests, and documentation.

Current capabilities include:

- Page and whole-tree views, with cross-page prerequisite links.
- Worker-based graph layout and Canvas rendering.
- Search, node details, learning queues, and local progress.
- Import of Loregrid V2 and legacy Learning Tech Tree V1 data.
- A single-file offline build.

The project does not currently provide a hosted demo. Offline download packages are
listed under [GitHub Releases](https://github.com/pheasant79/loregrid/releases).
See the [v2.1.0 notes](releases/v2.1.0.md) for package contents and limitations, or the [v2.0.0 notes](releases/v2.0.0.md) for the previous version.
The root `index.html` is a ready-to-open offline application; see the [README](../README.md)
for ordinary-user and developer workflows.
