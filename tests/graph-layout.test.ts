import { describe, expect, it } from 'vitest';
import { buildGraphView, requiredAncestors, tabKey } from '../src/core/graph';
import { layoutGraph } from '../src/core/layout';
import { SearchIndex } from '../src/core/search';
import { SpatialIndex } from '../src/ui/spatial-index';
import { makeTree } from './fixtures';

describe('paged graph views', () => {
  it('creates one proxy for a shared external prerequisite', () => {
    const tree = makeTree();
    const beta = buildGraphView(tree, tabKey('beta'));
    const proxies = beta.nodes.filter((node) => node.kind === 'proxy');
    expect(proxies.map((node) => node.nodeId).sort()).toEqual(['a', 'b']);
    expect(new Set(proxies.map((node) => node.viewId)).size).toBe(proxies.length);
    expect(beta.edges.some((edge) => edge.source.startsWith('proxy:beta:') && edge.target === 'c')).toBe(true);
  });

  it('keeps one canonical node per business node in All', () => {
    const tree = makeTree();
    const all = buildGraphView(tree, 'all');
    expect(all.nodes).toHaveLength(tree.nodes.length);
    expect(all.nodes.every((node) => node.kind === 'real' && node.viewId === node.nodeId)).toBe(true);
    expect(requiredAncestors(tree, 'd')).toEqual(['a', 'b', 'c']);
  });
});

describe('layered layout', () => {
  it('is deterministic apart from measured duration', () => {
    const view = buildGraphView(makeTree(), 'all');
    const first = layoutGraph(view);
    const second = layoutGraph(view);
    expect({ ...first, durationMs: 0 }).toEqual({ ...second, durationMs: 0 });
  });

  it('does not overlap real nodes and routes long required edges through extra points', () => {
    const tree = makeTree();
    const result = layoutGraph(buildGraphView(tree, 'all'));
    for (let left = 0; left < result.nodes.length; left += 1) {
      for (let right = left + 1; right < result.nodes.length; right += 1) {
        const a = result.nodes[left]!;
        const b = result.nodes[right]!;
        const overlaps = a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
        expect(overlaps, `${a.nodeId} overlaps ${b.nodeId}`).toBe(false);
      }
    }
    const longEdge = result.edges.find((edge) => edge.originalEdgeId === 'edge-ad');
    expect(longEdge?.points.length).toBeGreaterThan(2);
    result.edges.filter((edge) => edge.type === 'required').forEach((edge) => {
      expect(edge.points.at(-1)!.x).toBeGreaterThan(edge.points[0]!.x);
    });
  });

  it('indexes search text and viewport nodes', () => {
    const tree = makeTree();
    const search = new SearchIndex(tree);
    expect(search.search('C')).toEqual([tree.nodes[2]]);
    const layout = layoutGraph(buildGraphView(tree, 'all'));
    const first = layout.nodes[0]!;
    const spatial = new SpatialIndex(layout.nodes, 100);
    expect(spatial.query({ left: first.x, top: first.y, right: first.x + first.width, bottom: first.y + first.height }).some((node) => node.viewId === first.viewId)).toBe(true);
  });
});
