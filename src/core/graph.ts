import type {
  GraphKey,
  GraphView,
  GraphViewEdge,
  GraphViewNode,
  TreeDefinitionV2,
  TreeEdge,
} from './types';

export const tabKey = (tabId: string): GraphKey => `tab:${tabId}`;
export const tabIdFromKey = (key: GraphKey): string | null => (key === 'all' ? null : key.slice(4));

export function buildGraphView(tree: TreeDefinitionV2, key: GraphKey): GraphView {
  if (key === 'all') {
    return {
      key,
      nodes: tree.nodes.map((node) => ({
        viewId: node.id,
        nodeId: node.id,
        title: node.title,
        tabId: node.tabId,
        kind: 'real',
        nodeKind: node.kind ?? 'topic',
        layout: node.layout,
      })),
      edges: tree.edges.map((edge) => viewEdge(edge, edge.source, edge.target)),
    };
  }

  const tabId = tabIdFromKey(key);
  if (!tabId) throw new Error(`Invalid graph key ${key}.`);
  const included = new Set(tree.nodes.filter((node) => node.tabId === tabId).map((node) => node.id));
  const nodes: GraphViewNode[] = tree.nodes
    .filter((node) => included.has(node.id))
    .map((node) => ({
      viewId: node.id,
      nodeId: node.id,
      title: node.title,
      tabId: node.tabId,
      kind: 'real',
      nodeKind: node.kind ?? 'topic',
      layout: node.layout,
    }));
  const edges: GraphViewEdge[] = [];
  const proxies = new Map<string, string>();
  const nodeById = new Map(tree.nodes.map((node) => [node.id, node]));

  for (const edge of tree.edges) {
    const sourceInside = included.has(edge.source);
    const targetInside = included.has(edge.target);
    if (sourceInside && targetInside) {
      edges.push(viewEdge(edge, edge.source, edge.target));
      continue;
    }
    if (edge.type !== 'required' || sourceInside || !targetInside) continue;
    const sourceNode = nodeById.get(edge.source);
    if (!sourceNode) continue;
    let proxyId = proxies.get(edge.source);
    if (!proxyId) {
      proxyId = `proxy:${tabId}:${edge.source}`;
      proxies.set(edge.source, proxyId);
      nodes.push({
        viewId: proxyId,
        nodeId: sourceNode.id,
        title: sourceNode.title,
        tabId,
        kind: 'proxy',
        nodeKind: sourceNode.kind ?? 'topic',
        targetTabId: sourceNode.tabId,
        layout: sourceNode.layout,
      });
    }
    edges.push(viewEdge(edge, proxyId, edge.target));
  }

  return { key, nodes, edges };
}

function viewEdge(edge: TreeEdge, source: string, target: string): GraphViewEdge {
  return {
    id: `${edge.id}@${source}->${target}`,
    source,
    target,
    type: edge.type,
    originalEdgeId: edge.id,
  };
}

export function requiredAncestors(tree: TreeDefinitionV2, nodeId: string): string[] {
  const incoming = new Map<string, string[]>();
  tree.nodes.forEach((node) => incoming.set(node.id, []));
  tree.edges.filter((edge) => edge.type === 'required').forEach((edge) => incoming.get(edge.target)?.push(edge.source));
  const result: string[] = [];
  const visited = new Set<string>();
  const visit = (id: string): void => {
    for (const prerequisite of incoming.get(id) ?? []) {
      if (visited.has(prerequisite)) continue;
      visited.add(prerequisite);
      visit(prerequisite);
      result.push(prerequisite);
    }
  };
  visit(nodeId);
  return result;
}

export function nodeRelations(tree: TreeDefinitionV2, nodeId: string): {
  prerequisites: TreeEdge[];
  dependents: TreeEdge[];
  recommended: TreeEdge[];
  related: TreeEdge[];
} {
  return {
    prerequisites: tree.edges.filter((edge) => edge.type === 'required' && edge.target === nodeId),
    dependents: tree.edges.filter((edge) => edge.type === 'required' && edge.source === nodeId),
    recommended: tree.edges.filter((edge) => edge.type === 'recommended' && (edge.source === nodeId || edge.target === nodeId)),
    related: tree.edges.filter((edge) => edge.type === 'related' && (edge.source === nodeId || edge.target === nodeId)),
  };
}
