// Adapted from YART SugiyamaLayout.SpringRelaxY / SpringPavProject
// Copyright (c) 2026 SeoHyeon, MIT. See ../docs/legal/THIRD_PARTY_NOTICES.md.

export interface SpringNode {
  id: string;
  height: number;
}

/** Pool-adjacent-violators projection onto nondecreasing coordinates, O(n). */
export function projectMonotone(values: readonly number[]): number[] {
  const blocks: Array<{ start: number; end: number; sum: number; weight: number }> = [];
  values.forEach((value, index) => {
    blocks.push({ start: index, end: index, sum: value, weight: 1 });
    while (blocks.length > 1) {
      const current = blocks[blocks.length - 1]!;
      const previous = blocks[blocks.length - 2]!;
      if (previous.sum / previous.weight <= current.sum / current.weight + 1e-6) break;
      previous.end = current.end;
      previous.sum += current.sum;
      previous.weight += current.weight;
      blocks.pop();
    }
  });
  const result = [...values];
  for (const block of blocks) {
    for (let index = block.start; index <= block.end; index++) result[index] = block.sum / block.weight;
  }
  return result;
}

/** Alternating spring relaxation with variable-gap nonoverlap projection. */
export function springCoordinates(
  layers: readonly (readonly SpringNode[])[],
  links: ReadonlyMap<string, readonly string[]>,
): Map<string, number> {
  const separation = (a: SpringNode, b: SpringNode): number =>
    (a.height + b.height) / 2 + (a.height === 20 && b.height === 20 ? 10 : 28);
  const coordinates = new Map<string, number>();
  let minimumHeight = 0;
  for (const layer of layers) {
    let y = 0;
    layer.forEach((node, index) => {
      if (index) y += separation(layer[index - 1]!, node);
      coordinates.set(node.id, y);
    });
    if (layer.length) minimumHeight = Math.max(minimumHeight, y + (layer[0]!.height + layer[layer.length - 1]!.height) / 2);
  }
  for (let pass = 0; pass < 16; pass++) {
    let low = Infinity, high = -Infinity;
    for (const layer of layers) for (const node of layer) {
      const y = coordinates.get(node.id)!;
      low = Math.min(low, y - node.height / 2);
      high = Math.max(high, y + node.height / 2);
    }
    const slack = minimumHeight > 1e-3 ? Math.max(0, Math.min(1, (high - low - minimumHeight) / minimumHeight)) : 0;
    for (let cursor = 0; cursor < layers.length; cursor++) {
      const layer = layers[pass % 2 === 0 ? cursor : layers.length - 1 - cursor]!;
      const prefix: number[] = [];
      const desired = layer.map((node, index) => {
        prefix[index] = index ? prefix[index - 1]! + separation(layer[index - 1]!, node) : 0;
        let sum = coordinates.get(node.id)! * 0.05;
        let weight = 0.05 + 0.8 * slack;
        for (const neighbor of links.get(node.id) ?? []) {
          const y = coordinates.get(neighbor);
          if (y === undefined) continue;
          sum += y; weight++;
        }
        return sum / weight - prefix[index]!;
      });
      const projected = projectMonotone(desired);
      layer.forEach((node, index) => coordinates.set(node.id, projected[index]! + prefix[index]!));
    }
  }
  return coordinates;
}
