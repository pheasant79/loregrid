import type { LayoutNode, LayoutResult, ProgressV2, TreeDefinitionV2 } from '../core/types';
import { statusOf } from '../core/progress';
import { SpatialIndex } from './spatial-index';

export interface ViewTransform {
  x: number;
  y: number;
  scale: number;
}

interface RendererCallbacks {
  onNodeClick: (node: LayoutNode) => void;
  onViewChange: (view: ViewTransform) => void;
}

export class GraphRenderer {
  readonly canvas: HTMLCanvasElement;
  readonly nodeLayer: HTMLDivElement;
  readonly minimap: HTMLCanvasElement;
  private context: CanvasRenderingContext2D;
  private minimapContext: CanvasRenderingContext2D;
  private layout: LayoutResult | null = null;
  private tree: TreeDefinitionV2 | null = null;
  private progress: ProgressV2 | null = null;
  private selectedId: string | null = null;
  private highlightedId: string | null = null;
  private showRecommended = false;
  private view: ViewTransform = { x: 0, y: 0, scale: 0.8 };
  private frame = 0;
  private resizeObserver: ResizeObserver;
  private callbacks: RendererCallbacks;
  private spatialIndex = new SpatialIndex([]);

  constructor(private viewport: HTMLElement, callbacks: RendererCallbacks) {
    this.callbacks = callbacks;
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'graph-canvas';
    this.nodeLayer = document.createElement('div');
    this.nodeLayer.className = 'node-layer';
    this.minimap = document.createElement('canvas');
    this.minimap.className = 'minimap';
    this.minimap.width = 220;
    this.minimap.height = 120;
    const context = this.canvas.getContext('2d');
    const minimapContext = this.minimap.getContext('2d');
    if (!context || !minimapContext) throw new Error('Canvas 2D is unavailable.');
    this.context = context;
    this.minimapContext = minimapContext;
    viewport.append(this.canvas, this.nodeLayer, this.minimap);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(viewport);
    this.resize();
  }

  setData(layout: LayoutResult, tree: TreeDefinitionV2, progress: ProgressV2): void {
    this.layout = layout;
    this.tree = tree;
    this.progress = progress;
    this.spatialIndex = new SpatialIndex(layout.nodes);
    this.requestDraw();
  }

  setProgress(progress: ProgressV2): void {
    this.progress = progress;
    this.requestDraw();
  }

  setSelection(nodeId: string | null): void {
    this.selectedId = nodeId;
    this.requestDraw();
  }

  setHighlight(nodeId: string | null): void {
    this.highlightedId = nodeId;
    this.requestDraw();
  }

  setRecommendedVisible(visible: boolean): void {
    this.showRecommended = visible;
    this.requestDraw();
  }

  getView(): ViewTransform {
    return { ...this.view };
  }

  setView(view: ViewTransform): void {
    this.view = { ...view, scale: clamp(view.scale, 0.08, 2.4) };
    this.callbacks.onViewChange(this.getView());
    this.requestDraw();
  }

  pan(dx: number, dy: number): void {
    this.setView({ ...this.view, x: this.view.x + dx, y: this.view.y + dy });
  }

  zoomAt(clientX: number, clientY: number, factor: number): void {
    const rect = this.viewport.getBoundingClientRect();
    const px = clientX - rect.left;
    const py = clientY - rect.top;
    const worldX = (px - this.view.x) / this.view.scale;
    const worldY = (py - this.view.y) / this.view.scale;
    const scale = clamp(this.view.scale * factor, 0.08, 2.4);
    this.setView({ x: px - worldX * scale, y: py - worldY * scale, scale });
  }

  fit(padding = 70): void {
    if (!this.layout) return;
    const width = Math.max(1, this.viewport.clientWidth - padding * 2);
    const height = Math.max(1, this.viewport.clientHeight - padding * 2);
    const scale = clamp(Math.min(width / this.layout.width, height / this.layout.height), 0.08, 1.25);
    this.setView({
      scale,
      x: (this.viewport.clientWidth - this.layout.width * scale) / 2,
      y: (this.viewport.clientHeight - this.layout.height * scale) / 2,
    });
  }

  centerNode(nodeId: string): void {
    const node = this.layout?.nodes.find((entry) => entry.nodeId === nodeId && entry.kind === 'real');
    if (!node) return;
    this.setView({
      ...this.view,
      x: this.viewport.clientWidth / 2 - (node.x + node.width / 2) * this.view.scale,
      y: this.viewport.clientHeight / 2 - (node.y + node.height / 2) * this.view.scale,
    });
  }

  destroy(): void {
    cancelAnimationFrame(this.frame);
    this.resizeObserver.disconnect();
  }

  private resize(): void {
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.max(1, Math.floor(this.viewport.clientWidth * dpr));
    this.canvas.height = Math.max(1, Math.floor(this.viewport.clientHeight * dpr));
    this.canvas.style.width = `${this.viewport.clientWidth}px`;
    this.canvas.style.height = `${this.viewport.clientHeight}px`;
    this.requestDraw();
  }

  private requestDraw(): void {
    cancelAnimationFrame(this.frame);
    this.frame = requestAnimationFrame(() => this.draw());
  }

  private draw(): void {
    const layout = this.layout;
    const tree = this.tree;
    const progress = this.progress;
    if (!layout || !tree || !progress) return;
    const dpr = window.devicePixelRatio || 1;
    const ctx = this.context;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, this.viewport.clientWidth, this.viewport.clientHeight);
    drawGrid(ctx, this.viewport.clientWidth, this.viewport.clientHeight, this.view);
    ctx.save();
    ctx.translate(this.view.x, this.view.y);
    ctx.scale(this.view.scale, this.view.scale);
    this.drawEdges(ctx, layout, tree);
    ctx.restore();
    this.drawNodes(layout, tree, progress);
    this.drawMinimap(layout, tree, progress);
  }

  private drawEdges(ctx: CanvasRenderingContext2D, layout: LayoutResult, tree: TreeDefinitionV2): void {
    const tabColors = new Map(tree.tabs.map((tab) => [tab.id, tab.color ?? '#6687a6']));
    const nodeByViewId = new Map(layout.nodes.map((node) => [node.viewId, node]));
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const edge of layout.edges) {
      if (edge.type === 'recommended' && !this.showRecommended) continue;
      if (edge.type === 'related') continue;
      const target = nodeByViewId.get(edge.target);
      ctx.beginPath();
      edge.points.forEach((point, index) => index === 0 ? ctx.moveTo(point.x, point.y) : ctx.lineTo(point.x, point.y));
      const selected = target?.nodeId === this.selectedId || nodeByViewId.get(edge.source)?.nodeId === this.selectedId;
      ctx.strokeStyle = selected ? '#f5c66f' : edge.type === 'recommended' ? '#71859a' : tabColors.get(target?.tabId ?? '') ?? '#657a91';
      ctx.globalAlpha = selected ? 1 : 0.68;
      ctx.lineWidth = selected ? 2.4 : edge.type === 'recommended' ? 1.2 : 1.65;
      ctx.setLineDash(edge.type === 'recommended' ? [7, 7] : []);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
      if (edge.points.length > 1) drawArrow(ctx, edge.points.at(-2)!, edge.points.at(-1)!, ctx.strokeStyle as string);
    }
  }

  private drawNodes(layout: LayoutResult, tree: TreeDefinitionV2, progress: ProgressV2): void {
    const worldLeft = (-this.view.x) / this.view.scale - 260;
    const worldTop = (-this.view.y) / this.view.scale - 180;
    const worldRight = worldLeft + this.viewport.clientWidth / this.view.scale + 520;
    const worldBottom = worldTop + this.viewport.clientHeight / this.view.scale + 360;
    const visible = this.spatialIndex.query({ left: worldLeft, top: worldTop, right: worldRight, bottom: worldBottom });
    const tabColors = new Map(tree.tabs.map((tab) => [tab.id, tab.color ?? '#6687a6']));
    const fragment = document.createDocumentFragment();
    this.nodeLayer.textContent = '';
    this.nodeLayer.style.transform = `translate(${this.view.x}px, ${this.view.y}px) scale(${this.view.scale})`;
    this.nodeLayer.className = `node-layer ${this.view.scale < 0.38 ? 'lod-low' : this.view.scale < 0.68 ? 'lod-medium' : 'lod-high'}`;

    visible.forEach((node) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `graph-node ${node.kind === 'proxy' ? 'is-proxy' : ''} status-${statusOf(progress, tree, node.nodeId)}`;
      if (node.nodeId === this.selectedId) button.classList.add('is-selected');
      if (node.nodeId === this.highlightedId) button.classList.add('is-highlighted');
      button.style.left = `${node.x}px`;
      button.style.top = `${node.y}px`;
      button.style.width = `${node.width}px`;
      button.style.height = `${node.height}px`;
      button.style.setProperty('--node-accent', tabColors.get(node.kind === 'proxy' ? node.targetTabId ?? node.tabId : node.tabId) ?? '#6687a6');
      button.dataset.nodeId = node.nodeId;
      button.setAttribute('aria-label', node.title);

      const accent = document.createElement('span');
      accent.className = 'node-accent';
      const title = document.createElement('span');
      title.className = 'node-title';
      title.textContent = node.title;
      const meta = document.createElement('span');
      meta.className = 'node-meta';
      meta.textContent = node.kind === 'proxy' ? 'EXTERNAL' : (node.nodeKind ?? 'topic').toUpperCase();
      button.append(accent, title, meta);
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        this.callbacks.onNodeClick(node);
      });
      fragment.append(button);
    });
    this.nodeLayer.append(fragment);
  }

  private drawMinimap(layout: LayoutResult, tree: TreeDefinitionV2, progress: ProgressV2): void {
    const ctx = this.minimapContext;
    const width = this.minimap.width;
    const height = this.minimap.height;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#080e14';
    ctx.fillRect(0, 0, width, height);
    const scale = Math.min((width - 12) / layout.width, (height - 12) / layout.height);
    const colors = new Map(tree.tabs.map((tab) => [tab.id, tab.color ?? '#6687a6']));
    layout.nodes.forEach((node) => {
      ctx.globalAlpha = statusOf(progress, tree, node.nodeId) === 'completed' ? 0.95 : 0.52;
      ctx.fillStyle = colors.get(node.kind === 'proxy' ? node.targetTabId ?? '' : node.tabId) ?? '#60758a';
      ctx.fillRect(6 + node.x * scale, 6 + node.y * scale, Math.max(2, node.width * scale), Math.max(1, node.height * scale));
    });
    ctx.globalAlpha = 1;
    const worldX = -this.view.x / this.view.scale;
    const worldY = -this.view.y / this.view.scale;
    ctx.strokeStyle = '#f2c572';
    ctx.lineWidth = 1;
    ctx.strokeRect(6 + worldX * scale, 6 + worldY * scale, this.viewport.clientWidth / this.view.scale * scale, this.viewport.clientHeight / this.view.scale * scale);
  }
}

function drawGrid(ctx: CanvasRenderingContext2D, width: number, height: number, view: ViewTransform): void {
  const spacing = 42 * view.scale;
  if (spacing < 9) return;
  ctx.strokeStyle = 'rgba(125, 151, 176, 0.08)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = ((view.x % spacing) + spacing) % spacing; x < width; x += spacing) {
    ctx.moveTo(x, 0); ctx.lineTo(x, height);
  }
  for (let y = ((view.y % spacing) + spacing) % spacing; y < height; y += spacing) {
    ctx.moveTo(0, y); ctx.lineTo(width, y);
  }
  ctx.stroke();
}

function drawArrow(ctx: CanvasRenderingContext2D, from: { x: number; y: number }, to: { x: number; y: number }, color: string): void {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const size = 7;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(to.x - Math.cos(angle - 0.55) * size, to.y - Math.sin(angle - 0.55) * size);
  ctx.lineTo(to.x - Math.cos(angle + 0.55) * size, to.y - Math.sin(angle + 0.55) * size);
  ctx.closePath();
  ctx.fill();
}

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));
