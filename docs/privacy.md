# Privacy and storage

## What stays on your device

Loregrid has no account, backend, telemetry, remote AI request, or cloud sync.

When you import a JSON file, Loregrid copies it into the current browser's local library.
It does not scan folders, monitor the original file, or change the disk copy.

The tree library is stored in IndexedDB. Queues, completion, notes, page selection, and
other progress are stored separately in browser storage.

## Public tree catalog

If a hosted copy of Loregrid has a public tree catalog configured, it makes a network
request to read the catalog and downloads a selected tree. Offline `file:` use does not
fetch remote trees. Catalog details are in the [public tree library guide](public-tree-library.md).

Loregrid does not upload imported trees, notes, queues, or progress. External resource
links open third-party websites.

## Back up important data

Tree JSON and progress backups are separate:

- A tree export contains the learning content.
- A progress backup contains your queue, completion state, and private notes.

Browser storage is not encrypted. It may be removed when site data is cleared, a private
window closes, or a browser profile or device changes. An offline HTML file opened from
`file:` may use different storage from the hosted app.

Keep the original tree files and export progress backups regularly. Do not commit private
tree content, notes, credentials, or progress backups to a public repository.
