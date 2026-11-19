import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
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
await copyFile(resolve('dist/index.html'), resolve(deliveryDir, `loregrid-${packageInfo.version}.html`));
await copyFile(resolve('LICENSE'), resolve(deliveryDir, 'LICENSE'));
await copyFile(resolve('THIRD_PARTY_NOTICES.md'), resolve(deliveryDir, 'THIRD_PARTY_NOTICES.md'));
