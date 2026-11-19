# Performance

Layout runs in a Web Worker. The renderer culls nodes outside the viewport, so panning
and zooming do not redraw every DOM node.

There is no hard node-count limit. The 10,000-node data set is a pressure test; a large
All view may take longer to lay out and is not expected to remain at 60 FPS on every
computer.

## Latest local measurements

Recorded on the project development computer on 2026-11-19. These are observations for
the listed test data, not performance guarantees.

| Data set | Page layout | All layout |
| ---: | ---: | ---: |
| 1,000 nodes | 12.2 ms | 50.8 ms |
| 5,000 nodes | 21.5 ms | 223.4 ms |
| 10,000 nodes | 38.9 ms | 456.3 ms |
| 10,000-node layered graph | -- | 3,850.6 ms |

The dense layered graph is a one-time layout case. It is not a per-frame interaction
measurement.

## Reproduce

```powershell
pnpm benchmark
```

Run the benchmark on the target computer when evaluating a specific workload. Test
large page interaction separately from one-time layout: the two affect users in
different ways.
