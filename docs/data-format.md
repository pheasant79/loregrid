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

Only `id`, `title`, and `tabId` are required. Optional fields include `kind` (`topic`, `optional`, `milestone`), `summary`, `outcome`, `caution`, `tags`, `resourceIds`, and layout hints (`groupId`, `order`, `stage`). Layout hints never fix x/y coordinates.

Each node belongs to exactly one primary tab. Trees may have multiple roots, leaves, and milestones.

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
