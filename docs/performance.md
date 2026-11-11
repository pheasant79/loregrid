# Performance evidence

Local benchmark on 2026-11-11 using Node.js 24 on the current Windows development machine. Run `pnpm benchmark` to reproduce on another machine.

| Nodes | Validate | Search index | Query | Largest page layout | All layout |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 1,000 | 3.6 ms | 0.9 ms | 0.4 ms | 1.7 ms (100 nodes) | 19.3 ms |
| 5,000 | 9.9 ms | 3.0 ms | 0.8 ms | 3.1 ms (500 nodes) | 67.3 ms |
| 10,000 | 17.8 ms | 7.1 ms | 2.2 ms | 10.6 ms (1,000 nodes) | 110.5 ms |

These synthetic graphs use ten tabs, long per-tab prerequisite chains, and cross-tab entries. Results are evidence for loading, validation, search, graph construction, and layout computation only. They do not promise a fixed frame rate on every device or continuous 60 FPS in a 10,000-node All view.
