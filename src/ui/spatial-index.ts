import type { LayoutNode } from '../core/types';

export interface Bounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export class SpatialIndex {
  private cells = new Map<string, LayoutNode[]>();

  constructor(nodes: LayoutNode[], private cellSize = 520) {
    nodes.forEach((node) => {
      const minX = Math.floor(node.x / cellSize);
      const maxX = Math.floor((node.x + node.width) / cellSize);
      const minY = Math.floor(node.y / cellSize);
      const maxY = Math.floor((node.y + node.height) / cellSize);
      for (let x = minX; x <= maxX; x += 1) {
        for (let y = minY; y <= maxY; y += 1) {
          const key = `${x}:${y}`;
          const cell = this.cells.get(key) ?? [];
          cell.push(node);
          this.cells.set(key, cell);
        }
      }
    });
  }

  query(bounds: Bounds): LayoutNode[] {
    const result: LayoutNode[] = [];
    const seen = new Set<string>();
    const minX = Math.floor(bounds.left / this.cellSize);
    const maxX = Math.floor(bounds.right / this.cellSize);
    const minY = Math.floor(bounds.top / this.cellSize);
    const maxY = Math.floor(bounds.bottom / this.cellSize);
    for (let x = minX; x <= maxX; x += 1) {
      for (let y = minY; y <= maxY; y += 1) {
        for (const node of this.cells.get(`${x}:${y}`) ?? []) {
          if (seen.has(node.viewId)) continue;
          seen.add(node.viewId);
          if (node.x + node.width < bounds.left || node.x > bounds.right || node.y + node.height < bounds.top || node.y > bounds.bottom) continue;
          result.push(node);
        }
      }
    }
    return result;
  }
}
