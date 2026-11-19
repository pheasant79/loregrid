# Organize a tree

Start from `data/templates/minimal-template-v2.json`. A tree is made of pages, nodes,
resources, optional stages, and relationships.

## Choose pages

Use a page for a durable area that benefits from its own view. Each node belongs to one
page. Required prerequisites can connect nodes across pages; Loregrid shows a proxy
where needed.

## Choose relationships

Use `required` only when a learner must complete a topic first. Multiple required
prerequisites mean all of them are needed.

Use `recommended` for useful next steps that should not block progress. Use `related`
for non-directional context.

## Add layout hints

Optional group, order, and stage values can guide organization. They do not assign
coordinates; Loregrid calculates node positions from the dependency graph.

Stages are defined once for the whole tree, so pages and All share the same labels.
See the [data format](data-format.md) for the stage structure.

## Validate

```powershell
pnpm validate -- path/to/tree.json
```

Validation checks structure and references. Review the rendered tree as well.
