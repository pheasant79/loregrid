# Loregrid change summary

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
See the [v2.0.0 notes](releases/v2.0.0.md) for package contents and limitations.
The root `index.html` is a ready-to-open offline application; see the [README](../README.md)
for ordinary-user and developer workflows.
