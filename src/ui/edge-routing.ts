import type { LayoutEdge, LayoutNode } from '../core/types';

export interface EdgePorts {
  sourceY: number;
  targetY: number;
}

export function distributeEdgePorts(
  nodes: readonly LayoutNode[],
  edges: readonly LayoutEdge[],
): Map<string, EdgePorts> {
  const nodeById = new Map(nodes.map((node) => [node.viewId, node]));
  const outgoing = new Map<string, LayoutEdge[]>();
  const incoming = new Map<string, LayoutEdge[]>();
  for (const edge of edges) {
    if (edge.type === 'related') continue;
    const out = outgoing.get(edge.source) ?? [];
    out.push(edge);
    outgoing.set(edge.source, out);
    const into = incoming.get(edge.target) ?? [];
    into.push(edge);
    incoming.set(edge.target, into);
  }

  const result = new Map<string, EdgePorts>();
  for (const [nodeId, group] of outgoing) {
    const node = nodeById.get(nodeId);
    if (!node) continue;
    const sharedBranches = new Map<string, LayoutEdge[]>();
    for (const edge of group) {
      const first = edge.points[1];
      const second = edge.points[2];
      const branch = first && second
        ? `${pointKey(first)}>${pointKey(second)}`
        : edge.id;
      const branches = sharedBranches.get(branch) ?? [];
      branches.push(edge);
      sharedBranches.set(branch, branches);
    }
    const branchEdges = [...sharedBranches.values()];
    const branchOrder = branchEdges
      .map((branch) => ({
        edges: branch,
        targetY: branch.reduce((sum, edge) => sum + (nodeById.get(edge.target)?.y ?? node.y), 0) / branch.length,
        key: branch.map((edge) => edge.id).sort()[0]!,
      }))
      .sort((a, b) => a.targetY - b.targetY || a.key.localeCompare(b.key));
    const ports = assignY(node, branchOrder.length);
    branchOrder.forEach(({ edges: branch }, index) => {
      for (const edge of branch) {
        result.set(edge.id, { sourceY: ports[index]!, targetY: centerY(node) });
      }
    });
  }

  for (const [nodeId, group] of incoming) {
    const node = nodeById.get(nodeId);
    if (!node) continue;
    const ordered = [...group].sort((a, b) =>
      (centerY(nodeById.get(a.source)) - centerY(nodeById.get(b.source)))
      || a.id.localeCompare(b.id));
    const ports = assignY(node, ordered.length);
    ordered.forEach((edge, index) => {
      const current = result.get(edge.id) ?? { sourceY: centerY(nodeById.get(edge.source)), targetY: centerY(node) };
      current.targetY = ports[index]!;
      result.set(edge.id, current);
    });
  }
  return result;
}

function assignY(node: LayoutNode, count: number): number[] {
  const center = centerY(node);
  if (count <= 1) return [center];
  const maxSpan = Math.max(0, node.height - 12);
  const spacing = Math.min(12, maxSpan / (count - 1));
  return Array.from({ length: count }, (_, index) => center + spacing * (index - (count - 1) / 2));
}

function centerY(node: LayoutNode | undefined): number {
  return node ? node.y + node.height / 2 : 0;
}

function pointKey(point: { x: number; y: number }): string {
  return `${Math.round(point.x * 1000)}:${Math.round(point.y * 1000)}`;
}
