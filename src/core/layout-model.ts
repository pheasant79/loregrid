// Generic graph primitives for the YART-adapted layout stages.
export interface LayoutVertex {
  id: string;
  rank: number;
  dummy?: boolean;
}

export interface LayoutLink {
  source: string;
  target: string;
}

export function linkIndex(links: readonly LayoutLink[], reverse = false): Map<string, string[]> {
  const result = new Map<string, string[]>();
  for (const edge of links) {
    const key = reverse ? edge.target : edge.source;
    const target = reverse ? edge.source : edge.target;
    const list = result.get(key) ?? [];
    list.push(target);
    result.set(key, list);
  }
  return result;
}

export const vertexHeight = (node: LayoutVertex): number => node.dummy ? 20 : 50;
export const vertexSeparation = (a: LayoutVertex, b: LayoutVertex): number =>
  (vertexHeight(a) + vertexHeight(b)) / 2 + (a.dummy && b.dummy ? 10 : 28);

export function dummyChains(vertices: ReadonlyMap<string, LayoutVertex>, links: readonly LayoutLink[]): string[][] {
  const up = linkIndex(links, true);
  const down = linkIndex(links);
  const result: string[][] = [];
  for (const node of vertices.values()) {
    if (!node.dummy || (up.get(node.id) ?? []).some((id) => vertices.get(id)?.dummy)) continue;
    const chain: string[] = [];
    let current: string | undefined = node.id;
    while (current) {
      chain.push(current);
      current = down.get(current)?.find((id) => vertices.get(id)?.dummy);
    }
    result.push(chain);
  }
  return result;
}
