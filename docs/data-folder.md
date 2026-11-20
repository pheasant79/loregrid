# Local data folder

Loregrid separates the fixed tree canvas from the progress drawn on it:

```text
data/
├── trees/
│   ├── loregrid-demo.json
│   └── your-ai-generated-tree.json
└── progress/
    └── <tree-id>.progress.json
```

AI or another authoring tool creates and edits tree JSON in `trees/`. Loregrid reads
these files but never edits them. Choose the `data/` folder in a supported browser.
When the browser still grants access, Loregrid reads the folder at startup. If access
expires, use **Reconnect data folder** to authorize it again. Use **Reload data folder**
after an authoring tool changes a tree while Loregrid is already open.

Completion, queue order, notes, and view preferences belong to a separate progress JSON
in `progress/`; they are never written into a tree definition. Loregrid also keeps an
active browser copy. Each saved progress change receives an update timestamp so the
newer browser or folder copy can be restored after access is interrupted.

The built-in folder picker is available in Chromium-based browsers on secure origins
(such as localhost or HTTPS). Firefox and other browsers without this API should use
**Import tree JSON** and the progress backup/restore controls. Manual import does not
watch the source file; import it again after its contents change. The app does not
silently scan the computer.

The two fictional sample trees are tracked by Git. Other JSON files in `data/trees/` and
all progress JSON files are ignored by Git so personal data is not accidentally
published. This keeps one place to find tree JSON; the `data/progress/` folder is only
for progress created by the app.

When a folder is selected, `trees/` and `progress/` are created if missing. The folder
may be the repository's `data/` directory or another dedicated Loregrid data directory.
