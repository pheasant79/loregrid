import type { TreeDefinitionV2, TreeNode } from './types';

interface SearchEntry {
  node: TreeNode;
  title: string;
  id: string;
  text: string;
}

const normalize = (value: string): string => value.normalize('NFKC').toLocaleLowerCase().trim();

export class SearchIndex {
  private entries: SearchEntry[];

  constructor(tree: TreeDefinitionV2) {
    this.entries = tree.nodes.map((node) => ({
      node,
      title: normalize(node.title),
      id: normalize(node.id),
      text: normalize([node.title, node.id, node.summary ?? '', ...(node.tags ?? [])].join(' ')),
    }));
  }

  search(query: string, limit = 12): TreeNode[] {
    const needle = normalize(query);
    if (!needle) return [];
    return this.entries
      .map((entry) => ({ entry, score: score(entry, needle) }))
      .filter((match) => match.score < Number.POSITIVE_INFINITY)
      .sort((a, b) => a.score - b.score || a.entry.title.localeCompare(b.entry.title) || a.entry.id.localeCompare(b.entry.id))
      .slice(0, limit)
      .map((match) => match.entry.node);
  }
}

function score(entry: SearchEntry, needle: string): number {
  if (entry.id === needle || entry.title === needle) return 0;
  if (entry.title.startsWith(needle)) return 1;
  if (entry.id.startsWith(needle)) return 2;
  const position = entry.text.indexOf(needle);
  return position < 0 ? Number.POSITIVE_INFINITY : 10 + position / 1000;
}
