import { readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { normalizeTree } from '../src/core/normalize';
import { assertValidTree } from '../src/core/validate';

async function main(): Promise<void> {
  const [inputArg, outputArg] = process.argv.slice(2);
  if (!inputArg) {
    console.error('Usage: npm run migrate -- <input-v1.json> [output-v2.json]');
    process.exitCode = 1;
    return;
  }

  const input = resolve(inputArg);
  const fallbackName = `${basename(input, extname(input))}.v2.json`;
  const output = resolve(outputArg ?? join(dirname(input), fallbackName));
  const raw: unknown = JSON.parse(await readFile(input, 'utf8'));
  const result = normalizeTree(raw);
  if (result.migratedFrom !== 'learning-tech-tree/v1') {
    throw new Error('Input is not a learning-tech-tree/v1 document. No migration was written.');
  }
  assertValidTree(result.tree);
  await writeFile(output, `${JSON.stringify(result.tree, null, 2)}\n`, 'utf8');
  console.log(`Migrated ${input} -> ${output} (${result.tree.nodes.length} nodes)`);
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
