import type { GraphView, GraphViewEdge, GraphViewNode, LayoutEdge, LayoutNode, LayoutResult, Point } from './types';

// The layered pipeline mirrors the generic Sugiyama stages used by YART:
// rank assignment, long-edge dummy insertion, barycentric ordering, and compact placement.
// See THIRD_PARTY_NOTICES.md and docs/yart-source-map.md.

const NODE_WIDTH = 220;
const NODE_HEIGHT = 82;
const PROXY_WIDTH = 190;
const RANK_GAP = 116;
const ROW_GAP = 34;
const MARGIN = 80;

interface WorkingNode extends GraphViewNode {
  rank: number;
  dummy?: boolean;
}

interface Segment {
  source: string;
  target: string;
  edgeId: string;
}

export function layoutGraph(view: GraphView): LayoutResult {
  const started = performance.now();
  const required = view.edges.filter((edge) => edge.type === 'required');
  const rank = assignRanks(view.nodes, required);
  const working = new Map<string, WorkingNode>();
  view.nodes.forEach((node) => working.set(node.viewId, { ...node, rank: rank.get(node.viewId) ?? 0 }));

  const segments: Segment[] = [];
  const edgePaths = new Map<string, string[]>();
  for (const edge of required) {
    const sourceRank = rank.get(edge.source) ?? 0;
    const targetRank = Math.max(sourceRank + 1, rank.get(edge.target) ?? sourceRank + 1);
    const path = [edge.source];
    let previous = edge.source;
    for (let currentRank = sourceRank + 1; currentRank < targetRank; currentRank += 1) {
      const dummyId = `dummy:${edge.id}:${currentRank}`;
      working.set(dummyId, {
        viewId: dummyId,
        nodeId: dummyId,
        title: '',
        tabId: '',
        kind: 'proxy',
        nodeKind: 'topic',
        rank: currentRank,
        dummy: true,
      });
      segments.push({ source: previous, target: dummyId, edgeId: edge.id });
      path.push(dummyId);
      previous = dummyId;
    }
    segments.push({ source: previous, target: edge.target, edgeId: edge.id });
    path.push(edge.target);
    edgePaths.set(edge.id, path);
  }

  const layers = buildLayers([...working.values()]);
  orderLayers(layers, segments);
  const positions = placeLayers(layers);
  const nodes: LayoutNode[] = view.nodes.map((node) => {
    const point = positions.get(node.viewId) ?? { x: MARGIN, y: MARGIN };
    return {
      ...node,
      x: point.x,
      y: point.y,
      width: node.kind === 'proxy' ? PROXY_WIDTH : NODE_WIDTH,
      height: NODE_HEIGHT,
      rank: rank.get(node.viewId) ?? 0,
    };
  });

  const layoutEdges: LayoutEdge[] = view.edges.map((edge) => {
    const path = edgePaths.get(edge.id) ?? [edge.source, edge.target];
    return { ...edge, points: routeEdge(path, positions, edge, working) };
  });
  const maxX = Math.max(MARGIN * 2, ...nodes.map((node) => node.x + node.width + MARGIN));
  const maxY = Math.max(MARGIN * 2, ...nodes.map((node) => node.y + node.height + MARGIN));

  return {
    key: view.key,
    nodes,
    edges: layoutEdges,
    width: maxX,
    height: maxY,
    durationMs: performance.now() - started,
  };
}

function assignRanks(nodes: GraphViewNode[], edges: GraphViewEdge[]): Map<string, number> {
  const indegree = new Map(nodes.map((node) => [node.viewId, 0]));
  const outgoing = new Map(nodes.map((node) => [node.viewId, [] as string[]]));
  for (const edge of edges) {
    if (!indegree.has(edge.source) || !indegree.has(edge.target)) continue;
    indegree.set(edge.target, (indegree.get(edge.target) ?? 0) + 1);
    outgoing.get(edge.source)?.push(edge.target);
  }
  const queue = nodes
    .filter((node) => (indegree.get(node.viewId) ?? 0) === 0)
    .sort(nodeOrder)
    .map((node) => node.viewId);
  const rank = new Map(nodes.map((node) => [node.viewId, Math.max(0, node.layout?.stage ?? 0)]));
  let cursor = 0;
  while (cursor < queue.length) {
    const id = queue[cursor++];
    if (!id) continue;
    for (const target of outgoing.get(id) ?? []) {
      rank.set(target, Math.max(rank.get(target) ?? 0, (rank.get(id) ?? 0) + 1));
      indegree.set(target, (indegree.get(target) ?? 1) - 1);
      if (indegree.get(target) === 0) {
        insertReady(queue, target, cursor, rank);
      }
    }
  }
  return rank;
}

function insertReady(queue: string[], id: string, start: number, rank: Map<string, number>): void {
  const compare = (left: string, right: string): number =>
    (rank.get(left) ?? 0) - (rank.get(right) ?? 0) || left.localeCompare(right);
  let low = start;
  let high = queue.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (compare(queue[middle]!, id) <= 0) low = middle + 1;
    else high = middle;
  }
  queue.splice(low, 0, id);
}

function buildLayers(nodes: WorkingNode[]): WorkingNode[][] {
  const maxRank = Math.max(0, ...nodes.map((node) => node.rank));
  const layers = Array.from({ length: maxRank + 1 }, () => [] as WorkingNode[]);
  nodes.forEach((node) => layers[node.rank]?.push(node));
  layers.forEach((layer) => layer.sort(nodeOrder));
  return layers;
}

function orderLayers(layers: WorkingNode[][], segments: Segment[]): void {
  const incoming = adjacency(segments, 'target', 'source');
  const outgoing = adjacency(segments, 'source', 'target');
  for (let pass = 0; pass < 6; pass += 1) {
    for (let rank = 1; rank < layers.length; rank += 1) sortByBarycenter(layers[rank] ?? [], layers[rank - 1] ?? [], incoming);
    for (let rank = layers.length - 2; rank >= 0; rank -= 1) sortByBarycenter(layers[rank] ?? [], layers[rank + 1] ?? [], outgoing);
  }
}

function adjacency(segments: Segment[], key: 'source' | 'target', value: 'source' | 'target'): Map<string, string[]> {
  const result = new Map<string, string[]>();
  segments.forEach((segment) => {
    const id = segment[key];
    const list = result.get(id) ?? [];
    list.push(segment[value]);
    result.set(id, list);
  });
  return result;
}

function sortByBarycenter(layer: WorkingNode[], adjacent: WorkingNode[], links: Map<string, string[]>): void {
  const order = new Map(adjacent.map((node, index) => [node.viewId, index]));
  layer.sort((a, b) => {
    const aLinks = links.get(a.viewId) ?? [];
    const bLinks = links.get(b.viewId) ?? [];
    const aCenter = aLinks.length ? aLinks.reduce((sum, id) => sum + (order.get(id) ?? 0), 0) / aLinks.length : Number.POSITIVE_INFINITY;
    const bCenter = bLinks.length ? bLinks.reduce((sum, id) => sum + (order.get(id) ?? 0), 0) / bLinks.length : Number.POSITIVE_INFINITY;
    return aCenter - bCenter || nodeOrder(a, b);
  });
}

function placeLayers(layers: WorkingNode[][]): Map<string, Point> {
  const positions = new Map<string, Point>();
  const tallest = Math.max(1, ...layers.map((layer) => layer.length));
  layers.forEach((layer, rank) => {
    const offset = ((tallest - layer.length) * (NODE_HEIGHT + ROW_GAP)) / 2;
    layer.forEach((node, index) => {
      positions.set(node.viewId, {
        x: MARGIN + rank * (NODE_WIDTH + RANK_GAP),
        y: MARGIN + offset + index * (NODE_HEIGHT + ROW_GAP),
      });
    });
  });
  return positions;
}

function routeEdge(path: string[], positions: Map<string, Point>, edge: GraphViewEdge, working: Map<string, WorkingNode>): Point[] {
  const centers = path.map((id, index) => {
    const point = positions.get(id) ?? { x: 0, y: 0 };
    const node = working.get(id);
    const width = node?.dummy ? 0 : node?.kind === 'proxy' ? PROXY_WIDTH : NODE_WIDTH;
    const x = node?.dummy
      ? point.x
      : index === 0
        ? point.x + width
        : index === path.length - 1
          ? point.x
          : point.x + width / 2;
    return { x, y: point.y + (node?.dummy ? 0 : NODE_HEIGHT / 2) };
  });
  if (centers.length > 2) return centers;
  const source = centers[0] ?? { x: 0, y: 0 };
  const target = centers[1] ?? source;
  if (edge.type === 'related') return [source, target];
  const middleX = (source.x + target.x) / 2;
  return [source, { x: middleX, y: source.y }, { x: middleX, y: target.y }, target];
}

function nodeOrder(a: GraphViewNode, b: GraphViewNode): number {
  return (a.layout?.order ?? Number.MAX_SAFE_INTEGER) - (b.layout?.order ?? Number.MAX_SAFE_INTEGER)
    || (a.layout?.groupId ?? '').localeCompare(b.layout?.groupId ?? '')
    || a.title.localeCompare(b.title)
    || a.viewId.localeCompare(b.viewId);
}
