import { PROGRESS_FORMAT, type GraphKey, type PagePreset, type ProgressV2, type TreeDefinitionV2 } from './types';
import { requiredAncestors, tabKey } from './graph';

const noteLimit = 12_000;
const keyFor = (treeId: string): string => `loregrid:progress:${treeId}`;
const entryKeyFor = (treeId: string, entryKey: string): string =>
  `loregrid:progress-entry:${encodeURIComponent(entryKey)}:${treeId}`;
const legacyKeyFor = (treeId: string): string => `learning-tech-tree:progress:${treeId}`;

export function emptyProgress(treeId: string): ProgressV2 {
  return { format: PROGRESS_FORMAT, treeId, completed: Object.create(null), notes: Object.create(null), queue: [] };
}

export function parseProgress(value: unknown, tree: TreeDefinitionV2): ProgressV2 {
  const raw = typeof value === 'string' ? (JSON.parse(value) as unknown) : value;
  if (!raw || typeof raw !== 'object') throw new Error('Invalid progress file.');
  const record = raw as Record<string, unknown>;
  const format = record.format;
  if (format !== PROGRESS_FORMAT && format !== 'learning-tech-progress/v1') throw new Error('Unsupported progress format.');
  if (record.treeId !== tree.id) throw new Error('This progress file belongs to a different tree.');
  const ids = new Set(tree.nodes.map((node) => node.id));
  const completed: Record<string, true> = Object.create(null);
  const notes: Record<string, string> = Object.create(null);
  if (record.completed && typeof record.completed === 'object' && !Array.isArray(record.completed)) {
    Object.entries(record.completed as Record<string, unknown>).forEach(([id, done]) => {
      if (ids.has(id) && done === true) completed[id] = true;
    });
  }
  if (record.notes && typeof record.notes === 'object' && !Array.isArray(record.notes)) {
    Object.entries(record.notes as Record<string, unknown>).forEach(([id, note]) => {
      if (ids.has(id) && typeof note === 'string') notes[id] = note.slice(0, noteLimit);
    });
  }
  const queue = Array.isArray(record.queue)
    ? [...new Set(record.queue.filter((id): id is string => typeof id === 'string' && ids.has(id) && !completed[id]))]
    : [];
  const rawUi = record.ui && typeof record.ui === 'object' ? (record.ui as Record<string, unknown>) : {};
  const language = rawUi.language === 'en' || rawUi.language === 'zh-CN' ? rawUi.language : undefined;
  const presets: PagePreset[] = [];
  const tabIds = new Set(tree.tabs.map((tab) => tab.id));
  if (Array.isArray(rawUi.presets)) {
    for (const value of rawUi.presets) {
      if (!value || typeof value !== 'object') continue;
      const entry = value as Record<string, unknown>;
      if (typeof entry.id !== 'string' || !/^[\w-]{1,100}$/.test(entry.id) || presets.some((preset) => preset.id === entry.id)) continue;
      if (typeof entry.name !== 'string' || !entry.name.trim() || !Array.isArray(entry.tabIds)) continue;
      const selected = [...new Set(entry.tabIds.filter((id): id is string => typeof id === 'string' && tabIds.has(id)))];
      if (selected.length) presets.push({ id: entry.id, name: entry.name.trim().slice(0, 120), tabIds: selected });
    }
  }
  const normalizeGraphKey = (value: unknown): GraphKey | undefined => {
    if (typeof value !== 'string') return undefined;
    if (value === 'all') return value;
    if (value.startsWith('preset:')) return presets.some((preset) => value === `preset:${preset.id}`) ? value as GraphKey : undefined;
    if (value.startsWith('tab:')) {
      try {
        const id = decodeURIComponent(value.slice(4));
        return tabIds.has(id) ? tabKey(id) : undefined;
      } catch { return undefined; }
    }
    if (value.startsWith('page:')) {
      const [, , encodedTab] = value.split(':');
      if (!encodedTab) return undefined;
      try {
        const id = decodeURIComponent(encodedTab);
        return tabIds.has(id) ? tabKey(id) : undefined;
      } catch { return undefined; }
    }
    return undefined;
  };
  const lastGraphKey = normalizeGraphKey(rawUi.lastGraphKey);
  const lastPageKey = normalizeGraphKey(rawUi.lastPageKey);
  const favorites = Array.isArray(rawUi.favorites)
    ? [...new Set(rawUi.favorites.map(normalizeGraphKey).filter((key): key is GraphKey => Boolean(key && key !== 'all')))]
    : [];
  const updatedAt = typeof record.updatedAt === 'string' && Number.isFinite(Date.parse(record.updatedAt))
    ? record.updatedAt
    : undefined;
  return {
    format: PROGRESS_FORMAT, treeId: tree.id, completed, notes, queue: orderQueue(queue, tree),
    updatedAt, ui: { language, lastGraphKey, lastPageKey, presets, favorites },
  };
}

export function isProgressNewer(candidate: ProgressV2, current: ProgressV2): boolean {
  const candidateTime = candidate.updatedAt ? Date.parse(candidate.updatedAt) : Number.NaN;
  const currentTime = current.updatedAt ? Date.parse(current.updatedAt) : Number.NaN;
  if (!Number.isFinite(candidateTime)) return false;
  return !Number.isFinite(currentTime) || candidateTime > currentTime;
}

export function loadProgress(
  tree: TreeDefinitionV2,
  storage?: Storage,
  entryKey?: string,
  allowLegacyFallback = true,
): { progress: ProgressV2; migrated: boolean; saveBlocked?: boolean } {
  try {
    const target = storage ?? globalThis.localStorage;
    const scopedKey = entryKey ? entryKeyFor(tree.id, entryKey) : keyFor(tree.id);
    const scoped = target.getItem(scopedKey);
    if (scoped) return { progress: parseProgress(scoped, tree), migrated: false };
    if (entryKey && !allowLegacyFallback) return { progress: emptyProgress(tree.id), migrated: false };
    const current = target.getItem(keyFor(tree.id));
    if (current) {
      const progress = parseProgress(current, tree);
      if (entryKey) target.setItem(scopedKey, JSON.stringify(progress));
      return { progress, migrated: Boolean(entryKey) };
    }
    const legacy = target.getItem(legacyKeyFor(tree.id));
    if (legacy) {
      const progress = parseProgress(legacy, tree);
      if (entryKey) target.setItem(scopedKey, JSON.stringify(progress));
      return { progress, migrated: true };
    }
  } catch {
    // Preserve unreadable or inaccessible stored data until the user restores a valid backup.
    return { progress: emptyProgress(tree.id), migrated: false, saveBlocked: true };
  }
  return { progress: emptyProgress(tree.id), migrated: false };
}

export function saveProgress(progress: ProgressV2, storage?: Storage, entryKey?: string): void {
  const target = storage ?? globalThis.localStorage;
  target.setItem(entryKey ? entryKeyFor(progress.treeId, entryKey) : keyFor(progress.treeId), JSON.stringify(progress));
}

export function restoreStoredProgress(progress: ProgressV2, storage?: Storage, entryKey?: string): void {
  const target = storage ?? globalThis.localStorage;
  const key = entryKey ? entryKeyFor(progress.treeId, entryKey) : keyFor(progress.treeId);
  const previous = target.getItem(key);
  // Write the recovery copy first. If storage is full, leave the existing record intact.
  if (previous !== null) target.setItem(`${key}:before-restore`, previous);
  target.setItem(key, JSON.stringify(progress));
}

export function completeNode(progress: ProgressV2, nodeId: string, done: boolean): ProgressV2 {
  const completed: Record<string, true> = Object.assign(Object.create(null), progress.completed);
  if (done) completed[nodeId] = true;
  else delete completed[nodeId];
  return { ...progress, completed, queue: done ? progress.queue.filter((id) => id !== nodeId) : progress.queue };
}

export function queueNode(progress: ProgressV2, nodeId: string): ProgressV2 {
  if (progress.completed[nodeId] || progress.queue.includes(nodeId)) return progress;
  return { ...progress, queue: [...progress.queue, nodeId] };
}

export function clearLearningQueue(progress: ProgressV2): ProgressV2 {
  return progress.queue.length ? { ...progress, queue: [] } : progress;
}

export function queueWithPrerequisites(progress: ProgressV2, tree: TreeDefinitionV2, nodeId: string, placement: 'back' | 'front' | 'replace' = 'back'): ProgressV2 {
  if (!tree.nodes.some((node) => node.id === nodeId) || progress.completed[nodeId]) return progress;
  const chain = [...requiredAncestors(tree, nodeId), nodeId].filter((id) => !progress.completed[id]);
  if (placement !== 'back') {
    const chainIds = new Set(chain);
    const tail = placement === 'replace' ? [] : progress.queue.filter((id) => !chainIds.has(id));
    return { ...progress, queue: orderQueue([...chain, ...tail], tree) };
  }
  const queue = [...progress.queue];
  const included = new Set(queue);
  for (const id of chain) {
    if (!included.has(id)) {
      queue.push(id);
      included.add(id);
    }
  }
  return { ...progress, queue: orderQueue(queue, tree) };
}

// YART ResearchQueueManager.DoRemove: remove queued dependents of an unfinished item.
// Completed intermediates stop the missing-prerequisite walk.
export function unqueueNode(progress: ProgressV2, tree: TreeDefinitionV2, nodeId: string): ProgressV2 {
  const removed = new Set([nodeId]);
  if (!progress.completed[nodeId]) {
    const outgoing = new Map<string, string[]>();
    for (const edge of tree.edges) {
      if (edge.type !== 'required') continue;
      const targets = outgoing.get(edge.source) ?? [];
      targets.push(edge.target);
      outgoing.set(edge.source, targets);
    }
    const pending = [nodeId];
    for (let index = 0; index < pending.length; index++) {
      for (const target of outgoing.get(pending[index]!) ?? []) {
        if (removed.has(target) || progress.completed[target]) continue;
        removed.add(target);
        pending.push(target);
      }
    }
  }
  return { ...progress, queue: progress.queue.filter((id) => !removed.has(id)) };
}

export function moveQueuedNode(progress: ProgressV2, tree: TreeDefinitionV2, nodeId: string, direction: -1 | 1): ProgressV2 {
  const index = progress.queue.indexOf(nodeId);
  return reorderQueue(progress, tree, nodeId, index + direction);
}

export function reorderQueue(progress: ProgressV2, tree: TreeDefinitionV2, nodeId: string, target: number): ProgressV2 {
  const index = progress.queue.indexOf(nodeId);
  if (index < 0 || target < 0 || target >= progress.queue.length) return progress;
  const queue = [...progress.queue];
  queue.splice(index, 1);
  queue.splice(target, 0, nodeId);
  return { ...progress, queue: orderQueue(queue, tree) };
}

/** YART EnsureTopologicalOrder, using an explicit stack for arbitrarily deep trees. */
function orderQueue(queue: readonly string[], tree: TreeDefinitionV2): string[] {
  const included = new Set(queue);
  const incoming = new Map<string, string[]>();
  for (const edge of tree.edges) {
    if (edge.type !== 'required' || !included.has(edge.source) || !included.has(edge.target)) continue;
    const sources = incoming.get(edge.target) ?? [];
    sources.push(edge.source);
    incoming.set(edge.target, sources);
  }
  const visited = new Set<string>();
  const ordered: string[] = [];
  for (const root of queue) {
    const stack: Array<{ id: string; exit: boolean }> = [{ id: root, exit: false }];
    while (stack.length) {
      const entry = stack.pop()!;
      if (entry.exit) { ordered.push(entry.id); continue; }
      if (visited.has(entry.id)) continue;
      visited.add(entry.id);
      stack.push({ id: entry.id, exit: true });
      const prerequisites = incoming.get(entry.id) ?? [];
      for (let index = prerequisites.length - 1; index >= 0; index--) {
        stack.push({ id: prerequisites[index]!, exit: false });
      }
    }
  }
  return ordered;
}

export function completeWithPrerequisites(progress: ProgressV2, tree: TreeDefinitionV2, nodeId: string): ProgressV2 {
  const completed: Record<string, true> = Object.assign(Object.create(null), progress.completed);
  requiredAncestors(tree, nodeId).forEach((id) => { completed[id] = true; });
  completed[nodeId] = true;
  return { ...progress, completed, queue: progress.queue.filter((id) => !completed[id]) };
}

export function missingPrerequisites(progress: ProgressV2, tree: TreeDefinitionV2, nodeId: string): string[] {
  return requiredAncestors(tree, nodeId).filter((id) => !progress.completed[id]);
}

export function inconsistentCompleted(progress: ProgressV2, tree: TreeDefinitionV2): Set<string> {
  statusesFor(progress, tree);
  return new Set(inconsistencyCache.get(progress)?.get(tree) ?? []);
}

export function statusOf(progress: ProgressV2, tree: TreeDefinitionV2, nodeId: string): 'completed' | 'ready' | 'locked' {
  return statusesFor(progress, tree).get(nodeId) ?? 'locked';
}

type NodeStatus = 'completed' | 'ready' | 'locked';
const statusCache = new WeakMap<ProgressV2, WeakMap<TreeDefinitionV2, Map<string, NodeStatus>>>();
const inconsistencyCache = new WeakMap<ProgressV2, WeakMap<TreeDefinitionV2, Set<string>>>();

// Completion updates replace the progress object. Notes/UI changes do not affect gating.
function statusesFor(progress: ProgressV2, tree: TreeDefinitionV2): Map<string, NodeStatus> {
  let byTree = statusCache.get(progress);
  const cached = byTree?.get(tree);
  if (cached) return cached;
  const outgoing = new Map(tree.nodes.map((node) => [node.id, [] as string[]]));
  const pending = new Map(tree.nodes.map((node) => [node.id, 0]));
  const blocked = new Set<string>();
  for (const edge of tree.edges) {
    if (edge.type !== 'required') continue;
    outgoing.get(edge.source)?.push(edge.target);
    pending.set(edge.target, (pending.get(edge.target) ?? 0) + 1);
  }
  const queue = tree.nodes.filter((node) => !pending.get(node.id)).map((node) => node.id);
  const result = new Map<string, NodeStatus>();
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const id = queue[cursor]!;
    result.set(id, progress.completed[id] ? 'completed' : blocked.has(id) ? 'locked' : 'ready');
    for (const target of outgoing.get(id) ?? []) {
      if (!progress.completed[id] || blocked.has(id)) blocked.add(target);
      const count = (pending.get(target) ?? 1) - 1;
      pending.set(target, count);
      if (count === 0) queue.push(target);
    }
  }
  if (!byTree) { byTree = new WeakMap(); statusCache.set(progress, byTree); }
  byTree.set(tree, result);
  let inconsistentByTree = inconsistencyCache.get(progress);
  if (!inconsistentByTree) { inconsistentByTree = new WeakMap(); inconsistencyCache.set(progress, inconsistentByTree); }
  inconsistentByTree.set(tree, new Set([...blocked].filter((id) => progress.completed[id])));
  return result;
}
