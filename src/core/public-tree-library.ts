import type { TreeLibraryItem } from './tree-library';

export interface PublicTreeDescriptor extends TreeLibraryItem {
  source: 'public';
  remoteUrl: string;
}

export interface PublicTreeCatalog {
  format: 'loregrid/public-tree-catalog-v1';
  trees: PublicTreeDescriptor[];
}

const idPattern = /^[A-Za-z][A-Za-z0-9_-]{0,95}$/;

export function parsePublicTreeCatalog(input: unknown, catalogUrl: string): PublicTreeCatalog {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('The public tree catalog must be an object.');
  }
  const catalog = input as Record<string, unknown>;
  if (catalog.format !== 'loregrid/public-tree-catalog-v1' || !Array.isArray(catalog.trees)) {
    throw new Error('The public tree catalog format is not supported.');
  }

  const ids = new Set<string>();
  const trees = catalog.trees.map((raw, index): PublicTreeDescriptor => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      throw new Error(`Public tree entry ${index + 1} is invalid.`);
    }
    const item = raw as Record<string, unknown>;
    if (typeof item.id !== 'string' || !idPattern.test(item.id) || ids.has(item.id)) {
      throw new Error(`Public tree entry ${index + 1} has a missing, invalid, or duplicate ID.`);
    }
    if (typeof item.title !== 'string' || !item.title.trim() || item.title.length > 500) {
      throw new Error(`Public tree entry ${index + 1} has an invalid title.`);
    }
    if (typeof item.url !== 'string' || !item.url.trim()) {
      throw new Error(`Public tree entry ${index + 1} has no JSON URL.`);
    }
    const remoteUrl = new URL(item.url, catalogUrl);
    if (!['http:', 'https:'].includes(remoteUrl.protocol) || remoteUrl.username || remoteUrl.password) {
      throw new Error(`Public tree entry ${index + 1} must use HTTP(S).`);
    }
    ids.add(item.id);
    const fileName = typeof item.fileName === 'string' && item.fileName.trim()
      ? item.fileName.slice(0, 260)
      : `${item.id}.json`;
    return {
      key: `public:${item.id}`,
      treeId: item.id,
      title: item.title,
      fileName,
      addedAt: 0,
      migrateLegacyProgress: false,
      source: 'public',
      remoteUrl: remoteUrl.toString(),
    };
  });

  return { format: 'loregrid/public-tree-catalog-v1', trees };
}

export function publicCatalogCacheKey(catalogUrl: string): string {
  return `loregrid:public-catalog:${catalogUrl}`;
}

/** Use resolved URLs so a redirected catalog can also be restored offline. */
export function serializePublicTreeCatalog(catalog: PublicTreeCatalog): string {
  return JSON.stringify({
    format: catalog.format,
    trees: catalog.trees.map((tree) => ({
      id: tree.treeId, title: tree.title, fileName: tree.fileName, url: tree.remoteUrl,
    })),
  });
}
