import { copyFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const manifest = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8')) as { version: string };
const destination = resolve(root, 'dist', `Loregrid-v${manifest.version}-offline`);
await mkdir(destination, { recursive: true });
await mkdir(resolve(destination, 'data/trees'), { recursive: true });
await mkdir(resolve(destination, 'data/progress'), { recursive: true });
await mkdir(resolve(destination, 'licenses'), { recursive: true });

// Explicit allowlist: never include personal trees, progress, or working files.
for (const name of ['loregrid-demo.json', 'computer-science-phd.json']) {
  await copyFile(resolve(root, 'data/trees', name), resolve(destination, 'data/trees', name));
}
await copyFile(resolve(root, 'dist/index.html'), resolve(destination, 'index.html'));
await copyFile(resolve(root, 'LICENSE'), resolve(destination, 'licenses/LICENSE.txt'));
const notices = (await readFile(resolve(root, 'docs/legal/THIRD_PARTY_NOTICES.md'), 'utf8'))
  .replace('(../../LICENSE)', '(LICENSE.txt)')
  .replace('(../yart-source-map.md)', '(yart-source-map.md)');
await writeFile(resolve(destination, 'licenses/THIRD_PARTY_NOTICES.md'), notices, 'utf8');
const sourceMap = (await readFile(resolve(root, 'docs/yart-source-map.md'), 'utf8'))
  .replace('(legal/THIRD_PARTY_NOTICES.md)', '(THIRD_PARTY_NOTICES.md)')
  .replace('(yart-parity.md)', '(https://github.com/pheasant79/loregrid/blob/main/docs/yart-parity.md)');
await writeFile(resolve(destination, 'licenses/yart-source-map.md'), sourceMap, 'utf8');
await writeFile(resolve(destination, '使用说明-START-HERE.txt'), `Loregrid ${manifest.version} — offline preview / 离线预发布版

启动 / Open
解压整个压缩包，双击 index.html。不要在压缩包内直接运行。
Extract the entire ZIP, then open index.html in Chrome, Edge, or Firefox.
No installation, Node.js, Vite, server, or account is required.

加载树 / Load trees
HTML 默认内置一棵虚构示例，不会自动扫描旁边的文件夹。
Chrome / Edge：点击左上角「⋯」→「选择数据文件夹」，
选择本包中的 data 文件夹（不是 trees），并允许访问。
授权有效时，启动或刷新数据会读取 data/trees 下的 JSON。
AI 更新 JSON 后，点击「刷新数据」；权限失效时重新授权。
In Chrome / Edge, open the upper-left ⋯ menu, choose the data-folder
action, and select data (not trees). Grant the requested access.
Reload data after editing JSON; reconnect if permission expires.
Firefox 不支持该文件夹连接方式；请在右下角树库菜单手动导入 JSON。
Firefox: manually import JSON from the lower-right Tree library menu.

文件 / Files
data/trees/     树定义；由 AI 或作者编辑。应用不会回写树定义。
data/progress/  完成、队列与笔记；连接并允许写入后保存独立进度 JSON。
licenses/      MIT 许可证、第三方声明及 YART 来源映射。
The app only reads tree definitions. Progress is separate.
Folder saving requires browser support and write permission.

备份 / Backups
浏览器缓存不是备份。重要记录请导出进度 JSON，并保留原始树文件。
不同浏览器、配置、设备或 HTML 路径可能使用不同的本地存储。
Keep tree files and exported progress backups. Browser storage may
be cleared and is not shared between browsers, profiles, or devices.
没有账号、云同步、遥测或游戏式自动研究。
No account, cloud sync, telemetry, or automatic timed research.

源码与文档 / Source and documentation
https://github.com/pheasant79/loregrid
https://github.com/pheasant79/loregrid/blob/main/docs/README.zh-CN.md
https://github.com/pheasant79/loregrid/blob/main/docs/data-format.md
`, 'utf8');
await writeFile(resolve(destination, 'data/progress/README.txt'),
  'Private progress JSON belongs here. Keep backups; do not publish personal files.\n私人进度文件保存在这里，请备份，不要公开上传。\n', 'utf8');

const allowedRoot = new Set(['index.html', 'data', 'licenses', '使用说明-START-HERE.txt']);
const entries = await readdir(destination);
if (entries.some((name) => !allowedRoot.has(name))) throw new Error('Unexpected release files; use a clean dist directory.');
const trees = await readdir(resolve(destination, 'data/trees'));
const progress = await readdir(resolve(destination, 'data/progress'));
if (trees.length !== 2 || progress.length !== 1 || progress[0] !== 'README.txt') {
  throw new Error('Unexpected data files in release; refusing to package private data.');
}
console.info(`Release folder ready: ${destination}`);
