import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

test('opens V1 content, migrates progress without modifying its original storage, and retains notes', async ({ page }) => {
  const input = JSON.parse(await readFile('data/examples/computer-science-phd.json', 'utf8'));
  const node = input.nodes[0];
  await page.goto('/');
  await expect(page.locator('#layoutBusy')).toBeHidden();
  await page.evaluate(({ treeId, nodeId }) => {
    localStorage.setItem(`learning-tech-tree:progress:${treeId}`, JSON.stringify({
      format: 'learning-tech-progress/v1', treeId, completed: { [nodeId]: true }, notes: { [nodeId]: '旧笔记' },
    }));
  }, { treeId: input.id, nodeId: node.id });
  await page.locator('#treeFile').setInputFiles('data/examples/computer-science-phd.json');
  await expect(page.locator('#treeTitle')).toHaveText(input.title);
  await expect(page.locator('#activePage')).toHaveText(input.branches[0].label);
  await expect(page.locator('#progressSummary')).toHaveText(`1 / ${input.nodes.length} 完成`);
  await page.locator('#searchInput').fill(node.id);
  await page.locator('#searchResults button').first().click();
  await expect(page.locator('.detail-stage')).toHaveText('阶段 · 早期基础');
  await expect(page.locator('#detailBody textarea')).toHaveValue('旧笔记');
  const saved = await page.evaluate((treeId) => ({
    legacy: localStorage.getItem(`learning-tech-tree:progress:${treeId}`),
    current: Object.entries(localStorage).find(([key]) =>
      key.startsWith('loregrid:progress-entry:') && key.endsWith(`:${treeId}`),
    )?.[1] ?? null,
  }), input.id);
  expect(JSON.parse(saved.legacy!).format).toBe('learning-tech-progress/v1');
  expect(JSON.parse(saved.current!).format).toBe('loregrid/progress-v2');
});

test('shows a V2 node stage in the details panel', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.graph-node').first()).toBeVisible();
  await page.locator('.graph-node[data-node-id="station-orientation"]').click();
  await expect(page.locator('.detail-stage')).toHaveText('阶段 · 基础准备');
});

test('opens the single file offline without external requests and renders imported text safely', async ({ page, context }) => {
  await context.setOffline(true);
  const requests: string[] = [];
  page.on('request', (request) => { if (/^https?:/.test(request.url())) requests.push(request.url()); });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(pathToFileURL(resolve('dist/index.html')).href);
  await expect(page.locator('.graph-node').first()).toBeVisible();
  const input = JSON.parse(await readFile('data/examples/loregrid-demo.json', 'utf8'));
  input.id = 'safe-import';
  input.nodes[0].title = '<img src=x onerror=alert(1)>';
  input.nodes[0].summary = '<script>window.injected=true</script>';
  await page.locator('#treeFile').setInputFiles({ name: 'safe.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(input)) });
  await page.locator(`.graph-node[data-node-id="${input.nodes[0].id}"]`).click();
  await expect(page.locator('#detailBody h1')).toHaveText(input.nodes[0].title);
  await expect(page.locator('#detailBody img, #detailBody script')).toHaveCount(0);
  expect(await page.evaluate(() => 'injected' in window)).toBe(false);
  await page.reload();
  await expect(page.locator('#treeTitle')).toHaveText(input.title);
  await expect(page.locator('.graph-node').first()).toBeVisible();
  input.resources = [{ id: 'unsafe-link', title: 'Unsafe', url: 'javascript:alert(1)' }];
  await page.locator('#treeFile').setInputFiles({ name: 'unsafe.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(input)) });
  await expect(page.locator('#toast')).toContainText('HTTP(S)');
  expect(requests).toEqual([]);
  expect(errors).toEqual([]);
});

test('switches local JSON trees and isolates queues, completion, and last page', async ({ page }) => {
  const source = JSON.parse(await readFile('data/examples/loregrid-demo.json', 'utf8'));
  const alpha = { ...source, id: 'same-tree-id', title: 'Alpha history' };
  const beta = { ...source, id: 'same-tree-id', title: 'Beta history' };
  await page.goto('/');
  await page.locator('#treeFile').setInputFiles([
    { name: 'alpha.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(alpha)) },
    { name: 'beta.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(beta)) },
  ]);
  await expect(page.locator('#treeTitle')).toHaveText(alpha.title);
  await page.locator('#treeSwitcherToggle').click();
  await expect(page.locator('#treeList .tree-choice')).toHaveCount(3);
  await page.keyboard.press('Escape');
  await page.locator('.graph-node[data-node-id="station-orientation"]').click();
  await page.locator('#detailBody textarea').fill('Alpha private note');
  await page.locator('#detailBody button').filter({ hasText: '加入队列' }).click();
  await page.locator('#categorySelect').selectOption('fieldwork');
  await page.locator('#treeSwitcherToggle').click();
  await page.locator('.tree-choice').filter({ hasText: beta.title }).click();
  await expect(page.locator('#treeTitle')).toHaveText(beta.title);
  await expect(page.locator('.queue-card')).toHaveCount(0);
  await expect(page.locator('#categorySelect')).toHaveValue('foundations');
  await page.locator('.graph-node[data-node-id="station-orientation"]').click();
  await expect(page.locator('#detailBody textarea')).toHaveValue('');
  await page.locator('#detailBody textarea').fill('Beta private note');
  await page.getByRole('button', { name: '标记完成', exact: true }).click();
  await page.locator('#categorySelect').selectOption('analysis');
  await page.locator('#treeSwitcherToggle').click();
  await page.locator('.tree-choice').filter({ hasText: alpha.title }).click();
  await expect(page.locator('#treeTitle')).toHaveText(alpha.title);
  await expect(page.locator('.queue-card')).toHaveCount(1);
  await expect(page.locator('#categorySelect')).toHaveValue('fieldwork');
  await page.locator('#searchInput').fill('station-orientation');
  await page.locator('#searchResults button').first().click();
  await expect(page.locator('#detailBody textarea')).toHaveValue('Alpha private note');
  await page.locator('#treeSwitcherToggle').click();
  await page.locator('.tree-choice').filter({ hasText: beta.title }).click();
  await expect(page.locator('#progressSummary')).toHaveText('1 / 20 完成');
  await expect(page.locator('#categorySelect')).toHaveValue('analysis');
  await page.locator('#treeFile').setInputFiles({
    name: 'beta.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(beta)),
  });
  await page.locator('#treeSwitcherToggle').click();
  await expect(page.locator('#treeList .tree-choice')).toHaveCount(3);
  await page.keyboard.press('Escape');
  await page.locator('#searchInput').fill('station-orientation');
  await page.locator('#searchResults button').first().click();
  await expect(page.locator('#detailBody textarea')).toHaveValue('Beta private note');
  await page.locator('#categorySelect').selectOption('analysis');
  await page.reload();
  await expect(page.locator('#treeTitle')).toHaveText(beta.title);
  await expect(page.locator('#progressSummary')).toHaveText('1 / 20 完成');
  await expect(page.locator('#categorySelect')).toHaveValue('analysis');
});

test('loads public trees on demand and reopens the cached tree offline', async ({ page, context }) => {
  const source = JSON.parse(await readFile('data/examples/loregrid-demo.json', 'utf8'));
  const publicTree = { ...source, id: 'public-demo-tree', title: 'Public demo tree' };
  let downloads = 0;
  await page.route('**/tree-catalog.json', (route) => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({
      format: 'loregrid/public-tree-catalog-v1',
      trees: [{ id: publicTree.id, title: publicTree.title, url: './trees/public-demo-tree.json' }],
    }),
  }));
  await page.route('**/trees/public-demo-tree.json', (route) => {
    downloads++;
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify(publicTree) });
  });
  await page.goto('/');
  await page.locator('#treeSwitcherToggle').click();
  const publicChoice = page.locator('.tree-choice').filter({ hasText: publicTree.title });
  await expect(publicChoice).toBeVisible();
  await expect(publicChoice).toContainText('公开');
  expect(downloads).toBe(0);
  await publicChoice.click();
  await expect(page.locator('#treeTitle')).toHaveText(publicTree.title);
  expect(downloads).toBe(1);
  await page.locator('.graph-node[data-node-id="station-orientation"]').click();
  await page.locator('#detailBody button').filter({ hasText: '加入队列' }).click();

  await page.route('**/tree-catalog.json', (route) => route.abort());
  await page.route('**/trees/public-demo-tree.json', (route) => route.abort());
  await page.reload();
  await expect(page.locator('#treeTitle')).toHaveText(publicTree.title);
  await expect(page.locator('.queue-card')).toHaveCount(1);
  await page.locator('#treeSwitcherToggle').click();
  await expect(page.locator('.tree-choice').filter({ hasText: publicTree.title })).toContainText('公开');
  await page.keyboard.press('Escape');

  await page.locator('#treeSwitcherToggle').click();
  await page.locator('.tree-choice').filter({ hasText: '远境观测站' }).click();
  await expect(page.locator('.queue-card')).toHaveCount(0);
  await context.setOffline(true);
  await page.locator('#treeSwitcherToggle').click();
  await page.locator('.tree-choice').filter({ hasText: publicTree.title }).click();
  await expect(page.locator('#treeTitle')).toHaveText(publicTree.title);
  await expect(page.locator('.queue-card')).toHaveCount(1);
});

test('rejects a mismatched public tree without replacing the current tree', async ({ page }) => {
  const source = JSON.parse(await readFile('data/examples/loregrid-demo.json', 'utf8'));
  await page.route('**/tree-catalog.json', (route) => route.fulfill({
    json: {
      format: 'loregrid/public-tree-catalog-v1',
      trees: [{ id: 'expected-tree', title: 'Mismatched tree', url: './trees/mismatch.json' }],
    },
  }));
  await page.route('**/trees/mismatch.json', (route) => route.fulfill({ json: source }));
  await page.goto('/');
  await expect(page.locator('.graph-node').first()).toBeVisible();
  await page.locator('#treeSwitcherToggle').click();
  await page.locator('.tree-choice').filter({ hasText: 'Mismatched tree' }).click();
  await expect(page.locator('#toast')).toContainText('ID does not match');
  await expect(page.locator('#treeTitle')).toHaveText(source.title);
});

test('bounds and searches a large tree list instead of growing over the board', async ({ page }) => {
  const source = JSON.parse(await readFile('data/examples/loregrid-demo.json', 'utf8'));
  const files = Array.from({ length: 14 }, (_, index) => {
    const tree = { ...source, id: `library-tree-${index}`, title: `Study tree ${index}` };
    return { name: `study-${index}.json`, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(tree)) };
  });
  await page.goto('/');
  await page.locator('#treeFile').setInputFiles(files);
  await page.locator('#treeSwitcherToggle').click();
  await expect(page.locator('#treeList .tree-choice')).toHaveCount(15);
  await expect(page.locator('#treePicker')).toBeVisible();
  await expect(page.locator('#treeSearch')).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('#treeList .tree-choice').first()).toBeFocused();
  await page.locator('#treeList .tree-choice').first().focus();
  const dimensions = await page.locator('#treeList').evaluate((element) => ({
    height: element.clientHeight,
    content: element.scrollHeight,
  }));
  expect(dimensions.content).toBeGreaterThan(dimensions.height);
  await expect(page).toHaveScreenshot('tree-library.png', { animations: 'disabled' });
  await page.locator('#treeSearch').fill('study-13');
  await expect(page.locator('#treeList .tree-choice')).toHaveCount(1);
  await expect(page.locator('#treeList .tree-choice')).toContainText('Study tree 13');
  await page.keyboard.press('Escape');
  await expect(page.locator('#treePicker')).toBeHidden();
  await expect(page.locator('#treeSwitcherToggle')).toBeFocused();
});

test('loads 10000 nodes, switches pages, searches globally and measures pan and zoom frames', async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  const tabs = Array.from({ length: 10 }, (_, i) => ({ id: `t${i}`, label: `Page ${i}` }));
  const nodes = Array.from({ length: 10_000 }, (_, i) => ({ id: `n${i}`, title: `Topic ${i}`, tabId: `t${Math.floor(i / 1000)}` }));
  const edges = nodes.filter((_, i) => i % 1000 !== 0).map((node) => {
    const i = Number(node.id.slice(1));
    return { id: `e${i}`, source: `n${i - 1}`, target: node.id, type: 'required' };
  });
  await page.goto('/');
  await page.locator('#treeFile').setInputFiles({ name: 'stress.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({
    format: 'loregrid/tree-v2', id: 'large-tree-stress', title: 'Stress', language: 'en', tabs, nodes, edges, resources: [],
  })) });
  await expect(page.locator('#graphStats')).toHaveText('1000 nodes');
  await page.locator('#categorySelect').selectOption({ label: 'Page 8' });
  await expect(page.locator('#activePage')).toHaveText('Page 8');
  const measureInteraction = (mode: 'pan' | 'zoom') => page.evaluate(async (interaction) => {
    const viewport = document.querySelector('#viewport')!;
    const rect = viewport.getBoundingClientRect();
    const timings: number[] = [];
    let active = true;
    let previous = performance.now();
    const recordFrame = () => {
      const now = performance.now();
      if (timings.length >= 0 && now - previous > 0) timings.push(now - previous);
      previous = now;
      if (active) requestAnimationFrame(recordFrame);
    };
    requestAnimationFrame(recordFrame);
    const x = rect.x + rect.width / 2;
    const y = rect.y + rect.height / 2;
    if (interaction === 'pan') {
      viewport.setPointerCapture = () => {};
      viewport.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, clientX: x, clientY: y }));
    }
    for (let frame = 0; frame < 100; frame++) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      if (interaction === 'pan') {
        viewport.dispatchEvent(new PointerEvent('pointermove', {
          bubbles: true, pointerId: 1, buttons: 1, clientX: x + frame, clientY: y + frame / 2,
        }));
      } else {
        viewport.dispatchEvent(new WheelEvent('wheel', {
          deltaY: frame % 2 ? 5 : -5, clientX: x, clientY: y, cancelable: true,
        }));
      }
    }
    if (interaction === 'pan') viewport.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1 }));
    active = false;
    timings.splice(0, 10);
    timings.sort((a, b) => a - b);
    return {
      medianFrameMs: timings[Math.floor(timings.length / 2)]!,
      p95FrameMs: timings[Math.floor(timings.length * 0.95)]!,
      maxFrameMs: timings.at(-1)!,
    };
  }, mode);
  const measurement = {
    nodes: 10_000,
    visiblePageNodes: 1_000,
    pan: await measureInteraction('pan'),
    zoom: await measureInteraction('zoom'),
  };
  console.info('Interaction frame measurement:', JSON.stringify(measurement));
  await testInfo.attach('interaction-frame-measurement', { body: JSON.stringify(measurement, null, 2), contentType: 'application/json' });
  expect(measurement.pan.p95FrameMs).toBeLessThan(100);
  expect(measurement.zoom.p95FrameMs).toBeLessThan(100);
  await page.locator('#searchInput').fill('n9999');
  await page.locator('#searchResults button').first().click();
  await expect(page.locator('#categorySelect')).toHaveValue('t9');
  await expect(page.locator('#activePage')).toHaveText('Page 9');
  await expect(page.locator('#detailBody h1')).toHaveText('Topic 9999');
  await page.locator('#closeDetails').click();
  await page.locator('#tabs button').click();
  await expect(page.locator('#graphStats')).toHaveText('10000 nodes');
  await expect(page.locator('#layoutBusy')).toBeHidden();
});

test('shows the concrete build version in the app footer', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#statusText')).toHaveText('Loregrid 2.0.0-rc.9');
});
