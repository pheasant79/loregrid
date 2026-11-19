# Publishing checklist

No publication is implied by a successful build. Before a public push, Release, or Pages deployment:

1. Run type checks, unit tests, data validation, production build, and relevant browser tests.
2. Confirm `dist/index.html` works without a server. For a hosted public library, also deploy `dist/tree-catalog.json` and any public JSON trees. The catalog is optional for standalone offline use.
3. Review staged files for personal data, progress, notes, local paths, credentials, test traces, and benchmark scratch output.
4. Keep `LICENSE`, `THIRD_PARTY_NOTICES.md`, and the YART source map.
5. Confirm the default example is fictional and contains no unauthorized assets.
6. Record browser/performance limitations honestly.

Push, GitHub Pages, Releases, and upstream pull requests require separate explicit authorization.
