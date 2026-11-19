import { describe, expect, it } from 'vitest';
import { buildGraphView } from '../src/core/graph';
import { layoutGraph } from '../src/core/layout';
import { distributeEdgePorts } from '../src/ui/edge-routing';
import { makeTree } from './fixtures';

describe('dependency edge ports', () => {
  it('separates multiple incoming and outgoing edges deterministically', () => {
    const tree = makeTree();
    tree.nodes = ['root', 'left', 'right', 'target'].map((id) => ({ id, title: id, tabId: 'alpha' }));
    tree.edges = [
      { id: 'root-left', source: 'root', target: 'left', type: 'required' },
      { id: 'root-right', source: 'root', target: 'right', type: 'required' },
      { id: 'left-target', source: 'left', target: 'target', type: 'required' },
      { id: 'right-target', source: 'right', target: 'target', type: 'required' },
    ];
    const layout = layoutGraph(buildGraphView(tree, 'all'));
    const first = distributeEdgePorts(layout.nodes, layout.edges);
    const second = distributeEdgePorts(layout.nodes, layout.edges);
    const edgeId = (originalId: string) => layout.edges.find((edge) => edge.originalEdgeId === originalId)!.id;
    expect([...first]).toEqual([...second]);
    expect(first.get(edgeId('root-left'))!.sourceY).not.toBe(first.get(edgeId('root-right'))!.sourceY);
    expect(first.get(edgeId('left-target'))!.targetY).not.toBe(first.get(edgeId('right-target'))!.targetY);
  });

  it('keeps outgoing edges on a shared long-edge trunk at one source port', () => {
    const tree = makeTree();
    tree.nodes = Array.from({ length: 6 }, (_, index) => ({ id: `n${index}`, title: `N${index}`, tabId: 'alpha' }));
    tree.edges = [
      { id: 'short', source: 'n0', target: 'n1', type: 'required' },
      { id: 'long-a', source: 'n0', target: 'n4', type: 'required' },
      { id: 'long-b', source: 'n0', target: 'n5', type: 'required' },
      { id: 'chain-1', source: 'n1', target: 'n2', type: 'required' },
      { id: 'chain-2', source: 'n2', target: 'n3', type: 'required' },
      { id: 'chain-3', source: 'n3', target: 'n4', type: 'required' },
      { id: 'chain-4', source: 'n4', target: 'n5', type: 'required' },
    ];
    const layout = layoutGraph(buildGraphView(tree, 'all'));
    const ports = distributeEdgePorts(layout.nodes, layout.edges);
    const longA = layout.edges.find((edge) => edge.originalEdgeId === 'long-a')!;
    const longB = layout.edges.find((edge) => edge.originalEdgeId === 'long-b')!;
    expect(ports.get(longA.id)!.sourceY).toBe(ports.get(longB.id)!.sourceY);
    expect(longA.points.slice(1, 3)).toEqual(longB.points.slice(1, 3));
  });
});
