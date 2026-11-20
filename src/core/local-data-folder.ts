import type { ProgressV2 } from './types';

interface WritableFile {
  write(data: string): Promise<void>;
  close(): Promise<void>;
}
interface LocalFileHandle {
  getFile(): Promise<File>;
  createWritable(): Promise<WritableFile>;
}

interface LocalDirectoryHandle {
  name: string;
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<LocalDirectoryHandle>;
  getFileHandle(name: string, options?: { create?: boolean }): Promise<LocalFileHandle>;
  queryPermission(options: { mode: 'readwrite' }): Promise<PermissionState>;
  requestPermission(options: { mode: 'readwrite' }): Promise<PermissionState>;
  entries(): AsyncIterable<[string, LocalDirectoryHandle | LocalFileHandle]>;
}

interface DirectoryPickerWindow extends Window {
  showDirectoryPicker?: (options?: { mode?: 'read' | 'readwrite' }) => Promise<LocalDirectoryHandle>;
}

const databaseName = 'loregrid-local-data-folder';
const storeName = 'handles';
const handleKey = 'data-root';

export class LocalDataFolder {
  private database: Promise<IDBDatabase> | null = null;
  private handle: LocalDirectoryHandle | null = null;
  private progressWrites = new Map<string, Promise<void>>();

  static isSupported(): boolean {
    return typeof (window as DirectoryPickerWindow).showDirectoryPicker === 'function';
  }

  async choose(): Promise<string> {
    const picker = (window as DirectoryPickerWindow).showDirectoryPicker;
    if (!picker) throw new Error('This browser cannot connect a folder. Import JSON files manually.');
    const handle = await picker.call(window, { mode: 'readwrite' });
    const permission = await handle.requestPermission({ mode: 'readwrite' });
    if (permission !== 'granted') throw new Error('Folder read and write permission was not granted.');
    await handle.getDirectoryHandle('trees', { create: true });
    await handle.getDirectoryHandle('progress', { create: true });
    await this.saveHandle(handle);
    this.handle = handle;
    return handle.name;
  }

  async connectSaved(): Promise<'connected' | 'permission-needed' | 'missing'> {
    const handle = await this.readHandle();
    if (!handle) return 'missing';
    this.handle = handle;
    const permission = await handle.queryPermission({ mode: 'readwrite' });
    if (permission !== 'granted') return 'permission-needed';
    return 'connected';
  }

  async requestSavedPermission(): Promise<boolean> {
    if (!this.handle) this.handle = await this.readHandle();
    if (!this.handle) return false;
    return (await this.handle.requestPermission({ mode: 'readwrite' })) === 'granted';
  }

  async rootName(): Promise<string | undefined> {
    if (!this.handle) this.handle = await this.readHandle();
    return this.handle?.name;
  }

  async readTrees(): Promise<{ fileName: string; tree?: unknown; error?: string; skipped?: boolean }[]> {
    const root = this.requireHandle();
    const directory = await root.getDirectoryHandle('trees', { create: true });
    const results: { fileName: string; tree?: unknown; error?: string; skipped?: boolean }[] = [];
    for await (const [name, entry] of directory.entries()) {
      if (!name.toLowerCase().endsWith('.json') || !('getFile' in entry)) continue;
      const file = await entry.getFile();
      if (file.size > 10 * 1024 * 1024 && !window.confirm(
        `Tree file "${name}" is ${(file.size / 1024 / 1024).toFixed(1)} MB. Reading and laying it out may take time. Continue?`,
      )) {
        results.push({ fileName: name, skipped: true });
        continue;
      }
      try {
        results.push({ fileName: name, tree: JSON.parse(await file.text()) as unknown });
      } catch (error) {
        results.push({ fileName: name, error: error instanceof Error ? error.message : String(error) });
      }
    }
    return results.sort((a, b) => a.fileName.localeCompare(b.fileName));
  }

  async readProgress(treeId: string): Promise<unknown | undefined> {
    await this.progressWrites.get(treeId);
    const root = this.requireHandle();
    try {
      const directory = await root.getDirectoryHandle('progress');
      const file = await directory.getFileHandle(`${treeId}.progress.json`);
      return JSON.parse(await (await file.getFile()).text()) as unknown;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'NotFoundError') return undefined;
      throw error;
    }
  }

  async writeProgress(progress: ProgressV2): Promise<void> {
    const root = this.requireHandle();
    const contents = `${JSON.stringify(progress, null, 2)}\n`;
    const previous = this.progressWrites.get(progress.treeId) ?? Promise.resolve();
    const current = previous.catch(() => undefined).then(async () => {
      const directory = await root.getDirectoryHandle('progress', { create: true });
      const file = await directory.getFileHandle(`${progress.treeId}.progress.json`, { create: true });
      const writable = await file.createWritable();
      await writable.write(contents);
      await writable.close();
    });
    this.progressWrites.set(progress.treeId, current);
    try {
      await current;
    } finally {
      if (this.progressWrites.get(progress.treeId) === current) this.progressWrites.delete(progress.treeId);
    }
  }

  private requireHandle(): LocalDirectoryHandle {
    if (!this.handle) throw new Error('Choose the Loregrid data folder first.');
    return this.handle;
  }

  private async saveHandle(handle: LocalDirectoryHandle): Promise<void> {
    const database = await this.open();
    await new Promise<void>((resolve, reject) => {
      const request = database.transaction(storeName, 'readwrite').objectStore(storeName).put(handle, handleKey);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private async readHandle(): Promise<LocalDirectoryHandle | null> {
    const database = await this.open();
    return new Promise((resolve, reject) => {
      const request = database.transaction(storeName, 'readonly').objectStore(storeName).get(handleKey);
      request.onsuccess = () => resolve((request.result as LocalDirectoryHandle | undefined) ?? null);
      request.onerror = () => reject(request.error);
    });
  }

  private open(): Promise<IDBDatabase> {
    if (this.database) return this.database;
    this.database = new Promise((resolve, reject) => {
      const request = indexedDB.open(databaseName, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(storeName);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return this.database;
  }
}
