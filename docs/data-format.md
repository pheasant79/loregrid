# Tree data format

The current format is `loregrid/tree-v2`.

- Schema: `schema/loregrid-tree-v2.schema.json`
- Complete example: `data/examples/loregrid-demo.json`
- Starter template: `data/templates/minimal-template-v2.json`

## Smallest valid tree

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

IDs start with a letter and contain only letters, digits, `_`, or `-`. Keep IDs stable
between revisions so saved progress can follow the tree.

## Nodes

Required fields are `id`, `title`, and `tabId`. Optional fields add type, description,
outcomes, cautions, tags, resources, and layout hints.

Each node belongs to one primary tab. Trees may have multiple starting points and goals.
Coordinates are always computed by Loregrid; they are not part of the data format.

## Stages

Stages are optional and shared by every page and the All view. Define their names and
order once at tree level, then assign nodes with `layout.stageId`.

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

Stages label and color regions; they do not force graph rank or spacing. Required
dependencies determine the layout. Optional nodes do not block stage completion.

Do not assign different meanings to the same stage order on different pages. The
following small example defines two shared stages:

## Relationships

- `required`: directed prerequisite; affects availability and layout. Multiple incoming
  required edges mean **all** prerequisites must be met.
- `recommended`: directed suggestion; does not block a node or set its main rank.
- `related`: non-directional association; does not affect availability or rank.

Required relationships must not form a cycle.

## Resources and safety

Resources may use HTTP(S) URLs only. Imported text is displayed as text, never executed as
HTML. Tree definitions do not contain progress or private notes.

## V1 compatibility

Legacy `learning-tech-tree/v1` files are read and converted in memory:

- `branches` become pages.
- `prereqIds` become `required` relationships.
- `applicationEdges` become `recommended` relationships.
- `relatedIds` become de-duplicated `related` relationships.
- `stage` is retained as an optional layout hint.
- `startId` and `endId` are ordinary node information, not global constraints.

Older V2 `paths` and `pathId` fields are accepted for compatibility and ignored. V2
trees use one flat set of pages (`tabs`).
