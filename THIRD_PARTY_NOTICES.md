# Third-party notices

Loregrid preserves the original Learning Tech Tree repository history and license.

## Learning Tech Tree

Copyright (c) 2026 Learning Tech Tree contributors

Licensed under the MIT License. The full license text remains in [`LICENSE`](LICENSE).

## Yet Another Research Tree (YART)

Copyright (c) 2026 SeoHyeon

Loregrid reuses the following YART-owned interface textures from `Textures/YART/`: `NodePanel.png`, `NodePanelBorder.png`, `EdgeLine.png`, `GlowRadial.png`, `NoiseTile.png`, `Vignette.png`, `IconCheck.png`, `IconLock.png`, `IconPlay.png`, and `IconSwap.png`. The files are included in `src/assets/yart/` and bundled into the offline HTML.

Loregrid's layered graph layout is a TypeScript adaptation of general Sugiyama-style stages studied in YART. The mapping covers rank budgeting and compaction (`src/core/rank-balancing.ts`), Fenwick crossing counts, median/transpose ordering, exact small-layer dynamic programming and bounded sifting (`src/core/crossing-layout.ts`), plus long-edge chain fitting, safe untangling and dummy-run separation (`src/core/chain-layout.ts`). `src/core/spring-layout.ts` adapts YART's `SpringRelaxY` and `SpringPavProject` methods for continuous web coordinates. Queue ordering/removal and modifier-click actions adapt `ResearchQueueManager` and `MainTabWindow_YART.Interaction`. General node/edge drawing behavior is adapted for Canvas and DOM. The layout is not byte-for-byte or coordinate-identical: it uses a generic single band, continuous coordinates, approximate capped path weights, and deterministic budgets for optional optimizations. RimWorld-specific definitions, Harmony integration, game state, Unity rendering, and RimWorld-owned visual assets are not included.

YART is licensed under the MIT License:

> Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
>
> The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
>
> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

Source repository: `https://github.com/csh1668/YetAnotherResearchTree`

The file-level behavior mapping is documented in [`docs/yart-source-map.md`](docs/yart-source-map.md).
