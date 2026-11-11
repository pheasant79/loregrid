import { performance } from 'node:perf_hooks';
import { buildGraphView, tabKey } from '../src/core/graph';
import { layoutGraph } from '../src/core/layout';
import { SearchIndex } from '../src/core/search';
import { TREE_FORMAT, type TreeDefinitionV2 } from '../src/core/types';
import { assertValidTree } from '../src/core/validate';

function syntheticTree(size: number, tabCount = 10): TreeDefinitionV2 {
  const perTab = Math.ceil(size / tabCount);
  const tabs = Array.from({ length: tabCount }, (_, index) => ({ id: `tab${index}`, label: `Tab ${index}`, order: index }));
  const nodes = Array.from({ length: size }, (_, index) => ({
    id: `node${index}`,
    title: `Synthetic node ${index}`,
    tabId: `tab${Math.min(tabCount - 1, Math.floor(index / perTab))}`,
    tags: [`group-${index % 37}`],
  }));
  const edges = [];
  for (let index = 1; index < size; index += 1) {
    if (index % perTab !== 0) {
      edges.push({ id: `edge${index}`, source: `node${index - 1}`, target: `node${index}`, type: 'required' as const });
    } else {
      edges.push({ id: `edge${index}`, source: `node${Math.max(0, index - perTab)}`, target: `node${index}`, type: 'required' as const });
    }
  }
  return { format: TREE_FORMAT, id: `synthetic-${size}`, title: `Synthetic ${size}`, tabs, resources: [], nodes, edges };
}

function timed<T>(operation: () => T): { value: T; ms: number } {
  const start = performance.now();
  const value = operation();
  return { value, ms: performance.now() - start };
}

for (const size of [1_000, 5_000, 10_000]) {
  const tree = syntheticTree(size);
  const validation = timed(() => assertValidTree(tree));
  const searchBuild = timed(() => new SearchIndex(tree));
  const search = timed(() => searchBuild.value.search('Synthetic node 9999'));
  const pageGraph = timed(() => buildGraphView(tree, tabKey('tab0')));
  const pageLayout = timed(() => layoutGraph(pageGraph.value));
  const allGraph = timed(() => buildGraphView(tree, 'all'));
  const allLayout = timed(() => layoutGraph(allGraph.value));
  console.log(JSON.stringify({
    size,
    validationMs: round(validation.ms),
    searchIndexMs: round(searchBuild.ms),
    searchMs: round(search.ms),
    pageNodes: pageGraph.value.nodes.length,
    pageLayoutMs: round(pageLayout.ms),
    allNodes: allGraph.value.nodes.length,
    allLayoutMs: round(allLayout.ms),
  }));
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}
