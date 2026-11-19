import { expect, test } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { readFile } from 'node:fs/promises';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.graph-node').first()).toBeVisible();
  await expect(page.locator('#layoutBusy')).toBeHidden();
});

test('switches pages and exposes cross-page prerequisite proxies', async ({ page }) => {
  await page.locator('#categorySelect').selectOption('fieldwork');
  await expect(page.locator('#categorySelect')).toHaveValue('fieldwork');
  await expect(page.locator('.graph-node.is-proxy')).toHaveCount(3);
  await expect(page.locator('.graph-node[data-node-id="safe-operations"]')).toBeVisible();
  expect(await page.locator('.graph-node').evaluateAll((nodes) => new Set(nodes.map((node) => getComputedStyle(node).backgroundColor)).size)).toBeLessThanOrEqual(2);
  await expect(page.locator('.graph-node').first()).not.toHaveAttribute('title', /.+/);
  await expect(page).toHaveScreenshot('fieldwork-page.png', { animations: 'disabled' });
});

test('uses All plus one flat page selector for the merged view', async ({ page }) => {
  await expect(page.locator('#categorySelect option[value="foundations"]')).toHaveText('基础系统');
  await expect(page.locator('#categorySelect')).not.toContainText('/');
  await expect(page.locator('#categorySelect optgroup')).toHaveCount(0);
  await page.locator('#categorySelect').selectOption('analysis');
  await expect(page.locator('#activePage')).toHaveText('数据分析');
  await expect(page.locator('#categorySelect option')).toHaveCount(4);
  await expect(page.locator('.graph-node[data-node-id="signal-basics"]')).toBeVisible();
  await page.locator('#tabs button').click();
  await expect(page.locator('#categorySelect')).toBeHidden();
  await expect(page.locator('.category-picker')).toBeHidden();
  await expect(page.locator('#graphStats')).toHaveText('20 节点');
  await page.locator('#tabs button').click();
  await expect(page.locator('#categorySelect')).toBeVisible();
  await expect(page.locator('.category-picker')).toBeVisible();
  await expect(page.locator('#categorySelect')).toHaveValue('analysis');
});

test('keeps relation controls in the upper-right and zoom controls in the lower-left', async ({ page }) => {
  const viewport = await page.locator('#viewport').boundingBox();
  const relation = await page.locator('#toggleRelations').boundingBox();
  const zoom = await page.locator('.zoom-controls').boundingBox();
  expect(viewport).not.toBeNull();
  expect(relation).not.toBeNull();
  expect(zoom).not.toBeNull();
  expect(Math.abs(relation!.x + relation!.width - (viewport!.x + viewport!.width - 16))).toBeLessThanOrEqual(1);
  expect(relation!.y).toBeGreaterThanOrEqual(viewport!.y);
  expect(zoom!.x).toBeLessThan(viewport!.x + 40);
  expect(zoom!.y + zoom!.height).toBeLessThanOrEqual(viewport!.y + viewport!.height - 13);
  await expect(page.locator('#queueScrollbar')).toHaveCSS('height', '18px');
});

test('centers node labels at board zoom and left-aligns rich-card labels', async ({ page }) => {
  const nodeLayer = page.locator('.node-layer');
  const title = page.locator('.graph-node .node-title').first();
  await expect(nodeLayer).toHaveClass(/lod-high/);
  await expect(title).toHaveCSS('text-align', 'center');
  for (let index = 0; index < 5; index++) await page.locator('#zoomIn').click();
  await expect(nodeLayer).toHaveClass(/lod-rich/);
  await expect(title).toHaveCSS('text-align', 'left');
  for (let index = 0; index < 14; index++) await page.locator('#zoomOut').click();
  await expect(nodeLayer).toHaveClass(/lod-low/);
  await expect(title).toHaveCSS('visibility', 'visible');
  await expect(title).toHaveCSS('text-align', 'center');
});

test('uses one compact top workbench for identity, page controls and queue', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.locator('#fitView').click();
  for (const id of ['station-orientation', 'safe-operations']) {
    await page.locator(`.graph-node[data-node-id="${id}"]`).click();
    await page.locator('#detailBody button').filter({ hasText: '加入队列' }).click();
  }
  await page.locator('#closeDetails').click();
  await page.locator('#tabs button').click();
  await expect(page.locator('#graphStats')).toHaveText('20 节点');
  await expect(page.locator('.topbar')).toHaveCount(0);
  await expect(page.locator('.product-controls')).toBeVisible();
  await expect(page.locator('.product-controls')).toBeAttached();
  await expect(page.locator('#categorySelect')).toBeHidden();
  await expect(page.locator('#queueItems')).toBeVisible();
  await expect(page.locator('.queue-card')).toHaveCount(2);
  const node = page.locator('.graph-node[data-node-id="station-orientation"]');
  await expect(node).toHaveCSS('background-color', 'rgb(9, 24, 45)');
  await expect(page.locator('.graph-node[data-node-id="safe-operations"]')).toHaveCSS('background-color', 'rgb(9, 24, 45)');
  await expect(page.locator('.graph-node[data-node-id="safe-operations"]')).toHaveCSS('opacity', '1');
  const nodeBox = await node.boundingBox();
  const iconBox = await node.locator('.node-icon').boundingBox();
  const titleBox = await node.locator('.node-title').boundingBox();
  expect(nodeBox).not.toBeNull();
  expect(iconBox).not.toBeNull();
  expect(titleBox).not.toBeNull();
  expect(iconBox!.x).toBeGreaterThan(titleBox!.x);
  expect(iconBox!.x + iconBox!.width).toBeLessThanOrEqual(nodeBox!.x + nodeBox!.width);
  const queueBar = await page.locator('.queuebar').boundingBox();
  const workspace = await page.locator('#workspace').boundingBox();
  expect(queueBar).not.toBeNull();
  expect(workspace).not.toBeNull();
  expect(queueBar!.y + queueBar!.height).toBeLessThanOrEqual(workspace!.y + 1);
  await expect(page).toHaveScreenshot('compact-workbench.png', { animations: 'disabled' });
});

test('searches globally and navigates to the real node tab', async ({ page }) => {
  await page.locator('#categorySelect').selectOption('fieldwork');
  await page.locator('#searchInput').fill('signal-basics');
  const result = page.locator('#searchResults button').first();
  const title = result.locator('b');
  const meta = result.locator('span');
  await expect(title).toBeVisible();
  await expect(meta).toBeVisible();
  const [resultBox, titleBox, metaBox] = await Promise.all([
    result.boundingBox(), title.boundingBox(), meta.boundingBox(),
  ]);
  expect(resultBox).not.toBeNull();
  expect(titleBox).not.toBeNull();
  expect(metaBox).not.toBeNull();
  expect(titleBox!.width).toBeGreaterThan(100);
  expect(metaBox!.width).toBeGreaterThan(100);
  expect(titleBox!.y).toBeLessThan(metaBox!.y);
  await page.locator('#searchResults button').click();
  await expect(page.locator('#categorySelect')).toHaveValue('analysis');
  await expect(page.locator('#detailBody h1')).toBeVisible();
  await expect(page.locator('.graph-node.is-selected[data-node-id="signal-basics"]')).toBeVisible();
});

test('selects a page, supports favorite shortcuts and edits combined pages', async ({ page }) => {
  await expect(page.locator('#categorySelect')).toHaveValue('foundations');
  await page.locator('#categorySelect').selectOption('analysis');
  await expect(page.locator('#categorySelect')).toHaveValue('analysis');
  await expect(page.locator('#activePage')).toHaveText('数据分析');

  await page.locator('#favoritePage').click();
  await page.locator('#moreButton').click();
  await expect(page.locator('#favoriteList button')).toContainText('数据分析');
  await page.locator('#moreButton').click();

  await page.locator('#addPreset').click();
  await page.locator('#presetName').fill('客户组合');
  await page.locator('#presetChoices input[value="fieldwork"]').check();
  await page.locator('#savePreset').click();
  await expect(page.locator('#activePage')).toHaveText('客户组合');
  await page.locator('#editPreset').click();
  await page.locator('#presetName').fill('客户组合新版');
  await page.locator('#presetChoices input[value="analysis"]').check();
  await page.locator('#savePreset').click();
  await expect(page.locator('#activePage')).toHaveText('客户组合新版');
  await expect(page.locator('#graphStats')).toHaveText('13 节点');
  await page.reload();
  await expect(page.locator('#activePage')).toHaveText('客户组合新版');
  await page.locator('#moreButton').click();
  await expect(page.locator('#favoriteList button')).toContainText('数据分析');
});

test('puts clear queue at the far right and explains unlock requirements beside early actions', async ({ page }) => {
  await page.locator('.graph-node[data-node-id="safe-operations"]').click();
  const actions = page.locator('#detailBody .detail-actions');
  await expect(actions).toBeVisible();
  const order = await page.locator('#detailBody').evaluate((body) => {
    const children = Array.from(body.children);
    return {
      actions: children.findIndex((element) => element.classList.contains('detail-actions')),
      firstSection: children.findIndex((element) => element.classList.contains('detail-section')),
    };
  });
  expect(order.actions).toBeGreaterThan(-1);
  expect(order.actions).toBeLessThan(order.firstSection);
  await expect(page.locator('#detailBody .unlock-link')).toHaveCount(2);
  await expect(page.locator('#detailBody .unlock-link').first()).toContainText('还需完成：观测站入门、结构化记录、基础测量');

  await page.getByRole('button', { name: '加入队列', exact: true }).click();
  const header = await page.locator('.queue-column > .queue-heading').boundingBox();
  const clear = await page.locator('#clearQueue').boundingBox();
  expect(header).not.toBeNull();
  expect(clear).not.toBeNull();
  expect(clear!.x + clear!.width).toBeGreaterThanOrEqual(header!.x + header!.width - 2);
});

test('search supports arrow and enter selection and node navigation history', async ({ page }) => {
  await page.locator('#searchInput').fill('signal-basics');
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('#searchInput')).toHaveAttribute('aria-activedescendant', 'search-result-0');
  await page.keyboard.press('Enter');
  await expect(page.locator('#detailBody h1')).toHaveText('信号基础');
  await page.locator('.graph-node[data-node-id="data-hygiene"]').click();
  await expect(page.locator('#historyBack')).toBeEnabled();
  await page.locator('#historyBack').click();
  await expect(page.locator('#detailBody h1')).toHaveText('信号基础');
  await page.locator('.graph-node[data-node-id="signal-basics"]').hover();
  await expect(page.locator('.graph-node.is-unfocused')).not.toHaveCount(0);
});

test('uses YART-style rich cards at high zoom without dimming unrelated nodes', async ({ page }) => {
  await page.locator('#categorySelect').selectOption('fieldwork');
  await page.locator('.graph-node[data-node-id="route-planning"]').hover();
  const unrelated = page.locator('.graph-node[data-node-id="sample-protocol"]');
  await expect(unrelated).toHaveClass(/is-unfocused/);
  await expect(unrelated).toHaveCSS('opacity', '1');
  await expect(unrelated).toHaveCSS('filter', 'none');

  for (let attempt = 0; attempt < 8; attempt++) {
    if (await page.locator('.node-layer').evaluate((layer) => layer.classList.contains('lod-rich'))) break;
    await page.locator('#zoomIn').click();
  }
  await expect(page.locator('.node-layer')).toHaveClass(/lod-rich/);
  const card = page.locator('.graph-node[data-node-id="route-planning"]');
  await expect(card.locator('.node-heading')).toBeVisible();
  await expect(card.locator('.node-rich-detail')).toContainText('根据目标');
  await expect(card.locator('.node-footer')).toBeVisible();
  const box = await card.boundingBox();
  expect(box?.height).toBeGreaterThan(60);
  const boxes = await page.locator('.graph-node').evaluateAll((elements) => elements.map((element) => {
    const { x, y, width, height } = element.getBoundingClientRect();
    return { left: x, top: y, right: x + width, bottom: y + height };
  }));
  for (let left = 0; left < boxes.length; left++) {
    for (let right = left + 1; right < boxes.length; right++) {
      const a = boxes[left]!;
      const b = boxes[right]!;
      expect(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top).toBe(true);
    }
  }
  await expect(page).toHaveScreenshot('rich-cards.png', { animations: 'disabled' });
  await page.locator('#languageToggle').click();
  const localizedCard = page.locator('.graph-node[data-node-id="route-planning"]');
  await expect(localizedCard.locator('.node-category')).toHaveText('TOPIC');
  await expect(localizedCard.locator('.node-footer')).toContainText('PREREQUISITES');
});

test('completes a node and all missing required prerequisites', async ({ page }) => {
  await page.locator('#categorySelect').selectOption('fieldwork');
  await page.locator('.graph-node[data-node-id="survey-mission"]').click();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: /^同时标记缺失前置完成/ }).click();
  await expect(page.locator('#progressSummary')).toHaveText('9 / 20 完成');
  const completed = page.locator('.graph-node[data-node-id="survey-mission"]');
  await expect(completed).toHaveClass(/status-completed/);
  await expect(completed).not.toHaveCSS('background-color', 'rgb(22, 75, 53)');
  await expect(completed).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await expect(completed).toHaveCSS('background-image', /linear-gradient/);
  await expect(completed).toHaveCSS('border-width', '2px');
  expect(await completed.evaluate((element) => (element as HTMLElement).style.getPropertyValue('--stage-color'))).toBe('#c7a56b');
  await page.locator('#closeDetails').click();
  await expect(page).toHaveScreenshot('completed-phase-tint.png', { animations: 'disabled' });
});

test('queues learning goals, removes them with the card X, and restores queue after reload', async ({ page }) => {
  await page.locator('.graph-node[data-node-id="station-orientation"]').click();
  await page.locator('#detailBody button').filter({ hasText: '加入队列' }).click();
  await page.locator('.graph-node[data-node-id="safe-operations"]').click();
  await page.locator('#detailBody button').filter({ hasText: '加入队列' }).click();
  await expect(page.locator('.queue-card')).toHaveCount(2);
  await expect(page.locator('.queue-card').first()).toContainText('观测站入门');
  await page.locator('.queue-card-open').last().focus();
  await page.keyboard.press('Alt+ArrowLeft');
  await expect(page.locator('.queue-card').first()).toHaveAttribute('data-node-id', 'station-orientation');
  await page.reload();
  await expect(page.locator('#layoutBusy')).toBeHidden();
  await expect(page.locator('.queue-card')).toHaveCount(2);
  await page.locator('.queue-remove').last().click();
  await expect(page.locator('.queue-card')).toHaveCount(1);
});

test('removes completed work from the learning queue', async ({ page }) => {
  await page.locator('.graph-node[data-node-id="station-orientation"]').click();
  await page.locator('#detailBody button').filter({ hasText: '加入队列' }).click();
  await page.getByRole('button', { name: '标记完成', exact: true }).click();
  await expect(page.locator('.queue-card')).toHaveCount(0);
});

test('clears the queue only after confirmation and preserves completion and notes', async ({ page }) => {
  await page.locator('.graph-node[data-node-id="station-orientation"]').click();
  await page.locator('#detailBody textarea').fill('Keep this private note');
  await page.getByRole('button', { name: '标记完成', exact: true }).click();
  await page.locator('.graph-node[data-node-id="safe-operations"]').click();
  await page.getByRole('button', { name: '加入队列', exact: true }).click();
  await page.locator('.graph-node[data-node-id="structured-notes"]').click();
  await page.getByRole('button', { name: '加入队列', exact: true }).click();
  await expect(page.locator('#clearQueue')).toBeVisible();

  page.once('dialog', (dialog) => dialog.dismiss());
  await page.locator('#clearQueue').click();
  await expect(page.locator('.queue-card')).toHaveCount(2);

  page.once('dialog', (dialog) => dialog.accept());
  await page.locator('#clearQueue').click();
  await expect(page.locator('.queue-card')).toHaveCount(0);
  await expect(page.locator('#clearQueue')).toBeHidden();
  await expect(page.locator('#progressSummary')).toHaveText('1 / 20 完成');
  await page.reload();
  await expect(page.locator('#progressSummary')).toHaveText('1 / 20 完成');
  await page.locator('.graph-node[data-node-id="station-orientation"]').click();
  await expect(page.locator('#detailBody textarea')).toHaveValue('Keep this private note');
});

test('uses YART modifier clicks and removes queued dependents with their prerequisite', async ({ page }) => {
  const ids = () => page.locator('.queue-card').evaluateAll((cards) => cards.map((card) => (card as HTMLElement).dataset.nodeId));
  await page.locator('.graph-node[data-node-id="safe-operations"]').click({ modifiers: ['Shift'] });
  expect(await ids()).toEqual(['station-orientation', 'safe-operations']);
  await page.locator('.graph-node[data-node-id="structured-notes"]').click({ modifiers: ['Alt'] });
  expect(await ids()).toEqual(['station-orientation', 'structured-notes', 'safe-operations']);
  await page.locator('.graph-node[data-node-id="basic-measurement"]').click({ modifiers: ['Control'] });
  expect(await ids()).toEqual(['station-orientation', 'basic-measurement']);
  await page.reload();
  await expect(page.locator('#layoutBusy')).toBeHidden();
  expect(await ids()).toEqual(['station-orientation', 'basic-measurement']);
  await page.locator('.queue-remove').first().click();
  await expect(page.locator('.queue-card')).toHaveCount(0);
  await expect(page.locator('#progressSummary')).toHaveText('0 / 20 完成');
});

test('opens a node context menu, queues a chain and dismisses it with keyboard focus restored', async ({ page }) => {
  const node = page.locator('.graph-node[data-node-id="systems-check"]');
  await node.click({ button: 'right' });
  await expect(page.getByRole('menu')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menu')).toHaveCount(0);
  await expect(node).toBeFocused();
  await node.click({ button: 'right' });
  await page.getByRole('menuitem', { name: '加入队列', exact: true }).click();
  await expect(page.locator('.queue-card')).toHaveCount(5);
  await node.click({ button: 'right' });
  await page.getByRole('menuitem', { name: '移出此项及依赖它的排队项', exact: true }).click();
  await expect(page.locator('.queue-card')).toHaveCount(4);
});

test('queues required prerequisites before the goal and opens a queued node across pages', async ({ page }) => {
  await page.locator('#categorySelect').selectOption('fieldwork');
  await page.locator('.graph-node[data-node-id="survey-mission"]').click();
  await page.getByRole('button', { name: '加入队列', exact: true }).click();
  await expect(page.locator('.queue-card')).toHaveCount(9);
  await expect(page.locator('.queue-card').last()).toHaveAttribute('data-node-id', 'survey-mission');
  const queueItems = page.locator('#queueItems');
  const queueScrollbar = page.locator('#queueScrollbar');
  await expect(queueScrollbar).toBeVisible();
  await expect(queueScrollbar).toHaveAttribute('aria-valuemax', /[1-9]\d*/);
  await queueScrollbar.focus();
  await page.keyboard.press('End');
  await expect.poll(() => queueItems.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
  await page.keyboard.press('Home');
  await expect.poll(() => queueItems.evaluate((element) => element.scrollLeft)).toBe(0);
  await page.locator('.queue-card-open').first().click();
  await expect(page.locator('#categorySelect')).toHaveValue('foundations');
  await expect(page.locator('#detailBody h1')).toHaveText('观测站入门');
  await expect(page).toHaveScreenshot('queue-and-details.png', { animations: 'disabled' });
});

test('creates a private combined page, restores it after reload and deletes it', async ({ page }) => {
  await page.locator('#addPreset').click();
  await page.locator('#presetName').fill('我的组合');
  await page.locator('#presetChoices input[value="fieldwork"]').check();
  await page.locator('#savePreset').click();
  await expect(page.locator('#activePage')).toHaveText('我的组合');
  await expect(page.locator('.graph-node.is-proxy')).toHaveCount(0);
  await expect(page.locator('#graphStats')).toHaveText('10 节点');
  await page.reload();
  await expect(page.locator('#activePage')).toHaveText('我的组合');
  page.once('dialog', (dialog) => dialog.accept());
  await page.locator('#deletePreset').click();
  await expect(page.locator('#activePage')).toHaveText('基础系统');
  await expect(page.locator('#categorySelect option')).toHaveCount(4);
});

test('backs up and restores notes, completion, queue and private combined pages', async ({ page }) => {
  await page.locator('.graph-node[data-node-id="station-orientation"]').click();
  await page.locator('#detailBody textarea').fill('客户的私人笔记 <script>不会执行</script>');
  await page.getByRole('button', { name: '标记完成', exact: true }).click();
  await page.locator('.graph-node[data-node-id="safe-operations"]').click();
  await page.getByRole('button', { name: '加入队列', exact: true }).click();
  await page.locator('#addPreset').click();
  await page.locator('#presetName').fill('备份组合');
  await page.locator('#presetChoices input[value="fieldwork"]').check();
  await page.locator('#savePreset').click();
  await expect(page.locator('#activePage')).toHaveText('备份组合');
  await page.locator('#moreButton').click();
  const pending = page.waitForEvent('download');
  await page.locator('#backupProgress').click();
  const backup = await pending;
  const backupPath = await backup.path();
  expect(backupPath).toBeTruthy();
  const raw = await readFile(backupPath!, 'utf8');
  expect(JSON.parse(raw).ui.presets[0].name).toBe('备份组合');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator('#layoutBusy')).toBeHidden();
  await page.locator('#progressFile').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(raw) });
  await expect(page.locator('#progressSummary')).toHaveText('1 / 20 完成');
  await expect(page.locator('.queue-card')).toHaveCount(1);
  await expect(page.locator('#activePage')).toHaveText('备份组合');
  await page.locator('#categorySelect').selectOption('foundations');
  await page.locator('.graph-node[data-node-id="station-orientation"]').click();
  await expect(page.locator('#detailBody textarea')).toHaveValue('客户的私人笔记 <script>不会执行</script>');
  const pendingExport = page.waitForEvent('download');
  await page.locator('#moreButton').click();
  await page.locator('#exportTree').click();
  const exported = await pendingExport;
  expect(await readFile((await exported.path())!, 'utf8')).not.toContain('客户的私人笔记');
  expect(await readFile((await exported.path())!, 'utf8')).not.toContain('备份组合');
});

test('rejects invalid imports while preserving the current tree and private progress', async ({ page }) => {
  await page.locator('.graph-node[data-node-id="station-orientation"]').click();
  await page.getByRole('button', { name: '标记完成', exact: true }).click();
  await page.locator('#treeFile').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{"format":"loregrid/tree-v2","nodes":[]}') });
  await expect(page.locator('#toast')).toContainText('文件无法打开');
  await expect(page.locator('#treeTitle')).toHaveText('远境观测站');
  await expect(page.locator('#progressSummary')).toHaveText('1 / 20 完成');
  await page.locator('#progressFile').setInputFiles({ name: 'wrong-tree.json', mimeType: 'application/json', buffer: Buffer.from('{"format":"loregrid/progress-v2","treeId":"other"}') });
  await expect(page.locator('#toast')).toContainText('different tree');
  await expect(page.locator('#progressSummary')).toHaveText('1 / 20 完成');
});

test('collapses details and toggles language', async ({ page }) => {
  await page.locator('.graph-node[data-node-id="station-orientation"]').click();
  await page.locator('#closeDetails').click();
  await expect(page.locator('#workspace')).toHaveClass(/details-closed/);
  await page.locator('#languageToggle').click();
  await expect(page.locator('#tabs')).toContainText('All');
  await expect(page.locator('#activePage')).toHaveText('Foundations');
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
  await expect(page.locator('#treeTitle')).not.toBeEmpty();
  if (process.env.LOREGRID_EXPECT_TREE_TITLE) {
    await expect(page.locator('#treeTitle')).toHaveText(process.env.LOREGRID_EXPECT_TREE_TITLE);
  }
  await expect(page.locator('#statusText')).toHaveText('Loregrid 2.0.0-rc.8');
  await expect(page.locator('.graph-node').first()).toBeVisible();
  const currentPageCount = Number(((await page.locator('#graphStats').textContent()) ?? '').match(/\d+/)?.[0]);
  await page.locator('#tabs button').first().click();
  await expect(page.locator('#categorySelect')).toBeHidden();
  await expect(page.locator('#layoutBusy')).toBeHidden();
  const allCount = Number(((await page.locator('#graphStats').textContent()) ?? '').match(/\d+/)?.[0]);
  expect(allCount).toBeGreaterThanOrEqual(currentPageCount);
  await expect(page.locator('.graph-node').first()).toBeVisible();
});

test('keeps the research board usable at a narrow viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('#layoutBusy')).toBeHidden();
  await expect(page.locator('.graph-node').first()).toBeVisible();
  const overflows = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflows).toBe(false);
  await expect(page.locator('#tabs')).toBeVisible();
  await expect(page).toHaveScreenshot('narrow-board.png', { animations: 'disabled' });
});
