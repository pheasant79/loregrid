import type {
  GraphKey,
  GraphView,
  GraphViewEdge,
  GraphViewNode,
  TreeDefinitionV2,
  TreeEdge,
  TreeNode,
} from './types';
import { stageForNode, treeStageAssignments } from './stages';

export const tabKey = (tabId: string): GraphKey => `tab:${encodeURIComponent(tabId)}`;
export const tabIdFromKey = (key: GraphKey): string | null => key.startsWith('tab:') ? decodeURIComponent(key.slice(4)) : null;

export function buildGraphView(tree: TreeDefinitionV2, key: GraphKey, presetTabIds?: readonly string[]): GraphView {
  const effectiveStages = treeStageAssignments(tree);
  const selectedTab = key.startsWith('tab:') ? decodeURIComponent(key.slice(4)) : null;
  if (key === 'all') {
    return {
      key,
      nodes: tree.nodes.map((node) => viewNode(tree, node, effectiveStages)),
      edges: tree.edges.map((edge) => viewEdge(edge, edge.source, edge.target)),
    };
  }

  const presetTabs = key.startsWith('preset:') && presetTabIds ? new Set(presetTabIds) : null;
  if (!selectedTab && !presetTabs) throw new Error(`Invalid graph key ${key}.`);
  const included = new Set(tree.nodes.filter((node) =>
    (!selectedTab || node.tabId === selectedTab) && (!presetTabs || presetTabs.has(node.tabId)),
  ).map((node) => node.id));
  const nodes: GraphViewNode[] = tree.nodes
    .filter((node) => included.has(node.id))
    .map((node) => viewNode(tree, node, effectiveStages));
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
      proxyId = `proxy:${key.startsWith('tab:') ? `tab:${selectedTab}` : encodeURIComponent(key)}:${edge.source}`;
      proxies.set(edge.source, proxyId);
      nodes.push({
        viewId: proxyId,
        nodeId: sourceNode.id,
        title: sourceNode.title,
        tabId: selectedTab ?? sourceNode.tabId,
        kind: 'proxy',
        nodeKind: sourceNode.kind ?? 'topic',
        targetTabId: sourceNode.tabId,
        stageId: stageMeta(tree, sourceNode).id,
        stageOrder: stageMeta(tree, sourceNode).order,
        effectiveStageId: effectiveStages.get(sourceNode.id)?.id,
        effectiveStageOrder: effectiveStages.get(sourceNode.id)?.order,
        layout: sourceNode.layout,
      });
    }
    edges.push(viewEdge(edge, proxyId, edge.target));
  }

  return { key, nodes, edges };
}

function viewNode(
  tree: TreeDefinitionV2,
  node: TreeNode,
  effectiveStages: Map<string, { id: string; order: number }>,
): GraphViewNode {
  const stage = stageMeta(tree, node);
  const effectiveStage = effectiveStages.get(node.id);
  return {
    viewId: node.id,
    nodeId: node.id,
    title: node.title,
    tabId: node.tabId,
    kind: 'real',
    nodeKind: node.kind ?? 'topic',
    stageId: stage.id,
    stageOrder: stage.order,
    effectiveStageId: effectiveStage?.id,
    effectiveStageOrder: effectiveStage?.order,
    layout: node.layout,
  };
}

function stageMeta(tree: TreeDefinitionV2, node: Pick<TreeNode, 'layout'>): { id?: string; order?: number } {
  const stage = stageForNode(tree, node);
  if (stage) return { id: stage.id, order: stage.order };
  const legacy = node.layout?.stage;
  if (typeof legacy === 'number' && Number.isFinite(legacy)) {
    return { id: `legacy-stage-${legacy}`, order: legacy };
  }
  return {};
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
  const stack = [{ id: nodeId, index: 0 }];
  visited.add(nodeId);
  while (stack.length) {
    const frame = stack[stack.length - 1]!;
    const prerequisites = incoming.get(frame.id) ?? [];
    if (frame.index >= prerequisites.length) {
      stack.pop();
      if (frame.id !== nodeId) result.push(frame.id);
      continue;
    }
    const id = prerequisites[frame.index++]!;
    if (!visited.has(id)) {
      visited.add(id);
      stack.push({ id, index: 0 });
    }
  }
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
