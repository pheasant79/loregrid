import type { TreeDefinitionV2, TreeNode } from './types';

interface SearchEntry {
  node: TreeNode;
  fields: Array<{ value: string; weight: number }>;
}

const normalize = (value: string): string => value.normalize('NFKC').toLocaleLowerCase().trim();

export class SearchIndex {
  private entries: SearchEntry[];

  constructor(tree: TreeDefinitionV2) {
    this.entries = tree.nodes.map((node) => ({
      node,
      fields: [
        { value: normalize(node.title), weight: 0 },
        { value: normalize(node.id), weight: 30 },
        { value: normalize((node.tags ?? []).join(' ')), weight: 20 },
        { value: normalize(node.summary ?? ''), weight: 40 },
        { value: normalize(node.outcome ?? ''), weight: 50 },
        { value: normalize(node.caution ?? ''), weight: 60 },
      ],
    }));
  }

  search(query: string, limit = 12): TreeNode[] {
    const tokens = normalize(query).split(/\s+/).filter(Boolean);
    if (!tokens.length) return [];
    return this.entries
      .map((entry) => ({ entry, score: score(entry, tokens) }))
      .filter((match) => match.score < Number.POSITIVE_INFINITY)
      .sort((a, b) => a.score - b.score
        || a.entry.node.title.localeCompare(b.entry.node.title)
        || a.entry.node.id.localeCompare(b.entry.node.id))
      .slice(0, limit)
      .map((match) => match.entry.node);
  }
}

function score(entry: SearchEntry, tokens: string[]): number {
  let total = 0;
  for (const token of tokens) {
    let best = Number.POSITIVE_INFINITY;
    for (const field of entry.fields) {
      const position = field.value.indexOf(token);
      if (position < 0) continue;
      const match = position === 0 ? (field.weight === 0 ? 0 : field.weight + 1) : field.weight + 10 + position / 1000;
      best = Math.min(best, match);
    }
    if (!Number.isFinite(best)) return Number.POSITIVE_INFINITY;
    total += best;
  }
  return total;
}
