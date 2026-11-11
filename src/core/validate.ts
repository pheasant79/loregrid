import type { TreeDefinitionV2, ValidationIssue } from './types';

const ID_PATTERN = /^[A-Za-z][A-Za-z0-9_-]{0,95}$/;
const SAFE_URL_PATTERN = /^https?:\/\//i;
const MAX_TITLE = 500;
const MAX_TEXT = 10_000;

export function validateTree(tree: TreeDefinitionV2): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const error = (code: string, message: string, path?: string): void => {
    issues.push({ severity: 'error', code, message, path });
  };
  const warning = (code: string, message: string, path?: string): void => {
    issues.push({ severity: 'warning', code, message, path });
  };

  if (!ID_PATTERN.test(tree.id)) error('tree.id', 'Tree ID is invalid.', 'id');
  if (!tree.title.trim()) error('tree.title', 'Tree title is required.', 'title');
  if (tree.title.length > MAX_TITLE) error('tree.title.length', `Tree title exceeds ${MAX_TITLE} characters.`, 'title');
  if ((tree.description?.length ?? 0) > MAX_TEXT) error('tree.description.length', `Tree description exceeds ${MAX_TEXT} characters.`, 'description');
  if (tree.tabs.length === 0) error('tabs.empty', 'At least one tab is required.', 'tabs');
  if (tree.nodes.length === 0) error('nodes.empty', 'At least one node is required.', 'nodes');

  const tabIds = uniqueIds(tree.tabs, 'tabs', error);
  const resourceIds = uniqueIds(tree.resources, 'resources', error);
  const nodeIds = uniqueIds(tree.nodes, 'nodes', error);
  uniqueIds(tree.edges, 'edges', error);

  tree.tabs.forEach((tab, index) => {
    if (!tab.label.trim()) error('tab.label', 'Tab label is required.', `tabs[${index}].label`);
    if (tab.label.length > MAX_TITLE) error('tab.label.length', `Tab label exceeds ${MAX_TITLE} characters.`, `tabs[${index}].label`);
    if ((tab.description?.length ?? 0) > MAX_TEXT) error('tab.description.length', `Tab description exceeds ${MAX_TEXT} characters.`, `tabs[${index}].description`);
    if (tab.color && !/^#[0-9a-f]{6}$/i.test(tab.color)) {
      error('tab.color', 'Tab color must be a six-digit hex color.', `tabs[${index}].color`);
    }
  });

  tree.resources.forEach((resource, index) => {
    if (resource.url && !SAFE_URL_PATTERN.test(resource.url)) {
      error('resource.url', 'Only HTTP(S) resource URLs are allowed.', `resources[${index}].url`);
    }
    if (resource.title.length > MAX_TITLE) error('resource.title.length', `Resource title exceeds ${MAX_TITLE} characters.`, `resources[${index}].title`);
    if ((resource.scope?.length ?? 0) > MAX_TEXT) error('resource.scope.length', `Resource scope exceeds ${MAX_TEXT} characters.`, `resources[${index}].scope`);
    if (!resourceIds.has(resource.id)) return;
  });

  tree.nodes.forEach((node, index) => {
    if (!node.title.trim()) error('node.title', 'Node title is required.', `nodes[${index}].title`);
    if (node.title.length > MAX_TITLE) error('node.title.length', `Node title exceeds ${MAX_TITLE} characters.`, `nodes[${index}].title`);
    for (const [field, value] of [['summary', node.summary], ['outcome', node.outcome], ['caution', node.caution]] as const) {
      if ((value?.length ?? 0) > MAX_TEXT) error(`node.${field}.length`, `Node ${field} exceeds ${MAX_TEXT} characters.`, `nodes[${index}].${field}`);
    }
    node.tags?.forEach((tag, tagIndex) => {
      if (tag.length > 100) error('node.tag.length', 'Node tag exceeds 100 characters.', `nodes[${index}].tags[${tagIndex}]`);
    });
    if (!tabIds.has(node.tabId)) error('node.tab', `Unknown tab ${node.tabId}.`, `nodes[${index}].tabId`);
    node.resourceIds?.forEach((resourceId) => {
      if (!resourceIds.has(resourceId)) {
        error('node.resource', `Unknown resource ${resourceId}.`, `nodes[${index}].resourceIds`);
      }
    });
  });

  tree.edges.forEach((edge, index) => {
    if (!nodeIds.has(edge.source)) error('edge.source', `Unknown source ${edge.source}.`, `edges[${index}].source`);
    if (!nodeIds.has(edge.target)) error('edge.target', `Unknown target ${edge.target}.`, `edges[${index}].target`);
    if (edge.source === edge.target) error('edge.self', 'Self edges are not allowed.', `edges[${index}]`);
    if ((edge.label?.length ?? 0) > 500) error('edge.label.length', 'Edge label exceeds 500 characters.', `edges[${index}].label`);
    if ((edge.reason?.length ?? 0) > MAX_TEXT) error('edge.reason.length', `Edge reason exceeds ${MAX_TEXT} characters.`, `edges[${index}].reason`);
  });

  const cycle = findRequiredCycle(tree);
  if (cycle.length > 0) error('required.cycle', `Required edges contain a cycle: ${cycle.join(' -> ')}.`);

  if (tree.nodes.length > 10_000) {
    warning('nodes.large', 'This tree exceeds the 10,000-node performance target; it remains valid.');
  }

  return issues;
}

function uniqueIds<T extends { id: string }>(
  items: T[],
  path: string,
  error: (code: string, message: string, path?: string) => void,
): Set<string> {
  const ids = new Set<string>();
  items.forEach((item, index) => {
    if (!ID_PATTERN.test(item.id)) error(`${path}.id`, `Invalid ID ${item.id}.`, `${path}[${index}].id`);
    if (ids.has(item.id)) error(`${path}.duplicate`, `Duplicate ID ${item.id}.`, `${path}[${index}].id`);
    ids.add(item.id);
  });
  return ids;
}

export function findRequiredCycle(tree: TreeDefinitionV2): string[] {
  const adjacency = new Map<string, string[]>();
  tree.nodes.forEach((node) => adjacency.set(node.id, []));
  tree.edges.filter((edge) => edge.type === 'required').forEach((edge) => adjacency.get(edge.source)?.push(edge.target));

  const state = new Map<string, 0 | 1 | 2>();
  const stack: string[] = [];
  let result: string[] = [];

  const visit = (id: string): boolean => {
    state.set(id, 1);
    stack.push(id);
    for (const next of adjacency.get(id) ?? []) {
      if (state.get(next) === 1) {
        const start = stack.indexOf(next);
        result = [...stack.slice(start), next];
        return true;
      }
      if (!state.get(next) && visit(next)) return true;
    }
    stack.pop();
    state.set(id, 2);
    return false;
  };

  for (const node of tree.nodes) {
    if (!state.get(node.id) && visit(node.id)) break;
  }
  return result;
}

export function assertValidTree(tree: TreeDefinitionV2): ValidationIssue[] {
  const issues = validateTree(tree);
  const errors = issues.filter((issue) => issue.severity === 'error');
  if (errors.length > 0) throw new Error(errors.slice(0, 8).map((issue) => issue.message).join('\n'));
  return issues;
}
