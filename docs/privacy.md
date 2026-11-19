# Privacy

Loregrid has no backend, account, telemetry, remote model request, or sync service. In the repository preview, the tree definition is a bundled fictional sample; in a customer build, the selected V1/V2 tree is embedded into the standalone HTML. The generated HTML contains that tree, so treat it as private if the tree is private.

Files selected with Add tree or Add JSON trees are copied into IndexedDB in the current browser. A separate catalog holds their titles, filenames and local entry keys so listing trees does not load every graph. The application does not scan arbitrary folders, watch the original files, upload them, or modify their disk copies. A changed file may be imported as a separate entry.

Progress, queues, notes, combined-page presets and the last page are stored in localStorage under each library entry's key and tree ID. Two imported files with the same tree ID therefore have independent local state. The first matching entry may migrate pre-library V1/V2 progress; the old record remains intact. The active library entry is also remembered locally. Exports happen only when the user chooses a tree-export or progress-backup action.

When opened from an HTTP(S) site, the app requests the configured public tree catalog (by default, `tree-catalog.json`) and fetches a public tree only after it is selected. Catalog metadata is cached in localStorage and opened public trees in IndexedDB. Offline `file:` use skips network access; only previously cached public trees can then be opened. Private trees and progress are never uploaded by this feature.

Tree JSON and progress JSON are intentionally separate. A tree export contains learning content, which may itself be private. A progress export contains private self-assessment and notes and should not be committed or shared unintentionally. Back up each tree's progress separately.

Browser storage is not encrypted. Clearing site data, changing browser profiles, moving/renaming an offline HTML file, changing from `file:` to a hosted origin, or using another device may make existing trees and progress unavailable. Private browsing may discard storage on exit. Keep source JSON files and export progress backups when the data matters. If tree storage is unavailable, an on-screen warning explains that imports survive only for the current session.

Public commits must exclude identities, student IDs, credentials, real advisors, private correspondence, unpublished research, local machine paths, personal notes, and progress backups. Use ignored `local-data/` for private trees. `.gitignore` is only a guardrail; inspect staged files before publishing.

External resource links open third-party sites and are subject to those sites' policies. Loregrid permits only HTTP(S) links and adds `noreferrer` when opening them.
