import type { TreeDefinitionV2 } from './types';

export interface TreeLibraryItem {
  key: string;
  title: string;
  treeId: string;
  fileName: string;
  addedAt: number;
  migrateLegacyProgress: boolean;
  source?: 'builtin' | 'local' | 'folder';
}

export interface TreeLibraryEntry extends TreeLibraryItem {
  tree: TreeDefinitionV2;
}

/** Metadata is read independently, so listing a library does not load every graph. */
export class TreeLibrary {
  private database: Promise<IDBDatabase> | null = null;

  async list(): Promise<TreeLibraryItem[]> {
    const database = await this.open();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction('catalog', 'readonly');
      const request = transaction.objectStore('catalog').getAll();
      request.onsuccess = () => resolve((request.result as TreeLibraryItem[]).sort((a, b) =>
        a.title.localeCompare(b.title) || a.fileName.localeCompare(b.fileName),
      ));
      request.onerror = () => reject(request.error);
    });
  }

  async get(key: string): Promise<TreeLibraryEntry | undefined> {
    const database = await this.open();
    return new Promise((resolve, reject) => {
      const request = database.transaction('trees', 'readonly').objectStore('trees').get(key);
      request.onsuccess = () => resolve(request.result as TreeLibraryEntry | undefined);
      request.onerror = () => reject(request.error);
    });
  }

  async add(tree: TreeDefinitionV2, fileName: string, migrateLegacyProgress = false): Promise<TreeLibraryEntry> {
    const existing = (await this.list()).find((item) =>
      (item.source === 'local' || item.source === 'folder') && item.treeId === tree.id,
    );
    if (existing) {
      const entry: TreeLibraryEntry = {
        key: existing.key, title: tree.title, treeId: tree.id, fileName: fileName.slice(0, 260),
        tree, addedAt: existing.addedAt, migrateLegacyProgress: existing.migrateLegacyProgress, source: existing.source,
      };
      await this.put(entry);
      return entry;
    }
    const key = globalThis.crypto?.randomUUID?.() ?? `tree-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const entry: TreeLibraryEntry = {
      key, title: tree.title, treeId: tree.id, fileName: fileName.slice(0, 260),
      tree, addedAt: Date.now(), migrateLegacyProgress, source: 'local',
    };
    await this.put(entry);
    return entry;
  }

  async addFromFolder(tree: TreeDefinitionV2, fileName: string, preferredKey?: string): Promise<TreeLibraryEntry> {
    const items = await this.list();
    const previous = items.find((item) => item.treeId === tree.id && item.source !== 'builtin');
    const key = preferredKey ?? previous?.key ?? `folder:${tree.id}`;
    const previousLocal = items.find((item) => item.source === 'local' && item.treeId === tree.id && item.key !== key);
    if (previousLocal) await this.remove(previousLocal.key);
    const existing = await this.get(key);
    const entry: TreeLibraryEntry = {
      key, title: tree.title, treeId: tree.id, fileName: fileName.slice(0, 260), tree,
      addedAt: existing?.addedAt ?? Date.now(),
      migrateLegacyProgress: existing?.migrateLegacyProgress ?? false,
      source: 'folder',
    };
    await this.put(entry);
    return entry;
  }

  async remove(key: string): Promise<void> {
    const database = await this.open();
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(['trees', 'catalog'], 'readwrite');
      transaction.objectStore('trees').delete(key);
      transaction.objectStore('catalog').delete(key);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  }

  async ensureBuiltIn(tree: TreeDefinitionV2): Promise<void> {
    await this.put({
      key: `builtin:${tree.id}`, title: tree.title, treeId: tree.id,
      fileName: 'Loregrid starter', tree, addedAt: 0, migrateLegacyProgress: true, source: 'builtin',
    });
  }

  private async put(entry: TreeLibraryEntry): Promise<void> {
    const database = await this.open();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(['trees', 'catalog'], 'readwrite');
      const { tree: _tree, ...metadata } = entry;
      transaction.objectStore('trees').put(entry);
      transaction.objectStore('catalog').put(metadata);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error('Could not save the local tree.'));
      transaction.onabort = () => reject(transaction.error ?? new Error('Saving the local tree was cancelled.'));
    });
  }

  private open(): Promise<IDBDatabase> {
    if (this.database) return this.database;
    if (!globalThis.indexedDB) return Promise.reject(new Error('This browser does not provide local tree storage.'));
    this.database = new Promise((resolve, reject) => {
      const request = indexedDB.open('loregrid-tree-library', 2);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains('trees')) database.createObjectStore('trees', { keyPath: 'key' });
        if (!database.objectStoreNames.contains('catalog')) {
          const catalog = database.createObjectStore('catalog', { keyPath: 'key' });
          const cursor = request.transaction!.objectStore('trees').openCursor();
          cursor.onsuccess = () => {
            const current = cursor.result;
            if (!current) return;
            const entry = current.value as TreeLibraryEntry;
            const { tree, ...stored } = entry;
            catalog.put({ ...stored, title: tree.title, treeId: tree.id });
            current.continue();
          };
        }
      };
      request.onsuccess = () => {
        request.result.onversionchange = () => { request.result.close(); this.database = null; };
        resolve(request.result);
      };
      request.onerror = () => reject(request.error ?? new Error('Could not open the local tree library.'));
      request.onblocked = () => reject(new Error('Close other Loregrid tabs to update the tree library.'));
    });
    this.database.catch(() => { this.database = null; });
    return this.database;
  }
}
