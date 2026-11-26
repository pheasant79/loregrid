import type { LayoutNode, LayoutResult, ProgressV2, TreeDefinitionV2, TreeNode } from '../core/types';
import { statusOf } from '../core/progress';
import { chooseLanguage, type Language } from '../core/i18n';
import { SpatialIndex } from './spatial-index';
import { DependencyFocus } from '../core/focus';
import { computeStageBands, stageColor, type StageBand } from '../core/stages';
import { distributeEdgePorts } from './edge-routing';
import { blendColor, buildEdgeCurves, edgeZoomStyle, EDGE_DEFAULT } from './edge-paint';
import { placeStageLabels } from './stage-labels';
import edgeLineUrl from '../assets/yart/EdgeLine.png';

export interface ViewTransform {
  x: number;
  y: number;
  scale: number;
}

interface RendererCallbacks {
  onNodeClick: (node: LayoutNode, event: MouseEvent) => void;
  onNodeContextMenu: (node: LayoutNode, event: MouseEvent) => void;
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
  private treeNodeById = new Map<string, TreeNode>();
  private language: Language = 'en';
  private progress: ProgressV2 | null = null;
  private selectedId: string | null = null;
  private highlightedId: string | null = null;
  private hoveredId: string | null = null;
  private focusIndex: DependencyFocus | null = null;
  private focusedNodes = new Set<string>();
  private queuePositions = new Map<string, number>();
  private showRecommended = false;
  private view: ViewTransform = { x: 0, y: 0, scale: 0.8 };
  private frame = 0;
  private resizeObserver: ResizeObserver;
  private callbacks: RendererCallbacks;
  private spatialIndex = new SpatialIndex([]);
  private renderedNodes = new Map<string, HTMLButtonElement>();
  private minimapBase = document.createElement('canvas');
  private minimapDirty = true;
  private edgeTextureBands: Array<{ width: number; alpha: number }> = [];
  private stageBands: StageBand[] = [];
  private edgeCurves: ReturnType<typeof buildEdgeCurves> | null = null;
  private zoomFloorLocked = true;

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
    const edgeTexture = new Image();
    edgeTexture.onload = () => {
      // EdgeLine is a constant white strip with a symmetric alpha cross-section.
      // Read it once and reproduce that profile with whole-path strokes, avoiding segment seams.
      const strip = document.createElement('canvas');
      strip.width = edgeTexture.naturalWidth;
      strip.height = edgeTexture.naturalHeight;
      const stripContext = strip.getContext('2d');
      if (!stripContext) return;
      stripContext.drawImage(edgeTexture, 0, 0);
      const pixels = stripContext.getImageData(0, 0, strip.width, strip.height).data;
      let previous = 0;
      for (let row = 0; row < strip.height / 2; row++) {
        const alpha = pixels[(row * strip.width + Math.floor(strip.width / 2)) * 4 + 3]! / 255;
        if (alpha <= previous) continue;
        this.edgeTextureBands.push({
          width: (strip.height - row * 2) / strip.height,
          alpha,
        });
        previous = alpha;
      }
      this.requestDraw();
    };
    edgeTexture.src = edgeLineUrl;
    viewport.append(this.canvas, this.nodeLayer, this.minimap);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(viewport);
    this.resize();
  }

  setData(layout: LayoutResult, tree: TreeDefinitionV2, progress: ProgressV2): void {
    this.edgeCurves = null;
    this.clearRenderedNodes();
    this.minimapDirty = true;
    this.layout = layout;
    if (this.tree !== tree) {
      this.focusIndex = new DependencyFocus(tree);
      this.treeNodeById = new Map(tree.nodes.map((node) => [node.id, node]));
    }
    this.language = chooseLanguage(tree.language, progress.ui?.language);
    this.stageBands = computeStageBands(layout, tree, progress, this.language);
    this.tree = tree;
    this.hoveredId = null;
    this.updateFocus();
    this.progress = progress;
    this.queuePositions = new Map(progress.queue.map((id, index) => [id, index + 1]));
    this.spatialIndex = new SpatialIndex(layout.nodes);
    this.requestDraw();
  }

  setProgress(progress: ProgressV2): void {
    this.edgeCurves = null;
    this.clearRenderedNodes();
    this.minimapDirty = true;
    this.progress = progress;
    if (this.layout && this.tree) this.stageBands = computeStageBands(this.layout, this.tree, progress, this.language);
    this.queuePositions = new Map(progress.queue.map((id, index) => [id, index + 1]));
    this.requestDraw();
  }

  setLanguage(language: Language): void {
    if (this.language === language) return;
    this.language = language;
    if (this.layout && this.tree && this.progress) this.stageBands = computeStageBands(this.layout, this.tree, this.progress, language);
    this.clearRenderedNodes();
    this.requestDraw();
  }

  setSelection(nodeId: string | null): void {
    this.selectedId = nodeId;
    this.updateFocus();
    this.requestDraw();
  }

  setHighlight(nodeId: string | null): void {
    this.highlightedId = nodeId;
    this.requestDraw();
  }

  private updateFocus(): void {
    this.edgeCurves = null;
    const id = this.hoveredId ?? this.selectedId;
    this.focusedNodes = id ? this.focusIndex?.connected(id) ?? new Set([id]) : new Set();
  }

  setRecommendedVisible(visible: boolean): void {
    this.edgeCurves = null;
    this.showRecommended = visible;
    this.requestDraw();
  }

  getView(): ViewTransform {
    return { ...this.view };
  }

  setView(view: ViewTransform): void {
    this.view = { ...view, scale: clamp(view.scale, this.zoomFloorLocked ? 0.2 : 0.08, 2.4) };
    this.callbacks.onViewChange(this.getView());
    this.requestDraw();
  }

  setZoomFloorLocked(locked: boolean): void {
    this.zoomFloorLocked = locked;
    const minimum = locked ? 0.2 : 0.08;
    if (this.view.scale < minimum) {
      const rect = this.viewport.getBoundingClientRect();
      this.zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, minimum / this.view.scale);
    } else this.requestDraw();
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
    const scale = clamp(this.view.scale * factor, this.zoomFloorLocked ? 0.2 : 0.08, 2.4);
    this.setView({ x: px - worldX * scale, y: py - worldY * scale, scale });
  }

  fit(padding = 70): void {
    if (!this.layout) return;
    const width = Math.max(1, this.viewport.clientWidth - padding * 2);
    const height = Math.max(1, this.viewport.clientHeight - padding * 2);
    const scale = clamp(Math.min(width / this.layout.width, height / this.layout.height), this.zoomFloorLocked ? 0.2 : 0.08, 1);
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
    const relationToggle = this.viewport.querySelector<HTMLElement>('#toggleRelations');
    const relationWidth = relationToggle && getComputedStyle(relationToggle).display !== 'none'
      ? relationToggle.offsetWidth
      : 0;
    drawStageBands(ctx, this.stageBands, this.view, this.viewport.clientWidth, this.viewport.clientHeight);
    drawGrid(ctx, this.viewport.clientWidth, this.viewport.clientHeight, this.view);
    drawStageTitles(ctx, this.stageBands, this.view, this.viewport.clientWidth, relationWidth);
    ctx.save();
    ctx.translate(this.view.x, this.view.y);
    ctx.scale(this.view.scale, this.view.scale);
    this.drawEdges(ctx, layout, tree);
    ctx.restore();
    this.drawNodes(layout, tree, progress);
    this.drawMinimap(layout, tree, progress);
  }

  private drawEdges(ctx: CanvasRenderingContext2D, layout: LayoutResult, tree: TreeDefinitionV2): void {
    if (!this.edgeCurves) {
      const visibleEdges = layout.edges.filter((edge) =>
        edge.type !== 'related' && (edge.type !== 'recommended' || this.showRecommended));
      this.edgeCurves = buildEdgeCurves(
        visibleEdges, layout.nodes, distributeEdgePorts(layout.nodes, visibleEdges),
        this.progress!.completed, this.stageBands,
        (node) => stageColor(tree, {
          stageId: node.effectiveStageId ?? node.stageId,
          stageOrder: node.effectiveStageOrder ?? node.stageOrder,
        }), this.focusedNodes,
      );
    }
    // Geometry, ports and trunk deduplication are cached across pan/zoom frames.
    const margin = 100 / this.view.scale;
    const left = -this.view.x / this.view.scale - margin;
    const top = -this.view.y / this.view.scale - margin;
    const right = left + this.viewport.clientWidth / this.view.scale + 2 * margin;
    const bottom = top + this.viewport.clientHeight / this.view.scale + 2 * margin;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const zoomStyle = edgeZoomStyle(this.view.scale);
    for (const curve of this.edgeCurves) {
      const { from, control1, control2, to, type, selected } = curve;
      if (Math.max(from.x, to.x) < left || Math.min(from.x, to.x) > right
        || Math.max(from.y, to.y) < top || Math.min(from.y, to.y) > bottom) continue;
      const gradient = ctx.createLinearGradient(
        from.x, from.y, to.x === from.x && to.y === from.y ? to.x + .001 : to.x, to.y,
      );
      const startColor = blendColor(curve.startColor, EDGE_DEFAULT, zoomStyle.desaturation);
      const endColor = blendColor(curve.endColor, EDGE_DEFAULT, zoomStyle.desaturation);
      gradient.addColorStop(0, selected ? blendColor(startColor, '#ffffff', .48) : startColor);
      gradient.addColorStop(1, selected ? blendColor(endColor, '#ffffff', .48) : endColor);
      ctx.strokeStyle = gradient;
      const lineWidth = type === 'recommended'
        ? Math.max(1.2 / this.view.scale, 1.3)
        : Math.max(zoomStyle.minScreenWidth / this.view.scale, 3);
      ctx.setLineDash(type === 'recommended' ? [7, 7] : []);
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.bezierCurveTo(control1.x, control1.y, control2.x, control2.y, to.x, to.y);
      if (type === 'required') {
        // A narrow, low-alpha fringe plus YART's alpha-profile core, rather
        // than a flat dim stroke or expensive per-edge shadowBlur.
        ctx.globalAlpha = (selected ? .12 : .07) * zoomStyle.alpha;
        ctx.lineWidth = lineWidth * 2.2;
        ctx.stroke();
      }
      if (this.edgeTextureBands.length && type === 'required') {
        let previousAlpha = 0;
        for (const band of this.edgeTextureBands) {
          const targetAlpha = band.alpha * (selected ? 1 : .95) * zoomStyle.alpha;
          ctx.globalAlpha = previousAlpha < 1 ? (targetAlpha - previousAlpha) / (1 - previousAlpha) : 0;
          ctx.lineWidth = lineWidth * band.width;
          ctx.stroke();
          previousAlpha = targetAlpha;
        }
      } else {
        ctx.globalAlpha = type === 'recommended' ? .72 : .95 * zoomStyle.alpha;
        ctx.lineWidth = lineWidth;
        ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }
  }

  private drawNodes(layout: LayoutResult, tree: TreeDefinitionV2, progress: ProgressV2): void {
    const worldLeft = (-this.view.x) / this.view.scale - 260;
    const worldTop = (-this.view.y) / this.view.scale - 180;
    const worldRight = worldLeft + this.viewport.clientWidth / this.view.scale + 520;
    const worldBottom = worldTop + this.viewport.clientHeight / this.view.scale + 360;
    const visible = this.spatialIndex.query({ left: worldLeft, top: worldTop, right: worldRight, bottom: worldBottom });
    const fragment = document.createDocumentFragment();
    const visibleIds = new Set(visible.map((node) => node.viewId));
    for (const [id, element] of this.renderedNodes) {
      if (!visibleIds.has(id)) { element.remove(); this.renderedNodes.delete(id); }
    }
    this.nodeLayer.style.transform = `translate(${this.view.x}px, ${this.view.y}px) scale(${this.view.scale})`;
    this.nodeLayer.className = `node-layer ${this.view.scale < 0.38 ? 'lod-low' : this.view.scale < 0.68 ? 'lod-medium' : this.view.scale >= 1.1 ? 'lod-rich' : 'lod-high'}`;
    this.nodeLayer.style.setProperty('--lod-border-width', `${this.view.scale < 0.38 ? 1.5 / this.view.scale : 2}px`);
    this.nodeLayer.style.setProperty('--lod-glow-size', `${this.view.scale < 0.38 ? 4 / this.view.scale : 0}px`);
    this.nodeLayer.style.setProperty('--lod-corner-radius', `${Math.max(7, 4.9 / this.view.scale)}px`);
    const richProgress = clamp((this.view.scale - 1.1) / 0.2, 0, 1);
    this.nodeLayer.style.setProperty('--rich-opacity', String(richProgress));

    visible.forEach((node) => {
      const richCard = this.view.scale >= 1.1 && node.kind !== 'proxy';
      const richExtraHeight = richCard ? 16 * richProgress : 0;
      const existing = this.renderedNodes.get(node.viewId);
      if (existing) {
        existing.style.top = `${node.y - richExtraHeight / 2}px`;
        existing.style.height = `${node.height + richExtraHeight}px`;
        existing.classList.toggle('is-selected', node.nodeId === this.selectedId);
        existing.classList.toggle('is-highlighted', node.nodeId === this.highlightedId);
        existing.classList.toggle('is-focused', this.focusedNodes.has(node.nodeId));
        existing.classList.toggle('is-unfocused', Boolean(this.hoveredId ?? this.selectedId) && !this.focusedNodes.has(node.nodeId));
        return;
      }
      const button = document.createElement('button');
      this.renderedNodes.set(node.viewId, button);
      button.type = 'button';
      button.className = `graph-node ${node.kind === 'proxy' ? 'is-proxy' : ''} status-${statusOf(progress, tree, node.nodeId)}`;
      if (node.nodeId === this.selectedId) button.classList.add('is-selected');
      if (node.nodeId === this.highlightedId) button.classList.add('is-highlighted');
      if (this.focusedNodes.has(node.nodeId)) button.classList.add('is-focused');
      if ((this.hoveredId ?? this.selectedId) && !this.focusedNodes.has(node.nodeId)) button.classList.add('is-unfocused');
      button.style.left = `${node.x}px`;
      button.style.top = `${node.y - richExtraHeight / 2}px`;
      button.style.width = `${node.width}px`;
      button.style.height = `${node.height + richExtraHeight}px`;
      const nodeColor = stageColor(tree, {
        stageId: node.effectiveStageId ?? node.stageId,
        stageOrder: node.effectiveStageOrder ?? node.stageOrder,
      });
      button.style.setProperty('--node-accent', nodeColor);
      button.style.setProperty('--stage-color', nodeColor);
      button.dataset.nodeId = node.nodeId;
      button.setAttribute('aria-label', node.title);

      const status = statusOf(progress, tree, node.nodeId);
      const icon = document.createElement('span');
      icon.className = 'node-icon';
      icon.setAttribute('aria-hidden', 'true');
      icon.textContent = status === 'completed' ? '✓'
        : status === 'ready' ? '▶'
          : node.kind === 'proxy' ? '↗'
            : node.nodeKind === 'milestone' ? '✦' : node.nodeKind === 'optional' ? '○' : '◇';
      const heading = document.createElement('span');
      heading.className = 'node-heading';
      const category = document.createElement('span');
      category.className = 'node-category';
      category.textContent = node.kind === 'proxy'
        ? this.language === 'en' ? 'LINKED PAGE' : '关联分页'
        : this.language === 'en'
          ? ({ milestone: 'MILESTONE', optional: 'OPTIONAL', topic: 'TOPIC' }[node.nodeKind ?? 'topic'])
          : ({ milestone: '里程碑', optional: '可选', topic: '主题' }[node.nodeKind ?? 'topic']);
      const state = document.createElement('span');
      state.className = 'node-state';
      state.setAttribute('aria-hidden', 'true');
      state.textContent = status === 'completed' ? '✓' : status === 'ready' ? '•' : '◦';
      heading.append(category, state);
      const title = document.createElement('span');
      title.className = 'node-title';
      title.textContent = node.title;
      const richDetail = document.createElement('span');
      richDetail.className = 'node-rich-detail';
      const sourceNode = this.treeNodeById.get(node.nodeId);
      richDetail.textContent = (sourceNode?.summary || sourceNode?.outcome || sourceNode?.tags?.slice(0, 2).join(' · ') || '').slice(0, 96);
      const footer = document.createElement('span');
      footer.className = 'node-footer';
      const track = document.createElement('span');
      track.className = 'node-progress';
      const fill = document.createElement('i');
      if (status === 'completed') fill.style.width = '100%';
      track.append(fill);
      const footerLabel = document.createElement('span');
      footerLabel.textContent = this.language === 'en'
        ? status === 'completed' ? 'COMPLETED' : status === 'ready' ? 'READY' : 'PREREQUISITES'
        : status === 'completed' ? '已完成' : status === 'ready' ? '可开始' : '需前置';
      footer.append(track, footerLabel);
      button.append(icon, heading, title, richDetail, footer);
      const queuePosition = this.queuePositions.get(node.nodeId);
      if (queuePosition) {
        const badge = document.createElement('span');
        badge.className = 'node-queue-badge';
        badge.textContent = String(queuePosition);
        button.classList.add('is-queued');
        button.dataset.queuePosition = String(queuePosition);
        button.append(badge);
      }
      button.addEventListener('pointerenter', () => {
        if (this.view.scale < .4) return;
        this.hoveredId = node.nodeId;
        this.updateFocus();
        this.requestDraw();
      });
      button.addEventListener('pointerleave', () => {
        if (this.hoveredId !== node.nodeId) return;
        this.hoveredId = null;
        this.updateFocus();
        this.requestDraw();
      });
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        this.callbacks.onNodeClick(node, event);
      });
      button.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        event.stopPropagation();
        this.callbacks.onNodeContextMenu(node, event);
      });
      fragment.append(button);
    });
    this.nodeLayer.append(fragment);
  }

  private clearRenderedNodes(): void {
    this.renderedNodes.clear();
    this.nodeLayer.replaceChildren();
  }

  private drawMinimap(layout: LayoutResult, tree: TreeDefinitionV2, progress: ProgressV2): void {
    const ctx = this.minimapContext;
    const width = this.minimap.width;
    const height = this.minimap.height;
    ctx.clearRect(0, 0, width, height);
    const scale = Math.min((width - 12) / layout.width, (height - 12) / layout.height);
    if (this.minimapDirty) {
      this.minimapBase.width = width; this.minimapBase.height = height;
      const base = this.minimapBase.getContext('2d')!;
      base.fillStyle = '#080e14'; base.fillRect(0, 0, width, height);
      for (const node of layout.nodes) {
        const completed = progress.completed[node.nodeId];
        base.globalAlpha = completed ? .95 : .65;
        base.fillStyle = completed
          ? stageColor(tree, { stageId: node.effectiveStageId ?? node.stageId, stageOrder: node.effectiveStageOrder ?? node.stageOrder })
          : '#53677f';
        base.fillRect(6 + node.x * scale, 6 + node.y * scale, Math.max(2, node.width * scale), Math.max(1, node.height * scale));
      }
      this.minimapDirty = false;
    }
    ctx.drawImage(this.minimapBase, 0, 0);
    const worldX = -this.view.x / this.view.scale;
    const worldY = -this.view.y / this.view.scale;
    ctx.strokeStyle = '#f2c572';
    ctx.lineWidth = 1;
    ctx.strokeRect(6 + worldX * scale, 6 + worldY * scale, this.viewport.clientWidth / this.view.scale * scale, this.viewport.clientHeight / this.view.scale * scale);
  }
}

export function drawGrid(ctx: CanvasRenderingContext2D, width: number, height: number, view: ViewTransform): void {
  // YART Canvas.DrawGrid / Constraints: fade minor lines independently;
  // major lines remain present even at the minimum supported zoom.
  if (!Number.isFinite(view.scale) || view.scale <= 0) return;
  const minorAlpha = 0.018 * clamp((view.scale - 0.4) / 0.2, 0, 1);
  ctx.save();
  ctx.lineWidth = 1;
  const drawLines = (worldSpacing: number, alpha: number, skipMajor: boolean): void => {
    if (alpha <= 0.004) return;
    const spacing = worldSpacing * view.scale;
    ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
    ctx.beginPath();
    for (let index = Math.ceil(-view.x / spacing); index * spacing + view.x < width; index++) {
      if (skipMajor && index % 5 === 0) continue;
      const x = index * spacing + view.x;
      ctx.moveTo(x, 0); ctx.lineTo(x, height);
    }
    for (let index = Math.ceil(-view.y / spacing); index * spacing + view.y < height; index++) {
      if (skipMajor && index % 5 === 0) continue;
      const y = index * spacing + view.y;
      ctx.moveTo(0, y); ctx.lineTo(width, y);
    }
    ctx.stroke();
  };
  drawLines(40, minorAlpha, true);
  drawLines(200, 0.035, false);
  ctx.restore();
}

function drawStageBands(
  ctx: CanvasRenderingContext2D,
  bands: readonly StageBand[],
  view: ViewTransform,
  viewportWidth: number,
  viewportHeight: number,
): void {
  if (!bands.length) return;
  ctx.save();
  ctx.lineWidth = 1;
  bands.forEach((band) => {
    const left = band.left * view.scale + view.x;
    const right = band.right * view.scale + view.x;
    if (right <= 0 || left >= viewportWidth || right <= left) return;
    const gradient = ctx.createLinearGradient(left, 0, right, 0);
    gradient.addColorStop(0, rgba(band.color, 0.075));
    gradient.addColorStop(1, rgba(band.color, 0));
    ctx.fillStyle = gradient;
    ctx.fillRect(Math.max(0, left), 0, Math.min(viewportWidth, right) - Math.max(0, left), viewportHeight);

    ctx.strokeStyle = rgba('#536579', 0.34);
    ctx.beginPath();
    ctx.moveTo(Math.round(left) + 0.5, 0);
    ctx.lineTo(Math.round(left) + 0.5, viewportHeight);
    ctx.stroke();

  });
  ctx.restore();
}

function drawStageTitles(
  ctx: CanvasRenderingContext2D,
  bands: readonly StageBand[],
  view: ViewTransform,
  viewportWidth: number,
  relationControlWidth: number,
): void {
  if (!bands.length) return;
  ctx.save();
  ctx.font = '600 11px Inter, "Segoe UI", "Microsoft YaHei UI", sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  for (const label of placeStageLabels(bands, view, viewportWidth, relationControlWidth, (text) => ctx.measureText(text).width)) {
    ctx.fillStyle = label.color;
    ctx.fillText(label.text, label.x, label.y);
  }
  ctx.restore();
}

function rgba(hex: string, alpha: number): string {
  const value = hex.replace('#', '');
  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));
