import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

test('opens V1 content, migrates progress without modifying its original storage, and retains notes', async ({ page }) => {
  const input = JSON.parse(await readFile('data/computer-science-phd.json', 'utf8'));
  const node = input.nodes[0];
  await page.goto('/');
  await expect(page.locator('#layoutBusy')).toBeHidden();
  await page.evaluate(({ treeId, nodeId }) => {
    localStorage.setItem(`learning-tech-tree:progress:${treeId}`, JSON.stringify({
      format: 'learning-tech-progress/v1', treeId, completed: { [nodeId]: true }, notes: { [nodeId]: '旧笔记' },
    }));
  }, { treeId: input.id, nodeId: node.id });
  await page.locator('#treeFile').setInputFiles('data/computer-science-phd.json');
  await expect(page.locator('#treeTitle')).toHaveText(input.title);
  await expect(page.locator('#activePage')).toHaveText(input.branches[0].label);
  await expect(page.locator('#progressSummary')).toHaveText(`1 / ${input.nodes.length} 完成`);
  await page.locator('#searchInput').fill(node.id);
  await page.locator('#searchResults button').first().click();
  await expect(page.locator('.detail-stage')).toHaveText('阶段 · 早期基础');
  await expect(page.locator('#detailBody textarea')).toHaveValue('旧笔记');
  const saved = await page.evaluate((treeId) => ({
    legacy: localStorage.getItem(`learning-tech-tree:progress:${treeId}`),
    current: localStorage.getItem(`loregrid:progress:${treeId}`),
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
  const input = JSON.parse(await readFile('data/loregrid-demo.json', 'utf8'));
  input.id = 'safe-import';
  input.nodes[0].title = '<img src=x onerror=alert(1)>';
  input.nodes[0].summary = '<script>window.injected=true</script>';
  await page.locator('#treeFile').setInputFiles({ name: 'safe.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(input)) });
  await page.locator(`.graph-node[data-node-id="${input.nodes[0].id}"]`).click();
  await expect(page.locator('#detailBody h1')).toHaveText(input.nodes[0].title);
  await expect(page.locator('#detailBody img, #detailBody script')).toHaveCount(0);
  expect(await page.evaluate(() => 'injected' in window)).toBe(false);
  input.resources = [{ id: 'unsafe-link', title: 'Unsafe', url: 'javascript:alert(1)' }];
  await page.locator('#treeFile').setInputFiles({ name: 'unsafe.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(input)) });
  await expect(page.locator('#toast')).toContainText('HTTP(S)');
  expect(requests).toEqual([]);
  expect(errors).toEqual([]);
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
    format: 'loregrid/tree-v2', id: 'customer-stress', title: 'Stress', language: 'en', tabs, nodes, edges, resources: [],
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
  await expect(page.locator('#statusText')).toHaveText('Loregrid 2.0.0-rc.8');
});
