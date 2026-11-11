import { PROGRESS_FORMAT, type GraphKey, type ProgressV2, type TreeDefinitionV2 } from './types';
import { requiredAncestors } from './graph';

const noteLimit = 12_000;
const keyFor = (treeId: string): string => `loregrid:progress:${treeId}`;
const legacyKeyFor = (treeId: string): string => `learning-tech-tree:progress:${treeId}`;

export function emptyProgress(treeId: string): ProgressV2 {
  return { format: PROGRESS_FORMAT, treeId, completed: {}, notes: {} };
}

export function parseProgress(value: unknown, tree: TreeDefinitionV2): ProgressV2 {
  const raw = typeof value === 'string' ? (JSON.parse(value) as unknown) : value;
  if (!raw || typeof raw !== 'object') throw new Error('Invalid progress file.');
  const record = raw as Record<string, unknown>;
  const format = record.format;
  if (format !== PROGRESS_FORMAT && format !== 'learning-tech-progress/v1') throw new Error('Unsupported progress format.');
  if (record.treeId !== tree.id) throw new Error('This progress file belongs to a different tree.');
  const ids = new Set(tree.nodes.map((node) => node.id));
  const completed: Record<string, true> = {};
  const notes: Record<string, string> = {};
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
  const rawUi = record.ui && typeof record.ui === 'object' ? (record.ui as Record<string, unknown>) : {};
  const language = rawUi.language === 'en' || rawUi.language === 'zh-CN' ? rawUi.language : undefined;
  const lastGraphKey = typeof rawUi.lastGraphKey === 'string' ? (rawUi.lastGraphKey as GraphKey) : undefined;
  return { format: PROGRESS_FORMAT, treeId: tree.id, completed, notes, ui: { language, lastGraphKey } };
}

export function loadProgress(tree: TreeDefinitionV2, storage?: Storage): { progress: ProgressV2; migrated: boolean } {
  try {
    const target = storage ?? globalThis.localStorage;
    const current = target.getItem(keyFor(tree.id));
    if (current) return { progress: parseProgress(current, tree), migrated: false };
    const legacy = target.getItem(legacyKeyFor(tree.id));
    if (legacy) return { progress: parseProgress(legacy, tree), migrated: true };
  } catch {
    return { progress: emptyProgress(tree.id), migrated: false };
  }
  return { progress: emptyProgress(tree.id), migrated: false };
}

export function saveProgress(progress: ProgressV2, storage?: Storage): void {
  const target = storage ?? globalThis.localStorage;
  target.setItem(keyFor(progress.treeId), JSON.stringify(progress));
}

export function completeNode(progress: ProgressV2, nodeId: string, done: boolean): ProgressV2 {
  const completed = { ...progress.completed };
  if (done) completed[nodeId] = true;
  else delete completed[nodeId];
  return { ...progress, completed };
}

export function completeWithPrerequisites(progress: ProgressV2, tree: TreeDefinitionV2, nodeId: string): ProgressV2 {
  const completed = { ...progress.completed };
  requiredAncestors(tree, nodeId).forEach((id) => { completed[id] = true; });
  completed[nodeId] = true;
  return { ...progress, completed };
}

export function missingPrerequisites(progress: ProgressV2, tree: TreeDefinitionV2, nodeId: string): string[] {
  return requiredAncestors(tree, nodeId).filter((id) => !progress.completed[id]);
}

export function inconsistentCompleted(progress: ProgressV2, tree: TreeDefinitionV2): Set<string> {
  const result = new Set<string>();
  Object.keys(progress.completed).forEach((id) => {
    if (missingPrerequisites(progress, tree, id).length > 0) result.add(id);
  });
  return result;
}

export function statusOf(progress: ProgressV2, tree: TreeDefinitionV2, nodeId: string): 'completed' | 'ready' | 'locked' {
  if (progress.completed[nodeId]) return 'completed';
  return missingPrerequisites(progress, tree, nodeId).length === 0 ? 'ready' : 'locked';
}
