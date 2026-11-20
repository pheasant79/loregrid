import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildGraphView, tabKey } from '../src/core/graph';
import { layoutGraph } from '../src/core/layout';
import { normalizeTree } from '../src/core/normalize';
import type { LayoutResult } from '../src/core/types';
import { makeTree } from './fixtures';

function expectStageInvariants(layout: LayoutResult): void {
  const byId = new Map(layout.nodes.map((node) => [node.viewId, node]));
  const bands = new Map(layout.stageBoundaries.map((band) => [band.stageId, band]));
  for (const [index, band] of layout.stageBoundaries.entries()) {
    expect(band.right, `${layout.key}: inverted ${band.stageId}`).toBeGreaterThan(band.left);
    const previous = layout.stageBoundaries[index - 1];
    if (previous) {
      expect(band.stageOrder).toBeGreaterThan(previous.stageOrder);
      expect(band.left).toBe(previous.right);
    }
  }
  for (const node of layout.nodes) {
    const stage = node.effectiveStageId ?? node.stageId;
    if (!stage) continue;
    const band = bands.get(stage)!;
    expect(band, `${layout.key}: missing ${stage}`).toBeDefined();
    expect(node.x, `${layout.key}: ${node.nodeId} before ${stage}`).toBeGreaterThanOrEqual(band.left);
    expect(node.x + node.width, `${layout.key}: ${node.nodeId} after ${stage}`).toBeLessThanOrEqual(band.right);
  }
  for (const edge of layout.edges.filter((entry) => entry.type === 'required')) {
    const source = byId.get(edge.source)!;
    const target = byId.get(edge.target)!;
    expect(target.rank).toBeGreaterThan(source.rank);
    expect(target.x).toBeGreaterThan(source.x + source.width);
  }
  // Same-column boxes must be separated; columns have disjoint x extents.
  const columns = new Map<number, typeof layout.nodes>();
  for (const node of layout.nodes) {
    const column = columns.get(node.rank) ?? [];
    column.push(node); columns.set(node.rank, column);
  }
  for (const column of columns.values()) {
    column.sort((a, b) => a.y - b.y);
    column.slice(1).forEach((node, index) =>
      expect(node.y).toBeGreaterThanOrEqual(column[index]!.y + column[index]!.height));
  }
}

describe('stage rank-band regressions', () => {
  for (const file of ['computer-science-phd', 'loregrid-demo']) {
    const tree = normalizeTree(JSON.parse(readFileSync(`data/trees/${file}.json`, 'utf8'))).tree;
    it(`keeps ${file} nodes and proxies inside ordered stages in All, every page and a combination`, () => {
      const views = [
        buildGraphView(tree, 'all'),
        ...tree.tabs.map((tab) => buildGraphView(tree, tabKey(tab.id))),
        buildGraphView(tree, 'preset:regression', tree.tabs.filter((_, index) => index % 2 === 0).map((tab) => tab.id)),
      ];
      for (const view of views) expectStageInvariants(layoutGraph(view));
    });
  }

  it('allocates era widths from actual dependency depth, including disconnected roots and isolates', () => {
    const tree = makeTree();
    tree.stages = ['early', 'middle', 'late'].map((id, order) => ({ id, title: id, order }));
    tree.nodes = [
      { id: 'a', title: 'A', tabId: 'alpha', layout: { stageId: 'early' } },
      ...['b', 'c', 'd'].map((id) => ({ id, title: id, tabId: 'alpha', layout: { stageId: 'middle' } })),
      { id: 'isolated', title: 'Isolated', tabId: 'beta', layout: { stageId: 'late' } },
    ];
    tree.edges = [
      { id: 'bc', source: 'b', target: 'c', type: 'required' },
      { id: 'cd', source: 'c', target: 'd', type: 'required' },
    ];
    const layout = layoutGraph(buildGraphView(tree, 'all'));
    expectStageInvariants(layout);
    const widths = layout.stageBoundaries.map((band) => band.right - band.left);
    expect(widths[1]).toBeGreaterThan(widths[0]!);
    expect(widths[1]).toBeGreaterThan(widths[2]!);
    const repeated = layoutGraph(buildGraphView(tree, 'all'));
    expect({ ...layout, durationMs: 0 }).toEqual({ ...repeated, durationMs: 0 });
  });

  it('expands a crowded stage without letting nodes spill into the following era', () => {
    const tree = makeTree();
    tree.stages = [{ id: 'early', title: 'Early', order: 0 }, { id: 'late', title: 'Late', order: 1 }];
    tree.nodes = [
      { id: 'root', title: 'Root', tabId: 'alpha', layout: { stageId: 'early' } },
      ...Array.from({ length: 80 }, (_, i) => ({
        id: `leaf${i}`, title: `Leaf ${i}`, tabId: 'alpha', layout: { stageId: 'early' },
      })),
      { id: 'later', title: 'Later', tabId: 'beta', layout: { stageId: 'late' } },
    ];
    tree.edges = tree.nodes.slice(1, -1).map((node) => ({
      id: `edge-${node.id}`, source: 'root', target: node.id, type: 'required',
    }));
    const layout = layoutGraph(buildGraphView(tree, tabKey('alpha')));
    expectStageInvariants(layout);
    expect(new Set(layout.nodes.map((node) => node.rank)).size).toBeGreaterThan(2);
    expectStageInvariants(layoutGraph(buildGraphView(tree, 'all')));
  });
});
