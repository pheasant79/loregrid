import { defineConfig } from 'vitest/config';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { readFileSync } from 'node:fs';

const packageInfo = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };
const bundledTree = process.env.LOREGRID_TREE_JSON
  ? JSON.parse(process.env.LOREGRID_TREE_JSON) as unknown
  : JSON.parse(readFileSync(new URL('./data/trees/loregrid-demo.json', import.meta.url), 'utf8')) as unknown;
const bundledTreeLiteral = JSON.stringify(bundledTree)
  .replace(/</g, '\\u003c')
  .replace(/\u2028/g, '\\u2028')
  .replace(/\u2029/g, '\\u2029');

export default defineConfig({
  base: './',
  define: {
    __LOREGRID_VERSION__: JSON.stringify(packageInfo.version),
    __LOREGRID_INITIAL_TREE__: bundledTreeLiteral,
  },
  plugins: [viteSingleFile()],
  build: {
    target: 'es2022',
    cssCodeSplit: false,
    assetsInlineLimit: 100_000_000,
    chunkSizeWarningLimit: 5000,
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
  worker: {
    // Classic inline Blob workers also work when the single HTML is opened via file:.
    format: 'iife',
  },
  test: {
    environment: 'jsdom',
    exclude: ['tests/e2e/**', 'node_modules/**', 'dist/**'],
    coverage: {
      reporter: ['text', 'html'],
    },
  },
});
