# Privacy

Loregrid has no backend, account, telemetry, remote model request, or sync service. Tree definitions are loaded from the bundled demo or a file selected by the user. Progress and notes are stored locally by tree ID and exported only when the user chooses a backup action.

Tree JSON and progress JSON are intentionally separate. A tree export contains public learning content. A progress export contains private self-assessment and notes and should not be committed or shared unintentionally.

Browser storage is not encrypted. Clearing site data, changing browser profiles, changing from `file:` to a hosted origin, or using another device may make existing progress unavailable. Export a backup when the data matters.

Public commits must exclude identities, student IDs, credentials, real advisors, private correspondence, unpublished research, local machine paths, personal notes, and progress backups. Use ignored `local-data/` for private trees. `.gitignore` is only a guardrail; inspect staged files before publishing.

External resource links open third-party sites and are subject to those sites' policies. Loregrid permits only HTTP(S) links and adds `noreferrer` when opening them.
