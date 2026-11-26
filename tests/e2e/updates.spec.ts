import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const manifest = JSON.parse(await readFile(new URL('../../package.json', import.meta.url), 'utf8')) as { version: string };

const endpoint = 'https://api.github.com/repos/pheasant79/loregrid/releases/latest';
const latest = (version = '2.2.0', assets = true) => ({
  tag_name: `v${version}`, draft: false, prerelease: false,
  html_url: `https://github.com/pheasant79/loregrid/releases/tag/v${version}`,
  body: '更新说明 / Release notes\n<script>window.__injected = true</script>\n- Improved offline updates',
  assets: assets ? [
    { name: `Loregrid-v${version}-update.html`, browser_download_url: `https://github.com/pheasant79/loregrid/releases/download/v${version}/Loregrid-v${version}-update.html` },
    { name: `Loregrid-v${version}-offline.zip`, browser_download_url: `https://github.com/pheasant79/loregrid/releases/download/v${version}/Loregrid-v${version}-offline.zip` },
  ] : [],
});
async function ready(page: Page, url = '/') {
  await page.goto(url); await expect(page.locator('.graph-node').first()).toBeVisible();
  await expect(page.locator('#layoutBusy')).toBeHidden();
}

test('stays offline by default and shows a safe bilingual update dialog on request', async ({ page }, testInfo) => {
  let calls = 0;
  await page.route(endpoint, async (route) => { calls++; await route.fulfill({ json: latest() }); });
  await ready(page); expect(calls).toBe(0);
  await page.locator('#versionButton').click();
  await expect(page.locator('#updateStatus')).toHaveText('发现新版本: 2.2.0');
  expect(calls).toBe(1);
  await expect(page.locator('#autoUpdateCheck')).not.toBeChecked();
  await expect(page.locator('#updateNotes')).toContainText('<script>');
  expect(await page.evaluate(() => (window as Window & { __injected?: boolean }).__injected)).toBeUndefined();
  await expect(page.locator('#downloadUpdate')).toHaveAttribute('href', /Loregrid-v2.2.0-update.html$/);
  await expect(page.locator('#downloadFullUpdate')).toBeVisible();
  await expect(page.locator('#updateSteps')).toContainText('不要覆盖或删除 data/');
  await page.locator('#updateDialog').screenshot({ path: `test-results/update-dialog-${testInfo.project.name}.png` });
  await page.keyboard.press('Escape'); await expect(page.locator('#updateDialog')).not.toBeVisible();
  await expect(page.locator('#versionButton')).toBeFocused();
  await expect(page.locator('#updateBadge')).toBeVisible();
  await page.locator('#languageToggle').click(); await page.locator('#moreButton').click();
  await page.locator('#checkUpdates').click();
  await expect(page.locator('#updateHeading')).toHaveText('App updates');
  await expect(page.locator('#updateStatus')).toHaveText('New version available: 2.2.0');
});

test('reports current stable versions and an old-release download fallback', async ({ page }) => {
  await page.route(endpoint, (route) => route.fulfill({ json: latest(manifest.version) }));
  await ready(page); await page.locator('#versionButton').click();
  await expect(page.locator('#updateStatus')).toHaveText('当前已是最新正式版本。');
  await expect(page.locator('#downloadUpdate')).toBeHidden(); await expect(page.locator('#updateBadge')).toBeHidden();
  await page.route(endpoint, (route) => route.fulfill({ json: latest('2.2.0', false) }));
  await page.locator('#runUpdateCheck').click();
  await expect(page.locator('#updateFallback')).toContainText('尚未提供单独的更新 HTML');
  await expect(page.locator('#updateReleaseLink')).toHaveAttribute('href', /releases\/tag\/v2.2.0$/);
});

test('reports network and rate-limit failures without claiming the app is up to date', async ({ page }) => {
  await page.route(endpoint, (route) => route.abort());
  await ready(page); await page.locator('#versionButton').click();
  await expect(page.locator('#updateStatus')).toContainText('无法连接 GitHub');
  await expect(page.locator('#runUpdateCheck')).toBeEnabled();
  await expect(page.locator('#updateRelease')).toBeHidden();
  await page.route(endpoint, (route) => route.fulfill({ status: 429, body: '{}' }));
  await page.locator('#runUpdateCheck').click(); await expect(page.locator('#updateStatus')).toContainText('限制了请求');
  await page.keyboard.press('Escape'); await expect(page.locator('.graph-node').first()).toBeVisible();
});

test('persists opt-in, checks once daily without a modal, and permits manual rechecks', async ({ page }) => {
  let calls = 0;
  await page.route(endpoint, async (route) => { calls++; await route.fulfill({ json: latest() }); });
  await ready(page); await page.locator('#versionButton').click(); await expect(page.locator('#updateStatus')).toContainText('发现新版本');
  await page.locator('#autoUpdateCheck').check(); await page.reload(); await expect(page.locator('.graph-node').first()).toBeVisible();
  expect(calls).toBe(1);
  await page.evaluate(() => {
    const key = 'loregrid:updates-v1'; const preference = JSON.parse(localStorage.getItem(key)!);
    preference.lastAttempt = Date.now() - 25 * 60 * 60 * 1000; localStorage.setItem(key, JSON.stringify(preference));
  });
  await page.reload(); await expect(page.locator('#updateBadge')).toBeVisible(); expect(calls).toBe(2);
  await expect(page.locator('#updateDialog')).not.toBeVisible();
  await page.locator('#versionButton').click(); await expect(page.locator('#updateStatus')).toContainText('发现新版本'); expect(calls).toBe(3);
  await page.locator('#autoUpdateCheck').uncheck(); await page.reload(); await expect(page.locator('.graph-node').first()).toBeVisible(); expect(calls).toBe(3);
});

test('exports current progress from the dialog without changing completion or queue', async ({ page }) => {
  await page.route(endpoint, (route) => route.fulfill({ json: latest() }));
  await ready(page);
  const before = await page.locator('#progressSummary').textContent();
  await page.locator('#versionButton').click();
  const downloadEvent = page.waitForEvent('download'); await page.locator('#updateBackup').click();
  const download = await downloadEvent; expect(download.suggestedFilename()).toMatch(/\.progress\.json$/);
  const backup = JSON.parse(await readFile((await download.path())!, 'utf8'));
  expect(backup.format).toBe('loregrid/progress-v2'); expect(backup.completed).toEqual({}); expect(backup.queue).toEqual([]);
  expect(await page.locator('#progressSummary').textContent()).toBe(before);
});

test('works in the built standalone file and remains usable when offline', async ({ page }) => {
  await page.route(endpoint, (route) => route.abort());
  await ready(page, pathToFileURL(resolve('index.html')).href);
  await page.locator('#versionButton').click(); await expect(page.locator('#updateStatus')).toContainText('无法连接 GitHub');
  await page.keyboard.press('Escape'); await page.locator('#zoomOut').click(); await expect(page.locator('.graph-node').first()).toBeVisible();
});
