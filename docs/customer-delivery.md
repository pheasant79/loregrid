# Customer delivery

## What is delivered

The customer build contains both a usable application and the content used for that
build. It is not a server deployment and it is not a replacement for the open-source
repository.

```powershell
pnpm build:customer -- local-data\customer-tree.json
```

The generated folder is `dist/customer-delivery/`. Open `Loregrid.html` in that folder.
The `trees/` copy is provided for inspection and recovery; the application embeds the
validated tree so the package can be used offline.

## What is not promised

The current application has no backend, account, cloud sync, or automatic disk-folder
watcher. Imported trees and progress are stored in the browser profile that opened the
application. Use the in-app tree export and progress backup before changing devices or
browser profiles.

## Public repository boundary

The public repository contains source code and fictional/public examples only. Customer
trees, notes, progress backups, credentials, local paths and generated customer builds
stay outside Git. The customer package retains `LICENSE` and
`THIRD_PARTY_NOTICES.md`.
