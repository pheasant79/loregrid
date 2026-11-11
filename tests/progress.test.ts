import { describe, expect, it } from 'vitest';
import {
  completeNode,
  completeWithPrerequisites,
  emptyProgress,
  inconsistentCompleted,
  missingPrerequisites,
  parseProgress,
  statusOf,
} from '../src/core/progress';
import { makeTree } from './fixtures';

describe('progress v2', () => {
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
});
