import { describe, expect, it } from 'vitest';
import { buildGraphView, requiredAncestors, tabIdFromKey, tabKey } from '../src/core/graph';
import { layoutGraph } from '../src/core/layout';
import { SearchIndex } from '../src/core/search';
import { DependencyFocus } from '../src/core/focus';
import { SpatialIndex } from '../src/ui/spatial-index';
import { projectMonotone, springCoordinates } from '../src/core/spring-layout';
import { assertValidTree } from '../src/core/validate';
import { normalizeTree } from '../src/core/normalize';
import { makeTree } from './fixtures';

describe('paged graph views', () => {
  it('creates one proxy for a shared external prerequisite', () => {
    const tree = makeTree();
    const beta = buildGraphView(tree, tabKey('beta'));
    const proxies = beta.nodes.filter((node) => node.kind === 'proxy');
    expect(proxies.map((node) => node.nodeId).sort()).toEqual(['a', 'b']);
    expect(new Set(proxies.map((node) => node.viewId)).size).toBe(proxies.length);
    expect(beta.edges.some((edge) => edge.source.startsWith('proxy:tab:beta:') && edge.target === 'c')).toBe(true);
  });

  it('keeps one canonical node per business node in All', () => {
    const tree = makeTree();
    const all = buildGraphView(tree, 'all');
    expect(all.nodes).toHaveLength(tree.nodes.length);
    expect(all.nodes.every((node) => node.kind === 'real' && node.viewId === node.nodeId)).toBe(true);
    expect(requiredAncestors(tree, 'd')).toEqual(['a', 'b', 'c']);
  });

  it('merges selected preset pages once and retains external prerequisite proxies', () => {
    const tree = makeTree();
    expect(buildGraphView(tree, 'preset:both', ['alpha', 'beta', 'alpha']).nodes).toHaveLength(4);
    const beta = buildGraphView(tree, 'preset:beta', ['beta']);
    expect(beta.nodes.filter((node) => node.kind === 'real').map((node) => node.nodeId)).toEqual(['c', 'd']);
    expect(beta.nodes.filter((node) => node.kind === 'proxy').map((node) => node.nodeId).sort()).toEqual(['a', 'b']);
    tree.tabs[1]!.id = 'tab:one';
    tree.nodes.filter((node) => node.tabId === 'beta').forEach((node) => { node.tabId = 'tab:one'; });
    expect(buildGraphView(tree, tabKey('tab:one')).nodes.filter((node) => node.kind === 'real')).toHaveLength(2);
  });

  it('treats legacy path metadata as inert and selects a page by tab only', () => {
    const tree = makeTree();
    const normalized = normalizeTree({
      ...tree,
      paths: [{ id: 'field-path', label: 'Field path' }, { id: 'analysis:path', label: 'Analysis path' }],
      nodes: tree.nodes.map((node) => ({ ...node, pathId: node.id === 'a' || node.id === 'b' ? 'field-path' : 'analysis:path' })),
    }).tree;
    const view = buildGraphView(normalized, tabKey('beta'));
    expect(view.nodes.filter((node) => node.kind === 'real').map((node) => node.nodeId)).toEqual(['c', 'd']);
    expect(view.nodes.filter((node) => node.kind === 'proxy')).toHaveLength(2);
    expect('paths' in normalized).toBe(false);
    expect(normalized.nodes.every((node) => !('pathId' in node))).toBe(true);
    expect(tabIdFromKey(tabKey('tab:one'))).toBe('tab:one');
  });
});

describe('layered layout', () => {
  it('tightens a short branch toward its late dependent while keeping required edges forward', () => {
    const tree = makeTree();
    tree.nodes = ['root', 'middle', 'late', 'sink', 'branch'].map((id) => ({ id, title: id, tabId: 'alpha' }));
    tree.edges = [['root', 'middle'], ['middle', 'late'], ['late', 'sink'], ['branch', 'sink']].map(([source, target], index) => ({
      id: `required-${index}`, source: source!, target: target!, type: 'required',
    }));
    const result = layoutGraph(buildGraphView(tree, 'all'));
    const byId = new Map(result.nodes.map((node) => [node.nodeId, node]));
    expect(byId.get('branch')!.rank).toBe(2);
    expect(byId.get('sink')!.rank).toBe(3);
    result.edges.forEach((edge) => expect(edge.points.at(-1)!.x).toBeGreaterThan(edge.points[0]!.x));
  });
  it('projects spring positions without overlap and retains straight chains', () => {
    expect(projectMonotone([3, 1, 2, 0])).toEqual([1.5, 1.5, 1.5, 1.5]);
    const centers = springCoordinates(
      [[{ id: 'a', height: 50 }], [{ id: 'b', height: 50 }], [{ id: 'c', height: 50 }]],
      new Map([['a', ['b']], ['b', ['a', 'c']], ['c', ['b']]]),
    );
    expect(centers.get('a')).toBe(centers.get('b'));
    expect(centers.get('b')).toBe(centers.get('c'));
    const packed = springCoordinates([[{ id: 'real', height: 50 }, { id: 'dummy', height: 20 }, { id: 'other', height: 50 }]], new Map());
    expect(packed.get('dummy')! - packed.get('real')!).toBeGreaterThanOrEqual(63);
    expect(packed.get('other')! - packed.get('dummy')!).toBeGreaterThanOrEqual(63);
  });

  it('handles fractional and very large stage hints as ordering rather than fixed coordinates', () => {
    const tree = makeTree();
    tree.nodes[0]!.layout = { stage: 1e12 };
    tree.nodes[1]!.layout = { stage: 0.5 };
    const result = layoutGraph(buildGraphView(tree, 'all'));
    expect(result.width).toBeLessThan(2000);
    expect(new Set(result.nodes.map((node) => `${node.x},${node.y}`)).size).toBe(4);
  });

  it('adds only a visual gutter at a stage boundary without changing dependency ranks', () => {
    const unstaged = makeTree();
    const staged = makeTree();
    staged.stages = [
      { id: 'first', title: 'First', order: 0 },
      { id: 'second', title: 'Second', order: 1 },
    ];
    staged.nodes[0]!.layout = { stageId: 'first' };
    staged.nodes[1]!.layout = { stageId: 'second' };
    const plainLayout = layoutGraph(buildGraphView(unstaged, 'all'));
    const stageLayout = layoutGraph(buildGraphView(staged, 'all'));
    const plainA = plainLayout.nodes.find((node) => node.nodeId === 'a')!;
    const plainB = plainLayout.nodes.find((node) => node.nodeId === 'b')!;
    const stagedA = stageLayout.nodes.find((node) => node.nodeId === 'a')!;
    const stagedB = stageLayout.nodes.find((node) => node.nodeId === 'b')!;
    expect(stagedA.rank).toBe(plainA.rank);
    expect(stagedB.rank).toBe(plainB.rank);
    expect(stagedB.x - stagedA.x).toBe(plainB.x - plainA.x + 50);
    expect(stageLayout.stageBoundaries.map((stage) => stage.stageId)).toEqual(['first', 'second']);
  });

  it('distributes isolated nodes into underfilled ranks in their stage deterministically', () => {
    const tree = makeTree();
    tree.stages = [{ id: 'early', title: 'Early', order: 0 }, { id: 'late', title: 'Late', order: 1 }];
    tree.nodes = [
      { id: 'root', title: 'Root', tabId: 'alpha', layout: { stageId: 'early' } },
      { id: 'child', title: 'Child', tabId: 'alpha', layout: { stageId: 'late' } },
      ...['lone-a', 'lone-b', 'lone-c'].map((id) => ({ id, title: id, tabId: 'alpha', layout: { stageId: 'late' } })),
    ];
    tree.edges = [{ id: 'root-child', source: 'root', target: 'child', type: 'required' }];
    const first = layoutGraph(buildGraphView(tree, 'all'));
    const second = layoutGraph(buildGraphView(tree, 'all'));
    const byId = new Map(first.nodes.map((node) => [node.nodeId, node]));
    expect(byId.get('root')!.rank).toBe(0);
    expect(byId.get('child')!.rank).toBe(1);
    expect(new Set(['lone-a', 'lone-b', 'lone-c'].map((id) => byId.get(id)!.rank))).toEqual(new Set([1]));
    expect(new Set(['lone-a', 'lone-b', 'lone-c'].map((id) => byId.get(id)!.y)).size).toBe(3);
    expect({ ...first, durationMs: 0 }).toEqual({ ...second, durationMs: 0 });
  });

  it('packs an all-isolated graph into a deterministic compact grid', () => {
    const tree = makeTree();
    tree.nodes = Array.from({ length: 9 }, (_, index) => ({ id: `isolate-${index}`, title: `Isolate ${index}`, tabId: 'alpha' }));
    tree.edges = [];
    const layout = layoutGraph(buildGraphView(tree, 'all'));
    expect(new Set(layout.nodes.map((node) => node.rank)).size).toBe(3);
    expect(new Set(layout.nodes.map((node) => node.y)).size).toBe(3);
    expect(new Set(layout.nodes.map((node) => `${node.x}:${node.y}`)).size).toBe(9);
    for (let left = 0; left < layout.nodes.length; left += 1) for (let right = left + 1; right < layout.nodes.length; right += 1) {
      const a = layout.nodes[left]!; const b = layout.nodes[right]!;
      expect(a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y).toBe(true);
    }
  });

  it('validates and traverses more than ten thousand chained nodes without recursion limits', () => {
    const tree = makeTree();
    tree.nodes = Array.from({ length: 12_000 }, (_, index) => ({ id: `n${index}`, title: `N${index}`, tabId: 'alpha' }));
    tree.edges = tree.nodes.slice(1).map((node, index) => ({ id: `e${index}`, source: `n${index}`, target: node.id, type: 'required' }));
    expect(assertValidTree(tree).some((issue) => issue.code === 'nodes.large')).toBe(true);
    expect(requiredAncestors(tree, 'n11999')).toHaveLength(11_999);
  });
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

  it('requires every query token and ranks title matches ahead of descriptive matches', () => {
    const tree = makeTree();
    tree.nodes[0]!.title = 'Signal processing';
    tree.nodes[0]!.tags = ['audio'];
    tree.nodes[1]!.title = 'Signal basics';
    tree.nodes[1]!.summary = 'processing fundamentals';
    const search = new SearchIndex(tree);
    expect(search.search('signal processing')).toEqual([tree.nodes[0], tree.nodes[1]]);
    expect(search.search('signal audio')).toEqual([tree.nodes[0]]);
    expect(search.search('signal absent')).toEqual([]);
  });

  it('collects all required ancestors and immediate required successors for YART-style focus', () => {
    const focus = new DependencyFocus(makeTree());
    expect([...focus.connected('c')].sort()).toEqual(['a', 'b', 'c', 'd']);
  });
});
