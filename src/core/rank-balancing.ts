// Adapted from YART SugiyamaLayout.ComputeColumnBudget / LimitColumnHeights /
// BalanceRanks. Copyright (c) 2026 SeoHyeon, MIT; see ../docs/legal/THIRD_PARTY_NOTICES.md.
import { linkIndex, type LayoutLink } from './layout-model';

/** Generic era bands replace game tech levels; no authored coordinates. */
export function balanceRanks(
  rank: Map<string, number>,
  edges: readonly LayoutLink[],
  unified: boolean,
  stageBounds?: ReadonlyMap<string, [number, number]>,
): void {
  if (!rank.size) return;
  const down = linkIndex(edges);
  const up = linkIndex(edges, true);
  const ids = [...rank.keys()].sort();
  const originalCounts = new Map<number, number>();
  for (const value of rank.values()) originalCounts.set(value, (originalCounts.get(value) ?? 0) + 1);
  const sortedCounts = [...originalCounts.values()].sort((a, b) => a - b);
  const budget = Math.max(12, unified ? sortedCounts[Math.ceil(sortedCounts.length * 0.88) - 1]! : 12) * 78;
  let last = 0;
  for (const value of rank.values()) last = Math.max(last, value);
  const rows = Array<number>(last + 9).fill(0);
  const corridors = Array<number>(last + 9).fill(0);
  const maxChild = new Map<string, number>();
  const recount = (): void => {
    rows.fill(0); corridors.fill(0); maxChild.clear();
    for (const id of ids) {
      const r = rank.get(id)!;
      rows[r]!++;
      let end = r;
      for (const child of down.get(id) ?? []) end = Math.max(end, rank.get(child)!);
      maxChild.set(id, end);
      for (let column = r + 1; column < end; column++) corridors[column]!++;
    }
  };
  recount();
  const bands = [...new Set(stageBounds?.values())];
  const expandBand = (band: [number, number]): void => {
    const insertion = band[1] + 1;
    for (const [id, value] of rank) if (value >= insertion) rank.set(id, value + 1);
    for (const other of bands) {
      if (other === band) other[1]++;
      else if (other[0] >= insertion) { other[0]++; other[1]++; }
    }
    last++;
    recount();
  };
  const contribution = (r: number, end: number, column: number): number => r < column && end > column ? 1 : 0;
  const height = (r: number): number => rows[r]! * 78 + corridors[r]! * 30;
  const overflow = (h: number): number => Math.max(0, (h - budget) / 78) ** 2;
  const bounds = (id: string): [number, number] => {
    let low = 0, high = last;
    for (const parent of up.get(id) ?? []) low = Math.max(low, rank.get(parent)! + 1);
    for (const child of down.get(id) ?? []) high = Math.min(high, rank.get(child)! - 1);
    const stage = stageBounds?.get(id);
    if (stage) {
      low = Math.max(low, stage[0]);
      high = Math.min(high, stage[1]);
    }
    return [low, high];
  };
  const parentEndAfter = (parent: string, moving: string, target: number): number => {
    let end = rank.get(parent)!;
    for (const child of down.get(parent) ?? []) end = Math.max(end, child === moving ? target : rank.get(child)!);
    return end;
  };
  const move = (id: string, target: number): void => {
    const old = rank.get(id)!;
    const ownEnd = maxChild.get(id)!;
    // A source's shared trunk occupies one corridor per intermediate column.
    for (let column = Math.min(old, target); column <= Math.max(old, target); column++) {
      corridors[column]! += contribution(target, ownEnd, column) - contribution(old, ownEnd, column);
    }
    rows[old]!--; rows[target]!++;
    rank.set(id, target);
    maxChild.set(id, down.get(id)?.length ? Math.max(target, ownEnd) : target);
    for (const parent of up.get(id) ?? []) {
      const oldEnd = maxChild.get(parent)!;
      const newEnd = parentEndAfter(parent, id, target);
      const parentRank = rank.get(parent)!;
      for (let column = Math.min(oldEnd, newEnd); column < Math.max(oldEnd, newEnd); column++) {
        corridors[column]! += contribution(parentRank, newEnd, column) - contribution(parentRank, oldEnd, column);
      }
      maxChild.set(parent, newEnd);
    }
  };
  const withinSpan = (id: string, target: number): boolean => {
    const parents = up.get(id) ?? [];
    let latest = -Infinity;
    for (const parent of parents) latest = Math.max(latest, rank.get(parent)!);
    return !parents.length || target - latest <= 2;
  };

  // Soft column budget, minimum six real rows and at most eight extra ranks.
  // Candidate priorities match YART: fewer new corridors, leaves, then stable ID.
  let extra = 8;
  for (let column = 0; column <= last; column++) {
    if (height(column) <= budget) continue;
    const candidates = ids.filter((id) => rank.get(id) === column).map((id) => {
      const newCorridors = (up.get(id) ?? []).filter((parent) => maxChild.get(parent)! <= column).length;
      return { id, newCorridors, leaf: !(down.get(id)?.length) };
    }).sort((a, b) => a.newCorridors - b.newCorridors || Number(b.leaf) - Number(a.leaf) || a.id.localeCompare(b.id));
    for (const candidate of candidates) {
      if (height(column) <= budget || rows[column]! <= 6) break;
      const { id } = candidate;
      if (!withinSpan(id, column + 1)) continue;
      const band = stageBounds?.get(id);
      const needsExpansion = band && column === band[1];
      if ((down.get(id) ?? []).some((child) =>
        rank.get(child)! < column + 2 && (!needsExpansion || stageBounds?.get(child) === band))) continue;
      const added = (up.get(id) ?? []).filter((parent) => maxChild.get(parent)! <= column).length;
      if (-78 + added * 30 >= 0) continue;
      if (needsExpansion) {
        if (!extra) break;
        expandBand(band);
        extra--;
      } else if (column === last) { if (!extra) break; last++; extra--; }
      const [low, high] = bounds(id);
      if (column + 1 < low || column + 1 > high) continue;
      move(id, column + 1);
    }
  }

  // YART's overflow² + span/used-column objective. Cache updates are incremental.
  // A deterministic work budget bounds optional refinement, never input size.
  let work = 2_000_000;
  for (let iteration = 0; iteration < ids.length * (last + 1) && work > 0; iteration++) {
    let bestId: string | undefined, bestTarget = 0, bestDelta = -1e-4;
    for (const id of ids) {
      if (--work < 0) break;
      const r = rank.get(id)!;
      const [low, high] = bounds(id);
      for (const target of [r - 1, r + 1]) {
        if (target < low || target > high || (target > r && (rows[r]! <= 6 || !withinSpan(id, target)))) continue;
        const end = maxChild.get(id)!;
        let oldCorr = contribution(target, end, r) - contribution(r, end, r);
        let newCorr = contribution(target, end, target) - contribution(r, end, target);
        for (const parent of up.get(id) ?? []) {
          const before = maxChild.get(parent)!;
          const after = parentEndAfter(parent, id, target);
          const pr = rank.get(parent)!;
          oldCorr += contribution(pr, after, r) - contribution(pr, before, r);
          newCorr += contribution(pr, after, target) - contribution(pr, before, target);
        }
        const deltaOverflow = overflow((rows[r]! - 1) * 78 + (corridors[r]! + oldCorr) * 30)
          + overflow((rows[target]! + 1) * 78 + (corridors[target]! + newCorr) * 30)
          - overflow(height(r)) - overflow(height(target));
        const deltaSpan = ((up.get(id)?.length ?? 0) - (down.get(id)?.length ?? 0)) * (target - r);
        const deltaUsed = Number(rows[target] === 0) - Number(rows[r] === 1);
        const delta = deltaOverflow + 0.01 * deltaSpan + 0.1 * deltaUsed;
        if (delta < bestDelta) { bestId = id; bestTarget = target; bestDelta = delta; }
      }
    }
    if (!bestId) break;
    move(bestId, bestTarget);
  }
}
