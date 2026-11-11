import { expect, test } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#layoutBusy')).toBeHidden();
});

test('switches pages and exposes cross-page prerequisite proxies', async ({ page }) => {
  await page.getByRole('button', { name: '现场调查', exact: true }).click();
  await expect(page.locator('#activePage')).toHaveText('现场调查');
  await expect(page.locator('.graph-node.is-proxy')).toHaveCount(3);
  await expect(page.locator('.graph-node[data-node-id="safe-operations"]')).toBeVisible();
  await expect(page).toHaveScreenshot('fieldwork-page.png', { animations: 'disabled' });
});

test('searches globally and navigates to the real node tab', async ({ page }) => {
  await page.getByRole('button', { name: '现场调查', exact: true }).click();
  await page.locator('#searchInput').fill('信号基础');
  await page.locator('#searchResults button').click();
  await expect(page.locator('#activePage')).toHaveText('数据分析');
  await expect(page.locator('#detailBody h1')).toHaveText('信号基础');
  await expect(page.locator('.graph-node.is-selected[data-node-id="signal-basics"]')).toBeVisible();
});

test('completes a node and all missing required prerequisites', async ({ page }) => {
  await page.getByRole('button', { name: '现场调查', exact: true }).click();
  await page.locator('.graph-node[data-node-id="survey-mission"]').click();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: /完成此节点及缺失前置/ }).click();
  await expect(page.locator('#progressSummary')).toHaveText('9 / 20 完成');
  await expect(page.locator('.graph-node[data-node-id="survey-mission"]')).toHaveClass(/status-completed/);
});

test('collapses details and toggles language', async ({ page }) => {
  await page.locator('.graph-node[data-node-id="station-orientation"]').click();
  await page.locator('#closeDetails').click();
  await expect(page.locator('#workspace')).toHaveClass(/details-closed/);
  await page.locator('#languageToggle').click();
  await expect(page.locator('#tabs')).toContainText('All');
  await expect(page.locator('#searchInput')).toHaveAttribute('placeholder', 'Search nodes, tags, or IDs');
});

test('downloads a sanitized V2 tree export', async ({ page }) => {
  await page.locator('#moreButton').click();
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#exportTree').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('loregrid-demo.json');
});

test('opens the production build directly from the filesystem', async ({ page }) => {
  await page.goto(pathToFileURL(resolve('dist/index.html')).href);
  await expect(page.locator('#treeTitle')).toHaveText('远境观测站');
  await expect(page.locator('.graph-node')).toHaveCount(20);
  await expect(page.locator('#layoutBusy')).toBeHidden();
});
