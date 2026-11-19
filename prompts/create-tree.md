# Copyable prompt: create a Loregrid tree

```text
Use this Loregrid repository as the implementation reference. Read AGENTS.md,
docs/create-with-codex.md, docs/data-format.md, docs/customization.md, and
data/templates/minimal-template-v2.json before editing.

Subject or interdisciplinary goal: [fill in]
Starting knowledge: [fill in]
Desired outcomes: [fill in]
Meaningful page/tab categories: [fill in or propose]
Special interests and constraints: [fill in]
Language and depth: [fill in]
Output boundary: [public generic tree / private personal tree]

Create a loregrid/tree-v2 definition with stable IDs. Each node must belong to
one primary tab and should have a clear scope and observable outcome. Use
required edges only for genuine hard prerequisites; multiple required inputs
mean AND. Use recommended edges for directed, non-gating development and
related edges for contextual association. Required edges must be acyclic.

Allow multiple roots, leaves, and milestones. Do not invent a universal degree
sequence, fixed duration, institution, publication quota, or mandatory method.
Use primary public sources for specialized factual claims and distinguish those
claims from educational design. Do not fabricate citations.

Do not write x/y positions. Optional group, order, and stage values are layout
hints only. Preserve privacy: public files must not include identities,
credentials, advisors, student records, private notes, progress, unpublished
work, or local paths. Put private trees under local-data/.

Validate with `pnpm validate -- <file>` and report structural, browser, and
academic review separately. Do not push or publish unless explicitly asked.
```
