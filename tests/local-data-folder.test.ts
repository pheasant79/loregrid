import { describe, expect, it, vi } from 'vitest';
import { LocalDataFolder } from '../src/core/local-data-folder';
import { emptyProgress } from '../src/core/progress';

function mockFolder(
  trees: Record<string, string> = {},
  progress: Record<string, string> = {},
  fileSizes: Record<string, number> = {},
) {
  const writes: string[] = [];
  const treeEntries = Object.entries(trees).map(([name, text]) => [name, {
    getFile: async () => ({ size: fileSizes[name] ?? text.length, text: async () => text }),
  }] as const);
  const treeDirectory = {
    async *entries() { yield* treeEntries; },
  };
  const progressDirectory = {
    async getFileHandle(name: string, options?: { create?: boolean }) {
      if (!(name in progress) && !options?.create) throw new DOMException('Not found', 'NotFoundError');
      return {
        getFile: async () => ({ text: async () => progress[name] }),
        createWritable: async () => {
          let content = '';
          return {
            write: async (value: string) => { content = value; },
            close: async () => { progress[name] = content; writes.push(name); },
          };
        },
      };
    },
  };
  const getDirectoryHandle = vi.fn(async (name: string) => {
    if (name === 'trees') return treeDirectory;
    if (name === 'progress') return progressDirectory;
    throw new Error(`Unexpected directory ${name}`);
  });
  const folder = new LocalDataFolder();
  Object.defineProperty(folder, 'handle', { value: { getDirectoryHandle } });
  return { folder, progress, writes, getDirectoryHandle };
}

describe('local data folder', () => {
  it('reads tree JSON independently and reports malformed files without stopping valid files', async () => {
    const { folder } = mockFolder({
      'valid.json': '{"id":"valid"}',
      'broken.json': '{',
      'README.md': 'ignored',
    });
    const files = await folder.readTrees();
    expect(files).toHaveLength(2);
    expect(files[0]).toMatchObject({ fileName: 'broken.json', error: expect.any(String) });
    expect(files[1]).toEqual({ fileName: 'valid.json', tree: { id: 'valid' } });
  });

  it('reports declined oversized tree files so a partial scan cannot delete cached trees', async () => {
    const { folder } = mockFolder(
      { 'large.json': '{"id":"large"}' },
      {},
      { 'large.json': 10 * 1024 * 1024 + 1 },
    );
    vi.spyOn(window, 'confirm').mockReturnValue(false);

    await expect(folder.readTrees()).resolves.toEqual([{ fileName: 'large.json', skipped: true }]);
    vi.restoreAllMocks();
  });

  it('writes separate progress snapshots in order and never writes tree definitions', async () => {
    const { folder, progress, writes, getDirectoryHandle } = mockFolder();
    const value = emptyProgress('history');
    const first = folder.writeProgress(value);
    value.queue.push('first-goal');
    const second = folder.writeProgress(value);
    await Promise.all([first, second]);

    expect(JSON.parse(progress['history.progress.json']!).queue).toEqual(['first-goal']);
    expect(writes).toEqual(['history.progress.json', 'history.progress.json']);
    expect(getDirectoryHandle.mock.calls.every(([name]) => name === 'progress')).toBe(true);
    expect(await folder.readProgress('history')).toEqual(JSON.parse(progress['history.progress.json']!));
  });

  it('waits for pending progress writes before reading the saved file', async () => {
    const { folder } = mockFolder();
    const value = emptyProgress('history');
    value.completed.first = true;
    const write = folder.writeProgress(value);
    expect(await folder.readProgress('history')).toMatchObject({ completed: { first: true } });
    await write;
    expect(await folder.readProgress('missing')).toBeUndefined();
  });
});
