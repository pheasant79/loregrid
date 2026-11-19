import { describe, expect, it } from 'vitest';
import { minimizeCrossings, countCrossings } from '../src/core/crossing-layout';
import { shapeLongEdges } from '../src/core/chain-layout';
import { balanceRanks } from '../src/core/rank-balancing';
import { vertexSeparation, type LayoutLink, type LayoutVertex } from '../src/core/layout-model';
import { layoutGraph } from '../src/core/layout';
import { buildGraphView, tabKey } from '../src/core/graph';
import { makeTree } from './fixtures';

function verticesFor(layers: readonly (readonly string[])[], dummy: ReadonlySet<string> = new Set()): Map<string, LayoutVertex> {
  return new Map(layers.flatMap((layer, rank) => layer.map((id) => [id, { id, rank, dummy: dummy.has(id) }] as const)));
}

function permutations<T>(items: readonly T[]): T[][] {
  if (items.length < 2) return [[...items]];
  return items.flatMap((item, index) => permutations([...items.slice(0, index), ...items.slice(index + 1)]).map((tail) => [item, ...tail]));
}

describe('YART-adapted advanced layout', () => {
  it('balances dense independent ranks without dropping nodes or changing dependency direction', () => {
    const ids = Array.from({ length: 80 }, (_, index) => `leaf${index.toString().padStart(2, '0')}`);
    const ranks = new Map([['root', 0], ...ids.map((id) => [id, 1] as const)]);
    const links = ids.map((target) => ({ source: 'root', target }));
    balanceRanks(ranks, links, false);
    const counts = new Map<number, number>();
    for (const rank of ranks.values()) counts.set(rank, (counts.get(rank) ?? 0) + 1);
    expect(ranks.size).toBe(81);
    expect(Math.max(...counts.values())).toBeLessThan(80);
    links.forEach((edge) => expect(ranks.get(edge.target)).toBeGreaterThan(ranks.get(edge.source)!));
    // The soft budget must not manufacture arbitrarily long prerequisite spans.
    ids.forEach((id) => expect(ranks.get(id)! - ranks.get('root')!).toBeLessThanOrEqual(2));
    const repeated = new Map([['root', 0], ...ids.map((id) => [id, 1] as const)]);
    balanceRanks(repeated, links, false);
    expect([...repeated]).toEqual([...ranks]);
  });

  it('counts crossings correctly at shared endpoints and removes a reversed matching', () => {
    const layers = [['a', 'b', 'c'], ['x', 'y', 'z']];
    const links = [{ source: 'a', target: 'z' }, { source: 'b', target: 'y' }, { source: 'c', target: 'x' }];
    expect(countCrossings(layers, links)).toBe(3);
    expect(countCrossings([['a'], ['x', 'y']], [{ source: 'a', target: 'y' }, { source: 'a', target: 'x' }])).toBe(0);
    expect(countCrossings([['a', 'b'], ['x']], [{ source: 'b', target: 'x' }, { source: 'a', target: 'x' }])).toBe(0);
    const result = minimizeCrossings(layers, verticesFor(layers), links);
    expect(result.initialCrossings).toBe(3);
    expect(result.crossings).toBe(0);
  });

  it('leaves each small layer at a crossing optimum against its fixed neighbors', () => {
    const layers = [['a', 'b', 'c', 'd', 'e'], ['f', 'g', 'h', 'i', 'j'], ['k', 'l', 'm', 'n']];
    const links: LayoutLink[] = [];
    for (let r = 0; r < 2; r++) layers[r]!.forEach((source, i) => layers[r + 1]!.forEach((target, j) => {
      if ((i * 7 + j * 3 + r) % 5 < 2) links.push({ source, target });
    }));
    const result = minimizeCrossings(layers, verticesFor(layers), links);
    expect(result.crossings).toBeLessThan(result.initialCrossings);
    const current = countCrossings(layers, links);
    layers.forEach((layer, rank) => {
      const best = Math.min(...permutations(layer).map((candidate) =>
        countCrossings(layers.map((value, r) => r === rank ? candidate : value), links)));
      expect(current).toBe(best);
    });
  });

  it('straightens a free dummy corridor and preserves endpoint coordinates', () => {
    const layers = [['source'], ['d1'], ['d2'], ['target']];
    const vertices = verticesFor(layers, new Set(['d1', 'd2']));
    const links = [{ source: 'source', target: 'd1' }, { source: 'd1', target: 'd2' }, { source: 'd2', target: 'target' }];
    const y = new Map([['source', 0], ['d1', 200], ['d2', -100], ['target', 0]]);
    const metrics = shapeLongEdges(layers, vertices, links, y);
    expect(metrics.bendsBefore).toBeGreaterThan(0);
    expect(metrics.bendsAfter).toBe(0);
    expect([...y.values()]).toEqual([0, 0, 0, 0]);
  });

  it('fits multiple long corridors between fixed obstacles without overlaps', () => {
    const layers = [['s1', 's2'], ['top', 'd1', 'd2', 'bottom'], ['t1', 't2']];
    const vertices = verticesFor(layers, new Set(['d1', 'd2']));
    const links = [
      { source: 's1', target: 'd1' }, { source: 'd1', target: 't1' },
      { source: 's2', target: 'd2' }, { source: 'd2', target: 't2' },
    ];
    const y = new Map([['s1', 60], ['s2', 130], ['top', 0], ['d1', 65], ['d2', 95], ['bottom', 220], ['t1', 60], ['t2', 130]]);
    shapeLongEdges(layers, vertices, links, y);
    expect(y.get('top')).toBe(0);
    expect(y.get('bottom')).toBe(220);
    for (const layer of layers) for (let i = 1; i < layer.length; i++) {
      const a = vertices.get(layer[i - 1]!)!, b = vertices.get(layer[i]!)!;
      expect(y.get(b.id)! - y.get(a.id)!).toBeGreaterThanOrEqual(vertexSeparation(a, b) - 24 - 1e-6);
    }
  });

  it('untangles adjacent strips without adding boundary crossings', () => {
    const layers = [['s1', 's2'], ['d1', 'd2'], ['e1', 'e2'], ['t2', 't1']];
    const vertices = verticesFor(layers, new Set(['d1', 'd2', 'e1', 'e2']));
    const links = [
      { source: 's1', target: 'd1' }, { source: 'd1', target: 'e1' }, { source: 'e1', target: 't1' },
      { source: 's2', target: 'd2' }, { source: 'd2', target: 'e2' }, { source: 'e2', target: 't2' },
    ];
    const before = countCrossings(layers, links);
    const y = new Map(layers.flatMap((layer) => layer.map((id, index) => [id, index * 100] as const)));
    const result = shapeLongEdges(layers, vertices, links, y);
    expect(result.untangled).toBeGreaterThan(0);
    expect(countCrossings(layers, links)).toBeLessThanOrEqual(before);
    for (const layer of layers) for (let index = 1; index < layer.length; index++) {
      expect(y.get(layer[index]!)! - y.get(layer[index - 1]!)!).toBeGreaterThanOrEqual(24);
    }
  });

  it('shares long-edge trunk coordinates without merging canonical nodes', () => {
    const tree = makeTree();
    tree.nodes = ['a', 'b', 'c', 'd', 'e'].map((id) => ({ id, title: id, tabId: 'alpha' }));
    tree.edges = [['a', 'b'], ['b', 'c'], ['c', 'd'], ['d', 'e'], ['a', 'd'], ['a', 'e']].map(([source, target], index) => ({
      id: `e${index}`, source: source!, target: target!, type: 'required',
    }));
    const layout = layoutGraph(buildGraphView(tree, tabKey('alpha')));
    const toD = layout.edges.find((edge) => edge.originalEdgeId === 'e4')!;
    const toE = layout.edges.find((edge) => edge.originalEdgeId === 'e5')!;
    expect(toD.points.length).toBeGreaterThan(2);
    expect(toE.points.slice(0, toD.points.length - 1)).toEqual(toD.points.slice(0, -1));
    expect(new Set(layout.nodes.map((node) => node.nodeId)).size).toBe(5);
    // Each dummy corridor stays horizontal across the entire width of the
    // intermediate column. Cubic interpolation is confined to the gaps.
    for (let index = 1; index < toE.points.length - 1; index += 2) {
      const entrance = toE.points[index]!, exit = toE.points[index + 1]!;
      expect(exit.x - entrance.x).toBe(200);
      expect(exit.y).toBe(entrance.y);
      const column = layout.nodes.filter((node) => node.x === entrance.x);
      for (const node of column) {
        expect(entrance.y < node.y || entrance.y > node.y + node.height).toBe(true);
      }
    }
  });

  it('keeps dense, disconnected and cross-page DAG fixtures finite, deterministic and separated', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const tree = makeTree();
      tree.nodes = Array.from({ length: 50 }, (_, index) => ({
        id: `n${index}`, title: `N${index}`, tabId: index % 3 ? 'alpha' : 'beta',
      }));
      tree.edges = [];
      for (let target = 1; target < 50; target++) for (let source = 0; source < target; source++) {
        if ((source * 37 + target * 19 + seed * 23) % 47 < 3) {
          tree.edges.push({ id: `e${source}:${target}`, source: `n${source}`, target: `n${target}`, type: 'required' });
        }
      }
      for (const key of ['all', tabKey('alpha')] as const) {
        const view = buildGraphView(tree, key);
        const first = layoutGraph(view), second = layoutGraph(view);
        expect({ ...first, durationMs: 0 }).toEqual({ ...second, durationMs: 0 });
        expect(first.nodes).toHaveLength(view.nodes.length);
        const ranks = new Map<number, typeof first.nodes>();
        for (const node of first.nodes) {
          expect(Number.isFinite(node.x + node.y)).toBe(true);
          const layer = ranks.get(node.rank) ?? []; layer.push(node); ranks.set(node.rank, layer);
        }
        for (const layer of ranks.values()) {
          layer.sort((a, b) => a.y - b.y);
          for (let index = 1; index < layer.length; index++) {
            expect(layer[index]!.y - layer[index - 1]!.y).toBeGreaterThanOrEqual(50 - 1e-6);
          }
        }
        first.edges.filter((edge) => edge.type === 'required').forEach((edge) => {
          expect(edge.points.every((point) => Number.isFinite(point.x + point.y))).toBe(true);
          for (let index = 1; index < edge.points.length; index++) expect(edge.points[index]!.x).toBeGreaterThan(edge.points[index - 1]!.x);
        });
      }
    }
  }, 20_000);
});
