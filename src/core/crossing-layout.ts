// Adapted from YART SugiyamaLayout.MinimizeCrossings, WMedian, Transpose,
// ExactSmallLayerSweep, SiftingPass, CountCrossings and EstimateMinHeight.
// Copyright (c) 2026 SeoHyeon, MIT; see THIRD_PARTY_NOTICES.md.
import { dummyChains, linkIndex, vertexSeparation, type LayoutLink, type LayoutVertex } from './layout-model';

export interface OrderingResult {
  initialCrossings: number;
  crossings: number;
  score: number;
}

/** Counts edge crossings in O(E log V); shared sources/targets are not crossings. */
export function countCrossings(layers: readonly (readonly string[])[], links: readonly LayoutLink[]): number {
  const up = linkIndex(links, true);
  const positions = new Map<string, number>();
  layers.forEach((layer) => layer.forEach((id, index) => positions.set(id, index)));
  let total = 0;
  for (let rank = 1; rank < layers.length; rank++) {
    const previous = layers[rank - 1]!;
    const bit = new Float64Array(previous.length + 1);
    let seen = 0;
    for (const id of layers[rank]!) {
      const sources = (up.get(id) ?? []).map((source) => positions.get(source)!).sort((a, b) => a - b);
      for (const source of sources) {
        let prefix = 0;
        for (let index = source + 1; index > 0; index -= index & -index) prefix += bit[index]!;
        total += seen - prefix;
        for (let index = source + 1; index < bit.length; index += index & -index) bit[index]!++;
        seen++;
      }
    }
  }
  return total;
}

/** Chain units preserve long corridors when comparing estimated layout height. */
function minimumHeight(layers: readonly (readonly string[])[], vertices: ReadonlyMap<string, LayoutVertex>, chains: readonly string[][]): number {
  const unitOf = new Map<string, number>();
  let count = 0;
  for (const chain of chains) { for (const id of chain) unitOf.set(id, count); count++; }
  for (const layer of layers) for (const id of layer) if (!unitOf.has(id)) unitOf.set(id, count++);
  const above = Array.from({ length: count }, () => [] as Array<[number, number]>);
  const below = Array.from({ length: count }, () => [] as number[]);
  for (const layer of layers) for (let i = 1; i < layer.length; i++) {
    const a = layer[i - 1]!, b = layer[i]!;
    const ua = unitOf.get(a)!, ub = unitOf.get(b)!;
    if (ua === ub) continue;
    above[ub]!.push([ua, vertexSeparation(vertices.get(a)!, vertices.get(b)!)]);
    below[ua]!.push(ub);
  }
  const indegree = above.map((list) => list.length);
  const ready = indegree.flatMap((degree, id) => degree ? [] : [id]);
  const seen = new Set<number>();
  const y = new Float64Array(count);
  let cursor = 0, forced = 0, height = 0;
  while (seen.size < count) {
    let id: number | undefined;
    while (cursor < ready.length && id === undefined) {
      const candidate = ready[cursor++]!;
      if (!seen.has(candidate)) id = candidate;
    }
    if (id === undefined) { while (seen.has(forced)) forced++; id = forced; }
    for (const [parent, gap] of above[id]!) if (seen.has(parent)) y[id] = Math.max(y[id]!, y[parent]! + gap);
    seen.add(id);
    height = Math.max(height, y[id]!);
    for (const child of below[id]!) if (--indegree[child]! === 0) ready.push(child);
  }
  return height;
}

export function minimizeCrossings(
  layers: string[][], vertices: ReadonlyMap<string, LayoutVertex>, links: readonly LayoutLink[],
): OrderingResult {
  const up = linkIndex(links, true), down = linkIndex(links);
  const positions = new Map<string, number>();
  const sync = (): void => { layers.forEach((layer) => layer.forEach((id, index) => positions.set(id, index))); };
  const snapshot = (): string[][] => layers.map((layer) => [...layer]);
  const restore = (saved: readonly (readonly string[])[]): void => {
    saved.forEach((layer, rank) => { layers[rank] = [...layer]; }); sync();
  };
  const chains = dummyChains(vertices, links);
  const score = (): { crossings: number; value: number } => {
    const crossings = countCrossings(layers, links);
    return { crossings, value: crossings + 4 * minimumHeight(layers, vertices, chains) / 78 };
  };
  sync();
  const initialCrossings = countCrossings(layers, links);
  let best = snapshot(), bestScore = score().value;
  // Optional pair comparisons have a deterministic budget, without a node cap.
  let pairWork = 3_000_000;
  const pair = (a: string, b: string): number => {
    if (--pairWork < 0) return Infinity;
    let crossings = 0;
    for (const index of [up, down]) for (const left of index.get(a) ?? []) for (const right of index.get(b) ?? []) {
      if (--pairWork < 0) return Infinity;
      if (positions.get(left)! > positions.get(right)!) crossings++;
    }
    return crossings;
  };
  const transpose = (): void => {
    for (let sweep = 0; sweep < 8 && pairWork > 0; sweep++) {
      let changed = false;
      for (const layer of layers) for (let i = 0; i + 1 < layer.length && pairWork > 0; i++) {
        const a = layer[i]!, b = layer[i + 1]!;
        const before = pair(a, b), after = pair(b, a);
        if (after < before) {
          layer[i] = b; layer[i + 1] = a; positions.set(b, i); positions.set(a, i + 1); changed = true;
        }
      }
      if (!changed) break;
    }
  };
  const medianSweep = (forward: boolean): void => {
    for (let cursor = 0; cursor < layers.length - 1; cursor++) {
      const rank = forward ? cursor + 1 : layers.length - 2 - cursor;
      const layer = layers[rank]!;
      const indexed = layer.map((id, index) => {
        const adjacent = ((forward ? up : down).get(id) ?? []).map((value) => positions.get(value)!).sort((a, b) => a - b);
        return { id, index, median: weightedMedian(adjacent) };
      });
      const sorted = indexed.filter((entry) => entry.median >= 0).sort((a, b) => a.median - b.median || a.index - b.index);
      let next = 0;
      layers[rank] = indexed.map((entry) => entry.median < 0 ? entry.id : sorted[next++]!.id);
      layers[rank]!.forEach((id, index) => positions.set(id, index));
    }
  };
  // DFS, degree, reverse and centered weighted DFS. The weighted seed uses
  // capped descendant-path weights, avoiding YART's quadratic descendant sets.
  const weights = new Map<string, number>();
  for (const layer of [...layers].reverse()) for (const id of layer) {
    weights.set(id, Math.min(1e9, (down.get(id) ?? []).reduce((sum, child) => sum + 1 + (weights.get(child) ?? 0), 0)));
  }
  const seed = (variant: number): string[][] => {
    const result = layers.map(() => [] as string[]);
    const visited = new Set<string>();
    const order = (ids: readonly string[]): string[] => {
      const sorted = [...ids].sort((a, b) => {
        if (variant === 1) return (down.get(b)?.length ?? 0) - (down.get(a)?.length ?? 0) || a.localeCompare(b);
        if (variant === 2) return b.localeCompare(a);
        if (variant === 3) return weights.get(b)! - weights.get(a)! || a.localeCompare(b);
        return a.localeCompare(b);
      });
      if (variant !== 3) return sorted;
      const left: string[] = [], right: string[] = [];
      sorted.forEach((id, index) => (index % 2 ? left : right).push(id));
      return [...left.reverse(), ...right];
    };
    for (const root of order([...vertices.keys()].filter((id) => !up.has(id)))) {
      const stack = [root];
      while (stack.length) {
        const id = stack.pop()!;
        if (visited.has(id)) continue;
        visited.add(id); result[vertices.get(id)!.rank]!.push(id);
        const children = order(down.get(id) ?? []);
        for (let index = children.length - 1; index >= 0; index--) stack.push(children[index]!);
      }
    }
    for (const node of vertices.values()) if (!visited.has(node.id)) result[node.rank]!.push(node.id);
    return result;
  };
  for (let variant = 0; variant < 4; variant++) {
    restore(seed(variant));
    let local = snapshot(), current = score(), localScore = current.value;
    let bestCross = current.crossings, stale = 0;
    for (let iteration = 0; iteration < 24 && bestCross > 0 && stale < 5 && pairWork > 0; iteration++) {
      medianSweep(iteration % 2 === 0); transpose();
      current = score();
      if (current.crossings < bestCross) { bestCross = current.crossings; stale = 0; } else stale++;
      if (current.value < localScore) { local = snapshot(); localScore = current.value; }
    }
    if (localScore < bestScore) { bestScore = localScore; best = local; }
  }
  restore(best);
  let acceptedScore = score().value;

  // Exact subset DP for <=10 nodes. The cost is crossings on both boundaries.
  for (let pass = 0; pass < 4 && pairWork > 0; pass++) {
    let improved = false;
    for (let r = 0; r < layers.length && pairWork > 0; r++) {
      const layer = layers[r]!, n = layer.length;
      if (n < 3 || n > 10) continue;
      const costs = layer.map((a) => layer.map((b) => a === b ? 0 : pair(a, b)));
      if (pairWork <= 0) break;
      let current = 0;
      for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) current += costs[a]![b]!;
      if (!current) continue;
      const full = 1 << n, dp = new Float64Array(full).fill(Infinity), pick = new Int16Array(full);
      dp[0] = 0;
      for (let mask = 0; mask < full; mask++) for (let v = 0; v < n; v++) {
        if (mask & (1 << v)) continue;
        let added = 0;
        for (let u = 0; u < n; u++) if (mask & (1 << u)) added += costs[u]![v]!;
        const next = mask | (1 << v), value = dp[mask]! + added;
        if (value < dp[next]!) { dp[next] = value; pick[next] = v; }
      }
      if (dp[full - 1]! >= current) continue;
      const before = acceptedScore, saved = [...layer], ordered = new Array<string>(n);
      let mask = full - 1;
      for (let slot = n - 1; slot >= 0; slot--) {
        const v = pick[mask]!; ordered[slot] = layer[v]!; mask &= ~(1 << v);
      }
      layers[r] = ordered; sync();
      const after = score().value;
      if (after < before) { improved = true; acceptedScore = after; }
      else { layers[r] = saved; sync(); }
    }
    if (!improved) break;
  }
  // Vertex sifting with on-demand pair costs, no O(layer-size²) memory table.
  for (let pass = 0; pass < 4 && pairWork > 0; pass++) {
    let improved = false;
    for (let r = 0; r < layers.length && pairWork > 0; r++) {
      const layer = layers[r]!;
      if (layer.length < 3) continue;
      const saved = [...layer], before = acceptedScore;
      let changed = false;
      for (const id of saved) {
        if (pairWork <= 0) break;
        const others = layer.filter((value) => value !== id);
        const deltas: number[] = [];
        let running = 0, valid = true;
        for (const other of others) {
          const above = pair(id, other), below = pair(other, id);
          if (!Number.isFinite(above + below)) { valid = false; break; }
          running += above; deltas.push(below - above);
        }
        if (!valid) break;
        const currentPosition = layer.indexOf(id);
        let currentCost = running;
        for (let p = 0; p < currentPosition; p++) currentCost += deltas[p]!;
        let bestCost = currentCost, bestPosition = currentPosition;
        for (let p = 0; p <= others.length; p++) {
          if (running < bestCost) { bestCost = running; bestPosition = p; }
          running += deltas[p] ?? 0;
        }
        if (bestPosition !== currentPosition) {
          others.splice(bestPosition, 0, id);
          for (let index = 0; index < others.length; index++) layer[index] = others[index]!;
          changed = true;
        }
      }
      if (changed) {
        layers[r]!.forEach((id, index) => positions.set(id, index));
        const after = score().value;
        if (after < before - 1e-4) { improved = true; acceptedScore = after; }
        else { layers[r] = saved; saved.forEach((id, index) => positions.set(id, index)); }
      }
    }
    if (!improved) break;
  }
  const final = score();
  return { initialCrossings, crossings: final.crossings, score: final.value };
}

function weightedMedian(positions: number[]): number {
  const n = positions.length, middle = Math.floor(n / 2);
  if (!n) return -1;
  if (n % 2) return positions[middle]!;
  if (n === 2) return (positions[0]! + positions[1]!) / 2;
  const left = positions[middle - 1]! - positions[0]!, right = positions[n - 1]! - positions[middle]!;
  return left + right === 0 ? (positions[middle - 1]! + positions[middle]!) / 2
    : (positions[middle - 1]! * right + positions[middle]! * left) / (left + right);
}
