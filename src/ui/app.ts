import { buildGraphView, nodeRelations, tabKey } from '../core/graph';
import { chooseLanguage, t, type Language, type MessageKey } from '../core/i18n';
import { normalizeTree } from '../core/normalize';
import { stageTitle } from '../core/stages';
import { SearchIndex } from '../core/search';
import {
  clearLearningQueue,
  completeNode,
  completeWithPrerequisites,
  inconsistentCompleted,
  isProgressNewer,
  loadProgress,
  missingPrerequisites,
  moveQueuedNode,
  parseProgress,
  queueWithPrerequisites,
  reorderQueue,
  restoreStoredProgress,
  saveProgress,
  statusOf,
  unqueueNode,
} from '../core/progress';
import { assertValidTree } from '../core/validate';
import type { GraphKey, LayoutNode, ProgressV2, TreeDefinitionV2, TreeNode } from '../core/types';
import { GraphRenderer } from './renderer';
import { LayoutService } from './layout-service';
import { TreeLibrary, type TreeLibraryEntry, type TreeLibraryItem } from '../core/tree-library';
import { LocalDataFolder } from '../core/local-data-folder';

export class LoregridApp {
  private tree!: TreeDefinitionV2;
  private progress!: ProgressV2;
  private language: Language = 'en';
  private graphKey: GraphKey = 'all';
  private lastPageKey: GraphKey = 'all';
  private selectedId: string | null = null;
  private renderer!: GraphRenderer;
  private layoutService = new LayoutService();
  private layoutGeneration = 0;
  private showRecommended = false;
  private nodeById = new Map<string, TreeDefinitionV2['nodes'][number]>();
  private searchTimer = 0;
  private searchIndex!: SearchIndex;
  private searchMatches: TreeNode[] = [];
  private selectedSearchIndex = -1;
  private history: string[] = [];
  private historyIndex = -1;
  private editingPresetId: string | null = null;
  private progressSaveBlocked = false;
  private nodeMenu: HTMLDivElement | null = null;
  private menuController: AbortController | null = null;
  private library = new TreeLibrary();
  private libraryEntries: TreeLibraryItem[] = [];
  private activeEntryKey: string | undefined;
  private libraryAvailable = true;
  private libraryReady: Promise<void> = Promise.resolve();
  private libraryImporting = false;
  private sessionTrees = new Map<string, TreeLibraryEntry>();
  private treeSelectionGeneration = 0;
  private localData = new LocalDataFolder();
  private localDataConnected = false;
  private localDataPermissionNeeded = false;

  constructor(private root: HTMLElement, private initialTree: unknown) {
    this.renderShell();
    this.bindShell();
    this.renderer = new GraphRenderer(this.element('viewport'), {
      onNodeClick: (node, event) => void this.handleNodeClick(node, event),
      onNodeContextMenu: (node, event) => this.showNodeMenu(node, event),
      onViewChange: (view) => this.updateZoomLabel(view.scale),
    });
    this.libraryReady = this.initializeLibrary(initialTree);
  }

  private renderShell(): void {
    this.root.innerHTML = `
      <div class="app-shell">
        <section class="queuebar" aria-label="Learning queue">
          <nav class="page-controls" aria-label="Graph pages">
            <div class="product-controls">
              <div class="brand-block" aria-label="Loregrid">
                <span class="brand-mark" aria-hidden="true"><i></i><i></i><i></i></span>
                <strong>LOREGRID</strong>
              </div>
              <div class="tree-identity"><strong id="treeTitle">Loregrid</strong><span id="treeSubtitle"></span></div>
              <div class="top-actions">
                <button id="moreButton" class="icon-button" type="button" aria-label="Menu">•••</button>
                <div id="moreMenu" class="more-menu" hidden>
                  <div id="favoriteList" class="favorite-list"></div>
                  <button id="openTree" type="button" data-i18n="openTree"></button>
                  <button id="chooseDataFolder" type="button" data-i18n="chooseDataFolder"></button>
                  <button id="refreshDataFolder" type="button" data-i18n="refreshDataFolder"></button>
                  <button id="exportTree" type="button" data-i18n="exportTree"></button>
                  <button id="backupProgress" type="button" data-i18n="backup"></button>
                  <button id="restoreProgress" type="button" data-i18n="restore"></button>
                </div>
                <button id="languageToggle" class="language-toggle" type="button">中 / EN</button>
              </div>
            </div>
            <input id="treeFile" type="file" accept=".json,application/json" multiple hidden />
            <input id="progressFile" type="file" accept=".json,application/json" hidden />
            <div class="page-controls-row">
              <div id="tabs" class="tabs"></div>
              <label class="category-picker"><span id="categoryLabel" class="sr-only"></span><select id="categorySelect" aria-label="Category"></select></label>
              <button id="favoritePage" class="preset-tool favorite-page" type="button" aria-label="Add page to favorites" title="Add page to favorites">☆</button>
              <button id="editPreset" class="preset-tool" type="button" hidden aria-label="Edit combined page" title="Edit combined page">✎</button>
              <button id="addPreset" class="preset-tool" type="button">+</button>
              <button id="deletePreset" class="preset-tool" type="button" hidden>×</button>
            </div>
            <label class="search-box">
              <span aria-hidden="true">⌕</span>
              <input id="searchInput" type="search" autocomplete="off" role="combobox" aria-controls="searchResults" aria-expanded="false" aria-autocomplete="list" />
              <kbd>/</kbd>
              <div id="searchResults" class="search-results" role="listbox" hidden></div>
            </label>
          </nav>
          <section class="queue-column">
            <div class="queue-heading">
              <div class="queue-heading-label"><strong data-i18n="queue"></strong><small id="queueCount"></small></div>
              <button id="clearQueue" class="clear-queue" type="button" data-i18n="clearQueue" hidden></button>
            </div>
            <div id="queueItems" class="queue-items" aria-live="polite"></div>
            <div id="queueScrollbar" class="queue-scrollbar" role="scrollbar" aria-label="Learning queue position" aria-controls="queueItems" aria-orientation="horizontal" aria-valuemin="0" aria-valuemax="0" aria-valuenow="0" tabindex="0">
              <div id="queueScrollbarThumb" class="queue-scrollbar-thumb"></div>
            </div>
          </section>
        </section>
        <main id="workspace" class="workspace details-closed">
          <section id="viewport" class="viewport" tabindex="0" aria-label="Loregrid graph">
            <div class="canvas-hud">
              <div class="canvas-status" aria-hidden="true"><span id="activePage">ALL</span><small id="graphStats"></small></div>
              <div class="zoom-controls">
                <button id="historyBack" type="button" aria-label="Back" title="Back">←</button>
                <button id="historyForward" type="button" aria-label="Forward" title="Forward">→</button>
                <button id="fitView" type="button" data-i18n-title="fit" aria-label="Fit view"><svg class="fit-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10" /></svg></button>
                <button id="zoomOut" type="button" aria-label="Zoom out">−</button>
                <span id="zoomValue">100%</span>
                <button id="zoomIn" type="button" aria-label="Zoom in">+</button>
              </div>
              <button id="toggleRelations" class="relation-toggle" type="button" data-i18n="relations"></button>
            </div>
            <div id="layoutBusy" class="layout-busy" hidden><span class="spinner"></span><b data-i18n="layoutBusy"></b><button id="cancelLayout" type="button" data-i18n="cancel"></button></div>
            <div id="toast" class="toast" hidden></div>
          </section>
          <aside id="detailPanel" class="detail-panel">
            <header><span data-i18n="details"></span><button id="closeDetails" type="button" aria-label="Close">×</button></header>
            <div id="detailBody" class="detail-body"></div>
          </aside>
          <section id="treeSwitcher" class="tree-switcher" aria-label="Tree library">
            <div id="treePicker" class="tree-picker" hidden>
              <header><strong id="treeLibraryHeading"></strong><button id="closeTreePicker" type="button" aria-label="Close tree list">×</button></header>
              <input id="treeSearch" type="search" autocomplete="off" />
              <div id="treeList" class="tree-list" aria-label="Trees"></div>
              <button id="addLibraryTree" class="add-library-tree" type="button"></button>
            </div>
            <button id="treeSwitcherToggle" class="tree-switcher-toggle" type="button" aria-controls="treePicker" aria-expanded="false">
              <span id="treeSwitcherLabel"></span><strong id="currentTreeName"></strong><small id="treeSwitcherStatus"></small><span class="tree-picker-chevron" aria-hidden="true">⌃</span>
            </button>
          </section>
        </main>
        <footer class="statusbar">
          <div><span class="status-dot"></span><span id="statusText">Loregrid ${__LOREGRID_VERSION__}</span></div>
          <div id="progressSummary"></div>
        </footer>
        <dialog id="presetDialog" class="preset-dialog">
          <form id="presetForm">
            <h2 id="presetHeading"></h2>
            <label><span id="presetNameLabel"></span><input id="presetName" maxlength="120" required /></label>
            <fieldset id="presetChoices"></fieldset>
            <p id="presetError" role="alert" hidden></p>
            <div class="dialog-actions"><button id="cancelPreset" type="button" data-i18n="cancel"></button><button id="savePreset" type="submit"></button></div>
          </form>
        </dialog>
      </div>`;
    if (!LocalDataFolder.isSupported()) {
      this.element<HTMLButtonElement>('chooseDataFolder').hidden = true;
      this.element<HTMLButtonElement>('refreshDataFolder').hidden = true;
    }
  }

  private bindShell(): void {
    const viewport = this.element('viewport');
    let dragging = false;
    let previous = { x: 0, y: 0 };
    viewport.addEventListener('pointerdown', (event) => {
      if ((event.target as HTMLElement).closest('.graph-node, button, input, textarea, a, .tree-switcher')) return;
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
      if ((event.target as HTMLElement).closest('.tree-switcher')) return;
      event.preventDefault();
      this.renderer.zoomAt(event.clientX, event.clientY, Math.exp(-event.deltaY * 0.0012));
    }, { passive: false });

    this.element<HTMLButtonElement>('fitView').onclick = () => this.renderer.fit();
    this.element<HTMLButtonElement>('clearQueue').onclick = () => {
      const count = this.progress.queue.length;
      if (!count) return;
      const confirmation = t(this.language, 'confirmClearQueue').replace('{count}', String(count));
      if (!window.confirm(confirmation)) return;
      this.progress = clearLearningQueue(this.progress);
      this.persistAndRefresh();
    };
    this.element<HTMLSelectElement>('categorySelect').onchange = (event) => {
      const value = (event.currentTarget as HTMLSelectElement).value;
      if (value) {
        if (value.startsWith('preset:')) void this.switchGraph(value as GraphKey);
        else void this.switchGraph(tabKey(value));
      }
    };
    this.element('addPreset').onclick = () => this.openPresetEditor();
    this.element('editPreset').onclick = () => {
      const preset = this.currentPreset();
      if (preset) this.openPresetEditor(preset.id);
    };
    this.element('favoritePage').onclick = () => this.toggleFavorite(this.favoriteKeyForCurrentGraph());
    this.element('cancelPreset').onclick = () => this.element<HTMLDialogElement>('presetDialog').close();
    this.element<HTMLFormElement>('presetForm').onsubmit = (event) => {
      event.preventDefault();
      const form = event.currentTarget as HTMLFormElement;
      const tabIds = new FormData(form).getAll('presetTab').map(String);
      if (!tabIds.length) {
        this.element('presetError').textContent = this.language === 'en' ? 'Select at least one page.' : '至少选择一个分页。';
        this.element('presetError').hidden = false;
        return;
      }
      const name = this.element<HTMLInputElement>('presetName').value.trim();
      if (!name) return;
      const presets = this.progress.ui?.presets ?? [];
      const id = this.editingPresetId ?? `view-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      const preset = { id, name, tabIds };
      this.progress.ui = {
        ...this.progress.ui,
        presets: this.editingPresetId
          ? presets.map((entry) => entry.id === id ? preset : entry)
          : [...presets, preset],
      };
      this.editingPresetId = null;
      this.element<HTMLDialogElement>('presetDialog').close();
      this.persistAndRefresh();
      void this.switchGraph(`preset:${id}`);
    };
    this.element('deletePreset').onclick = () => {
      const preset = this.currentPreset();
      if (!preset || !window.confirm(`${this.language === 'en' ? 'Delete combined page' : '删除组合分页'} “${preset.name}”?`)) return;
      this.progress.ui = {
        ...this.progress.ui,
        presets: this.progress.ui?.presets?.filter((entry) => entry.id !== preset.id),
        favorites: this.progress.ui?.favorites?.filter((entry) => entry !== `preset:${preset.id}`),
      };
      void this.switchGraph(this.tree.tabs[0] ? tabKey(this.tree.tabs[0].id) : 'all');
    };
    const queueItems = this.element('queueItems');
    const queueScrollbar = this.element<HTMLDivElement>('queueScrollbar');
    const queueScrollbarThumb = this.element<HTMLDivElement>('queueScrollbarThumb');
    let scrollbarDrag: { startX: number; startScroll: number; maxScroll: number } | null = null;
    let queueScrollbarFrame = 0;
    const syncQueueScrollbar = () => {
      if (queueScrollbarFrame) return;
      queueScrollbarFrame = requestAnimationFrame(() => {
        queueScrollbarFrame = 0;
        this.syncQueueScrollbar();
      });
    };
    queueItems.addEventListener('scroll', syncQueueScrollbar, { passive: true });
    new ResizeObserver(syncQueueScrollbar).observe(queueItems);
    queueScrollbar.addEventListener('pointerdown', (event) => {
      const maxScroll = queueItems.scrollWidth - queueItems.clientWidth;
      if (maxScroll <= 0) return;
      const rect = queueScrollbar.getBoundingClientRect();
      const thumbRect = queueScrollbarThumb.getBoundingClientRect();
      if ((event.target as HTMLElement).closest('.queue-scrollbar-thumb')) {
        scrollbarDrag = { startX: event.clientX, startScroll: queueItems.scrollLeft, maxScroll };
      } else {
        const thumbRatio = thumbRect.width / rect.width;
        const position = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width - thumbRatio / 2));
        queueItems.scrollLeft = position / Math.max(0.01, 1 - thumbRatio) * maxScroll;
        scrollbarDrag = { startX: event.clientX, startScroll: queueItems.scrollLeft, maxScroll };
      }
      queueScrollbar.setPointerCapture(event.pointerId);
      event.preventDefault();
    });
    queueScrollbar.addEventListener('pointermove', (event) => {
      if (!scrollbarDrag) return;
      const travel = queueScrollbar.clientWidth - queueScrollbarThumb.offsetWidth;
      if (travel <= 0) return;
      queueItems.scrollLeft = scrollbarDrag.startScroll
        + (event.clientX - scrollbarDrag.startX) / travel * scrollbarDrag.maxScroll;
    });
    const stopScrollbarDrag = () => { scrollbarDrag = null; };
    queueScrollbar.addEventListener('pointerup', stopScrollbarDrag);
    queueScrollbar.addEventListener('pointercancel', stopScrollbarDrag);
    queueScrollbar.addEventListener('keydown', (event) => {
      const step = event.key === 'PageUp' || event.key === 'PageDown' ? queueItems.clientWidth : Math.max(48, queueItems.clientWidth * 0.1);
      if (event.key === 'ArrowLeft' || event.key === 'PageUp') queueItems.scrollLeft -= step;
      else if (event.key === 'ArrowRight' || event.key === 'PageDown') queueItems.scrollLeft += step;
      else if (event.key === 'Home') queueItems.scrollLeft = 0;
      else if (event.key === 'End') queueItems.scrollLeft = queueItems.scrollWidth;
      else return;
      event.preventDefault();
    });
    queueItems.addEventListener('dragstart', (event) => {
      const card = (event.target as HTMLElement).closest<HTMLElement>('.queue-card');
      if (!card || !event.dataTransfer) return;
      event.dataTransfer.setData('text/plain', card.dataset.nodeId ?? '');
      event.dataTransfer.effectAllowed = 'move';
      card.classList.add('is-dragging');
    });
    queueItems.addEventListener('dragend', (event) => {
      (event.target as HTMLElement).closest('.queue-card')?.classList.remove('is-dragging');
      queueItems.querySelectorAll('.queue-card').forEach((card) => card.classList.remove('is-drop-target'));
    });
    queueItems.addEventListener('dragover', (event) => {
      const card = (event.target as HTMLElement).closest<HTMLElement>('.queue-card');
      if (!card || !event.dataTransfer) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      card.classList.add('is-drop-target');
    });
    queueItems.addEventListener('dragleave', (event) => {
      (event.target as HTMLElement).closest('.queue-card')?.classList.remove('is-drop-target');
    });
    queueItems.addEventListener('drop', (event) => {
      event.preventDefault();
      const source = event.dataTransfer?.getData('text/plain');
      const target = (event.target as HTMLElement).closest<HTMLElement>('.queue-card')?.dataset.nodeId;
      if (!source || !target || source === target) return;
      this.moveQueueItem(source, target);
    });
    queueItems.addEventListener('wheel', (event) => {
      if (queueItems.scrollWidth <= queueItems.clientWidth || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
      event.preventDefault();
      queueItems.scrollLeft += event.deltaY;
    }, { passive: false });
    queueItems.addEventListener('keydown', (event) => {
      if (!event.altKey || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      const card = (event.target as HTMLElement).closest<HTMLElement>('.queue-card');
      const id = card?.dataset.nodeId;
      if (!id) return;
      event.preventDefault();
      this.progress = moveQueuedNode(this.progress, this.tree, id, event.key === 'ArrowLeft' ? -1 : 1);
      this.persistAndRefresh();
      [...queueItems.querySelectorAll<HTMLElement>('.queue-card')].find((item) => item.dataset.nodeId === id)?.querySelector<HTMLElement>('.queue-card-open')?.focus();
    });
    this.element<HTMLButtonElement>('zoomIn').onclick = () => this.zoomCenter(1.18);
    this.element<HTMLButtonElement>('zoomOut').onclick = () => this.zoomCenter(1 / 1.18);
    this.element<HTMLButtonElement>('toggleRelations').onclick = (event) => {
      this.showRecommended = !this.showRecommended;
      (event.currentTarget as HTMLButtonElement).classList.toggle('active', this.showRecommended);
      this.renderer.setRecommendedVisible(this.showRecommended);
    };
    this.element<HTMLInputElement>('treeFile').onchange = (event) => void this.openTreeFile(event);
    this.element<HTMLButtonElement>('openTree').onclick = () => {
      this.element('moreMenu').hidden = true;
      this.element<HTMLInputElement>('treeFile').click();
    };
    this.element<HTMLButtonElement>('treeSwitcherToggle').onclick = () => this.setTreePickerOpen(this.element('treePicker').hidden);
    this.element<HTMLButtonElement>('closeTreePicker').onclick = () => { this.setTreePickerOpen(false); this.element('treeSwitcherToggle').focus(); };
    this.element<HTMLButtonElement>('addLibraryTree').onclick = () => this.element<HTMLInputElement>('treeFile').click();
    this.element<HTMLInputElement>('treeSearch').oninput = () => this.renderTreeList();
    this.element('treeSwitcher').addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        this.setTreePickerOpen(false);
        this.element('treeSwitcherToggle').focus();
      }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        const choices = [...this.element('treeList').querySelectorAll<HTMLButtonElement>('.tree-choice')];
        const index = choices.indexOf(document.activeElement as HTMLButtonElement);
        if (choices.length) {
          event.preventDefault();
          choices[index < 0 ? (event.key === 'ArrowDown' ? 0 : choices.length - 1) :
            (index + (event.key === 'ArrowDown' ? 1 : -1) + choices.length) % choices.length]?.focus();
        }
      }
    });
    document.addEventListener('pointerdown', (event) => {
      if (!(event.target as HTMLElement).closest('.tree-switcher')) this.setTreePickerOpen(false);
    });
    this.element<HTMLButtonElement>('exportTree').onclick = () => this.download(`${this.tree.id}.json`, JSON.stringify(this.tree, null, 2));
    this.element<HTMLButtonElement>('chooseDataFolder').onclick = () => void this.chooseDataFolder();
    this.element<HTMLButtonElement>('refreshDataFolder').onclick = () => void this.refreshDataFolder();
    this.element<HTMLButtonElement>('backupProgress').onclick = () => {
      this.progress = { ...this.progress, exportedAt: new Date().toISOString() };
      this.persist();
      if (this.localDataConnected) void this.writeProgressFile(true);
      else this.download(`${this.tree.id}.progress.json`, JSON.stringify(this.progress, null, 2));
    };
    this.element<HTMLButtonElement>('restoreProgress').onclick = () => this.element<HTMLInputElement>('progressFile').click();
    this.element<HTMLInputElement>('progressFile').onchange = (event) => void this.restoreProgressFile(event);
    this.element<HTMLButtonElement>('languageToggle').onclick = () => {
      this.language = this.language === 'zh-CN' ? 'en' : 'zh-CN';
      this.progress.ui = { ...this.progress.ui, language: this.language };
      this.persist();
      this.applyLanguage();
      this.renderTabs();
      this.renderQueue();
      this.renderDetail();
      this.renderTreeLibrary();
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
      if (event.key === 'Escape') {
        this.element('searchResults').hidden = true;
        this.selectedSearchIndex = -1;
        search.removeAttribute('aria-activedescendant');
        search.setAttribute('aria-expanded', 'false');
      } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        window.clearTimeout(this.searchTimer);
        if (!this.searchMatches.length) this.renderSearch(search.value);
        if (!this.searchMatches.length) return;
        event.preventDefault();
        const direction = event.key === 'ArrowDown' ? 1 : -1;
        this.selectedSearchIndex = this.selectedSearchIndex < 0
          ? direction > 0 ? 0 : this.searchMatches.length - 1
          : (this.selectedSearchIndex + direction + this.searchMatches.length) % this.searchMatches.length;
        this.renderSearchResults();
      } else if (event.key === 'Enter' && this.selectedSearchIndex >= 0) {
        event.preventDefault();
        const node = this.searchMatches[this.selectedSearchIndex];
        if (node) {
          this.element('searchResults').hidden = true;
          search.value = '';
          this.searchMatches = [];
          this.selectedSearchIndex = -1;
          void this.navigateToNode(node.id);
        }
      }
    });
    this.element<HTMLButtonElement>('historyBack').onclick = () => void this.navigateHistory(-1);
    this.element<HTMLButtonElement>('historyForward').onclick = () => void this.navigateHistory(1);
    document.addEventListener('keydown', (event) => {
      if (event.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        event.preventDefault(); search.focus();
      }
    });
  }

  private async initializeLibrary(initialTree: unknown): Promise<void> {
    try {
      const normalized = normalizeTree(initialTree);
      assertValidTree(normalized.tree);
      const builtinKey = `builtin:${normalized.tree.id}`;
      this.sessionTrees.set(builtinKey, {
        key: builtinKey, title: normalized.tree.title, treeId: normalized.tree.id,
        fileName: 'Loregrid starter', tree: normalized.tree, addedAt: 0, migrateLegacyProgress: true, source: 'builtin',
      });
      await this.library.ensureBuiltIn(normalized.tree);
      this.libraryEntries = await this.library.list();
      await this.connectAndSyncDataFolder(normalized.tree.id);
      let lastKey: string | null = null;
      try { lastKey = localStorage.getItem('loregrid:active-tree'); } catch { /* Selection persistence is optional. */ }
      const item = this.libraryEntries.find((candidate) => candidate.key === lastKey)
        ?? this.libraryEntries.find((candidate) => candidate.key === `builtin:${normalized.tree.id}`)
        ?? this.libraryEntries[0];
      let entry: TreeLibraryEntry | undefined;
      if (item?.key === builtinKey) entry = { ...item, tree: normalized.tree };
      else if (item) entry = await this.library.get(item.key);
      const restored = entry ?? this.sessionTrees.get(builtinKey)!;
      this.sessionTrees.set(restored.key, restored);
      await this.loadTree(restored.tree, restored.key, restored.migrateLegacyProgress);
    } catch {
      this.libraryAvailable = false;
      if (!this.libraryEntries.length) {
        const normalized = normalizeTree(initialTree);
        this.libraryEntries = [{
          key: `builtin:${normalized.tree.id}`, title: normalized.tree.title, treeId: normalized.tree.id,
          fileName: 'Loregrid starter', addedAt: 0, migrateLegacyProgress: true, source: 'builtin',
        }];
      }
      const fallbackTree = normalizeTree(initialTree).tree;
      this.sessionTrees.set(`builtin:${fallbackTree.id}`, {
        key: `builtin:${fallbackTree.id}`, title: fallbackTree.title, treeId: fallbackTree.id,
        tree: fallbackTree, fileName: 'Loregrid starter', addedAt: 0, migrateLegacyProgress: true, source: 'builtin',
      });
      await this.loadTree(fallbackTree, `builtin:${fallbackTree.id}`, true);
      this.toast(this.language === 'en'
        ? 'Tree storage is unavailable. Trees added in this session will not survive a reload. Export your trees and progress.'
        : '树库存储不可用：本次添加的树刷新后不会保留。请导出树和进度备份。', true);
    } finally {
      this.renderTreeLibrary();
    }
  }

  private async connectAndSyncDataFolder(starterTreeId: string): Promise<void> {
    if (!LocalDataFolder.isSupported()) return;
    try {
      const status = await this.localData.connectSaved();
      if (status === 'connected') {
        this.localDataConnected = true;
        await this.syncDataFolder(starterTreeId);
      } else if (status === 'permission-needed') {
        this.localDataPermissionNeeded = true;
        this.element<HTMLButtonElement>('chooseDataFolder').textContent = t(this.language, 'reconnectDataFolder');
      }
    } catch {
      this.localDataConnected = false;
    }
  }

  private async chooseDataFolder(): Promise<void> {
    try {
      if (this.localDataPermissionNeeded) {
        const ok = await this.localData.requestSavedPermission();
        if (!ok) throw new Error(t(this.language, 'dataFolderPermissionNeeded'));
      } else await this.localData.choose();
      this.localDataConnected = true;
      this.localDataPermissionNeeded = false;
      const name = await this.localData.rootName() ?? 'data';
      const starterTreeId = this.libraryEntries.find((entry) => entry.source === 'builtin')?.treeId ?? this.tree.id;
      await this.syncDataFolder(starterTreeId);
      this.element('treeSwitcherStatus').textContent = t(this.language, 'dataFolderConnected').replace('{name}', name);
      this.toast(t(this.language, 'dataFolderConnected').replace('{name}', name));
    } catch (error) {
      this.toast(error instanceof Error ? error.message : String(error), true);
    }
  }

  private async refreshDataFolder(): Promise<void> {
    try {
      if (!this.localDataConnected) {
        if (!(await this.localData.requestSavedPermission())) {
          this.toast(t(this.language, 'dataFolderPermissionNeeded'), true);
          return;
        }
        this.localDataConnected = true;
        this.localDataPermissionNeeded = false;
      }
      await this.syncDataFolder(normalizeTree(this.initialTree).tree.id);
      this.toast(t(this.language, 'dataFolderRefreshed'));
    } catch (error) {
      this.toast(error instanceof Error ? error.message : String(error), true);
    }
  }

  private async syncDataFolder(starterTreeId: string): Promise<void> {
    const files = await this.localData.readTrees();
    let activeUpdated: TreeLibraryEntry | undefined;
    const seenTreeIds = new Set<string>();
    const errors: string[] = files.filter((file) => file.error)
      .map((file) => `${file.fileName}: ${file.error}`);
    let incompleteScan = files.some((file) => file.error || file.skipped);
    for (const file of files) {
      if (file.error) continue;
      try {
        const normalized = normalizeTree(file.tree);
        assertValidTree(normalized.tree);
        if (seenTreeIds.has(normalized.tree.id)) throw new Error(`Duplicate tree ID "${normalized.tree.id}" in data/trees.`);
        seenTreeIds.add(normalized.tree.id);
        const entry = await this.library.addFromFolder(
          normalized.tree,
          file.fileName,
          normalized.tree.id === starterTreeId ? `builtin:${starterTreeId}` : undefined,
        );
        this.sessionTrees.set(entry.key, entry);
        const { tree: _tree, ...metadata } = entry;
        this.libraryEntries = this.libraryEntries.filter((candidate) => candidate.key !== entry.key);
        this.libraryEntries.push(metadata);
        if (entry.treeId === this.tree?.id && entry.key === this.activeEntryKey) activeUpdated = entry;
      } catch (error) {
        incompleteScan = true;
        errors.push(`${file.fileName}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    if (!seenTreeIds.has(starterTreeId) && !incompleteScan) {
      const builtin = normalizeTree(this.initialTree).tree;
      await this.library.ensureBuiltIn(builtin);
      const entry: TreeLibraryEntry = {
        key: `builtin:${builtin.id}`, title: builtin.title, treeId: builtin.id,
        fileName: 'Loregrid starter', tree: builtin, addedAt: 0,
        migrateLegacyProgress: true, source: 'builtin',
      };
      this.sessionTrees.set(entry.key, entry);
      if (this.activeEntryKey === entry.key && this.tree?.id === starterTreeId) activeUpdated = entry;
    }
    const staleFolderItems = this.libraryEntries.filter((item) => !incompleteScan && item.source === 'folder'
      && !seenTreeIds.has(item.treeId));
    for (const item of staleFolderItems) {
      await this.library.remove(item.key);
      this.sessionTrees.delete(item.key);
    }
    this.libraryEntries = await this.library.list();
    if (!this.libraryEntries.length) {
      const builtin = normalizeTree(this.initialTree).tree;
      await this.library.ensureBuiltIn(builtin);
      this.libraryEntries = await this.library.list();
    }
    this.renderTreeLibrary();
    if (activeUpdated) await this.loadTree(activeUpdated.tree, activeUpdated.key, false);
    else if (this.activeEntryKey && !this.libraryEntries.some((item) => item.key === this.activeEntryKey)
      && this.libraryEntries.length) {
      const next = this.libraryEntries.find((item) => item.source === 'folder') ?? this.libraryEntries[0]!;
      const entry = this.sessionTrees.get(next.key) ?? await this.library.get(next.key);
      if (entry) await this.activateTree(entry);
    }
    if (errors.length) this.toast(errors.join(' · '), true);
  }

  private async writeProgressFile(showToast = false): Promise<void> {
    try {
      await this.localData.writeProgress(this.progress);
      if (showToast) this.toast(t(this.language, 'progressSavedToFolder'));
    } catch {
      this.localDataConnected = false;
      this.localDataPermissionNeeded = true;
      this.element<HTMLButtonElement>('chooseDataFolder').textContent = t(this.language, 'reconnectDataFolder');
      if (showToast) this.download(`${this.tree.id}.progress.json`, JSON.stringify(this.progress, null, 2));
      else this.element('treeSwitcherStatus').textContent = t(this.language, 'dataFolderPermissionNeeded');
    }
  }

  private async activateTree(entry: TreeLibraryEntry, allowLegacyFallback = entry.migrateLegacyProgress): Promise<void> {
    if (entry.key === this.activeEntryKey) {
      this.sessionTrees.set(entry.key, entry);
      this.setTreePickerOpen(false);
      await this.loadTree(entry.tree, entry.key, allowLegacyFallback);
      return;
    }
    const generation = ++this.treeSelectionGeneration;
    this.setTreePickerOpen(false);
    this.sessionTrees.set(entry.key, entry);
    this.activeEntryKey = entry.key;
    try { localStorage.setItem('loregrid:active-tree', entry.key); } catch { /* Active selection can be restored manually. */ }
    await this.loadTree(entry.tree, entry.key, allowLegacyFallback);
    if (generation === this.treeSelectionGeneration && this.element('treePicker').hidden) {
      this.element('treeSwitcherToggle').focus();
    }
  }

  private async activateTreeItem(item: TreeLibraryItem): Promise<void> {
    if (item.key === this.activeEntryKey) { this.setTreePickerOpen(false); return; }
    const generation = ++this.treeSelectionGeneration;
    try {
      const entry = this.sessionTrees.get(item.key) ?? await this.library.get(item.key);
      if (generation !== this.treeSelectionGeneration) return;
      if (!entry) throw new Error(this.language === 'en' ? 'This tree is missing from local storage.' : '本地树库中找不到这棵树。');
      await this.activateTree(entry);
    } catch (error) {
      this.toast(error instanceof Error ? error.message : String(error), true);
    }
  }

  private refreshTreeLibraryView(): void {
    const focusedEntryKey = (document.activeElement as HTMLElement | null)?.closest<HTMLElement>('.tree-choice')?.dataset.entryKey;
    this.renderTreeLibrary();
    if (focusedEntryKey) {
      [...this.element('treeList').querySelectorAll<HTMLButtonElement>('.tree-choice')]
        .find((choice) => choice.dataset.entryKey === focusedEntryKey)?.focus();
    }
  }

  private setTreePickerOpen(open: boolean): void {
    const picker = this.root.querySelector<HTMLElement>('#treePicker');
    const toggle = this.root.querySelector<HTMLButtonElement>('#treeSwitcherToggle');
    if (!picker || !toggle) return;
    picker.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    if (open) {
      this.renderTreeList();
      window.requestAnimationFrame(() => this.element<HTMLInputElement>('treeSearch').focus());
    }
  }

  private renderTreeLibrary(): void {
    const heading = this.element('treeLibraryHeading');
    const search = this.element<HTMLInputElement>('treeSearch');
    const add = this.element<HTMLButtonElement>('addLibraryTree');
    heading.textContent = t(this.language, 'treeLibrary');
    search.placeholder = t(this.language, 'searchTrees');
    search.setAttribute('aria-label', t(this.language, 'searchTrees'));
    this.element('treeSwitcher').setAttribute('aria-label', t(this.language, 'treeLibrary'));
    this.element('closeTreePicker').setAttribute('aria-label', this.language === 'en' ? 'Close tree list' : '收起树列表');
    add.textContent = `+ ${t(this.language, 'addTree')}`;
    this.element('treeSwitcherLabel').textContent = t(this.language, 'treeLibrary');
    this.element('currentTreeName').textContent = this.tree?.title ?? '';
    const activeQueueSize = this.progress?.queue.length ?? 0;
    this.element('treeSwitcherStatus').textContent = t(this.language, 'treeStatus')
      .replace('{queue}', String(activeQueueSize))
      .replace('{count}', String(this.libraryEntries.length));
    this.element<HTMLButtonElement>('treeSwitcherToggle').setAttribute(
      'aria-label',
      `${t(this.language, 'treeLibrary')}: ${this.tree?.title ?? ''}`,
    );
    if (!this.element('treePicker').hidden) this.renderTreeList();
    this.element('treeSwitcher').hidden = this.libraryEntries.length === 0;
  }

  private renderTreeList(): void {
    const host = this.root.querySelector<HTMLElement>('#treeList');
    if (!host) return;
    const query = this.root.querySelector<HTMLInputElement>('#treeSearch')?.value.trim().toLocaleLowerCase() ?? '';
    host.replaceChildren();
    const entries = this.libraryEntries.filter((entry) =>
      `${entry.title} ${entry.fileName}`.toLocaleLowerCase().includes(query),
    );
    if (!entries.length) {
      const empty = document.createElement('p');
      empty.className = 'tree-list-empty';
      empty.textContent = t(this.language, 'noTrees');
      host.append(empty);
      return;
    }
    for (const entry of entries) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'tree-choice';
      button.classList.toggle('active', entry.key === this.activeEntryKey);
      button.setAttribute('aria-pressed', String(entry.key === this.activeEntryKey));
      button.dataset.entryKey = entry.key;
      const identity = document.createElement('span');
      identity.className = 'tree-choice-identity';
      const title = document.createElement('strong');
      title.textContent = entry.title;
      const fileName = document.createElement('small');
      const source = entry.source === 'builtin' ? t(this.language, 'builtinTree') : t(this.language, 'localTree');
      fileName.textContent = `${source} · ${entry.fileName}`;
      identity.append(title, fileName);
      const count = document.createElement('span');
      count.className = 'tree-choice-count';
      count.textContent = String(this.storedQueueCount(entry));
      button.append(identity, count);
      button.onclick = () => void this.activateTreeItem(entry);
      host.append(button);
    }
  }

  private storedQueueCount(entry: TreeLibraryItem): number {
    try {
      const raw = localStorage.getItem(`loregrid:progress-entry:${encodeURIComponent(entry.key)}:${entry.treeId}`);
      if (raw) {
        const progress = JSON.parse(raw) as { queue?: unknown };
        return Array.isArray(progress.queue) ? progress.queue.length : 0;
      }
      if (entry.key === this.activeEntryKey) return this.progress?.queue.length ?? 0;
    } catch { /* Queue badges are informational; unreadable data stays untouched. */ }
    return 0;
  }

  private async loadTree(input: unknown, entryKey?: string, allowLegacyFallback = true): Promise<void> {
    const normalized = normalizeTree(input);
    assertValidTree(normalized.tree);
    let loaded = loadProgress(normalized.tree, undefined, entryKey, allowLegacyFallback);
    let invalidFolderProgress = false;
    if (this.localDataConnected) {
      try {
        const diskProgress = await this.localData.readProgress(normalized.tree.id);
        if (diskProgress !== undefined) {
          const disk = parseProgress(diskProgress, normalized.tree);
          if (isProgressNewer(loaded.progress, disk)) await this.localData.writeProgress(loaded.progress);
          else {
            restoreStoredProgress(disk, undefined, entryKey);
            loaded = { progress: disk, migrated: false };
          }
        }
      } catch {
        invalidFolderProgress = true;
      }
    }
    this.closeNodeMenu();
    this.activeEntryKey = entryKey;
    this.tree = normalized.tree;
    this.nodeById = new Map(this.tree.nodes.map((node) => [node.id, node]));
    this.searchIndex = new SearchIndex(this.tree);
    this.progressSaveBlocked = Boolean(loaded.saveBlocked || invalidFolderProgress);
    this.progress = loaded.progress;
    if (this.localDataConnected && !this.progressSaveBlocked) void this.writeProgressFile();
    this.language = chooseLanguage(this.tree.language, this.progress.ui?.language);
    const requestedKey = this.progress.ui?.lastGraphKey;
    const firstCategory = this.visibleTabs()[0];
    this.graphKey = requestedKey && this.graphKeyExists(requestedKey)
      ? requestedKey
      : firstCategory ? tabKey(firstCategory.id) : 'all';
    const savedPage = this.progress.ui?.lastPageKey;
    this.lastPageKey = savedPage && savedPage.startsWith('tab:') && this.graphKeyExists(savedPage)
      ? savedPage
      : this.graphKey.startsWith('tab:') ? this.graphKey : firstCategory ? tabKey(firstCategory.id) : 'all';
    this.history = [];
    this.historyIndex = -1;
    this.searchMatches = [];
    this.renderSearch('');
    this.updateHistoryButtons();
    this.element('treeTitle').textContent = this.tree.title;
    this.element('treeSubtitle').textContent = this.tree.subtitle ?? this.tree.description ?? '';
    try {
      if (entryKey) localStorage.setItem('loregrid:active-tree', entryKey);
    } catch { /* The current session still works when browser storage is disabled. */ }
    this.applyLanguage();
    this.renderTabs();
    this.renderQueue();
    this.updateProgressSummary();
    this.selectedId = null;
    this.element('workspace').classList.add('details-closed');
    this.renderDetail();
    this.renderTreeLibrary();
    await this.switchGraph(this.graphKey, true);
    if (this.progressSaveBlocked) this.toast(t(this.language, 'storageRecovery'), true);
    else if (normalized.migratedFrom) this.toast(t(this.language, 'migrated'));
    else if (loaded.migrated) this.toast(t(this.language, 'progressMigrated'));
  }

  private async switchGraph(key: GraphKey, fit = true, focusNode?: string): Promise<void> {
    const generation = ++this.layoutGeneration;
    this.graphKey = key;
    if (key !== 'all' && !key.startsWith('preset:')) this.lastPageKey = key;
    const selection = this.graphSelection(key);
    this.progress.ui = { ...this.progress.ui, lastGraphKey: key, lastPageKey: this.lastPageKey };
    this.persist();
    this.renderTabs();
    this.element('layoutBusy').hidden = false;
    const view = buildGraphView(this.tree, key, this.currentPreset()?.tabIds);
    try {
      const layout = await this.layoutService.request(view, `${this.tree.id}:${this.tree.version ?? '2'}`);
      if (generation !== this.layoutGeneration) return;
      this.renderer.setData(layout, this.tree, this.progress);
      this.renderer.setRecommendedVisible(this.showRecommended);
      this.renderer.setSelection(this.selectedId);
      this.element('layoutBusy').hidden = true;
      this.element('activePage').textContent = key === 'all' ? t(this.language, 'all') : this.graphLabel(key);
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
    const all = document.createElement('button');
    all.type = 'button';
    all.textContent = t(this.language, 'all');
    all.classList.toggle('active', this.graphKey === 'all');
    all.setAttribute('aria-pressed', String(this.graphKey === 'all'));
    all.setAttribute('aria-label', this.language === 'en' ? 'Show all pages' : '显示全部分页');
    all.onclick = () => { void this.switchGraph(this.graphKey === 'all' ? this.lastPageKey : 'all'); };
    host.append(all);
    const category = this.element<HTMLSelectElement>('categorySelect');
    const selectionKey = this.graphKey === 'all' ? this.lastPageKey : this.graphKey;
    category.replaceChildren();
    this.element('categoryLabel').textContent = this.language === 'en' ? 'Page' : '分页';
    category.setAttribute('aria-label', this.language === 'en' ? 'Page' : '分页');
    this.visibleTabs().forEach((tab) => {
      const option = document.createElement('option');
      option.value = tab.id;
      option.textContent = this.language === 'en' ? tab.labelEn ?? tab.label : tab.label;
      category.append(option);
    });
    const presets = this.progress.ui?.presets ?? [];
    if (presets.length) {
      const group = document.createElement('optgroup');
      group.label = this.language === 'en' ? 'Combined pages' : '组合分页';
      presets.forEach((preset) => {
        const option = document.createElement('option'); option.value = `preset:${preset.id}`; option.textContent = preset.name; group.append(option);
      });
      category.append(group);
    }
    const shownKey = this.graphKey === 'all' ? this.lastPageKey : this.graphKey;
    const shownValue = shownKey.startsWith('preset:')
      ? shownKey
      : this.graphSelection(shownKey).categoryId ?? category.querySelector('option')?.value ?? '';
    category.value = shownValue;
    category.hidden = this.graphKey === 'all';
    const categoryPicker = category.closest<HTMLElement>('.category-picker');
    if (categoryPicker) categoryPicker.hidden = this.graphKey === 'all';
    this.element('addPreset').hidden = this.graphKey === 'all';
    this.element('addPreset').setAttribute('aria-label', this.language === 'en' ? 'Create combined page' : '新建组合分页');
    this.element('deletePreset').hidden = !this.currentPreset();
    this.element('editPreset').hidden = !this.currentPreset();
    this.element('deletePreset').setAttribute('aria-label', this.language === 'en' ? 'Delete combined page' : '删除组合分页');
    const favoriteKey = this.favoriteKeyForCurrentGraph();
    const isFavorite = (this.progress.ui?.favorites ?? []).includes(favoriteKey);
    const favoriteButton = this.element<HTMLButtonElement>('favoritePage');
    favoriteButton.hidden = this.graphKey === 'all';
    favoriteButton.textContent = isFavorite ? '★' : '☆';
    favoriteButton.classList.toggle('is-favorite', isFavorite);
    favoriteButton.title = isFavorite
      ? (this.language === 'en' ? 'Remove from favorites' : '取消收藏')
      : (this.language === 'en' ? 'Add to favorites' : '加入收藏');
    this.renderFavoriteList();
  }

  private async handleNodeClick(layoutNode: LayoutNode, event: MouseEvent): Promise<void> {
    this.closeNodeMenu();
    if (event.ctrlKey || event.altKey || event.shiftKey) {
      this.progress = queueWithPrerequisites(this.progress, this.tree, layoutNode.nodeId,
        event.ctrlKey ? 'replace' : event.altKey ? 'front' : 'back');
      this.persistAndRefresh();
      return;
    }
    if (layoutNode.kind === 'proxy' && layoutNode.targetTabId) {
      this.selectedId = layoutNode.nodeId;
      await this.switchGraph(tabKey(layoutNode.targetTabId), false, layoutNode.nodeId);
    } else {
      this.selectedId = layoutNode.nodeId;
      this.renderer.setSelection(layoutNode.nodeId);
    }
    this.recordHistory(layoutNode.nodeId);
    this.element('workspace').classList.remove('details-closed');
    this.renderDetail();
  }

  private closeNodeMenu(): void {
    this.menuController?.abort();
    this.menuController = null;
    this.nodeMenu?.remove();
    this.nodeMenu = null;
  }

  private showNodeMenu(node: LayoutNode, event: MouseEvent): void {
    this.closeNodeMenu();
    const originElement = event.currentTarget as HTMLElement;
    const menu = document.createElement('div');
    menu.className = 'node-context-menu';
    menu.setAttribute('role', 'menu');
    menu.setAttribute('aria-label', node.title);
    const addAction = (label: string, run: () => void): void => {
      const button = document.createElement('button');
      button.type = 'button';
      button.setAttribute('role', 'menuitem');
      button.textContent = label;
      button.onclick = () => { this.closeNodeMenu(); run(); };
      menu.append(button);
    };
    if (!this.progress.completed[node.nodeId]) {
      if (this.progress.queue.includes(node.nodeId)) {
        addAction(t(this.language, 'removeQueueChain'), () => {
          this.progress = unqueueNode(this.progress, this.tree, node.nodeId);
          this.persistAndRefresh();
        });
      }
      for (const [placement, label] of [['back', 'addQueue'], ['front', 'priorityQueue'], ['replace', 'replaceQueue']] as const) {
        addAction(t(this.language, label), () => {
          this.progress = queueWithPrerequisites(this.progress, this.tree, node.nodeId, placement);
          this.persistAndRefresh();
        });
      }
    }
    addAction(t(this.language, node.kind === 'proxy' ? 'jump' : 'details'), () => void this.navigateToNode(node.nodeId));
    this.nodeMenu = menu;
    this.root.append(menu);
    const origin = originElement.getBoundingClientRect();
    menu.style.left = `${Math.max(4, Math.min(event.clientX || origin.left, window.innerWidth - menu.offsetWidth - 4))}px`;
    menu.style.top = `${Math.max(4, Math.min(event.clientY || origin.bottom, window.innerHeight - menu.offsetHeight - 4))}px`;
    const buttons = [...menu.querySelectorAll<HTMLButtonElement>('button')];
    buttons[0]?.focus();
    const dismiss = (outside: Event): void => {
      if (menu.contains(outside.target as Node)) return;
      this.closeNodeMenu();
    };
    this.menuController = new AbortController();
    document.addEventListener('pointerdown', dismiss, { capture: true, signal: this.menuController.signal });
    menu.onkeydown = (key) => {
      const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
      if (key.key === 'Escape' || key.key === 'Tab') {
        this.closeNodeMenu();
        if (key.key === 'Escape') { key.preventDefault(); originElement.focus(); }
      } else if (key.key === 'ArrowDown' || key.key === 'ArrowUp') {
        key.preventDefault();
        buttons[(current + (key.key === 'ArrowDown' ? 1 : buttons.length - 1)) % buttons.length]?.focus();
      }
    };
  }

  private renderDetail(): void {
    const host = this.element('detailBody');
    host.textContent = '';
    const node = this.selectedId ? this.nodeById.get(this.selectedId) : undefined;
    if (host.dataset.nodeId !== node?.id) host.scrollTop = 0;
    host.dataset.nodeId = node?.id ?? '';
    if (!node) {
      const empty = document.createElement('div');
      empty.className = 'detail-empty';
      const glyph = document.createElement('div'); glyph.className = 'detail-glyph'; glyph.textContent = '◇';
      const text = document.createElement('p'); text.textContent = t(this.language, 'emptyDetails');
      empty.append(glyph, text); host.append(empty); return;
    }
    const tab = this.tree.tabs.find((entry) => entry.id === node.tabId);
    const tabLabel = this.language === 'en' ? tab?.labelEn ?? tab?.label ?? node.tabId : tab?.label ?? node.tabId;
    const eyebrow = document.createElement('div'); eyebrow.className = 'detail-eyebrow'; eyebrow.textContent = `${tabLabel} · ${node.kind ?? 'topic'}`;
    const title = document.createElement('h1'); title.textContent = node.title;
    host.append(eyebrow, title);
    if (node.tags?.length) {
      const tags = document.createElement('div'); tags.className = 'tags';
      node.tags.forEach((tag) => { const item = document.createElement('span'); item.textContent = tag; tags.append(item); });
      host.append(tags);
    }
    if (node.summary) {
      const intro = document.createElement('section');
      intro.className = 'detail-intro';
      const heading = document.createElement('h2');
      heading.textContent = this.language === 'en' ? 'Learning content' : '学习内容';
      const summary = document.createElement('p');
      summary.className = 'summary';
      summary.textContent = node.summary;
      intro.append(heading, summary);
      host.append(intro);
    }
    const relations = nodeRelations(this.tree, node.id);
    const actions = document.createElement('div'); actions.className = 'detail-actions';
    const queueAction = document.createElement('button');
    queueAction.type = 'button';
    queueAction.className = 'queue-action';
    const queued = this.progress.queue.includes(node.id);
    const missing = missingPrerequisites(this.progress, this.tree, node.id);
    queueAction.disabled = Boolean(this.progress.completed[node.id]);
    queueAction.textContent = t(this.language, queued ? 'removeQueue' : 'addQueue');
    queueAction.onclick = () => {
      this.progress = queued ? unqueueNode(this.progress, this.tree, node.id) : queueWithPrerequisites(this.progress, this.tree, node.id);
      this.persistAndRefresh();
    };
    actions.append(queueAction);
    const status = statusOf(this.progress, this.tree, node.id);
    const main = document.createElement('button'); main.type = 'button'; main.className = 'primary-action';
    main.textContent = status === 'completed' ? t(this.language, 'undoComplete') : t(this.language, 'completeOnly');
    main.onclick = () => {
      this.progress = completeNode(this.progress, node.id, status !== 'completed');
      this.persistAndRefresh();
    };
    actions.append(main);
    if (status !== 'completed' && missing.length > 0) {
      const chain = document.createElement('button'); chain.type = 'button'; chain.className = 'secondary-action';
      chain.textContent = `${t(this.language, 'completeChain')} (${missing.length + 1})`;
      chain.onclick = () => {
        if (!window.confirm(`${t(this.language, 'completeChain')}: ${missing.length + 1}`)) return;
        this.progress = completeWithPrerequisites(this.progress, this.tree, node.id);
        this.persistAndRefresh();
      };
      actions.append(chain);
    }
    if (!queued && !this.progress.completed[node.id] && missing.length) {
      const hint = document.createElement('small');
      hint.className = 'queue-action-hint';
      hint.textContent = this.language === 'en'
        ? `${missing.length} missing prerequisite${missing.length === 1 ? '' : 's'} will be added in order.`
        : `加入队列时会按顺序一并加入 ${missing.length} 项未完成前置。`;
      actions.append(hint);
    }
    host.append(actions);
    if (inconsistentCompleted(this.progress, this.tree).has(node.id)) {
      const warning = document.createElement('div'); warning.className = 'state-warning'; warning.textContent = t(this.language, 'missingWarning'); host.append(warning);
    }
    if (node.outcome) this.detailSection(host, t(this.language, 'outcome'), node.outcome);
    if (node.caution) this.detailSection(host, t(this.language, 'caution'), node.caution, 'caution');
    if (node.layout?.stageId || node.layout?.stage !== undefined) {
      const stage = document.createElement('p');
      stage.className = 'detail-stage';
      stage.textContent = `${this.language === 'en' ? 'Stage' : '阶段'} · ${stageTitle(this.tree, node, this.language)}`;
      host.append(stage);
    }
    this.relationSection(host, t(this.language, 'prerequisites'), relations.prerequisites.map((edge) => edge.source));
    this.unlockSection(host, relations.dependents.map((edge) => edge.target), node.id);
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

  private unlockSection(host: HTMLElement, ids: string[], currentNodeId: string): void {
    const unique = [...new Set(ids)];
    if (!unique.length) return;
    const section = this.section(host, t(this.language, 'unlocks'));
    unique.forEach((id) => {
      const node = this.nodeById.get(id); if (!node) return;
      const button = document.createElement('button'); button.type = 'button'; button.className = 'relation-link unlock-link';
      const dot = document.createElement('span'); dot.className = 'relation-dot'; dot.setAttribute('aria-hidden', 'true');
      const content = document.createElement('span'); content.className = 'unlock-copy';
      const label = document.createElement('b'); label.textContent = node.title;
      const remaining = missingPrerequisites(this.progress, this.tree, id).filter((missingId) => missingId !== currentNodeId);
      const explanation = document.createElement('small');
      explanation.textContent = this.progress.completed[id]
        ? this.language === 'en' ? 'Already completed' : '已完成'
        : remaining.length
        ? `${this.language === 'en' ? 'Still required: ' : '还需完成：'}${remaining.map((missingId) => this.nodeById.get(missingId)?.title ?? missingId).join('、')}`
        : this.language === 'en' ? 'Ready when this node is completed' : '完成本节点后即可开始';
      content.append(label, explanation);
      button.append(dot, content);
      button.onclick = () => void this.navigateToNode(node.id);
      section.append(button);
    });
  }

  private async navigateToNode(nodeId: string, record = true): Promise<void> {
    const node = this.nodeById.get(nodeId); if (!node) return;
    this.selectedId = nodeId;
    const targetKey = this.graphKey === 'all' ? 'all' : tabKey(node.tabId);
    if (targetKey !== this.graphKey) await this.switchGraph(targetKey, false, nodeId);
    else { this.renderer.setSelection(nodeId); this.renderer.centerNode(nodeId); this.renderer.setHighlight(nodeId); }
    this.element('workspace').classList.remove('details-closed');
    if (record) this.recordHistory(nodeId);
    this.renderDetail();
  }

  private renderSearch(query: string): void {
    this.searchMatches = this.searchIndex ? this.searchIndex.search(query, 12) : [];
    this.selectedSearchIndex = -1;
    this.renderSearchResults();
  }

  private renderSearchResults(): void {
    const host = this.element('searchResults');
    host.textContent = '';
    const search = this.element<HTMLInputElement>('searchInput');
    search.removeAttribute('aria-activedescendant');
    if (!this.searchMatches.length) { host.hidden = true; search.setAttribute('aria-expanded', 'false'); return; }
    this.searchMatches.forEach((node, index) => {
      const button = document.createElement('button'); button.type = 'button';
      button.setAttribute('role', 'option');
      button.id = `search-result-${index}`;
      button.classList.toggle('is-active', index === this.selectedSearchIndex);
      if (index === this.selectedSearchIndex) search.setAttribute('aria-activedescendant', button.id);
      const title = document.createElement('b'); title.textContent = node.title;
      const meta = document.createElement('span'); meta.textContent = `${this.tabLabel(node.tabId)} · ${node.id}`;
      button.append(title, meta);
      button.onclick = () => { host.hidden = true; search.value = ''; search.setAttribute('aria-expanded', 'false'); void this.navigateToNode(node.id); };
      host.append(button);
    });
    host.hidden = false;
    search.setAttribute('aria-expanded', 'true');
    host.querySelector('.is-active')?.scrollIntoView({ block: 'nearest' });
  }

  private applyLanguage(): void {
    document.documentElement.lang = this.language;
    this.renderer.setLanguage(this.language);
    this.root.querySelectorAll<HTMLElement>('[data-i18n]').forEach((element) => {
      const key = element.dataset.i18n as MessageKey; element.textContent = t(this.language, key);
    });
    this.root.querySelectorAll<HTMLElement>('[data-i18n-title]').forEach((element) => {
      const key = element.dataset.i18nTitle as MessageKey; element.title = t(this.language, key);
    });
    this.element<HTMLInputElement>('searchInput').placeholder = t(this.language, 'search');
    if (this.tree && this.progress) {
      const selection = this.graphSelection(this.graphKey);
      this.element('activePage').textContent = this.graphKey === 'all' ? t(this.language, 'all') : this.graphLabel(this.graphKey);
    }
    this.updateProgressSummary();
  }

  private updateProgressSummary(): void {
    if (!this.tree || !this.progress) return;
    const complete = Object.keys(this.progress.completed).length;
    this.element('progressSummary').textContent = `${complete} / ${this.tree.nodes.length} ${t(this.language, 'complete')}`;
  }

  private persistAndRefresh(): void {
    this.persist(); this.renderer.setProgress(this.progress); this.updateProgressSummary(); this.renderDetail(); this.renderQueue(); this.renderTabs();
  }

  private renderQueue(): void {
    if (!this.progress || !this.tree) return;
    const host = this.element('queueItems');
    host.replaceChildren();
    const queue = this.progress.queue.filter((id) => this.nodeById.has(id) && !this.progress.completed[id]);
    this.element('queueCount').textContent = `${queue.length}`;
    this.element<HTMLButtonElement>('clearQueue').hidden = queue.length === 0;
    if (!queue.length) {
      const empty = document.createElement('span');
      empty.className = 'queue-empty';
      empty.textContent = this.language === 'en' ? 'No learning goals queued' : '学习队列为空';
      host.append(empty);
      this.syncQueueScrollbar();
      return;
    }
    queue.forEach((id, index) => {
      const node = this.nodeById.get(id);
      if (!node) return;
      const card = document.createElement('article');
      card.className = 'queue-card';
      card.draggable = true;
      card.dataset.nodeId = id;
      const open = document.createElement('button');
      open.type = 'button';
      open.className = 'queue-card-open';
      open.setAttribute('aria-label', `${index + 1}. ${node.title}`);
      open.onclick = () => void this.navigateToNode(id);
      const number = document.createElement('span');
      number.className = 'queue-number';
      number.textContent = String(index + 1).padStart(2, '0');
      const content = document.createElement('span');
      content.className = 'queue-content';
      const title = document.createElement('strong');
      title.textContent = node.title;
      const meta = document.createElement('small');
      meta.textContent = `${this.tabLabel(node.tabId)} · ${t(this.language, statusOf(this.progress, this.tree, id))}`;
      content.append(title, meta);
      open.append(number, content);
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'queue-remove';
      remove.setAttribute('aria-label', `${t(this.language, 'removeQueue')}: ${node.title}`);
      remove.textContent = '×';
      remove.onclick = () => {
        this.progress = unqueueNode(this.progress, this.tree, id);
        this.persistAndRefresh();
      };
      card.append(open, remove);
      host.append(card);
    });
    requestAnimationFrame(() => this.syncQueueScrollbar());
  }

  private syncQueueScrollbar(): void {
    const host = this.root.querySelector<HTMLElement>('#queueItems');
    const track = this.root.querySelector<HTMLElement>('#queueScrollbar');
    const thumb = this.root.querySelector<HTMLElement>('#queueScrollbarThumb');
    if (!host || !track || !thumb) return;
    const maxScroll = Math.max(0, host.scrollWidth - host.clientWidth);
    const width = track.clientWidth;
    const thumbWidth = maxScroll > 0
      ? Math.max(48, width * host.clientWidth / host.scrollWidth)
      : width;
    const travel = Math.max(0, width - thumbWidth);
    const left = maxScroll > 0 ? host.scrollLeft / maxScroll * travel : 0;
    thumb.style.width = `${thumbWidth}px`;
    thumb.style.transform = `translate3d(${left}px, 0, 0)`;
    track.setAttribute('aria-valuemax', String(maxScroll));
    track.setAttribute('aria-valuenow', String(Math.round(host.scrollLeft)));
  }

  private moveQueueItem(sourceId: string, targetId: string): void {
    const source = this.progress.queue.indexOf(sourceId);
    const target = this.progress.queue.indexOf(targetId);
    if (source < 0 || target < 0) return;
    const updated = reorderQueue(this.progress, this.tree, sourceId, target);
    if (updated.queue.every((id, index) => id === this.progress.queue[index])) return;
    this.progress = updated;
    this.persistAndRefresh();
  }

  private persist(): void {
    if (this.progressSaveBlocked) { this.toast(t(this.language, 'storageRecovery'), true); return; }
    try {
      this.progress = { ...this.progress, updatedAt: new Date().toISOString() };
      saveProgress(this.progress, undefined, this.activeEntryKey);
      if (this.localDataConnected) void this.writeProgressFile();
      this.renderTreeLibrary();
    }
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
    const input = event.currentTarget as HTMLInputElement;
    const files = [...(input.files ?? [])]; input.value = '';
    if (!files.length || this.libraryImporting) return;
    this.libraryImporting = true;
    await this.libraryReady;
    const toggle = this.element<HTMLButtonElement>('treeSwitcherToggle');
    toggle.disabled = true;
    this.element('treeSwitcher').setAttribute('aria-busy', 'true');
    this.element('treeSwitcherStatus').textContent = t(this.language, 'importingTrees');
    this.setTreePickerOpen(false);
    try {
      let first: { entry: TreeLibraryEntry; allowLegacy: boolean } | undefined;
      const errors: string[] = [];
      const importedIds = new Set<string>();
      for (const file of files) {
        try {
          const text = await this.readImport(file); if (text === null) continue;
          const normalized = normalizeTree(JSON.parse(text));
          assertValidTree(normalized.tree);
          if (importedIds.has(normalized.tree.id)) throw new Error(`Duplicate tree ID "${normalized.tree.id}" in selected files.`);
          importedIds.add(normalized.tree.id);
          let duplicate: TreeLibraryEntry | undefined;
          for (const item of this.libraryEntries.filter((entry) =>
            entry.treeId === normalized.tree.id && entry.source === 'local',
          )) {
            const existing = this.sessionTrees.get(item.key) ?? await this.library.get(item.key);
            if (existing && JSON.stringify(existing.tree) === JSON.stringify(normalized.tree)) { duplicate = existing; break; }
          }
          if (duplicate) { first ??= { entry: duplicate, allowLegacy: false }; continue; }
          const allowLegacy = !this.libraryEntries.some((entry) => entry.treeId === normalized.tree.id && entry.source === 'local');
          const entry: TreeLibraryEntry = this.libraryAvailable
            ? await this.library.add(normalized.tree, file.name, allowLegacy)
            : {
              key: this.createSessionEntryKey(), title: normalized.tree.title, treeId: normalized.tree.id,
              fileName: file.name, tree: normalized.tree, addedAt: Date.now(), migrateLegacyProgress: allowLegacy,
            };
          const { tree: _tree, ...metadata } = entry;
          this.libraryEntries = this.libraryEntries.filter((candidate) => candidate.key !== entry.key);
          this.libraryEntries.push(metadata);
          if (!this.libraryAvailable) this.sessionTrees.set(entry.key, entry);
          first ??= { entry, allowLegacy };
        } catch (error) {
          errors.push(`${file.name}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      if (first) await this.activateTree(first.entry, first.allowLegacy);
      if (errors.length) this.toast(`${t(this.language, 'invalidFile')}: ${errors.join(' · ')}`, true);
      else if (first && !this.libraryAvailable) this.toast(this.language === 'en'
        ? 'Added for this session only. Local tree storage is unavailable; export a backup.'
        : '仅添加到本次会话。树库存储不可用，请导出备份。', true);
    } finally {
      this.libraryImporting = false;
      toggle.disabled = false;
      this.element('treeSwitcher').setAttribute('aria-busy', 'false');
      this.renderTreeLibrary();
    }
  }

  private async restoreProgressFile(event: Event): Promise<void> {
    const input = event.currentTarget as HTMLInputElement; const file = input.files?.[0]; input.value = '';
    if (!file) return;
    try {
      const text = await this.readImport(file); if (text === null) return;
      const restored = parseProgress(text, this.tree);
      restoreStoredProgress(restored, undefined, this.activeEntryKey);
      this.progressSaveBlocked = false;
      this.progress = restored;
      this.language = chooseLanguage(this.tree.language, restored.ui?.language);
      this.applyLanguage();
      const restoredKey = restored.ui?.lastGraphKey;
      this.persistAndRefresh();
      const fallbackTab = this.visibleTabs()[0];
      await this.switchGraph(restoredKey && this.graphKeyExists(restoredKey) ? restoredKey : fallbackTab ? tabKey(fallbackTab.id) : 'all');
    }
    catch (error) { this.toast(`${t(this.language, 'invalidFile')}: ${error instanceof Error ? error.message : String(error)}`, true); }
  }

  private createSessionEntryKey(): string {
    return globalThis.crypto?.randomUUID?.() ?? `session-tree-${Date.now()}-${Math.random().toString(36).slice(2)}`;
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
  private graphLabel(key: GraphKey): string {
    const preset = this.progress.ui?.presets?.find((entry) => key === `preset:${entry.id}`);
    if (preset) return preset.name;
    const selection = this.graphSelection(key);
    const categoryLabel = selection.categoryId ? this.tabLabel(selection.categoryId) : '';
    return categoryLabel || t(this.language, 'all');
  }
  private graphSelection(key: GraphKey): { categoryId: string | null } {
    if (key === 'all' || key.startsWith('preset:')) return { categoryId: null };
    return { categoryId: decodeURIComponent(key.slice(4)) };
  }
  private graphKeyExists(key: GraphKey): boolean {
    if (key === 'all') return true;
    if (key.startsWith('preset:')) return Boolean(this.progress.ui?.presets?.some((preset) => key === `preset:${preset.id}`));
    return key.startsWith('tab:') && this.tree.tabs.some((tab) => `tab:${encodeURIComponent(tab.id)}` === key);
  }
  private currentPreset() {
    return this.progress.ui?.presets?.find((preset) => this.graphKey === `preset:${preset.id}`);
  }

  private visibleTabs() {
    return [...this.tree.tabs].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }

  private favoriteKeyForCurrentGraph(): GraphKey { return this.graphKey; }

  private toggleFavorite(key: GraphKey): void {
    if (key === 'all') return;
    const favorites = this.progress.ui?.favorites ?? [];
    this.progress.ui = { ...this.progress.ui, favorites: favorites.includes(key) ? favorites.filter((entry) => entry !== key) : [...favorites, key] };
    this.persist();
    this.renderTabs();
  }

  private renderFavoriteList(): void {
    const host = this.element('favoriteList');
    host.replaceChildren();
    for (const key of this.progress.ui?.favorites ?? []) {
      if (!this.graphKeyExists(key)) continue;
      const button = document.createElement('button');
      button.type = 'button';
      const preset = this.progress.ui?.presets?.find((entry) => key === `preset:${entry.id}`);
      const selection = this.graphSelection(key);
      button.textContent = `★ ${preset?.name ?? (selection.categoryId ? this.tabLabel(selection.categoryId) : '')}`;
      button.onclick = () => { this.element('moreMenu').hidden = true; void this.switchGraph(key); };
      host.append(button);
    }
    host.hidden = !host.childElementCount;
  }

  private recordHistory(nodeId: string): void {
    if (this.history[this.historyIndex] !== nodeId) {
      this.history = [...this.history.slice(0, this.historyIndex + 1), nodeId];
      this.historyIndex = this.history.length - 1;
    }
    this.updateHistoryButtons();
  }

  private updateHistoryButtons(): void {
    this.element<HTMLButtonElement>('historyBack').disabled = this.historyIndex <= 0;
    this.element<HTMLButtonElement>('historyForward').disabled = this.historyIndex >= this.history.length - 1;
  }

  private async navigateHistory(direction: number): Promise<void> {
    const target = this.historyIndex + direction;
    const id = this.history[target];
    if (!id) return;
    this.historyIndex = target;
    this.updateHistoryButtons();
    await this.navigateToNode(id, false);
  }

  private openPresetEditor(id?: string): void {
    const preset = this.progress.ui?.presets?.find((entry) => entry.id === id);
    this.editingPresetId = preset?.id ?? null;
    const en = this.language === 'en';
    this.element('presetHeading').textContent = preset ? (en ? 'Edit combined page' : '编辑组合分页') : (en ? 'Create combined page' : '新建组合分页');
    this.element('presetNameLabel').textContent = en ? 'Name' : '名称';
    this.element('savePreset').textContent = preset ? (en ? 'Save' : '保存') : (en ? 'Create' : '创建');
    this.element<HTMLInputElement>('presetName').value = preset?.name ?? '';
    this.element('presetError').hidden = true;
    const choices = this.element('presetChoices');
    choices.replaceChildren();
    for (const tab of this.tree.tabs) {
      const label = document.createElement('label');
      const check = document.createElement('input');
      check.type = 'checkbox'; check.name = 'presetTab'; check.value = tab.id;
      check.checked = preset ? preset.tabIds.includes(tab.id) : this.graphSelection(this.graphKey).categoryId === tab.id;
      label.append(check, document.createTextNode(this.tabLabel(tab.id)));
      choices.append(label);
    }
    this.element<HTMLDialogElement>('presetDialog').showModal();
  }
  private toast(message: string, error = false): void {
    const toast = this.element('toast'); toast.textContent = message; toast.classList.toggle('is-error', error); toast.hidden = false;
    window.setTimeout(() => { toast.hidden = true; }, 4200);
  }
  private element<T extends HTMLElement = HTMLElement>(id: string): T { const value = this.root.querySelector<T>(`#${id}`); if (!value) throw new Error(`Missing #${id}.`); return value; }
}
