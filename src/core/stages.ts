import type { LayoutResult, ProgressV2, TreeDefinitionV2, TreeEdge, TreeNode, TreeStage } from './types';
import type { Language } from './i18n';

const STAGE_PALETTE = ['#7fa6c9', '#86b9a0', '#c7a56b', '#b58ac7', '#c88778', '#8ab3b9'];

export function stageColor(
  tree: TreeDefinitionV2,
  node: Pick<StageAssignmentNode, 'stageId' | 'stageOrder'>,
): string {
  const stage = tree.stages?.find((entry) => entry.id === node.stageId)
    ?? tree.stages?.find((entry) => entry.order === node.stageOrder);
  const order = stage?.order ?? node.stageOrder ?? 0;
  const paletteIndex = ((order % STAGE_PALETTE.length) + STAGE_PALETTE.length) % STAGE_PALETTE.length;
  return stage?.color ?? STAGE_PALETTE[paletteIndex]!;
}

/**
 * Resolve a node's authored stage. V2 prefers the stable stage ID; the
 * numeric hint remains readable so old V1/V2 trees continue to work.
 */
export function stageForNode(
  tree: TreeDefinitionV2,
  node: Pick<TreeNode, 'layout'>,
): TreeStage | undefined {
  const stages = tree.stages ?? [];
  const stageId = node.layout?.stageId;
  if (stageId) {
    const byId = stages.find((stage) => stage.id === stageId);
    if (byId) return byId;
  }
  const order = node.layout?.stage;
  return typeof order === 'number' && Number.isFinite(order)
    ? stages.find((stage) => stage.order === order)
    : undefined;
}

export function stageTitle(
  tree: TreeDefinitionV2,
  node: Pick<TreeNode, 'layout'>,
  language: Language,
): string {
  const stage = stageForNode(tree, node);
  if (stage) return language === 'en' ? stage.titleEn || stage.title : stage.title;
  const order = node.layout?.stage;
  return language === 'en'
    ? `Stage ${typeof order === 'number' ? order + 1 : '—'}`
    : `阶段 ${typeof order === 'number' ? order + 1 : '—'}`;
}

export interface StageAssignmentNode {
  id: string;
  stageId?: string;
  stageOrder?: number;
}

export interface StageAssignment {
  id: string;
  order: number;
}

/**
 * Propagate a later required-prerequisite stage through a DAG. The layout and
 * stage-progress summary share this rule so a node cannot visually belong to
 * one stage while its completion is counted in another.
 */
export function propagateStageAssignments(
  nodes: readonly StageAssignmentNode[],
  edges: readonly Pick<TreeEdge, 'source' | 'target'>[],
  compare: (a: StageAssignmentNode, b: StageAssignmentNode) => number = (a, b) => a.id.localeCompare(b.id),
): Map<string, StageAssignment> {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const incoming = new Map(nodes.map((node) => [node.id, [] as string[]]));
  const outgoing = new Map(nodes.map((node) => [node.id, [] as string[]]));
  const indegree = new Map(nodes.map((node) => [node.id, 0]));
  for (const edge of edges) {
    if (!incoming.has(edge.target) || !outgoing.has(edge.source)) continue;
    incoming.get(edge.target)!.push(edge.source);
    outgoing.get(edge.source)!.push(edge.target);
    indegree.set(edge.target, indegree.get(edge.target)! + 1);
  }
  const queue = nodes.filter((node) => indegree.get(node.id) === 0).sort(compare).map((node) => node.id);
  const assignments = new Map<string, StageAssignment>();
  const insertReady = (id: string, start: number): void => {
    const candidate = byId.get(id)!;
    let low = start;
    let high = queue.length;
    while (low < high) {
      const middle = (low + high) >>> 1;
      if (compare(byId.get(queue[middle]!)!, candidate) <= 0) low = middle + 1;
      else high = middle;
    }
    queue.splice(low, 0, id);
  };

  for (let cursor = 0; cursor < queue.length; cursor++) {
    const id = queue[cursor]!;
    const node = byId.get(id)!;
    let stage = node.stageId && Number.isFinite(node.stageOrder)
      ? { id: node.stageId, order: node.stageOrder! }
      : undefined;
    for (const parentId of incoming.get(id) ?? []) {
      const parent = assignments.get(parentId);
      if (parent && (!stage || parent.order > stage.order)) stage = parent;
    }
    if (stage) assignments.set(id, stage);
    for (const child of outgoing.get(id) ?? []) {
      indegree.set(child, indegree.get(child)! - 1);
      if (indegree.get(child) === 0) insertReady(child, cursor + 1);
    }
  }
  return assignments;
}

export function treeStageAssignments(tree: TreeDefinitionV2): Map<string, StageAssignment> {
  return propagateStageAssignments(tree.nodes.map((node) => {
    const stage = stageForNode(tree, node);
    return {
      id: node.id,
      stageId: stage?.id ?? (typeof node.layout?.stage === 'number' ? `legacy-stage-${node.layout.stage}` : undefined),
      stageOrder: stage?.order ?? node.layout?.stage,
    };
  }), tree.edges.filter((edge) => edge.type === 'required'));
}

export interface StageBand {
  stageId: string;
  left: number;
  right: number;
  label: string;
  color: string;
  progress: string;
  completed: number;
  total: number;
  complete: boolean;
}

export function stageBandAtX(bands: readonly StageBand[], x: number): StageBand | undefined {
  const containing = bands.find((band) => x >= band.left && x <= band.right);
  if (containing) return containing;
  return bands.reduce<StageBand | undefined>((closest, band) => {
    if (!closest) return band;
    const distance = (candidate: StageBand) => x < candidate.left
      ? candidate.left - x
      : x > candidate.right ? x - candidate.right : 0;
    return distance(band) < distance(closest) ? band : closest;
  }, undefined);
}

/**
 * Stage geometry comes from the layout's rank boundaries. This is deliberately
 * not inferred from each stage's node bounding box: YART defines era
 * boundaries while assigning columns, then the renderer paints those regions.
 */
export function computeStageBands(
  layout: LayoutResult,
  tree: TreeDefinitionV2,
  progress: ProgressV2,
  language: Language,
): StageBand[] {
  if (!layout.stageBoundaries.length || !layout.nodes.length) return [];
  const realNodes = layout.nodes.filter((node) => node.kind === 'real');
  if (!realNodes.length) return [];
  const counts = new Map<string, { completed: number; total: number }>();
  // Stage identity is tree-wide. A page view may show only part of an era, but
  // it must not turn that era green merely because its hidden nodes are absent.
  // Count canonical business nodes rather than proxies or view-local nodes.
  const assignments = treeStageAssignments(tree);
  for (const node of tree.nodes) {
    const stageId = assignments.get(node.id)?.id;
    if (!stageId || node.kind === 'optional') continue;
    const count = counts.get(stageId) ?? { completed: 0, total: 0 };
    count.total++;
    if (progress.completed[node.id]) count.completed++;
    counts.set(stageId, count);
  }

  return layout.stageBoundaries.map((boundary) => {
    const stage = tree.stages?.find((entry) => entry.id === boundary.stageId);
    const count = counts.get(boundary.stageId) ?? { completed: 0, total: 0 };
    const color = stageColor(tree, { stageId: boundary.stageId, stageOrder: boundary.stageOrder });
    const fallback = language === 'en' ? `Stage ${boundary.stageOrder + 1}` : `阶段 ${boundary.stageOrder + 1}`;
    return {
      stageId: boundary.stageId,
      left: boundary.left,
      right: boundary.right,
      label: stage ? language === 'en' ? stage.titleEn || stage.title : stage.title : fallback,
      color,
      progress: count.total ? `${count.completed}/${count.total}` : '—',
      completed: count.completed,
      total: count.total,
      complete: count.total > 0 && count.completed === count.total,
    };
  });
}
