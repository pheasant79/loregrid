import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('reloads authorized folder trees after AI edits and saves independent progress JSON', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Native directory-handle persistence is a Chromium feature.');
  await page.addInitScript(() => {
    Object.defineProperty(window, 'showDirectoryPicker', {
      value: async () => navigator.storage.getDirectory(),
      configurable: true,
    });
  });
  await page.goto('/');
  await expect(page.locator('.graph-node').first()).toBeVisible();
  const source = JSON.parse(await readFile('data/trees/loregrid-demo.json', 'utf8'));
  source.id = 'folder-test';
  source.title = 'Folder original';
  await page.evaluate(async (tree) => {
    const root = await navigator.storage.getDirectory();
    const trees = await root.getDirectoryHandle('trees', { create: true });
    const file = await trees.getFileHandle('test.json', { create: true });
    const writable = await file.createWritable();
    await writable.write(JSON.stringify(tree));
    await writable.close();
  }, source);
  await page.locator('#moreButton').click();
  await page.locator('#chooseDataFolder').click();
  await page.locator('#treeSwitcherToggle').click();
  await expect(page.locator('.tree-choice').filter({ hasText: source.title })).toBeVisible();
  await page.locator('.tree-choice').filter({ hasText: source.title }).click();
  await expect(page.locator('#treeTitle')).toHaveText(source.title);
  await page.locator('.graph-node[data-node-id="station-orientation"]').click();
  await page.getByRole('button', { name: '标记完成', exact: true }).click();
  await expect.poll(() => page.evaluate(async () => {
    try {
      const root = await navigator.storage.getDirectory();
      const directory = await root.getDirectoryHandle('progress');
      const file = await directory.getFileHandle('folder-test.progress.json');
      return JSON.parse(await (await file.getFile()).text()).completed['station-orientation'];
    } catch { return false; }
  })).toBe(true);

  source.title = 'Folder updated by AI';
  source.nodes.push({ id: 'ai-added-node', title: 'AI new goal', tabId: source.tabs[0].id });
  await page.evaluate(async (tree) => {
    const root = await navigator.storage.getDirectory();
    const trees = await root.getDirectoryHandle('trees');
    const file = await trees.getFileHandle('test.json');
    const writable = await file.createWritable();
    await writable.write(JSON.stringify(tree));
    await writable.close();
    const broken = await trees.getFileHandle('broken.json', { create: true });
    const brokenWriter = await broken.createWritable();
    await brokenWriter.write('{');
    await brokenWriter.close();
  }, source);
  await page.reload();
  await expect(page.locator('#treeTitle')).toHaveText(source.title);
  await expect(page.locator('#progressSummary')).toHaveText('1 / 21 完成');
  await page.locator('#searchInput').fill('ai-added-node');
  await page.locator('#searchResults button').first().click();
  await expect(page.locator('#detailBody h1')).toHaveText('AI new goal');
  const disk = await page.evaluate(async () => {
    const root = await navigator.storage.getDirectory();
    const trees = await root.getDirectoryHandle('trees');
    return JSON.parse(await (await (await trees.getFileHandle('test.json')).getFile()).text());
  });
  expect(disk).toEqual(source);
});
