import { describe, expect, it } from 'vitest';
import {
  completeNode,
  completeWithPrerequisites,
  clearLearningQueue,
  emptyProgress,
  inconsistentCompleted,
  isProgressNewer,
  missingPrerequisites,
  moveQueuedNode,
  parseProgress,
  queueNode,
  queueWithPrerequisites,
  loadProgress,
  restoreStoredProgress,
  statusOf,
  unqueueNode,
} from '../src/core/progress';
import { makeTree } from './fixtures';

describe('progress v2', () => {
  it('keeps the newer browser or folder progress copy by timestamp', () => {
    const tree = makeTree();
    const base = { format: 'loregrid/progress-v2' as const, treeId: tree.id, completed: {}, notes: {}, queue: [] };
    const older = parseProgress({ ...base, updatedAt: '2026-11-19T10:00:00.000Z' }, tree);
    const newer = parseProgress({ ...base, updatedAt: '2026-11-19T11:00:00.000Z' }, tree);
    const legacy = parseProgress(base, tree);

    expect(isProgressNewer(newer, older)).toBe(true);
    expect(isProgressNewer(older, newer)).toBe(false);
    expect(isProgressNewer(newer, legacy)).toBe(true);
    expect(isProgressNewer(legacy, newer)).toBe(false);
  });

  it('upgrades legacy progress and removes unknown entries', () => {
    const tree = makeTree();
    const progress = parseProgress({
      format: 'learning-tech-progress/v1',
      treeId: tree.id,
      completed: { a: true, missing: true, b: false },
      notes: { a: 'kept', missing: 'removed' },
    }, tree);
    expect(progress.format).toBe('loregrid/progress-v2');
    expect(progress.completed).toEqual({ a: true });
    expect(progress.notes).toEqual({ a: 'kept' });
  });

  it('migrates saved path-page views to flat pages and keeps private presets', () => {
    const tree = makeTree();
    const progress = parseProgress({
      format: 'loregrid/progress-v2', treeId: tree.id, completed: {}, notes: {}, queue: [],
      ui: {
        lastGraphKey: 'page:field-path:alpha',
        presets: [{ id: 'focus-set', name: 'Focus set', tabIds: ['alpha'] }],
        favorites: ['tab:alpha', 'page:field-path:alpha', 'page:other:alpha', 'preset:focus-set', 'preset:missing', 'all'],
      },
    }, tree);
    expect(progress.ui?.favorites).toEqual(['tab:alpha', 'preset:focus-set']);
    expect(progress.ui?.lastGraphKey).toBe('tab:alpha');
  });

  it('completes all required ancestors and reports inconsistent manual completion', () => {
    const tree = makeTree();
    const empty = emptyProgress(tree.id);
    expect(statusOf(empty, tree, 'a')).toBe('ready');
    expect(statusOf(empty, tree, 'd')).toBe('locked');
    expect(missingPrerequisites(empty, tree, 'd')).toEqual(['a', 'b', 'c']);

    const manual = completeNode(empty, 'd', true);
    expect([...inconsistentCompleted(manual, tree)]).toEqual(['d']);

    const complete = completeWithPrerequisites(empty, tree, 'd');
    expect(Object.keys(complete.completed).sort()).toEqual(['a', 'b', 'c', 'd']);
    expect(inconsistentCompleted(complete, tree).size).toBe(0);
  });

  it('keeps a sanitized, ordered learning queue in private progress', () => {
    const tree = makeTree();
    const queued = queueNode(queueNode(emptyProgress(tree.id), 'a'), 'd');
    const reordered = moveQueuedNode(queued, tree, 'd', -1);
    expect(reordered.queue).toEqual(['a', 'd']);
    expect(unqueueNode(reordered, tree, 'd').queue).toEqual(['a']);

    const restored = parseProgress({
      format: 'loregrid/progress-v2',
      treeId: tree.id,
      completed: {},
      notes: {},
      queue: ['d', 'missing', 'd', 5],
    }, tree);
    expect(restored.queue).toEqual(['d']);
  });

  it('removes completed topics and completed prerequisites from the queue', () => {
    const tree = makeTree();
    const queued = queueNode(queueNode(queueNode(emptyProgress(tree.id), 'a'), 'b'), 'd');
    expect(completeNode(queued, 'b', true).queue).toEqual(['a', 'd']);
    expect(completeWithPrerequisites(queued, tree, 'd').queue).toEqual([]);
    const done = completeNode(queued, 'b', true);
    expect(queueNode(done, 'b').queue).toEqual(['a', 'd']);
    expect(parseProgress({ ...done, queue: ['b', 'a', 'a'] }, tree).queue).toEqual(['a']);
  });

  it('clears only the queue while preserving completion, notes, and UI preferences', () => {
    const tree = makeTree();
    const progress = {
      ...queueNode(emptyProgress(tree.id), 'd'),
      completed: { a: true as const },
      notes: { d: 'Keep this note' },
      ui: { favorites: ['tab:alpha' as const], presets: [{ id: 'focus', name: 'Focus', tabIds: ['alpha' as const] }] },
    };
    const cleared = clearLearningQueue(progress);
    expect(cleared.queue).toEqual([]);
    expect(cleared.completed).toEqual(progress.completed);
    expect(cleared.notes).toEqual(progress.notes);
    expect(cleared.ui).toEqual(progress.ui);
    expect(clearLearningQueue(cleared)).toBe(cleared);
  });

  it('queues only missing required ancestors before the goal, preserving existing order', () => {
    const tree = makeTree();
    const progress = completeNode(emptyProgress(tree.id), 'a', true);
    expect(queueWithPrerequisites(progress, tree, 'd').queue).toEqual(['b', 'c', 'd']);
    expect(queueWithPrerequisites(queueWithPrerequisites(progress, tree, 'd'), tree, 'd').queue).toEqual(['b', 'c', 'd']);
    expect(queueWithPrerequisites(progress, tree, 'missing')).toBe(progress);
    const inconsistent = completeNode(progress, 'c', true);
    expect(statusOf(inconsistent, tree, 'd')).toBe('locked');
    expect([...inconsistentCompleted(inconsistent, tree)]).toEqual(['c']);
  });

  it('keeps required prerequisites before a queue item after reorder and removes queued dependents', () => {
    const tree = makeTree();
    const queue = queueWithPrerequisites(emptyProgress(tree.id), tree, 'd');
    expect(queue.queue).toEqual(['a', 'b', 'c', 'd']);
    const requestedMove = moveQueuedNode(queue, tree, 'd', -1);
    expect(requestedMove.queue).toEqual(['a', 'b', 'c', 'd']);
    expect(unqueueNode(queue, tree, 'b').queue).toEqual(['a']);
    const completedPrerequisite = completeNode(queue, 'b', true);
    expect(unqueueNode(completedPrerequisite, tree, 'b').queue).toEqual(['a', 'c', 'd']);
  });

  it('supports YART-style append, priority and exclusive prerequisite-chain queue actions', () => {
    const tree = makeTree();
    tree.nodes.push({ id: 'independent', title: 'Independent', tabId: 'alpha' });
    const initial = queueNode(queueNode(emptyProgress(tree.id), 'independent'), 'a');
    expect(queueWithPrerequisites(initial, tree, 'd', 'front').queue).toEqual(['a', 'b', 'c', 'd', 'independent']);
    expect(queueWithPrerequisites(initial, tree, 'd', 'replace').queue).toEqual(['a', 'b', 'c', 'd']);
    expect(queueWithPrerequisites(initial, tree, 'd').queue).toEqual(['independent', 'a', 'b', 'c', 'd']);
  });

  it('keeps large queues and handles IDs that coincide with object prototype properties', () => {
    const tree = makeTree();
    tree.nodes = Array.from({ length: 600 }, (_, index) => ({ id: `n${index}`, title: `N${index}`, tabId: 'alpha' }));
    tree.nodes.push({ id: 'constructor', title: 'Constructor', tabId: 'alpha' });
    tree.edges = [];
    const progress = parseProgress({ ...emptyProgress(tree.id), queue: tree.nodes.map((node) => node.id) }, tree);
    expect(progress.queue).toHaveLength(601);
    expect(statusOf(progress, tree, 'constructor')).toBe('ready');
    const done = completeNode(progress, 'constructor', true);
    expect(statusOf(done, tree, 'constructor')).toBe('completed');
    expect(statusOf(completeNode(done, 'constructor', false), tree, 'constructor')).toBe('ready');
  });

  it('preserves unreadable stored progress and backs up the original before restore', () => {
    const tree = makeTree();
    localStorage.clear();
    const key = `loregrid:progress:${tree.id}`;
    localStorage.setItem(key, 'unreadable original');
    expect(loadProgress(tree, localStorage).saveBlocked).toBe(true);
    expect(localStorage.getItem(key)).toBe('unreadable original');
    const restored = completeNode(emptyProgress(tree.id), 'a', true);
    restoreStoredProgress(restored, localStorage);
    expect(localStorage.getItem(`${key}:before-restore`)).toBe('unreadable original');
    expect(loadProgress(tree, localStorage).progress.completed.a).toBe(true);
  });

  it('isolates progress for separate library entries even when tree IDs match', () => {
    const tree = makeTree();
    const alpha = { ...completeNode(emptyProgress(tree.id), 'a', true), queue: ['b'] };
    const beta = { ...emptyProgress(tree.id), queue: ['c'] };
    localStorage.clear();
    restoreStoredProgress(alpha, localStorage, 'alpha-entry');
    restoreStoredProgress(beta, localStorage, 'beta-entry');
    const loadedAlpha = loadProgress(tree, localStorage, 'alpha-entry', false).progress;
    const loadedBeta = loadProgress(tree, localStorage, 'beta-entry', false).progress;
    expect(loadedAlpha.completed.a).toBe(true);
    expect(loadedAlpha.queue).toEqual(['b']);
    expect(loadedBeta.completed).toEqual({});
    expect(loadedBeta.queue).toEqual(['c']);
    expect(localStorage.getItem(`loregrid:progress:${tree.id}`)).toBeNull();
  });
});
