import type { TreeDefinitionV2 } from './types';

/** YART-style focus: all required ancestors and immediate required successors.
 * Iterative traversal preserves support for deep imported graphs.
 */
export class DependencyFocus {
  private incoming = new Map<string, string[]>();
  private outgoing = new Map<string, string[]>();

  constructor(tree: TreeDefinitionV2) {
    for (const edge of tree.edges) {
      if (edge.type !== 'required') continue;
      const incoming = this.incoming.get(edge.target) ?? [];
      incoming.push(edge.source);
      this.incoming.set(edge.target, incoming);
      const outgoing = this.outgoing.get(edge.source) ?? [];
      outgoing.push(edge.target);
      this.outgoing.set(edge.source, outgoing);
    }
  }

  connected(nodeId: string): Set<string> {
    const result = new Set([nodeId]);
    const pending = [nodeId];
    while (pending.length) {
      const id = pending.pop()!;
      for (const source of this.incoming.get(id) ?? []) {
        if (result.has(source)) continue;
        result.add(source);
        pending.push(source);
      }
    }
    for (const target of this.outgoing.get(nodeId) ?? []) result.add(target);
    return result;
  }
}
