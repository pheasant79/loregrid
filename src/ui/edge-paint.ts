import type { LayoutEdge, LayoutNode, Point } from '../core/types';
import { stageBandAtX, type StageBand } from '../core/stages';

// YART Edges.cs GetEdgeColor / Constraints.EdgeDefault / EdgeEraDesaturate.
// Real endpoints use their own completion state; dummy corridors inherit the
// real source's state and the era at their world X coordinate.
export const EDGE_DEFAULT = '#4d5973';

export interface EdgeCurve {
  from: Point;
  control1: Point;
  control2: Point;
  to: Point;
  startColor: string;
  endColor: string;
  selected: boolean;
  type: LayoutEdge['type'];
}

export function blendColor(from: string, to: string, amount: number): string {
  return `#${[1, 3, 5].map((offset) => Math.round(
    Number.parseInt(from.slice(offset, offset + 2), 16) * (1 - amount)
    + Number.parseInt(to.slice(offset, offset + 2), 16) * amount,
  ).toString(16).padStart(2, '0')).join('')}`;
}

export function edgeEndpointColor(
  node: LayoutNode | undefined,
  realSource: LayoutNode,
  x: number,
  completed: Readonly<Record<string, true>>,
  bands: readonly StageBand[],
  nodeColor: (node: LayoutNode) => string,
): string {
  if (!completed[(node ?? realSource).nodeId]) return EDGE_DEFAULT;
  const accent = node ? nodeColor(node) : stageBandAtX(bands, x)?.color ?? nodeColor(realSource);
  return blendColor(accent, EDGE_DEFAULT, 0.3);
}

export function buildEdgeCurves(
  edges: readonly LayoutEdge[],
  nodes: readonly LayoutNode[],
  ports: ReadonlyMap<string, { sourceY: number; targetY: number }>,
  completed: Readonly<Record<string, true>>,
  bands: readonly StageBand[],
  nodeColor: (node: LayoutNode) => string,
  focused: ReadonlySet<string>,
): EdgeCurve[] {
  const byId = new Map(nodes.map((node) => [node.viewId, node]));
  const curves = new Map<string, EdgeCurve>();
  for (const edge of edges) {
    const source = byId.get(edge.source);
    const target = byId.get(edge.target);
    if (!source || !target) continue;
    const edgePorts = ports.get(edge.id);
    const points = edge.points.map((point, index) => ({
      ...point,
      y: index === 0 ? edgePorts?.sourceY ?? point.y
        : index === edge.points.length - 1 ? edgePorts?.targetY ?? point.y : point.y,
    }));
    const selected = focused.has(source.nodeId) && focused.has(target.nodeId);
    for (let index = 1; index < points.length; index++) {
      const from = points[index - 1]!;
      const to = points[index]!;
      const dx = to.x - from.x;
      const cap = Math.abs(dx) * 0.9;
      // Monotone horizontal tangents preserve rounded turns and never curl
      // backwards into a neighbouring card. Dummy in/out pairs stay straight.
      const offset = Math.min(Math.max(cap * 0.5, 30), cap / 2) * Math.sign(dx);
      const startColor = edge.type === 'required'
        ? edgeEndpointColor(index === 1 ? source : undefined, source, from.x, completed, bands, nodeColor)
        : EDGE_DEFAULT;
      const endColor = edge.type === 'required'
        ? edgeEndpointColor(index === points.length - 1 ? target : undefined, source, to.x, completed, bands, nodeColor)
        : EDGE_DEFAULT;
      // Include real source identity: coincident unrelated dependencies are
      // not a shared business trunk. Shared geometry is painted exactly once.
      const key = edge.type === 'required'
        ? `${edge.source}|${[from, to].map((point) => `${point.x}:${point.y}`).join('>')}`
        : `${edge.id}:${index}`;
      const previous = curves.get(key);
      if (previous) { previous.selected ||= selected; continue; }
      curves.set(key, {
        from, to,
        control1: { x: from.x + offset, y: from.y },
        control2: { x: to.x - offset, y: to.y },
        startColor, endColor, selected, type: edge.type,
      });
    }
  }
  return [...curves.values()].sort((a, b) => Number(a.selected) - Number(b.selected));
}
