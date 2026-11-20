import { describe, expect, it } from 'vitest';
import type { LayoutEdge, LayoutNode, Point } from '../src/core/types';
import type { StageBand } from '../src/core/stages';
import { blendColor, buildEdgeCurves, EDGE_DEFAULT, edgeEndpointColor } from '../src/ui/edge-paint';

const node = (id: string, x: number, y = 0): LayoutNode => ({
  viewId: id, nodeId: id, title: id, tabId: 'page', nodeKind: 'topic',
  kind: 'real', x, y, width: 100, height: 40, rank: 0,
});
const source = node('source', 0);
const target = node('target', 600, 100);
const colors = (entry: LayoutNode) => entry.nodeId === 'source' ? '#86b9a0' : '#c7a56b';
const band = (id: string, left: number, right: number, color: string): StageBand => ({
  stageId: id, left, right, color, label: id, progress: '0/1', completed: 0, total: 1, complete: false,
});
const bands = [band('early', 0, 300, '#86b9a0'), band('late', 300, 800, '#c7a56b')];
const edge = (id: string, points: Point[], to = 'target'): LayoutEdge => ({
  id, originalEdgeId: id, source: 'source', target: to, type: 'required', points,
});

describe('YART completion-aware edge paint', () => {
  it.each([
    [{}, EDGE_DEFAULT, EDGE_DEFAULT],
    [{ source: true }, blendColor(colors(source), EDGE_DEFAULT, .3), EDGE_DEFAULT],
    [{ target: true }, EDGE_DEFAULT, blendColor(colors(target), EDGE_DEFAULT, .3)],
    [{ source: true, target: true }, blendColor(colors(source), EDGE_DEFAULT, .3), blendColor(colors(target), EDGE_DEFAULT, .3)],
  ] as const)('colors real endpoints independently for completion %j', (completed, start, end) => {
    const [curve] = buildEdgeCurves([edge('one', [{ x: 100, y: 20 }, { x: 600, y: 120 }])],
      [source, target], new Map(), completed, bands, colors, new Set());
    expect(curve!.startColor).toBe(start);
    expect(curve!.endColor).toBe(end);
  });

  it('keeps dummy corridors neutral until the real source completes, then uses the corridor era', () => {
    expect(edgeEndpointColor(undefined, source, 450, {}, bands, colors)).toBe(EDGE_DEFAULT);
    expect(edgeEndpointColor(undefined, source, 450, { target: true }, bands, colors)).toBe(EDGE_DEFAULT);
    expect(edgeEndpointColor(undefined, source, 450, { source: true }, bands, colors))
      .toBe(blendColor('#c7a56b', EDGE_DEFAULT, .3));
  });

  it('uses local endpoint gradients without tinting every unfinished long edge', () => {
    const points = [{ x: 100, y: 20 }, { x: 200, y: 80 }, { x: 400, y: 80 }, { x: 600, y: 120 }];
    const curves = buildEdgeCurves([edge('long', points)], [source, target], new Map(),
      { source: true }, bands, colors, new Set());
    expect(curves).toHaveLength(3);
    expect(curves[0]!.startColor).toBe(blendColor('#86b9a0', EDGE_DEFAULT, .3));
    expect(curves[1]!.endColor).toBe(blendColor('#c7a56b', EDGE_DEFAULT, .3));
    expect(curves[2]!.endColor).toBe(EDGE_DEFAULT);
  });

  it('paints shared trunks once, retains both final branches, and highlights the shared path', () => {
    const other = node('other', 600, 200);
    const shared = [{ x: 100, y: 20 }, { x: 200, y: 80 }, { x: 400, y: 80 }];
    const curves = buildEdgeCurves([
      edge('a', [...shared, { x: 600, y: 120 }]),
      edge('b', [...shared, { x: 600, y: 220 }], 'other'),
    ], [source, target, other], new Map(), {}, bands, colors, new Set(['source', 'other']));
    expect(curves).toHaveLength(4);
    expect(curves.filter((curve) => curve.to.x === 600)).toHaveLength(2);
    expect(curves.find((curve) => curve.to.x === 400)!.selected).toBe(true);
    expect(curves.filter((curve) => curve.to.x < 600).every((curve) => curve.selected)).toBe(true);
  });

  it('preserves smooth monotone curves, deterministic ports, and neutral recommendations', () => {
    const required = edge('one', [{ x: 100, y: 20 }, { x: 600, y: 120 }]);
    const recommended = { ...required, id: 'rec', type: 'recommended' as const };
    const ports = new Map([['one', { sourceY: 23, targetY: 117 }]]);
    const curves = buildEdgeCurves([required, recommended], [source, target], ports,
      { source: true, target: true }, bands, colors, new Set());
    const curve = curves[0]!;
    expect(curve.from.y).toBe(23);
    expect(curve.control1.y).toBe(curve.from.y);
    expect(curve.control2.y).toBe(curve.to.y);
    expect(curve.to.y).toBe(117);
    expect(curve.control1.x).toBeGreaterThan(curve.from.x);
    expect(curve.control2.x).toBeGreaterThanOrEqual(curve.control1.x);
    expect(curve.control2.x).toBeLessThan(curve.to.x);
    expect(curves[1]!.startColor).toBe(EDGE_DEFAULT);
    expect(curves[1]!.endColor).toBe(EDGE_DEFAULT);
  });
});
