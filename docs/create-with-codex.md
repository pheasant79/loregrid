# Draft a tree with Codex

Use this workflow to create or revise a learning-tree JSON file.

## Before drafting

Decide:

- The subject and intended learner.
- What a learner should be able to do at the end.
- The pages that make the subject easier to browse.
- Whether the tree is a fictional example or a private personal tree. Save authored
  tree JSON in `data/trees/`; private files are ignored by Git.

Read [`AGENTS.md`](../AGENTS.md), the [data format](data-format.md), the
[customization guide](customization.md), and
[`docs/templates/minimal-template-v2.json`](templates/minimal-template-v2.json).

## Build and review

Give each node a stable ID, clear scope, and useful outcome. Mark only genuine
prerequisites as `required`; use `recommended` or `related` for other connections.

Check specialized claims against appropriate sources. Keep fictional examples free of
real personal information and private notes.

Validate the file:

```powershell
pnpm validate -- path/to/tree.json
```

Then import it into Loregrid and review the layout and relationships. Passing validation
checks the data structure, not the educational quality of the tree.
