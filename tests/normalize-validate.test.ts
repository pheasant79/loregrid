import { describe, expect, it } from 'vitest';
import legacy from '../data/minimal-template.json';
import { normalizeTree } from '../src/core/normalize';
import { findRequiredCycle, validateTree } from '../src/core/validate';
import { makeTree } from './fixtures';

describe('tree normalization and validation', () => {
  it('migrates a V1 tree into V2 relations', () => {
    const result = normalizeTree(legacy);
    expect(result.migratedFrom).toBe('learning-tech-tree/v1');
    expect(result.tree.format).toBe('loregrid/tree-v2');
    expect(result.tree.tabs).toHaveLength(1);
    expect(result.tree.nodes).toHaveLength(4);
    expect(result.tree.edges.filter((edge) => edge.type === 'required')).toHaveLength(3);
    expect(validateTree(result.tree).filter((issue) => issue.severity === 'error')).toEqual([]);
  });

  it('rejects required cycles while allowing multiple roots and leaves', () => {
    const tree = makeTree();
    tree.edges.push({ id: 'edge-da', source: 'd', target: 'a', type: 'required' });
    expect(findRequiredCycle(tree)).toEqual(['a', 'b', 'c', 'd', 'a']);
    expect(validateTree(tree).some((issue) => issue.code === 'required.cycle')).toBe(true);
  });

  it('warns rather than rejects beyond the performance target', () => {
    const tree = makeTree();
    tree.nodes = Array.from({ length: 10_001 }, (_, index) => ({ id: `n${index}`, title: `Node ${index}`, tabId: 'alpha' }));
    tree.edges = [];
    const issues = validateTree(tree);
    expect(issues.some((issue) => issue.code === 'nodes.large' && issue.severity === 'warning')).toBe(true);
    expect(issues.some((issue) => issue.code === 'nodes.limit')).toBe(false);
  });

  it('rejects unsafe URLs and overlong imported text', () => {
    const tree = makeTree();
    tree.resources.push({ id: 'bad-link', title: 'Unsafe link', url: 'javascript:alert(1)' });
    tree.edges[0]!.reason = 'x'.repeat(10_001);
    const codes = validateTree(tree).map((issue) => issue.code);
    expect(codes).toContain('resource.url');
    expect(codes).toContain('edge.reason.length');
  });
});
