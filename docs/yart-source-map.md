# YART source mapping

Loregrid is a browser learning-map application, not a RimWorld mod. This document records which general ideas were studied so future maintainers can distinguish adapted layout behavior from independently authored product code.

| Loregrid area | YART reference | Adapted idea | Explicitly excluded |
| --- | --- | --- | --- |
| `src/core/graph.ts` | `Source/YART/Data/GraphKey.cs`, `ResearchGraph.cs`, `GraphBuildPipeline.cs` | Independent graph keys, per-tab views, unified view, canonical identity and cross-page entry nodes | RimWorld `ResearchProjectDef`, research tabs, DLC and mod compatibility |
| `src/core/layout.ts` | `Source/YART/SugiyamaLayout.cs` | Layer assignment, dummy nodes for long edges, barycentric ordering, compact layered placement | C# implementation details, Unity types, game-specific size rules |
| `src/worker/layout.worker.ts` | YART's staged graph build behavior | Layout work isolated from interactive rendering and cached by graph identity | Game ticks, Harmony, threading implementation |
| `src/ui/app.ts` | `MainTabWindow_YART.TopBar.cs`, `SearchUI.cs` | Tabs, All view, search-to-node navigation and a tree-first workspace | RimWorld window classes, textures, sounds and translated strings |
| `src/ui/renderer.ts` | `MainTabWindow_YART.Nodes.cs`, `Edges.cs` | Distinct node/edge rendering passes and zoom-dependent detail | Unity GL drawing and YART/RimWorld visual assets |

The Loregrid data model, progress semantics, bilingual web UI, Canvas/DOM renderer, import/export flow, privacy separation, accessibility behavior, and offline single-file build are independently authored for this project.
