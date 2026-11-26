# Create a Loregrid tree: copyable prompt

Fill in the fields below. See the [authoring guide](../docs/create-with-codex.md#english) for the full workflow.

```text
Create or revise a learning tree in this Loregrid repository.
Read AGENTS.md, docs/data-format.md, docs/customization.md, and
docs/templates/minimal-template-v2.json before editing. Preserve the viewer.

Subject and scope: [fill in]
Starting knowledge: [fill in]
Observable outcomes: [fill in]
Page suggestions: [fill in or propose]
Language and depth: [fill in]
Other constraints: [fill in]
Intended for public sharing: [yes/no; manual review still required]

Output only data/trees/<stable-id>.json using loregrid/tree-v2.
Do not create HTML, edit progress, build, commit, push, or publish.
The author maintains the fixed tree content; the app reads it.
Completion, queue, and private notes belong to separate progress files.

Use stable tree and node IDs; preserve existing IDs when revising titles.
Each node has one primary page and should explain its scope and outcome.
Use required only for genuine prerequisites: multiple inputs mean AND,
and required edges must be acyclic. Recommended links do not gate learning;
related links are undirected associations. Allow multiple roots, leaves,
and milestones. Do not fabricate dependencies just to connect everything.

All combines the current tree's pages. Optional stages are shared across
the whole tree, never independently defined per page. Omit stages if they
do not suit the subject. Do not supply x/y coordinates; group/order are hints.

Verify specialized claims against reliable primary sources and distinguish
facts from educational design. Never invent citations or institutional rules.
Keep identities, credentials, personal notes, progress, unpublished material,
and local paths out of shared files. Keep trees together in data/trees/;
do not create separate public/private tree directories.

If repository tools are available, run:
pnpm validate -- data/trees/<stable-id>.json
Report structural validation, content review, and browser checks separately.
Clearly state any checks not performed.
```
