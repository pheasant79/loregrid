import { TREE_FORMAT, type TreeDefinitionV2 } from '../src/core/types';

export function makeTree(): TreeDefinitionV2 {
  return {
    format: TREE_FORMAT,
    id: 'test-tree',
    title: 'Test tree',
    version: '1',
    tabs: [
      { id: 'alpha', label: 'Alpha', order: 1 },
      { id: 'beta', label: 'Beta', order: 2 },
    ],
    resources: [],
    nodes: [
      { id: 'a', title: 'A', tabId: 'alpha', layout: { order: 1 } },
      { id: 'b', title: 'B', tabId: 'alpha', layout: { order: 2 } },
      { id: 'c', title: 'C', tabId: 'beta', layout: { order: 1 } },
      { id: 'd', title: 'D', tabId: 'beta', kind: 'milestone', layout: { order: 2 } },
    ],
    edges: [
      { id: 'edge-ab', source: 'a', target: 'b', type: 'required' },
      { id: 'edge-bc', source: 'b', target: 'c', type: 'required' },
      { id: 'edge-ad', source: 'a', target: 'd', type: 'required' },
      { id: 'edge-cd', source: 'c', target: 'd', type: 'required' },
      { id: 'edge-ac-rec', source: 'a', target: 'c', type: 'recommended' },
      { id: 'edge-bd-rel', source: 'b', target: 'd', type: 'related' },
    ],
  };
}
