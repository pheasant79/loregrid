import { describe, expect, it } from 'vitest';
import { parsePublicTreeCatalog, serializePublicTreeCatalog } from '../src/core/public-tree-library';

describe('public tree catalog', () => {
  it('resolves tree files relative to the catalog and assigns stable public keys', () => {
    const catalog = parsePublicTreeCatalog({
      format: 'loregrid/public-tree-catalog-v1',
      trees: [{ id: 'history', title: 'History', url: './trees/history.json' }],
    }, 'https://example.test/library/catalog.json');

    expect(catalog.trees[0]).toMatchObject({
      key: 'public:history',
      treeId: 'history',
      title: 'History',
      fileName: 'history.json',
      source: 'public',
      remoteUrl: 'https://example.test/library/trees/history.json',
    });
  });

  it('round-trips a cached catalog without losing a redirected URL base', () => {
    const catalog = parsePublicTreeCatalog({
      format: 'loregrid/public-tree-catalog-v1',
      trees: [{ id: 'history', title: 'History', url: './trees/history.json' }],
    }, 'https://cdn.example.test/v2/catalog.json');
    expect(parsePublicTreeCatalog(
      JSON.parse(serializePublicTreeCatalog(catalog)), 'https://example.test/catalog.json',
    )).toEqual(catalog);
  });

  it('rejects unsafe URLs and duplicate tree IDs', () => {
    expect(() => parsePublicTreeCatalog({
      format: 'loregrid/public-tree-catalog-v1',
      trees: [{ id: 'unsafe', title: 'Unsafe', url: 'javascript:alert(1)' }],
    }, 'https://example.test/catalog.json')).toThrow('HTTP(S)');

    expect(() => parsePublicTreeCatalog({
      format: 'loregrid/public-tree-catalog-v1',
      trees: [
        { id: 'same', title: 'One', url: './one.json' },
        { id: 'same', title: 'Two', url: './two.json' },
      ],
    }, 'https://example.test/catalog.json')).toThrow('duplicate ID');
  });
});
