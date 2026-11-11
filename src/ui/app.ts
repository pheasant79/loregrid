import { buildGraphView, nodeRelations, tabKey } from '../core/graph';
import { chooseLanguage, t, type Language, type MessageKey } from '../core/i18n';
import { normalizeTree } from '../core/normalize';
import { SearchIndex } from '../core/search';
import {
  completeNode,
  completeWithPrerequisites,
  inconsistentCompleted,
  loadProgress,
  missingPrerequisites,
  parseProgress,
  saveProgress,
  statusOf,
} from '../core/progress';
import { assertValidTree } from '../core/validate';
import type { GraphKey, LayoutNode, ProgressV2, TreeDefinitionV2 } from '../core/types';
import { GraphRenderer } from './renderer';
import { LayoutService } from './layout-service';

export class LoregridApp {
  private tree!: TreeDefinitionV2;
  private progress!: ProgressV2;
  private language: Language = 'en';
  private graphKey: GraphKey = 'all';
  private selectedId: string | null = null;
  private renderer!: GraphRenderer;
  private layoutService = new LayoutService();
  private layoutGeneration = 0;
  private showRecommended = false;
  private nodeById = new Map<string, TreeDefinitionV2['nodes'][number]>();
  private searchTimer = 0;
  private searchIndex!: SearchIndex;

  constructor(private root: HTMLElement, initialTree: unknown) {
    this.renderShell();
    this.bindShell();
    this.renderer = new GraphRenderer(this.element('viewport'), {
      onNodeClick: (node) => void this.handleNodeClick(node),
      onViewChange: (view) => this.updateZoomLabel(view.scale),
    });
    void this.loadTree(initialTree);
  }

  private renderShell(): void {
    this.root.innerHTML = `
      <div class="app-shell">
        <header class="topbar">
          <div class="brand-block" aria-label="Loregrid">
            <span class="brand-mark" aria-hidden="true"><i></i><i></i><i></i></span>
            <span><strong>LOREGRID</strong><small>LEARNING SYSTEMS MAP</small></span>
          </div>
          <div class="tree-identity"><strong id="treeTitle">Loregrid</strong><span id="treeSubtitle"></span></div>
          <label class="search-box">
            <span aria-hidden="true">⌕</span>
            <input id="searchInput" type="search" autocomplete="off" />
            <kbd>/</kbd>
            <div id="searchResults" class="search-results" hidden></div>
          </label>
          <div class="top-actions">
            <button id="openTree" class="icon-text" type="button"><span>↗</span><b data-i18n="openTree"></b></button>
            <button id="moreButton" class="icon-button" type="button" aria-label="Menu">•••</button>
            <div id="moreMenu" class="more-menu" hidden>
              <button id="exportTree" type="button" data-i18n="exportTree"></button>
              <button id="backupProgress" type="button" data-i18n="backup"></button>
              <button id="restoreProgress" type="button" data-i18n="restore"></button>
            </div>
            <button id="languageToggle" class="language-toggle" type="button">中 / EN</button>
          </div>
          <input id="treeFile" type="file" accept=".json,application/json" hidden />
          <input id="progressFile" type="file" accept=".json,application/json" hidden />
        </header>
        <nav class="tabbar" aria-label="Graph pages">
          <div id="tabs" class="tabs"></div>
          <div class="tab-tools">
            <button id="toggleRelations" type="button" data-i18n="relations"></button>
            <button id="fitView" class="icon-button" type="button" data-i18n-title="fit" aria-label="Fit view">⌗</button>
          </div>
        </nav>
        <main id="workspace" class="workspace details-closed">
          <section id="viewport" class="viewport" tabindex="0" aria-label="Loregrid graph">
            <div class="canvas-hud">
              <div><span id="activePage">ALL</span><small id="graphStats"></small></div>
              <div class="zoom-controls">
                <button id="zoomOut" type="button" aria-label="Zoom out">−</button>
                <span id="zoomValue">100%</span>
                <button id="zoomIn" type="button" aria-label="Zoom in">+</button>
              </div>
            </div>
            <div id="layoutBusy" class="layout-busy" hidden><span class="spinner"></span><b data-i18n="layoutBusy"></b><button id="cancelLayout" type="button" data-i18n="cancel"></button></div>
            <div id="toast" class="toast" hidden></div>
          </section>
          <aside id="detailPanel" class="detail-panel">
            <header><span data-i18n="details"></span><button id="closeDetails" type="button" aria-label="Close">×</button></header>
            <div id="detailBody" class="detail-body"></div>
          </aside>
        </main>
        <footer class="statusbar">
          <div><span class="status-dot"></span><span id="statusText">Loregrid Alpha</span></div>
          <div id="progressSummary"></div>
        </footer>
      </div>`;
  }

  private bindShell(): void {
    const viewport = this.element('viewport');
    let dragging = false;
    let previous = { x: 0, y: 0 };
    viewport.addEventListener('pointerdown', (event) => {
      if ((event.target as HTMLElement).closest('.graph-node, button, input, textarea, a')) return;
      dragging = true;
      previous = { x: event.clientX, y: event.clientY };
      viewport.setPointerCapture(event.pointerId);
      viewport.classList.add('is-dragging');
    });
    viewport.addEventListener('pointermove', (event) => {
      if (!dragging) return;
      this.renderer.pan(event.clientX - previous.x, event.clientY - previous.y);
      previous = { x: event.clientX, y: event.clientY };
    });
    viewport.addEventListener('pointerup', () => {
      dragging = false;
      viewport.classList.remove('is-dragging');
    });
    viewport.addEventListener('wheel', (event) => {
      event.preventDefault();
      this.renderer.zoomAt(event.clientX, event.clientY, Math.exp(-event.deltaY * 0.0012));
    }, { passive: false });

    this.element<HTMLButtonElement>('fitView').onclick = () => this.renderer.fit();
    this.element<HTMLButtonElement>('zoomIn').onclick = () => this.zoomCenter(1.18);
    this.element<HTMLButtonElement>('zoomOut').onclick = () => this.zoomCenter(1 / 1.18);
    this.element<HTMLButtonElement>('toggleRelations').onclick = (event) => {
      this.showRecommended = !this.showRecommended;
      (event.currentTarget as HTMLButtonElement).classList.toggle('active', this.showRecommended);
      this.renderer.setRecommendedVisible(this.showRecommended);
    };
    this.element<HTMLButtonElement>('openTree').onclick = () => this.element<HTMLInputElement>('treeFile').click();
    this.element<HTMLInputElement>('treeFile').onchange = (event) => void this.openTreeFile(event);
    this.element<HTMLButtonElement>('exportTree').onclick = () => this.download(`${this.tree.id}.json`, JSON.stringify(this.tree, null, 2));
    this.element<HTMLButtonElement>('backupProgress').onclick = () => {
      this.progress.exportedAt = new Date().toISOString();
      this.download(`${this.tree.id}-progress-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(this.progress, null, 2));
    };
    this.element<HTMLButtonElement>('restoreProgress').onclick = () => this.element<HTMLInputElement>('progressFile').click();
    this.element<HTMLInputElement>('progressFile').onchange = (event) => void this.restoreProgressFile(event);
    this.element<HTMLButtonElement>('languageToggle').onclick = () => {
      this.language = this.language === 'zh-CN' ? 'en' : 'zh-CN';
      this.progress.ui = { ...this.progress.ui, language: this.language };
      this.persist();
      this.applyLanguage();
      this.renderTabs();
      this.renderDetail();
    };
    this.element<HTMLButtonElement>('moreButton').onclick = () => {
      const menu = this.element('moreMenu');
      menu.hidden = !menu.hidden;
    };
    this.element<HTMLButtonElement>('closeDetails').onclick = () => {
      this.selectedId = null;
      this.renderer.setSelection(null);
      this.element('workspace').classList.add('details-closed');
    };
    this.element<HTMLButtonElement>('cancelLayout').onclick = () => {
      this.layoutGeneration += 1;
      this.layoutService.cancel();
      this.element('layoutBusy').hidden = true;
    };
    const search = this.element<HTMLInputElement>('searchInput');
    search.addEventListener('input', () => {
      window.clearTimeout(this.searchTimer);
      this.searchTimer = window.setTimeout(() => this.renderSearch(search.value), 80);
    });
    search.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') this.element('searchResults').hidden = true;
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        event.preventDefault(); search.focus();
      }
    });
  }

  private async loadTree(input: unknown): Promise<void> {
    const normalized = normalizeTree(input);
    assertValidTree(normalized.tree);
    this.tree = normalized.tree;
    this.nodeById = new Map(this.tree.nodes.map((node) => [node.id, node]));
    this.searchIndex = new SearchIndex(this.tree);
    const loaded = loadProgress(this.tree);
    this.progress = loaded.progress;
    this.language = chooseLanguage(this.tree.language, this.progress.ui?.language);
    const requestedKey = this.progress.ui?.lastGraphKey;
    const firstTab = [...this.tree.tabs].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))[0];
    this.graphKey = requestedKey && this.graphKeyExists(requestedKey) ? requestedKey : firstTab ? tabKey(firstTab.id) : 'all';
    this.element('treeTitle').textContent = this.tree.title;
    this.element('treeSubtitle').textContent = this.tree.subtitle ?? this.tree.description ?? '';
    this.applyLanguage();
    this.renderTabs();
    this.updateProgressSummary();
    this.selectedId = null;
    this.renderDetail();
    await this.switchGraph(this.graphKey, true);
    if (normalized.migratedFrom) this.toast(t(this.language, 'migrated'));
    else if (loaded.migrated) this.toast(t(this.language, 'progressMigrated'));
  }

  private async switchGraph(key: GraphKey, fit = true, focusNode?: string): Promise<void> {
    const generation = ++this.layoutGeneration;
    this.graphKey = key;
    this.progress.ui = { ...this.progress.ui, lastGraphKey: key };
    this.persist();
    this.renderTabs();
    this.element('layoutBusy').hidden = false;
    const view = buildGraphView(this.tree, key);
    try {
      const layout = await this.layoutService.request(view, `${this.tree.id}:${this.tree.version ?? '2'}`);
      if (generation !== this.layoutGeneration) return;
      this.renderer.setData(layout, this.tree, this.progress);
      this.renderer.setRecommendedVisible(this.showRecommended);
      this.renderer.setSelection(this.selectedId);
      this.element('layoutBusy').hidden = true;
      this.element('activePage').textContent = key === 'all' ? 'ALL' : this.tabLabel(key.slice(4)).toUpperCase();
      this.element('graphStats').textContent = `${layout.nodes.length} ${t(this.language, 'nodes')}`;
      if (fit) this.renderer.fit();
      if (focusNode) {
        this.renderer.centerNode(focusNode);
        this.renderer.setHighlight(focusNode);
        window.setTimeout(() => this.renderer.setHighlight(null), 1800);
      }
    } catch (error) {
      if (generation !== this.layoutGeneration) return;
      this.element('layoutBusy').hidden = true;
      this.toast(error instanceof Error ? error.message : String(error), true);
    }
  }

  private renderTabs(): void {
    const host = this.element('tabs');
    host.textContent = '';
    const completedCount = (tabId?: string): number => this.tree.nodes.filter((node) => (!tabId || node.tabId === tabId) && this.progress.completed[node.id]).length;
    const nodeCount = (tabId?: string): number => this.tree.nodes.filter((node) => !tabId || node.tabId === tabId).length;
    const entries: Array<{ key: GraphKey; label: string; color: string; count: number; done: number }> = [
      { key: 'all', label: t(this.language, 'all'), color: '#d1a95e', count: nodeCount(), done: completedCount() },
      ...[...this.tree.tabs]
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map((tab) => ({ key: tabKey(tab.id), label: this.language === 'en' ? tab.labelEn ?? tab.label : tab.label, color: tab.color ?? '#6687a6', count: nodeCount(tab.id), done: completedCount(tab.id) })),
    ];
    entries.forEach((entry) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = this.graphKey === entry.key ? 'active' : '';
      button.setAttribute('aria-label', entry.label);
      button.setAttribute('aria-current', this.graphKey === entry.key ? 'page' : 'false');
      button.style.setProperty('--tab-color', entry.color);
      const dot = document.createElement('span'); dot.className = 'tab-dot';
      const label = document.createElement('span'); label.textContent = entry.label;
      const meta = document.createElement('small'); meta.className = 'tab-count'; meta.textContent = `${entry.done} / ${entry.count}`;
      button.append(dot, label, meta);
      button.onclick = () => void this.switchGraph(entry.key);
      host.append(button);
    });
  }

  private async handleNodeClick(layoutNode: LayoutNode): Promise<void> {
    if (layoutNode.kind === 'proxy' && layoutNode.targetTabId) {
      this.selectedId = layoutNode.nodeId;
      await this.switchGraph(tabKey(layoutNode.targetTabId), false, layoutNode.nodeId);
    } else {
      this.selectedId = layoutNode.nodeId;
      this.renderer.setSelection(layoutNode.nodeId);
    }
    this.element('workspace').classList.remove('details-closed');
    this.renderDetail();
  }

  private renderDetail(): void {
    const host = this.element('detailBody');
    host.textContent = '';
    const node = this.selectedId ? this.nodeById.get(this.selectedId) : undefined;
    if (!node) {
      const empty = document.createElement('div');
      empty.className = 'detail-empty';
      const glyph = document.createElement('div'); glyph.className = 'detail-glyph'; glyph.textContent = '◇';
      const text = document.createElement('p'); text.textContent = t(this.language, 'emptyDetails');
      empty.append(glyph, text); host.append(empty); return;
    }
    const tab = this.tree.tabs.find((entry) => entry.id === node.tabId);
    const eyebrow = document.createElement('div'); eyebrow.className = 'detail-eyebrow'; eyebrow.textContent = `${tab?.label ?? node.tabId} · ${node.kind ?? 'topic'}`;
    const title = document.createElement('h1'); title.textContent = node.title;
    host.append(eyebrow, title);
    if (node.tags?.length) {
      const tags = document.createElement('div'); tags.className = 'tags';
      node.tags.forEach((tag) => { const item = document.createElement('span'); item.textContent = tag; tags.append(item); });
      host.append(tags);
    }
    if (node.summary) { const summary = document.createElement('p'); summary.className = 'summary'; summary.textContent = node.summary; host.append(summary); }
    if (inconsistentCompleted(this.progress, this.tree).has(node.id)) {
      const warning = document.createElement('div'); warning.className = 'state-warning'; warning.textContent = t(this.language, 'missingWarning'); host.append(warning);
    }
    if (node.outcome) this.detailSection(host, t(this.language, 'outcome'), node.outcome);
    if (node.caution) this.detailSection(host, t(this.language, 'caution'), node.caution, 'caution');
    const relations = nodeRelations(this.tree, node.id);
    this.relationSection(host, t(this.language, 'prerequisites'), relations.prerequisites.map((edge) => edge.source));
    this.relationSection(host, t(this.language, 'dependents'), relations.dependents.map((edge) => edge.target));
    this.relationSection(host, t(this.language, 'recommended'), relations.recommended.map((edge) => edge.source === node.id ? edge.target : edge.source));
    this.relationSection(host, t(this.language, 'related'), relations.related.map((edge) => edge.source === node.id ? edge.target : edge.source));
    const resources = (node.resourceIds ?? []).map((id) => this.tree.resources.find((resource) => resource.id === id)).filter(Boolean);
    if (resources.length) {
      const section = this.section(host, t(this.language, 'resources'));
      resources.forEach((resource) => {
        if (!resource) return;
        const link = document.createElement(resource.url ? 'a' : 'div');
        link.className = 'resource-link'; link.textContent = resource.title;
        if (resource.url && link instanceof HTMLAnchorElement) { link.href = resource.url; link.target = '_blank'; link.rel = 'noreferrer'; }
        section.append(link);
      });
    }
    const notes = this.section(host, t(this.language, 'notes'));
    const textarea = document.createElement('textarea');
    textarea.value = this.progress.notes[node.id] ?? '';
    textarea.maxLength = 12_000;
    textarea.addEventListener('input', () => { this.progress.notes[node.id] = textarea.value; this.persist(); });
    notes.append(textarea);
    const actions = document.createElement('div'); actions.className = 'detail-actions';
    const status = statusOf(this.progress, this.tree, node.id);
    const main = document.createElement('button'); main.type = 'button'; main.className = 'primary-action';
    main.textContent = status === 'completed' ? t(this.language, 'undoComplete') : t(this.language, 'completeOnly');
    main.onclick = () => {
      this.progress = completeNode(this.progress, node.id, status !== 'completed');
      this.persistAndRefresh();
    };
    actions.append(main);
    const missing = missingPrerequisites(this.progress, this.tree, node.id);
    if (status !== 'completed' && missing.length > 0) {
      const chain = document.createElement('button'); chain.type = 'button'; chain.textContent = `${t(this.language, 'completeChain')} (${missing.length + 1})`;
      chain.onclick = () => {
        if (!window.confirm(`${t(this.language, 'completeChain')}: ${missing.length + 1}`)) return;
        this.progress = completeWithPrerequisites(this.progress, this.tree, node.id);
        this.persistAndRefresh();
      };
      actions.append(chain);
    }
    host.append(actions);
  }

  private relationSection(host: HTMLElement, heading: string, ids: string[]): void {
    const unique = [...new Set(ids)];
    if (!unique.length) return;
    const section = this.section(host, heading);
    unique.forEach((id) => {
      const node = this.nodeById.get(id); if (!node) return;
      const button = document.createElement('button'); button.type = 'button'; button.className = 'relation-link';
      const dot = document.createElement('span'); dot.style.background = this.tree.tabs.find((tab) => tab.id === node.tabId)?.color ?? '#6687a6';
      const label = document.createElement('b'); label.textContent = node.title;
      const arrow = document.createElement('i'); arrow.textContent = node.tabId === this.nodeById.get(this.selectedId ?? '')?.tabId ? '→' : '↗';
      button.append(dot, label, arrow);
      button.onclick = () => void this.navigateToNode(node.id);
      section.append(button);
    });
  }

  private async navigateToNode(nodeId: string): Promise<void> {
    const node = this.nodeById.get(nodeId); if (!node) return;
    this.selectedId = nodeId;
    const targetKey = this.graphKey === 'all' ? 'all' : tabKey(node.tabId);
    if (targetKey !== this.graphKey) await this.switchGraph(targetKey, false, nodeId);
    else { this.renderer.setSelection(nodeId); this.renderer.centerNode(nodeId); this.renderer.setHighlight(nodeId); }
    this.renderDetail();
  }

  private renderSearch(query: string): void {
    const host = this.element('searchResults');
    host.textContent = '';
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) { host.hidden = true; return; }
    const results = this.searchIndex.search(normalized, 12);
    if (!results.length) { host.hidden = true; return; }
    results.forEach((node) => {
      const button = document.createElement('button'); button.type = 'button';
      const title = document.createElement('b'); title.textContent = node.title;
      const meta = document.createElement('span'); meta.textContent = `${this.tabLabel(node.tabId)} · ${node.id}`;
      button.append(title, meta);
      button.onclick = () => { host.hidden = true; this.element<HTMLInputElement>('searchInput').value = ''; void this.navigateToNode(node.id); };
      host.append(button);
    });
    host.hidden = false;
  }

  private applyLanguage(): void {
    document.documentElement.lang = this.language;
    this.root.querySelectorAll<HTMLElement>('[data-i18n]').forEach((element) => {
      const key = element.dataset.i18n as MessageKey; element.textContent = t(this.language, key);
    });
    this.root.querySelectorAll<HTMLElement>('[data-i18n-title]').forEach((element) => {
      const key = element.dataset.i18nTitle as MessageKey; element.title = t(this.language, key);
    });
    this.element<HTMLInputElement>('searchInput').placeholder = t(this.language, 'search');
    this.updateProgressSummary();
  }

  private updateProgressSummary(): void {
    if (!this.tree || !this.progress) return;
    const complete = Object.keys(this.progress.completed).length;
    this.element('progressSummary').textContent = `${complete} / ${this.tree.nodes.length} ${t(this.language, 'complete')}`;
  }

  private persistAndRefresh(): void {
    this.persist(); this.renderer.setProgress(this.progress); this.updateProgressSummary(); this.renderDetail();
  }

  private persist(): void {
    try { saveProgress(this.progress); }
    catch { this.toast('Progress could not be saved. Export a backup.', true); }
  }

  private detailSection(host: HTMLElement, heading: string, value: string, className = ''): void {
    const section = this.section(host, heading); const body = document.createElement('p'); body.textContent = value;
    if (className) body.className = className; section.append(body);
  }

  private section(host: HTMLElement, heading: string): HTMLElement {
    const section = document.createElement('section'); section.className = 'detail-section';
    const title = document.createElement('h2'); title.textContent = heading; section.append(title); host.append(section); return section;
  }

  private async openTreeFile(event: Event): Promise<void> {
    const input = event.currentTarget as HTMLInputElement; const file = input.files?.[0]; input.value = '';
    if (!file) return;
    try {
      const text = await this.readImport(file); if (text === null) return;
      await this.loadTree(JSON.parse(text));
    }
    catch (error) { this.toast(`${t(this.language, 'invalidFile')}: ${error instanceof Error ? error.message : String(error)}`, true); }
  }

  private async restoreProgressFile(event: Event): Promise<void> {
    const input = event.currentTarget as HTMLInputElement; const file = input.files?.[0]; input.value = '';
    if (!file) return;
    try {
      const text = await this.readImport(file); if (text === null) return;
      this.progress = parseProgress(text, this.tree); this.persistAndRefresh();
    }
    catch (error) { this.toast(`${t(this.language, 'invalidFile')}: ${error instanceof Error ? error.message : String(error)}`, true); }
  }

  private async readImport(file: File): Promise<string | null> {
    if (file.size > 10 * 1024 * 1024 && !window.confirm(`${t(this.language, 'largeFile')}\n${(file.size / 1024 / 1024).toFixed(1)} MB`)) return null;
    return file.text();
  }

  private download(name: string, text: string): void {
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  private zoomCenter(factor: number): void {
    const rect = this.element('viewport').getBoundingClientRect(); this.renderer.zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, factor);
  }

  private updateZoomLabel(scale: number): void { this.element('zoomValue').textContent = `${Math.round(scale * 100)}%`; }
  private tabLabel(tabId: string): string { const tab = this.tree.tabs.find((entry) => entry.id === tabId); return this.language === 'en' ? tab?.labelEn ?? tab?.label ?? tabId : tab?.label ?? tabId; }
  private graphKeyExists(key: GraphKey): boolean { return key === 'all' || this.tree.tabs.some((tab) => key === tabKey(tab.id)); }
  private toast(message: string, error = false): void {
    const toast = this.element('toast'); toast.textContent = message; toast.classList.toggle('is-error', error); toast.hidden = false;
    window.setTimeout(() => { toast.hidden = true; }, 4200);
  }
  private element<T extends HTMLElement = HTMLElement>(id: string): T { const value = this.root.querySelector<T>(`#${id}`); if (!value) throw new Error(`Missing #${id}.`); return value; }
}
