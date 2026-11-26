# Privacy and storage

## What stays on your device

Loregrid has no account, backend, telemetry, remote AI request, or cloud sync.

When you connect a data folder, Loregrid reads JSON tree definitions from its `trees/`
folder at startup when permission is still available, and on request. It does not modify
those tree files. Browsers without local folder access can import tree JSON manually.

The tree library is cached in IndexedDB. Queues, completion, notes, page selection, and
other progress are stored in browser storage and, when folder write permission is
available, mirrored to one JSON file under `progress/`. When folder access is lost, the
browser copy remains available; on reconnection the app compares update timestamps to
avoid replacing a newer copy with an older one. Invalid progress files are left untouched
and automatic saving pauses until the user restores valid progress.

Loregrid does not upload imported trees, notes, queues, or progress. External resource
links open third-party websites.

## Optional update checks

Update checks are off by default. Clicking the version label or the menu's **Check for
updates** connects to GitHub's Releases API. An optional startup check runs at most
once daily. GitHub receives ordinary network metadata, such as your IP address; trees,
notes, queues, and progress are never included. Preferences and the last attempt time
are stored separately from learning progress. Release/download links open GitHub.
No files are automatically downloaded or overwritten. See [updating Loregrid](updates.md).

## Back up important data

Tree JSON and progress backups are separate:

- A tree export contains the learning content.
- A progress JSON contains your queue, completion state, private notes, and view settings.

Browser storage is not encrypted. It may be removed when site data is cleared, a private
window closes, or a browser profile or device changes. An offline HTML file opened from
`file:` may use different storage from the hosted app.

Keep the original tree files and separate progress JSON files. Do not commit private
tree content, notes, credentials, or progress backups to a public repository.
