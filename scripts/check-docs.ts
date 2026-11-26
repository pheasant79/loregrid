import { readdir, readFile, stat } from 'node:fs/promises';
import { dirname, extname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Local targets only: external availability and rendered layout need separate checks.
const root = fileURLToPath(new URL('../', import.meta.url));
async function collect(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const results = await Promise.all(entries.filter((entry) => entry.name !== 'long-tasks').map(async (entry) => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? collect(path) : entry.name.endsWith('.md') ? [path] : [];
  }));
  return results.flat();
}
function withoutFences(content: string): string {
  return content.replace(/^(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\1\s*$/gm, '');
}
function anchors(content: string): Set<string> {
  const ids = new Set<string>();
  const duplicates = new Map<string, number>();
  for (const match of withoutFences(content).matchAll(/^#{1,6}\s+(.+?)\s*#*\s*$/gm)) {
    const slug = (match[1] ?? '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/<[^>]*>/g, '').toLowerCase()
      .replace(/[^\p{L}\p{N}\p{M}_\-\s]/gu, '').replace(/\s/g, '-');
    const count = duplicates.get(slug) ?? 0;
    ids.add(count ? `${slug}-${count}` : slug);
    duplicates.set(slug, count + 1);
  }
  for (const match of content.matchAll(/\b(?:id|name)=["']([^"']+)["']/g)) ids.add(match[1]!);
  return ids;
}
const files = [resolve(root, 'README.md'), resolve(root, 'AGENTS.md'), ...await collect(resolve(root, 'docs')), ...await collect(resolve(root, 'prompts')), ...await collect(resolve(root, '.github')), ...await collect(resolve(root, 'data'))];
const failures: string[] = [];
let checked = 0;
for (const file of files) {
  const content = withoutFences(await readFile(file, 'utf8'));
  const urls = [...content.matchAll(/!?\[[^\]]*\]\(<?([^\s)>]+)>?(?:\s+["'][^\n]*?["'])?\)/g)].map((match) => match[1]!);
  urls.push(...[...content.matchAll(/\b(?:src|href)=["']([^"']+)["']/g)].map((match) => match[1]!));
  for (const url of urls) {
    if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(url)) continue;
    checked++;
    const [pathPart = '', fragment = ''] = url.split('#');
    const target = pathPart ? resolve(dirname(file), decodeURIComponent(pathPart.split('?')[0]!)) : file;
    try {
      await stat(target);
      if (fragment && extname(target) === '.md' && !anchors(await readFile(target, 'utf8')).has(decodeURIComponent(fragment))) {
        failures.push(`${relative(root, file)}: missing anchor ${url}`);
      }
    } catch {
      failures.push(`${relative(root, file)}: missing file ${url}`);
    }
  }
}
if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else {
  console.info(`Checked ${checked} local links across ${files.length} Markdown files. External URLs and visual layout were not checked.`);
}
