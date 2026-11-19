# YART source map

This map records the YART source areas reviewed when implementing Loregrid. The project
uses the YART-owned code and textures identified in `THIRD_PARTY_NOTICES.md` under their
MIT terms. Loregrid's TypeScript implementation is an adaptation, not a line-for-line
port.

## Graph and layout

| Loregrid source | YART reference | Adapted behavior |
| --- | --- | --- |
| `src/core/graph.ts` | `Source/YART/Data/GraphKey.cs`, `ResearchGraph.cs`, `GraphBuildPipeline.cs` | Stable graph identity, per-page views, All view, and cross-page prerequisite proxies. |
| `src/core/layout.ts`, `layout-model.ts`, `rank-balancing.ts`, `stages.ts` | `Source/YART/SugiyamaLayout.cs`, `Data/Constraints.cs` | Dependency ranks, tightening, compaction, long-edge routing, and shared stage regions. |
| `src/core/crossing-layout.ts` | `SugiyamaLayout.cs` crossing-reduction routines | Fenwick crossing counts, median sweeps, transpose, small-layer optimization, and bounded sifting. |
| `src/core/chain-layout.ts` | `SugiyamaLayout.cs` chain-shaping routines | Long-edge shaping, safe untangling, and feasible dummy-node separation. |
| `src/core/spring-layout.ts` | `SugiyamaLayout.cs`, `Data/Constraints.cs` | Spring relaxation, non-overlap projection, and terminal alignment. |
| `src/worker/layout.worker.ts` | YART staged graph build | Background layout calculation and caching. |

Loregrid uses continuous coordinates and deterministic work budgets. It does not promise
the same node ordering or coordinates as YART.

## Interface and rendering

| Loregrid source | YART reference | Adapted behavior |
| --- | --- | --- |
| `src/ui/app.ts`, `src/core/progress.ts` | `MainTabWindow_YART.TopBar.cs`, `QueueBar.cs`, `Interaction.cs`, `Data/ResearchQueueManager.cs` | Page controls, queue operations, prerequisite-chain insertion, and progress. |
| `src/ui/renderer.ts`, `src/ui/edge-routing.ts`, `src/styles.css` | `MainTabWindow_YART.Canvas.cs`, `Nodes.cs`, `Edges.cs`, `Rendering/EdgeRenderer.cs` | Node cards, curves, stage colors, stable edge ports, and shared long-edge trunks. |
| `src/assets/yart/` | `Textures/YART/NodePanel*.png`, `EdgeLine.png`, `GlowRadial.png`, `NoiseTile.png`, `Vignette.png`, status icons | YART-owned UI textures and status glyphs. |

Loregrid draws the graph with Canvas and HTML elements. Its gradients and curves are
adapted to the browser renderer, not pixel-identical to YART's Unity rendering.

## Excluded material

Loregrid does not include RimWorld-owned textures, game definitions, DLC behavior,
Harmony integration, game-save logic, or automatic in-game research. These exclusions
are also described in the [behavior comparison](yart-parity.md).
