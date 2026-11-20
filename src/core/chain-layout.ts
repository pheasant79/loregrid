// Adapted from YART SugiyamaLayout.ShapeChains / FitChain / UntangleChains /
// ResolveDummyRuns. Copyright (c) 2026 SeoHyeon, MIT; see ../docs/legal/THIRD_PARTY_NOTICES.md.
import { dummyChains, linkIndex, vertexSeparation, type LayoutLink, type LayoutVertex } from './layout-model';

export interface ChainResult {
  bendsBefore: number;
  bendsAfter: number;
  nonConverged: number;
  untangled: number;
}

export function shapeLongEdges(
  layers: string[][], vertices: ReadonlyMap<string, LayoutVertex>, links: readonly LayoutLink[], y: Map<string, number>,
): ChainResult {
  const chains = dummyChains(vertices, links);
  const up = linkIndex(links, true), down = linkIndex(links);
  const order = new Map<string, number>();
  const sync = (): void => { layers.forEach((layer) => layer.forEach((id, index) => order.set(id, index))); };
  sync();
  const sep = (a: string, b: string, relaxed = false): number =>
    vertexSeparation(vertices.get(a)!, vertices.get(b)!) - (relaxed ? (vertices.get(a)!.dummy && vertices.get(b)!.dummy ? 6 : 24) : 0);
  const targets = chains.map((chain) => chain.flatMap((id) => (down.get(id) ?? []).filter((child) => !vertices.get(child)!.dummy)));
  const destination = (index: number): number => {
    const values = targets[index]!.map((id) => y.get(id)!).sort((a, b) => a - b);
    const middle = Math.floor(values.length / 2);
    return values.length % 2 ? values[middle]! : (values[middle - 1]! + values[middle]!) / 2;
  };
  const bends = (): number => {
    let count = 0;
    chains.forEach((chain, index) => {
      const source = up.get(chain[0]!)?.[0];
      if (!source || !targets[index]!.length) return;
      const values = [y.get(source)!, ...chain.map((id) => y.get(id)!), destination(index)];
      let previousSign = 0;
      for (let j = 1; j < values.length; j++) {
        const dy = values[j]! - values[j - 1]!;
        if (Math.abs(dy) < 0.5) continue;
        const sign = Math.sign(dy);
        if (previousSign && sign !== previousSign) count++;
        previousSign = sign;
      }
    });
    return count;
  };
  const allDummy = chains.flat();
  const snapshot = (): number[] => allDummy.map((id) => y.get(id)!);
  const restore = (saved: number[]): void => { allDummy.forEach((id, index) => y.set(id, saved[index]!)); };
  const hash = (): number => {
    let result = 2166136261;
    for (const id of allDummy) result = Math.imul(result ^ Math.round(y.get(id)! / 0.5), 16777619);
    return result;
  };
  const fit = (chain: string[], index: number): number => {
    const source = up.get(chain[0]!)?.[0];
    if (!source || !targets[index]!.length) return 0;
    const sourceY = y.get(source)!, targetY = destination(index);
    const bounds = chain.map((id) => {
      const layer = layers[vertices.get(id)!.rank]!, slot = order.get(id)!;
      const previous = layer[slot - 1], next = layer[slot + 1];
      return [previous ? y.get(previous)! + sep(previous, id) : -Infinity,
        next ? y.get(next)! - sep(id, next) : Infinity] as const;
    });
    let suffix = chain.length, prefix = 0;
    for (let j = chain.length - 1; j >= 0 && bounds[j]![0] <= targetY && targetY <= bounds[j]![1]; j--) suffix = j;
    for (let j = 0; j < suffix && bounds[j]![0] <= sourceY && sourceY <= bounds[j]![1]; j++) prefix = j + 1;
    let previous = sourceY, moved = 0;
    chain.forEach((id, j) => {
      const [low, high] = bounds[j]!;
      const target = j >= suffix ? targetY : j < prefix ? sourceY : previous;
      const placed = low <= high ? Math.max(low, Math.min(high, target)) : (low + high) / 2;
      moved = Math.max(moved, Math.abs(placed - y.get(id)!));
      y.set(id, placed); previous = placed;
    });
    return moved;
  };
  const shape = (): number => {
    let bestBends = bends(), best = snapshot(), moving = 0, cycle = false;
    const seen = new Set([hash()]);
    for (let pass = 0; pass < 32; pass++) {
      moving = 0;
      for (let cursor = 0; cursor < chains.length; cursor++) {
        const index = pass % 2 ? chains.length - 1 - cursor : cursor;
        if (fit(chains[index]!, index) > 1) moving++;
      }
      const current = bends();
      if (current < bestBends) { bestBends = current; best = snapshot(); }
      if (!moving) break;
      const state = hash();
      if (seen.has(state)) { cycle = true; break; }
      seen.add(state);
    }
    if (cycle || moving) restore(best);
    return moving;
  };
  const clampRuns = (first = 0, last = layers.length - 1, checkOnly = false): number => {
    let bad = 0;
    for (let r = first; r <= last; r++) {
      const layer = layers[r]!;
      let cursor = 0;
      while (cursor < layer.length) {
        if (!vertices.get(layer[cursor]!)!.dummy) { cursor++; continue; }
        const start = cursor;
        while (cursor < layer.length && vertices.get(layer[cursor]!)!.dummy) cursor++;
        const end = cursor - 1, above = layer[start - 1], below = layer[cursor];
        let feasible = false;
        for (const relaxed of [false, true]) {
          const low: number[] = [], high: number[] = [];
          for (let j = start; j <= end; j++) low[j] = j === start
            ? above ? y.get(above)! + sep(above, layer[j]!, relaxed) : -Infinity
            : low[j - 1]! + sep(layer[j - 1]!, layer[j]!, relaxed);
          for (let j = end; j >= start; j--) high[j] = j === end
            ? below ? y.get(below)! - sep(layer[j]!, below, relaxed) : Infinity
            : high[j + 1]! - sep(layer[j]!, layer[j + 1]!, relaxed);
          if (low.some((value, j) => j >= start && value > high[j]!)) continue;
          feasible = true;
          if (!checkOnly) for (let j = start; j <= end; j++) {
            const floor = j === start ? low[j]! : Math.max(low[j]!, y.get(layer[j - 1]!)! + sep(layer[j - 1]!, layer[j]!, relaxed));
            y.set(layer[j]!, Math.max(floor, Math.min(high[j]!, y.get(layer[j]!)!)));
          }
          break;
        }
        if (!feasible) bad++;
      }
    }
    return bad;
  };
  const initial = bends();
  let nonConverged = shape();
  clampRuns();

  // Strip swaps are only attempted where two strips are adjacent in a layer.
  // This enumerates the same eligible pairs without a quadratic all-pairs scan.
  const strips = chains.map((chain, index) => ({
    members: targets[index]!.length === 1 ? [...chain, targets[index]![0]!] : [...chain],
    first: vertices.get(chain[0]!)!.rank,
    destination: targets[index]!.length ? destination(index) : 0,
  }));
  const stripOf = new Map<string, number[]>();
  strips.forEach((strip, index) => strip.members.forEach((id) => {
    const list = stripOf.get(id) ?? []; list.push(index); stripOf.set(id, list);
  }));
  const boundaryCrossings = (first: number, last: number): number => {
    const start = Math.max(0, first - 1), end = Math.min(layers.length - 1, last + 1);
    let crossings = 0;
    // Reuse the graph index and live order; scanning every link for each local
    // strip trial makes dense graphs quadratic even when strips are short.
    for (let rank = start + 1; rank <= end; rank++) {
      const bit = new Float64Array(layers[rank - 1]!.length + 1);
      let seen = 0;
      for (const id of layers[rank]!) {
        const sources = (up.get(id) ?? []).map((source) => order.get(source)!).sort((a, b) => a - b);
        for (const source of sources) {
          let prefix = 0;
          for (let cursor = source + 1; cursor > 0; cursor -= cursor & -cursor) prefix += bit[cursor]!;
          crossings += seen - prefix;
          for (let cursor = source + 1; cursor < bit.length; cursor += cursor & -cursor) bit[cursor]!++;
          seen++;
        }
      }
    }
    return crossings;
  };
  const layerWork = layers.map((layer) => layer.reduce((total, id) => total + 1 + (up.get(id)?.length ?? 0), 0));
  let untangled = 0, swapBudget = 20_000, swapWork = 2_000_000;
  for (let pass = 0; pass < Math.min(16, strips.length) && swapBudget > 0 && swapWork > 0; pass++) {
    const pairs = new Map<string, [number, number]>();
    for (const layer of layers) for (let j = 1; j < layer.length; j++) {
      for (const a of stripOf.get(layer[j - 1]!) ?? []) for (const b of stripOf.get(layer[j]!) ?? []) {
        if (a === b) continue;
        const lo = Math.min(a, b), hi = Math.max(a, b);
        pairs.set(`${lo}:${hi}`, [lo, hi]);
      }
    }
    let changed = false;
    for (const [ai, bi] of pairs.values()) {
      if (--swapBudget < 0) break;
      const a = strips[ai]!, b = strips[bi]!;
      const first = Math.max(a.first, b.first), last = Math.min(a.first + a.members.length - 1, b.first + b.members.length - 1);
      const member = (strip: typeof a, r: number): string => strip.members[r - strip.first]!;
      for (let r = first; r <= last;) {
        const ma = member(a, r), mb = member(b, r), diff = order.get(mb)! - order.get(ma)!;
        if (ma === mb || Math.abs(diff) !== 1) { r++; continue; }
        let end = r + 1;
        while (end <= last && member(a, end) !== member(b, end)
          && order.get(member(b, end))! - order.get(member(a, end))! === diff) end++;
        const upper = diff > 0 ? a : b, lower = diff > 0 ? b : a;
        if (upper.destination > lower.destination + 0.5) {
          let cost = 0;
          for (let column = Math.max(0, r - 1); column <= Math.min(layers.length - 1, end); column++) cost += layerWork[column]!;
          swapWork -= cost * 4;
          if (swapWork < 0) break;
          const before = boundaryCrossings(r, end - 1), badBefore = clampRuns(r, end - 1, true);
          const swap = (): void => {
            for (let column = r; column < end; column++) {
              const left = member(a, column), right = member(b, column);
              const ia = order.get(left)!, ib = order.get(right)!;
              const layer = layers[column]!;
              layer[ia] = right; layer[ib] = left; order.set(left, ib); order.set(right, ia);
              const oldY = y.get(left)!; y.set(left, y.get(right)!); y.set(right, oldY);
            }
          };
          swap();
          if (boundaryCrossings(r, end - 1) > before || clampRuns(r, end - 1, true) > badBefore) swap();
          else { changed = true; untangled++; }
        }
        r = end;
      }
      if (swapWork <= 0) break;
    }
    if (!changed) break;
  }
  if (untangled) { nonConverged = shape(); clampRuns(); }
  // A continuous-coordinate safety pass protects separation even if fixed
  // endpoints leave no feasible dummy corridor after a strip swap.
  for (const layer of layers) for (let j = 1; j < layer.length; j++) {
    const previous = layer[j - 1]!, current = layer[j]!;
    const minimum = y.get(previous)! + sep(previous, current, true);
    if (y.get(current)! < minimum) y.set(current, minimum);
  }
  return { bendsBefore: initial, bendsAfter: bends(), nonConverged, untangled };
}
