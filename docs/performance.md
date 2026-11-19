# Performance evidence

## 2026-11-19 isolated interaction and layout run

The following measurements were collected serially on the current Windows development machine. Layout timings come from `pnpm benchmark`; interaction timings come from a single-worker Chromium/Firefox Playwright run after switching to a 1,000-node page in a 10,000-node tree. The interaction test separately exercised 100 pan moves and 100 zoom wheel events and reports RAF interval median/P95/max. Treat these as fixture-specific observations, not universal performance guarantees.

| Browser | Interaction | Median RAF interval | P95 RAF interval | Max |
| --- | --- | ---: | ---: | ---: |
| Chromium | Pan | 8.6 ms | 12.1 ms | 26.7 ms |
| Chromium | Zoom | 10.1 ms | 14.8 ms | 15.4 ms |
| Firefox | Pan | 8.0 ms | 11.0 ms | 12.0 ms |
| Firefox | Zoom | 11.0 ms | 16.0 ms | 23.0 ms |

| Nodes | Validation | Search index | Query | Largest page layout | All layout |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 1,000 | 3.1 ms | 1.1 ms | 2.6 ms | 12.2 ms (100 nodes) | 50.8 ms |
| 5,000 | 10.3 ms | 3.9 ms | 4.7 ms | 21.5 ms (500 nodes) | 223.4 ms |
| 10,000 | 19.6 ms | 6.5 ms | 2.6 ms | 38.9 ms (1,000 nodes) | 456.3 ms |

Additional All-layout cases: 10,000-node hub (9,999 edges) 561.8 ms; 10,000-node layered DAG (29,352 edges) 3,850.6 ms. These include graph construction and layout in the benchmark process and are one-time work, not per-frame interaction.

Local benchmark on 2026-11-18 using Node.js 24 on the current Windows development machine. Run `pnpm benchmark` to reproduce on another machine.

| Nodes | Validate | Search index | Query | Largest page layout | All layout |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 1,000 | 7.1 ms | 2.5 ms | 3.3 ms | 23.8 ms (100 nodes) | 102.9 ms |
| 5,000 | 17.0 ms | 5.6 ms | 15.7 ms | 36.5 ms (500 nodes) | 485.9 ms |
| 10,000 | 55.2 ms | 15.2 ms | 3.8 ms | 78.7 ms (1,000 nodes) | 1,012.4 ms |

These synthetic graphs use ten tabs, long per-tab prerequisite chains, and cross-tab entries. Results are evidence for loading, validation, search, graph construction, and layout computation only. They do not promise a fixed frame rate on every device or continuous 60 FPS in a 10,000-node All view.

The current implementation includes rank budgeting, shared long-edge trunks, median/transpose/exact-small-layer/sifting crossing reduction, spring/PAV placement and chain shaping/untangling. Optional refinement work is deterministically bounded; inputs are not rejected based on node count. The same run also timed spring relaxation and PAV in isolation:

| Nodes | Isolated spring stage |
| ---: | ---: |
| 1,000 | 5.7 ms |
| 5,000 | 33.1 ms |
| 10,000 | 104.6 ms |

This isolated fixture uses approximately square layers and no links; its timing is separate from, and must not be added to, the full layout fixture above.

The benchmark additionally exercises broad hubs and denser layered DAGs with long edges:

| Nodes | Hub edges | Hub All layout | Layered edges | Layered All layout |
| ---: | ---: | ---: | ---: | ---: |
| 1,000 | 999 | 371.0 ms | 2,712 | 1,104.9 ms |
| 5,000 | 4,999 | 346.2 ms | 14,552 | 2,083.4 ms |
| 10,000 | 9,999 | 551.8 ms | 29,352 | 3,770.6 ms |

The hub has one root feeding every other node. The layered DAG uses 50-node layers, two links to the previous layer where distinct, plus a link three layers back. Timings include graph-view construction for these additional shapes. The dense All case takes seconds; Worker isolation and cancellation keep this separate from interactive rendering. These are local development-run measurements, not isolated hardware benchmarks or universal budgets.

A separate browser interaction test measures graph zoom frames on a 1,000-node page of a 10,000-node chain fixture, after layout. The latest 2026-11-18 regression measured Chromium median 6.7 ms / p95 9.0 ms and Firefox median 9.0 ms / p95 13.0 ms. It also verified global search, page switching and All completion. This measures that fixture's zoom interaction; it does not establish dense-All rendering performance.
