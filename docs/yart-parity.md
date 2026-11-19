# YART behavior comparison

Loregrid uses YART as a behavior and visual reference for a paged, node-based interface.
It is an independent learning tool, not a game mod. This guide describes the adaptations
and the features that are intentionally out of scope.

## Interface patterns

| Pattern | Loregrid adaptation |
| --- | --- |
| Page navigation | One tree has a flat set of pages and one All view. |
| Node cards | Rounded cards show learning content and progress. |
| Details | Selecting a node opens its description, prerequisites, and actions. |
| Learning queue | Queue items can be reordered, opened, and removed. |
| Stage regions | Optional tree-wide stages provide shared labels and colors. |
| Tree selection | The lower-right library switches between independent JSON trees. |

The queue represents a learner's plan. Loregrid does not simulate automatic research,
game resources, research duration, or game-save state.

## Graph layout and links

Required prerequisites determine the graph's main layers. The layout worker applies
crossing reduction, long-edge routing, compaction, and collision avoidance. Recommended
and related links do not affect the main rank.

Links are rendered as Canvas curves. Stage colors transition locally near stage
boundaries. This rendering is adapted to the web canvas and is not pixel-identical to
YART's Unity rendering. Moving particles along active links are not implemented.

## Differences

- Coordinates are computed by the web layout engine and are not stored in tree data.
- Browser storage replaces game saves.
- Loregrid's V1/V2 data model has learning-specific relationships and no game definitions.
- Game-only mechanics, assets, DLC behavior, and integration code are out of scope.

For source attribution and the areas reviewed, see the [YART source map](yart-source-map.md).
