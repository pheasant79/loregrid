import type {
  GraphView,
  GraphViewEdge,
  GraphViewNode,
  LayoutEdge,
  LayoutNode,
  LayoutResult,
  LayoutStageBoundary,
  Point,
} from './types';
import { springCoordinates } from './spring-layout';
import { balanceRanks } from './rank-balancing';
import { minimizeCrossings } from './crossing-layout';
import { shapeLongEdges } from './chain-layout';
import type { LayoutVertex } from './layout-model';
import { propagateStageAssignments } from './stages';

// The layered pipeline mirrors the generic Sugiyama stages used by YART:
// rank balancing, shared long-edge trunks, crossing optimization, spring placement,
// chain shaping and separation. Web-specific adaptations are documented below.
// See docs/legal/THIRD_PARTY_NOTICES.md and docs/yart-source-map.md.

const NODE_WIDTH = 200;
const NODE_HEIGHT = 50;
const PROXY_WIDTH = 200;
const RANK_GAP = 50;
const STAGE_TRANSITION_GAP = 50;
const MARGIN = 50;
const STAGE_BOUNDARY_OFFSET = 24;

interface WorkingNode extends StagedGraphNode {
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
  const stagedNodes = computeEffectiveStages(view.nodes, required);
  const { rank, bounds: stageRankBounds } = assignRanks(stagedNodes, required);
  balanceRanks(rank, required, view.key === 'all' || view.key.startsWith('preset:'), stageRankBounds);
  const compact = new Map([...new Set(rank.values())].sort((a, b) => a - b).map((value, index) => [value, index]));
  for (const [id, value] of rank) rank.set(id, compact.get(value)!);
  const working = new Map<string, WorkingNode>();
  stagedNodes.forEach((node) => working.set(node.viewId, { ...node, rank: rank.get(node.viewId) ?? 0 }));

  const segments: Segment[] = [];
  const edgePaths = new Map<string, string[]>();
  const longBySource = new Map<string, GraphViewEdge[]>();
  for (const edge of required) {
    if ((rank.get(edge.target) ?? 0) - (rank.get(edge.source) ?? 0) <= 1) {
      segments.push({ source: edge.source, target: edge.target, edgeId: edge.id });
      edgePaths.set(edge.id, [edge.source, edge.target]);
    } else {
      const list = longBySource.get(edge.source) ?? [];
      list.push(edge); longBySource.set(edge.source, list);
    }
  }
  // YART NormalizeEdges: all long edges from one source share a dummy trunk,
  // branching in the column immediately before each target.
  for (const [source, edges] of longBySource) {
    const sourceRank = rank.get(source)!;
    const maximum = edges.reduce((maximum, edge) => Math.max(maximum, rank.get(edge.target)!), sourceRank);
    const trunk = [source];
    let previous = source;
    for (let currentRank = sourceRank + 1; currentRank < maximum; currentRank++) {
      let dummyId = `dummy:${source}:${currentRank}`;
      while (working.has(dummyId)) dummyId += ':';
      working.set(dummyId, {
        viewId: dummyId,
        nodeId: dummyId,
        title: '',
        tabId: working.get(source)?.tabId ?? '',
        kind: 'proxy',
        nodeKind: 'topic',
        rank: currentRank,
        dummy: true,
        stageId: working.get(source)?.stageId,
        stageOrder: working.get(source)?.stageOrder,
        effectiveStageId: working.get(source)?.effectiveStageId,
        effectiveStageOrder: working.get(source)?.effectiveStageOrder,
        layout: working.get(source)?.layout,
      });
      segments.push({ source: previous, target: dummyId, edgeId: edges[0]!.id });
      trunk.push(dummyId);
      previous = dummyId;
    }
    for (const edge of edges) {
      const path = trunk.slice(0, rank.get(edge.target)! - sourceRank);
      segments.push({ source: path.at(-1)!, target: edge.target, edgeId: edge.id });
      path.push(edge.target); edgePaths.set(edge.id, path);
    }
  }

  const layers = buildLayers([...working.values()]);
  const vertices = new Map<string, LayoutVertex>([...working].map(([id, node]) => [id, { id, rank: node.rank, dummy: node.dummy }]));
  const ordered = layers.map((layer) => layer.map((node) => node.viewId));
  minimizeCrossings(ordered, vertices, segments);
  const orderedLayers = ordered.map((layer) => layer.map((id) => working.get(id)!));
  const positions = placeLayers(orderedLayers, segments);
  const nodes: LayoutNode[] = stagedNodes.map((node) => {
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
    return { ...edge, points: routeEdge(path, positions, working) };
  });
  const maxX = nodes.reduce((maximum, node) => Math.max(maximum, node.x + node.width + MARGIN), MARGIN * 2);
  const maxY = nodes.reduce((maximum, node) => Math.max(maximum, node.y + node.height + MARGIN), MARGIN * 2);

  return {
    key: view.key,
    nodes,
    edges: layoutEdges,
    width: maxX,
    height: maxY,
    durationMs: performance.now() - started,
    stageBoundaries: buildStageBoundaries(nodes),
  };
}

interface StagedGraphNode extends GraphViewNode {
  effectiveStageId?: string;
  effectiveStageOrder?: number;
}

/**
 * Propagate the latest prerequisite stage forward. A node assigned to an
 * earlier stage than one of its required ancestors inherits the ancestor's
 * stage, so dependency truth wins over a contradictory stage hint.
 */
function computeEffectiveStages(nodes: GraphViewNode[], edges: GraphViewEdge[]): StagedGraphNode[] {
  const byId = new Map(nodes.map((node) => [node.viewId, node]));
  const effective = propagateStageAssignments(nodes.map((node) => ({
    id: node.viewId,
    stageId: node.effectiveStageId ?? node.stageId ?? (node.layout?.stage !== undefined ? `legacy-stage-${node.layout.stage}` : undefined),
    stageOrder: node.effectiveStageOrder ?? node.stageOrder ?? node.layout?.stage,
  })), edges, (a, b) => nodeOrder(byId.get(a.id)!, byId.get(b.id)!));
  return nodes.map((node) => {
    const authoredStageId = node.stageId
      ?? (node.layout?.stage !== undefined ? `legacy-stage-${node.layout.stage}` : undefined);
    const authoredStageOrder = node.stageOrder ?? node.layout?.stage;
    const stage = effective.get(node.viewId);
    return {
      ...node,
      stageId: authoredStageId,
      stageOrder: authoredStageOrder,
      effectiveStageId: stage?.id,
      effectiveStageOrder: stage?.order,
    };
  });
}

function buildStageBoundaries(nodes: LayoutNode[]): LayoutStageBoundary[] {
  const groups = new Map<string, { order: number; left: number; right: number }>();
  for (const node of nodes) {
    const stageId = node.effectiveStageId ?? node.stageId;
    const stageOrder = node.effectiveStageOrder ?? node.stageOrder;
    if (!stageId || stageOrder === undefined || !Number.isFinite(stageOrder)) continue;
    const group = groups.get(stageId) ?? { order: stageOrder, left: Infinity, right: -Infinity };
    group.left = Math.min(group.left, node.x);
    group.right = Math.max(group.right, node.x + node.width);
    groups.set(stageId, group);
  }
  const ordered = [...groups.entries()]
    .map(([stageId, bounds]) => ({ stageId, ...bounds }))
    .sort((a, b) => a.order - b.order || a.left - b.left || a.stageId.localeCompare(b.stageId));
  if (!ordered.length) return [];
  return ordered.map((stage, index) => {
    const previous = ordered[index - 1];
    const next = ordered[index + 1];
    return {
      stageId: stage.stageId,
      stageOrder: stage.order,
      left: previous ? (previous.right + stage.left) / 2 : stage.left - STAGE_BOUNDARY_OFFSET,
      right: next ? (stage.right + next.left) / 2 : stage.right + STAGE_BOUNDARY_OFFSET,
    };
  });
}

function insertNodeReady(
  queue: string[],
  id: string,
  start: number,
  byId: Map<string, GraphViewNode>,
): void {
  let low = start;
  let high = queue.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (nodeOrder(byId.get(queue[middle]!)!, byId.get(id)!) <= 0) low = middle + 1;
    else high = middle;
  }
  queue.splice(low, 0, id);
}

function assignRanks(
  nodes: StagedGraphNode[],
  edges: GraphViewEdge[],
): { rank: Map<string, number>; bounds: Map<string, [number, number]> } {
  const indegree = new Map(nodes.map((node) => [node.viewId, 0]));
  const outgoing = new Map(nodes.map((node) => [node.viewId, [] as string[]]));
  for (const edge of edges) {
    if (!indegree.has(edge.source) || !indegree.has(edge.target)) continue;
    indegree.set(edge.target, (indegree.get(edge.target) ?? 0) + 1);
    outgoing.get(edge.source)?.push(edge.target);
  }
  const incoming = new Map(nodes.map((node) => [node.viewId, [] as string[]]));
  for (const edge of edges) incoming.get(edge.target)?.push(edge.source);
  const rank = new Map(nodes.map((node) => [node.viewId, 0]));
  const topo: string[] = [];
  const queue = nodes
    .filter((node) => (indegree.get(node.viewId) ?? 0) === 0)
    .sort(nodeOrder)
    .map((node) => node.viewId);
  let cursor = 0;
  while (cursor < queue.length) {
    const id = queue[cursor++];
    if (!id) continue;
    topo.push(id);
    for (const target of outgoing.get(id) ?? []) {
      indegree.set(target, (indegree.get(target) ?? 1) - 1);
      if (indegree.get(target) === 0) insertReady(queue, target, cursor, rank);
    }
  }
  // YART allocates a non-overlapping rank band per effective tech level before
  // tightening and balancing. This is the key invariant that keeps a node in
  // its era instead of deriving era rectangles after nodes have drifted.
  const stageGroups = new Map<number | undefined, string[]>();
  const byId = new Map(nodes.map((node) => [node.viewId, node]));
  for (const id of topo) {
    const order = byId.get(id)?.effectiveStageOrder;
    const group = stageGroups.get(order) ?? [];
    group.push(id); stageGroups.set(order, group);
  }
  const stageRankBounds = new Map<string, [number, number]>();
  const hasStages = nodes.some((node) => node.effectiveStageOrder !== undefined);
  let nextBase = 0;
  for (const [order, ids] of [...stageGroups.entries()].sort(([a], [b]) => {
    if (a === undefined) return -1;
    if (b === undefined) return 1;
    return a - b;
  })) {
    const base = nextBase;
    let maxRank = base;
    for (const id of ids) {
      let lower = base;
      for (const parent of incoming.get(id) ?? []) lower = Math.max(lower, (rank.get(parent) ?? 0) + 1);
      rank.set(id, lower);
      maxRank = Math.max(maxRank, lower);
    }
    const band: [number, number] = [base, maxRank];
    if (hasStages) for (const id of ids) stageRankBounds.set(id, band);
    nextBase = maxRank + 1;
  }
  let maxRank = 0;
  for (const value of rank.values()) maxRank = Math.max(maxRank, value);
  for (let pass = 0; pass < 16; pass++) {
    let changed = false;
    for (let index = topo.length - 1; index >= 0; index--) {
      const id = topo[index]!;
      const parents = incoming.get(id) ?? [];
      const children = outgoing.get(id) ?? [];
      const band = stageRankBounds.get(id);
      let lower = band?.[0] ?? 0;
      let upper = band?.[1] ?? maxRank;
      for (const parent of parents) lower = Math.max(lower, (rank.get(parent) ?? 0) + 1);
      for (const child of children) upper = Math.min(upper, (rank.get(child) ?? 0) - 1);
      if (lower > upper) continue;
      const current = rank.get(id) ?? 0;
      const target = children.length > parents.length ? upper
        : parents.length > children.length ? lower : Math.max(lower, Math.min(upper, current));
      if (target !== current) { rank.set(id, target); changed = true; }
    }
    if (!changed) break;
  }
  return { rank, bounds: stageRankBounds };
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
  const maxRank = nodes.reduce((maximum, node) => Math.max(maximum, node.rank), 0);
  const layers = Array.from({ length: maxRank + 1 }, () => [] as WorkingNode[]);
  nodes.forEach((node) => layers[node.rank]?.push(node));
  layers.forEach((layer) => layer.sort(nodeOrder));
  return layers;
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

function placeLayers(layers: WorkingNode[][], segments: Segment[]): Map<string, Point> {
  const positions = new Map<string, Point>();
  const neighbors = new Map<string, string[]>();
  for (const segment of segments) {
    for (const [id, neighbor] of [[segment.source, segment.target], [segment.target, segment.source]] as const) {
      const list = neighbors.get(id) ?? [];
      list.push(neighbor); neighbors.set(id, list);
    }
  }
  const springLayers = layers.map((layer) => layer.map((node) => ({ id: node.viewId, height: node.dummy ? 20 : NODE_HEIGHT })));
  const centers = springCoordinates(springLayers, neighbors);
  const vertices = new Map<string, LayoutVertex>(layers.flatMap((layer) => layer.map((node) => [
    node.viewId, { id: node.viewId, rank: node.rank, dummy: node.dummy },
  ] as const)));
  const chainLayers = layers.map((layer) => layer.map((node) => node.viewId));
  shapeLongEdges(chainLayers, vertices, segments, centers);
  const byId = new Map(layers.flat().map((node) => [node.viewId, node]));
  chainLayers.forEach((layer, index) => { layers[index] = layer.map((id) => byId.get(id)!); });
  alignTerminalLeaves(layers, segments, centers);
  let minY = Infinity;
  for (const layer of springLayers) for (const node of layer) minY = Math.min(minY, centers.get(node.id)! - node.height / 2);
  if (!Number.isFinite(minY)) minY = 0;
  let x = MARGIN;
  let previousColumnStage = -1;
  layers.forEach((layer) => {
    const realNodes = layer.filter((node) => !node.dummy && node.effectiveStageOrder !== undefined);
    const columnStage = realNodes.length
      ? realNodes.reduce((maximum, node) => Math.max(maximum, node.effectiveStageOrder!), -1)
      : previousColumnStage;
    if (previousColumnStage >= 0 && columnStage > previousColumnStage) x += STAGE_TRANSITION_GAP;
    layer.forEach((node) => {
      positions.set(node.viewId, {
        x,
        y: MARGIN + centers.get(node.viewId)! - minY - (node.dummy ? 0 : NODE_HEIGHT / 2),
      });
    });
    x += NODE_WIDTH + RANK_GAP;
    previousColumnStage = Math.max(previousColumnStage, columnStage);
  });
  return positions;
}

// Adapted from YART AlignTerminalLeavesToIncoming: move only sinks into free slots.
// Continuous coordinates replace YART's grid snapping; layer order stays fixed.
function alignTerminalLeaves(layers: WorkingNode[][], segments: Segment[], centers: Map<string, number>): void {
  const incoming = adjacency(segments, 'target', 'source');
  const outgoing = adjacency(segments, 'source', 'target');
  const height = (node: WorkingNode): number => node.dummy ? 20 : NODE_HEIGHT;
  const separation = (a: WorkingNode, b: WorkingNode): number =>
    (height(a) + height(b)) / 2 + (a.dummy && b.dummy ? 10 : 28);
  for (let pass = 0; pass < 2; pass++) {
    for (const layer of layers) {
      for (let index = 0; index < layer.length; index++) {
        const node = layer[index]!;
        if (node.dummy || node.kind === 'proxy' || outgoing.has(node.viewId)) continue;
        const parents = incoming.get(node.viewId) ?? [];
        if (!parents.length) continue;
        const target = parents.reduce((sum, id) => sum + centers.get(id)!, 0) / parents.length;
        const previous = layer[index - 1];
        const next = layer[index + 1];
        const lower = previous ? centers.get(previous.viewId)! + separation(previous, node) : -Infinity;
        const upper = next ? centers.get(next.viewId)! - separation(node, next) : Infinity;
        if (target >= lower && target <= upper) centers.set(node.viewId, target);
      }
    }
  }
}

function routeEdge(path: string[], positions: Map<string, Point>, working: Map<string, WorkingNode>): Point[] {
  const centers = path.flatMap((id, index) => {
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
    const y = point.y + (node?.dummy ? 0 : NODE_HEIGHT / 2);
    // Reserve the whole intervening card column as a horizontal corridor.
    // A single point at the column entrance lets the next Bezier turn through
    // the right half of an unrelated card, despite separated dummy centers.
    return node?.dummy ? [{ x, y }, { x: x + NODE_WIDTH, y }] : [{ x, y }];
  });
  if (centers.length > 2) return centers;
  const source = centers[0] ?? { x: 0, y: 0 };
  const target = centers[1] ?? source;
  return [source, target];
}

function nodeOrder(a: GraphViewNode, b: GraphViewNode): number {
  return (a.layout?.order ?? Number.MAX_SAFE_INTEGER) - (b.layout?.order ?? Number.MAX_SAFE_INTEGER)
    || (a.layout?.groupId ?? '').localeCompare(b.layout?.groupId ?? '')
    || a.title.localeCompare(b.title)
    || a.viewId.localeCompare(b.viewId);
}
