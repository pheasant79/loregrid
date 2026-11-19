# Loregrid tree format v2

The public format identifier is `loregrid/tree-v2`. See `schema/loregrid-tree-v2.schema.json` and `data/loregrid-demo.json` for the complete machine-readable contract.

## Minimal tree

```json
{
  "format": "loregrid/tree-v2",
  "id": "my-tree",
  "title": "My learning map",
  "tabs": [{ "id": "basics", "label": "Basics" }],
  "resources": [],
  "nodes": [{ "id": "start", "title": "Start", "tabId": "basics" }],
  "edges": []
}
```

IDs must start with an ASCII letter and then contain only letters, digits, `_`, or `-`. Keep them stable so progress can follow revisions.

## Nodes

Only `id`, `title`, and `tabId` are required. Optional fields include `kind` (`topic`, `optional`, `milestone`), `summary`, `outcome`, `caution`, `tags`, `resourceIds`, and layout hints (`groupId`, `order`, `stageId`, legacy `stage`). Layout hints never fix x/y coordinates.

Each node belongs to exactly one primary tab. Trees may have multiple roots, leaves, and milestones.

## Learning stages

Stage names are optional tree-wide data, not inferred from the subject or node kind. Add one shared ordered list of `stages` entries with stable IDs. Every tab, combined page, and `All` view uses the same stage identity and names; a node opts into a stage with `layout.stageId` (or the legacy numeric `layout.stage`). Do not define different names for the same stage order on different pages. For example:

```json
{
  "stages": [
    { "id": "intro", "title": "Orientation", "titleEn": "Orientation", "order": 0 },
    { "id": "practice", "title": "Field practice", "titleEn": "Field practice", "order": 1 }
  ],
  "nodes": [
    { "id": "start", "title": "Starting point", "tabId": "foundations", "layout": { "stageId": "intro" } }
  ]
}
```

The canvas groups nodes into shared stage regions in dependency order and shows the stage title and tree-wide required-node completion count at the top of each region. A partial page cannot mark a stage complete while canonical required nodes elsewhere in the tree remain incomplete. Optional nodes do not block stage completion. If required dependencies contradict an authored stage hint, the later prerequisite stage wins for completion accounting. Stages do not add graph ranks or artificial spacing; node columns come from required dependencies. Without stage data, existing trees retain the neutral numbered-stage fallback only when their nodes already have numeric stage hints. V1 `stages` labels are migrated and paired with their numeric stage order; conflicting legacy page-scoped names are consolidated to a neutral tree-wide label with a warning.

## Relations

- `required`: directed, solid, gating, contributes to rank. Multiple incoming required edges mean AND.
- `recommended`: directed, dashed, non-gating, does not determine primary rank.
- `related`: non-directional product relationship, non-gating, normally shown only in details or relationship mode.

Required edges must be acyclic.

## Resources and imported content

Resources may use an HTTP(S) URL. Other protocols are rejected. Imported strings are displayed as text, not HTML. Public tree data never contains progress or private notes.

## V1 mapping

- `branches` become tabs.
- `prereqIds` become required edges.
- `applicationEdges` become recommended edges.
- `relatedIds` become de-duplicated related edges.
- `stage` becomes an optional layout hint.
- `startId` and `endId` may become ordinary milestones; they no longer impose a single global path.

Older V2 files may include top-level `paths` and node-level `pathId` fields. They are accepted on import for compatibility and ignored. A tree has one flat set of pages (`tabs`); each node belongs to one page by `tabId`.
