import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { build } from 'vite';
import { normalizeTree } from '../src/core/normalize';
import { assertValidTree } from '../src/core/validate';

const treeFile = process.argv.slice(2).find((argument) => argument !== '--');
if (!treeFile) {
  console.error('Usage: pnpm build:customer -- <tree.json>');
  process.exit(2);
}

const source = JSON.parse(await readFile(resolve(treeFile), 'utf8')) as unknown;
const normalized = normalizeTree(source);
assertValidTree(normalized.tree);
const packageInfo = JSON.parse(await readFile(resolve('package.json'), 'utf8')) as { version: string };
process.env.LOREGRID_TREE_JSON = JSON.stringify(normalized.tree);

await build();

const deliveryDir = resolve('dist/customer-delivery');
await mkdir(deliveryDir, { recursive: true });
const treesDir = resolve(deliveryDir, 'trees');
await mkdir(treesDir, { recursive: true });
await copyFile(resolve('dist/index.html'), resolve(deliveryDir, 'Loregrid.html'));
await copyFile(resolve(treeFile), resolve(treesDir, basename(treeFile)));
await copyFile(resolve('LICENSE'), resolve(deliveryDir, 'LICENSE'));
await copyFile(resolve('THIRD_PARTY_NOTICES.md'), resolve(deliveryDir, 'THIRD_PARTY_NOTICES.md'));
await copyFile(resolve('docs/customer-quickstart.zh-CN.txt'), resolve(deliveryDir, '使用说明.txt'));
await writeFile(resolve(deliveryDir, 'loregrid-delivery.json'), `${JSON.stringify({
  format: 'loregrid/customer-delivery-v1',
  app: 'Loregrid.html',
  version: packageInfo.version,
  treeId: normalized.tree.id,
  treeTitle: normalized.tree.title,
  embeddedTree: basename(treeFile),
  storage: 'browser-local',
}, null, 2)}\n`, 'utf8');
