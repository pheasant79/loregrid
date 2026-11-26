import { chromium, expect } from '@playwright/test';
import { mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

// Only distributed fixtures and synthetic demonstration progress enter these images.
const root = fileURLToPath(new URL('../', import.meta.url));
const output = resolve(root, 'docs/assets');
await mkdir(output, { recursive: true });
const cs = JSON.parse(await readFile(resolve(root, 'data/trees/computer-science-phd.json'), 'utf8')) as { id: string; nodes: { id: string }[] };
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ?? (process.platform === 'win32' ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' : undefined) });
try {
  for (const language of ['zh', 'en'] as const) {
    const context = await browser.newContext({ viewport: { width: 1680, height: 820 }, deviceScaleFactor: 1, locale: language === 'zh' ? 'zh-CN' : 'en-US', colorScheme: 'dark' });
    // Explicitly prohibit external traffic during documentation capture.
    await context.route(/^https?:/, (route) => route.abort());
    const page = await context.newPage();
    await page.goto(pathToFileURL(resolve(root, 'index.html')).href);
    await expect(page.locator('.graph-node').first()).toBeVisible();
    await page.evaluate(({ treeId, ids }) => {
      localStorage.setItem(`learning-tech-tree:progress:${treeId}`, JSON.stringify({
        format: 'learning-tech-progress/v1', treeId, completed: Object.fromEntries(ids.map((id) => [id, true])), notes: {},
      }));
    }, { treeId: cs.id, ids: cs.nodes.slice(0, 33).map((node) => node.id) });
    await page.locator('#treeFile').setInputFiles(resolve(root, 'data/trees/computer-science-phd.json'));
    await expect(page.locator('#treeTitle')).toContainText('计算机科学');
    await expect(page.locator('#layoutBusy')).toBeHidden();
    if (language === 'en') await page.locator('#languageToggle').click();
    await page.locator('#tabs button').click();
    await expect(page.locator('#layoutBusy')).toBeHidden();
    await page.locator('#zoomFloorToggle').uncheck();
    await page.locator('#fitView').click();
    await page.addStyleTag({ content: '#toast { visibility: hidden !important; }' });
    await page.mouse.move(1675, 815);
    await page.screenshot({ path: resolve(output, `loregrid-overview-${language}.png`), animations: 'disabled' });

    // Return to the built-in fictional tree, with a visible queue and readable details.
    await page.setViewportSize({ width: 1440, height: 820 });
    await page.locator('#treeSwitcherToggle').click();
    await page.locator('#treeList button').filter({ hasText: '远境观测站' }).first().click();
    await expect(page.locator('#treeTitle')).toHaveText('远境观测站');
    await expect(page.locator('#layoutBusy')).toBeHidden();
    if ((await page.locator('html').getAttribute('lang')) !== (language === 'zh' ? 'zh-CN' : 'en')) await page.locator('#languageToggle').click();
    await page.locator('#categorySelect').selectOption('foundations');
    await expect(page.locator('#layoutBusy')).toBeHidden();
    await page.locator('.graph-node[data-node-id="station-orientation"]').click();
    await page.locator('#detailBody button').filter({ hasText: language === 'zh' ? /^标记完成$/ : /^Mark complete$/ }).click();
    await page.locator('.graph-node[data-node-id="safe-operations"]').click();
    await page.locator('#detailBody button').filter({ hasText: language === 'zh' ? /^标记完成$/ : /^Mark complete$/ }).click();
    await page.locator('#categorySelect').selectOption('fieldwork');
    await expect(page.locator('#layoutBusy')).toBeHidden();
    await page.locator('.graph-node[data-node-id="route-planning"]').click();
    await page.locator('#detailBody button').filter({ hasText: language === 'zh' ? /^加入队列$/ : /^Add to queue$/ }).click();
    await page.locator('#detailBody textarea').fill(language === 'zh' ? '演示记录：先检查路线风险，再按清单完成一次练习。' : 'Demo note: review route risks, then complete one practice run using the checklist.');
    await page.evaluate(() => new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done()))));
    await page.locator('#fitView').click();
    // Reframe through real canvas panning; the detail panel overlays part of the fitted graph.
    await page.locator('#zoomOut').click();
    const viewport = await page.locator('.viewport').boundingBox();
    if (viewport) {
      await page.mouse.move(viewport.x + 600, viewport.y + 130);
      await page.mouse.down();
      await page.mouse.move(viewport.x + 740, viewport.y + 130, { steps: 12 });
      await page.mouse.up();
    }
    await page.locator('#detailBody').evaluate((element) => {
      element.scrollTop = 0;
      window.getSelection()?.removeAllRanges();
      (document.activeElement as HTMLElement | null)?.blur();
    });
    await page.mouse.move(1435, 815);
    await page.screenshot({ path: resolve(output, `loregrid-workflow-${language}.png`), animations: 'disabled' });
    await context.close();
  }
} finally { await browser.close(); }
console.info('Documentation screenshots captured from the root offline app.');
