import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { normalizeTree } from '../src/core/normalize';
import { validateTree } from '../src/core/validate';

async function main(): Promise<void> {
  const requested = process.argv.slice(2);
  const files = requested.length > 0
    ? requested
    : (await readdir(resolve('data'))).filter((name) => name.endsWith('.json')).map((name) => resolve('data', name));
  let failed = false;

  for (const file of files) {
    try {
      const raw: unknown = JSON.parse(await readFile(resolve(file), 'utf8'));
      const normalized = normalizeTree(raw);
      const issues = validateTree(normalized.tree);
      const errors = issues.filter((issue) => issue.severity === 'error');
      issues.filter((issue) => issue.severity === 'warning').forEach((issue) => {
        console.warn(`Warning ${file}: ${issue.message}`);
      });
      if (errors.length > 0) {
        failed = true;
        console.error(`${file}\n${errors.map((issue) => `  [${issue.code}] ${issue.message}`).join('\n')}`);
      } else {
        const migration = normalized.migratedFrom ? `; migrated from ${normalized.migratedFrom}` : '';
        console.log(`Valid: ${file} (${normalized.tree.nodes.length} nodes; ${normalized.tree.tabs.length} tabs${migration})`);
      }
    } catch (error) {
      failed = true;
      console.error(`${file}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (failed) process.exitCode = 1;
}

void main();
