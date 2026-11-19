import { performance } from 'node:perf_hooks';
import { buildGraphView, tabKey } from '../src/core/graph';
import { layoutGraph } from '../src/core/layout';
import { SearchIndex } from '../src/core/search';
import { TREE_FORMAT, type TreeDefinitionV2 } from '../src/core/types';
import { assertValidTree } from '../src/core/validate';
import { springCoordinates } from '../src/core/spring-layout';

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
  const perLayer = Math.max(1, Math.ceil(Math.sqrt(size)));
  const layers = Array.from({ length: Math.ceil(size / perLayer) }, (_, layerIndex) =>
    Array.from({ length: Math.min(perLayer, size - layerIndex * perLayer) }, (__, index) => ({ id: `${layerIndex}:${index}`, height: 50 })),
  );
  const spring = timed(() => springCoordinates(layers, new Map()));
  console.log(JSON.stringify({
    size,
    validationMs: round(validation.ms),
    searchIndexMs: round(searchBuild.ms),
    searchMs: round(search.ms),
    pageNodes: pageGraph.value.nodes.length,
    pageLayoutMs: round(pageLayout.ms),
    allNodes: allGraph.value.nodes.length,
    allLayoutMs: round(allLayout.ms),
    springStageMs: round(spring.ms),
  }));
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

// Complement the deep-chain fixture with broad ranks, high-degree hubs and
// shared long-edge trunks. These expose work hidden by a simple chain.
for (const size of [1_000, 5_000, 10_000]) {
  for (const shape of ['hub', 'layered'] as const) {
    const tree = syntheticTree(size);
    tree.edges = [];
    const width = 50;
    for (let target = 1; target < size; target++) {
      const sources = shape === 'hub' ? [0] : target < width ? []
        : [target - width, Math.floor((target - width) / width) * width + (target * 17 % width)];
      if (shape === 'layered' && target >= width * 3) sources.push(target - width * 3);
      for (const source of new Set(sources)) tree.edges.push({
        id: `edge-${source}-${target}`, source: `node${source}`, target: `node${target}`, type: 'required',
      });
    }
    assertValidTree(tree);
    const layout = timed(() => layoutGraph(buildGraphView(tree, 'all')));
    if (layout.value.nodes.length !== size || layout.value.nodes.some((node) => !Number.isFinite(node.x + node.y))) {
      throw new Error(`Invalid ${shape} layout for ${size} nodes`);
    }
    console.log(JSON.stringify({ shape, size, edges: tree.edges.length, allLayoutMs: round(layout.ms) }));
  }
}
