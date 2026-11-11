import {
  TREE_FORMAT,
  type EdgeType,
  type NormalizationResult,
  type TreeDefinitionV2,
  type TreeEdge,
  type TreeNode,
  type TreeResource,
  type TreeTab,
} from './types';

type UnknownRecord = Record<string, unknown>;

const asRecord = (value: unknown): UnknownRecord =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as UnknownRecord) : {};

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const text = (value: unknown, fallback = ''): string => (typeof value === 'string' ? value : fallback);
const number = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;
const stringList = (value: unknown): string[] =>
  asArray(value).filter((entry): entry is string => typeof entry === 'string');

const edgeId = (type: EdgeType, source: string, target: string, index: number): string => {
  const input = `${type}\u0000${source}\u0000${target}\u0000${index}`;
  let hash = 2166136261;
  for (let cursor = 0; cursor < input.length; cursor += 1) {
    hash ^= input.charCodeAt(cursor);
    hash = Math.imul(hash, 16777619);
  }
  return `edge-${type}-${(hash >>> 0).toString(36)}`;
};

function normalizeV2(input: UnknownRecord): TreeDefinitionV2 {
  const tabs: TreeTab[] = asArray(input.tabs).map((raw, index) => {
    const tab = asRecord(raw);
    return {
      id: text(tab.id, `tab-${index + 1}`),
      label: text(tab.label, text(tab.id, `Tab ${index + 1}`)),
      labelEn: text(tab.labelEn) || undefined,
      color: text(tab.color) || undefined,
      order: number(tab.order),
      description: text(tab.description) || undefined,
    };
  });

  const resources: TreeResource[] = asArray(input.resources).map((raw, index) => {
    const resource = asRecord(raw);
    return {
      id: text(resource.id, `resource-${index + 1}`),
      title: text(resource.title, text(resource.id, `Resource ${index + 1}`)),
      url: text(resource.url) || undefined,
      scope: text(resource.scope) || undefined,
    };
  });

  const nodes: TreeNode[] = asArray(input.nodes).map((raw, index) => {
    const node = asRecord(raw);
    const layout = asRecord(node.layout);
    const kind = text(node.kind);
    return {
      id: text(node.id, `node-${index + 1}`),
      title: text(node.title, text(node.name, text(node.id, `Node ${index + 1}`))),
      tabId: text(node.tabId, text(node.branch)),
      kind: kind === 'optional' || kind === 'milestone' ? kind : 'topic',
      summary: text(node.summary, text(node.description)) || undefined,
      outcome: text(node.outcome) || undefined,
      caution: text(node.caution) || undefined,
      tags: stringList(node.tags),
      resourceIds: stringList(node.resourceIds),
      layout: {
        groupId: text(layout.groupId) || undefined,
        order: number(layout.order),
        stage: number(layout.stage),
      },
    };
  });

  const edges: TreeEdge[] = asArray(input.edges).map((raw, index) => {
    const edge = asRecord(raw);
    const typeValue = text(edge.type);
    const type: EdgeType = typeValue === 'recommended' || typeValue === 'related' ? typeValue : 'required';
    const source = text(edge.source);
    const target = text(edge.target);
    return {
      id: text(edge.id, edgeId(type, source, target, index)),
      source,
      target,
      type,
      label: text(edge.label) || undefined,
      reason: text(edge.reason) || undefined,
    };
  });

  return {
    format: TREE_FORMAT,
    id: text(input.id, 'untitled-tree'),
    title: text(input.title, 'Untitled tree'),
    subtitle: text(input.subtitle) || undefined,
    description: text(input.description) || undefined,
    version: text(input.version) || undefined,
    language: text(input.language) || undefined,
    tabs,
    resources,
    nodes,
    edges: dedupeEdges(edges),
  };
}

function migrateV1(input: UnknownRecord): TreeDefinitionV2 {
  const branches = asArray(input.branches);
  const tabs: TreeTab[] = branches.map((raw, index) => {
    const branch = asRecord(raw);
    return {
      id: text(branch.id, `tab-${index + 1}`),
      label: text(branch.label, text(branch.id, `Tab ${index + 1}`)),
      labelEn: text(branch.en) || undefined,
      color: text(branch.color) || undefined,
      order: index,
    };
  });

  const resources: TreeResource[] = asArray(input.sources).map((raw, index) => {
    const source = asRecord(raw);
    return {
      id: text(source.id, `resource-${index + 1}`),
      title: text(source.title, text(source.id, `Resource ${index + 1}`)),
      url: text(source.url) || undefined,
      scope: text(source.scope) || undefined,
    };
  });

  const rawNodes = asArray(input.nodes);
  const nodes: TreeNode[] = rawNodes.map((raw, index) => {
    const node = asRecord(raw);
    const id = text(node.id, `node-${index + 1}`);
    const oldKind = text(node.kind);
    const startId = text(input.startId);
    const endId = text(input.endId);
    return {
      id,
      title: text(node.name, id),
      tabId: text(node.branch, tabs[0]?.id ?? 'main'),
      kind: oldKind === 'milestone' || id === startId || id === endId ? 'milestone' : oldKind === 'optional' ? 'optional' : 'topic',
      summary: text(node.description) || undefined,
      outcome: text(node.outcome) || undefined,
      caution: text(node.caution) || undefined,
      resourceIds: stringList(node.sourceIds),
      tags: [],
      layout: { stage: number(node.stage) },
    };
  });

  const edges: TreeEdge[] = [];
  rawNodes.forEach((raw, nodeIndex) => {
    const node = asRecord(raw);
    const target = text(node.id, `node-${nodeIndex + 1}`);
    stringList(node.prereqIds).forEach((source, edgeIndex) => {
      edges.push({ id: edgeId('required', source, target, edgeIndex), source, target, type: 'required' });
    });
    stringList(node.relatedIds).forEach((other, edgeIndex) => {
      const source = target.localeCompare(other) <= 0 ? target : other;
      const relatedTarget = source === target ? other : target;
      edges.push({ id: edgeId('related', source, relatedTarget, edgeIndex), source, target: relatedTarget, type: 'related' });
    });
  });

  asArray(input.applicationEdges).forEach((raw, index) => {
    const oldEdge = asRecord(raw);
    const source = text(oldEdge.source);
    const target = text(oldEdge.target);
    edges.push({
      id: edgeId('recommended', source, target, index),
      source,
      target,
      type: 'recommended',
      label: text(oldEdge.relation) || undefined,
      reason: text(oldEdge.reason) || undefined,
    });
  });

  return {
    format: TREE_FORMAT,
    id: text(input.id, 'migrated-tree'),
    title: text(input.title, 'Migrated tree'),
    subtitle: text(input.subtitle) || undefined,
    description: text(input.description) || undefined,
    version: text(input.version) || undefined,
    language: text(input.language) || undefined,
    tabs,
    resources,
    nodes,
    edges: dedupeEdges(edges),
  };
}

function dedupeEdges(edges: TreeEdge[]): TreeEdge[] {
  const seen = new Set<string>();
  return edges.filter((edge) => {
    const key = `${edge.type}:${edge.source}:${edge.target}`;
    if (!edge.source || !edge.target || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function normalizeTree(input: unknown): NormalizationResult {
  const record = asRecord(input);
  if (record.format === TREE_FORMAT) {
    return { tree: normalizeV2(record), warnings: [] };
  }
  if (record.format === 'learning-tech-tree/v1') {
    return {
      tree: migrateV1(record),
      migratedFrom: 'learning-tech-tree/v1',
      warnings: ['This tree was converted from learning-tech-tree/v1 in memory.'],
    };
  }
  throw new Error('Unsupported tree format. Expected loregrid/tree-v2 or learning-tech-tree/v1.');
}
