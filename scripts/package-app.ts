import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = resolve(root, 'dist/index.html');
const output = resolve(root, 'index.html');
let html = await readFile(source, 'utf8');
if (!html.includes('id="app"') || /<script[^>]+src=["'][^"']+\.ts["']/.test(html)) {
  throw new Error('Unexpected offline HTML structure.');
}
const notice = await readFile(resolve(root, 'docs/legal/THIRD_PARTY_NOTICES.md'), 'utf8');
const license = await readFile(resolve(root, 'LICENSE'), 'utf8');
const attribution = `\nLoregrid open-source licenses\n\n${license}\n\n${notice}\n`.replace(/--/g, '—');
html = html.replace('</head>', `<!--${attribution}-->\n</head>`);
await writeFile(source, html, 'utf8');
if (process.env.LOREGRID_TREE_JSON) {
  console.info('Custom tree build: dist/index.html only; the public app was not updated.');
} else {
  await writeFile(output, html, 'utf8');
  console.info('Ready app: index.html (open directly; no Node.js or Vite needed).');
}
