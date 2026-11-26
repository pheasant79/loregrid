import type { Language } from '../core/i18n';
import { fetchLatestRelease, isNewerRelease, RELEASES_PAGE, UpdateError, UpdatePreferences, type AppRelease } from '../core/updates';

const words = {
  'zh-CN': {
    title: '程序更新', check: '检查更新', close: '关闭', current: '当前版本', idle: '点击检查，查询最新正式版本。', checking: '正在查询 GitHub 正式版本…',
    latest: '当前已是最新正式版本。', ahead: '当前版本高于最新公开正式版。', available: '发现新版本', badge: '有更新',
    privacy: '检查时会连接 GitHub，GitHub 可收到 IP 地址等常规网络信息；不会发送树、进度或笔记。默认不自动联网。',
    automatic: '启动时检查更新（每天最多一次）', temporary: '浏览器无法保存此设置，仅在本次打开期间有效。',
    notes: '版本说明', noNotes: '该版本未提供说明。', download: '下载更新 HTML', full: '下载完整离线包', release: '打开正式版本页面',
    backup: '备份当前树进度', guide: '如何保留数据升级',
    steps: [
      '先备份重要记录。此处按钮只导出当前树的进度；其他树请逐一切换并备份，同时保留原始树 JSON。',
      '下载更新 HTML。关闭旧页面，将下载的文件改名为 index.html，替换原位置的同名文件。不要覆盖或删除 data/。',
      '重新打开 index.html，检查版本和进度。若更换了路径、浏览器或浏览器配置，请重新连接数据文件夹或导入树与进度备份。',
    ],
    fallback: '此正式版本尚未提供单独的更新 HTML。请下载完整离线包，解压到临时位置，仅取出其中的 index.html 替换旧文件。',
    distinction: '这里只更新程序；AI 修改树 JSON 后，请使用“重新读取数据文件夹”或手动导入树。',
    errors: { network: '无法连接 GitHub。请检查网络后重试；离线学习不受影响。', timeout: '检查超时，请稍后重试。', 'rate-limit': 'GitHub 暂时限制了请求，请稍后重试或打开版本页面。', 'no-release': '尚未找到可用的正式 Release。', invalid: '版本信息无法验证，请在正式版本页面确认。' },
  },
  en: {
    title: 'App updates', check: 'Check for updates', close: 'Close', current: 'Current version', idle: 'Check the latest stable release when you are ready.', checking: 'Checking GitHub stable releases…',
    latest: 'You are using the latest stable release.', ahead: 'This version is newer than the latest public stable release.', available: 'New version available', badge: 'Update available',
    privacy: 'Checking connects to GitHub, which receives ordinary network information such as your IP address. Trees, progress, and notes are never sent. Automatic checks are off by default.',
    automatic: 'Check on startup (at most once a day)', temporary: 'This browser cannot save the setting; it applies only for this session.',
    notes: 'Release notes', noNotes: 'No release notes were provided.', download: 'Download update HTML', full: 'Download full offline package', release: 'Open stable releases',
    backup: 'Back up current tree progress', guide: 'Upgrade without losing your data',
    steps: [
      'Back up important records first. This button exports progress for the current tree only; switch to other trees to back them up too. Keep the original tree JSON files.',
      'Download the update HTML. Close the old page, rename the download to index.html, and replace the old file at the same location. Keep data/ intact.',
      'Reopen index.html and check the version and progress. If the location, browser, or profile changed, reconnect your data folder or import trees and progress backups.',
    ],
    fallback: 'This release has no standalone update HTML. Download the full offline package, extract it separately, and replace only the old index.html with the one from that package.',
    distinction: 'This updates the app. After AI edits tree JSON, use “Reload data folder” or manually import the tree instead.',
    errors: { network: 'Could not connect to GitHub. Check your connection and retry; offline learning is unaffected.', timeout: 'The check timed out. Please try again later.', 'rate-limit': 'GitHub is temporarily limiting requests. Retry later or open the release page.', 'no-release': 'No stable Release is available yet.', invalid: 'The release metadata could not be verified. Please check the release page.' },
  },
} as const;

type Status = 'idle' | 'checking' | 'result' | 'error';
export class UpdateDialog {
  private dialog: HTMLDialogElement;
  private preferences: UpdatePreferences;
  private status: Status = 'idle';
  private release?: AppRelease;
  private error: keyof typeof words.en.errors = 'network';
  private pending?: Promise<void>;
  private temporary = false;
  constructor(private root: HTMLElement, private version: string, private language: () => Language, private backup: () => void) {
    let storage: Storage | undefined;
    try { storage = window.localStorage; } catch { /* Offline storage may be blocked. */ }
    this.preferences = new UpdatePreferences(storage);
    this.dialog = document.createElement('dialog');
    this.dialog.id = 'updateDialog'; this.dialog.className = 'update-dialog';
    this.dialog.setAttribute('aria-labelledby', 'updateHeading');
    this.dialog.innerHTML = `
      <header><h2 id="updateHeading"></h2><button id="closeUpdate" type="button">×</button></header>
      <p id="updateCurrent" class="update-current"></p>
      <p id="updateStatus" class="update-status" role="status" aria-live="polite"></p>
      <p id="updatePrivacy" class="update-muted"></p>
      <label class="update-preference"><input id="autoUpdateCheck" type="checkbox"><span id="autoUpdateLabel"></span></label>
      <p id="updateTemporary" class="update-muted" hidden></p>
      <div class="update-actions"><button id="runUpdateCheck" type="button"></button><button id="updateBackup" type="button"></button><a id="updateReleaseLink" target="_blank" rel="noopener noreferrer"></a></div>
      <section id="updateRelease" hidden><h3 id="updateNotesHeading"></h3><pre id="updateNotes"></pre>
        <p id="updateFallback" class="update-muted" hidden></p>
        <div class="update-actions"><a id="downloadUpdate" class="update-download" target="_blank" rel="noopener noreferrer" hidden></a><a id="downloadFullUpdate" target="_blank" rel="noopener noreferrer" hidden></a></div>
      </section>
      <section class="update-guide"><h3 id="updateGuideHeading"></h3><ol id="updateSteps"></ol><p id="updateDistinction" class="update-muted"></p></section>`;
    this.root.append(this.dialog);
    this.get<HTMLButtonElement>('closeUpdate').onclick = () => this.dialog.close();
    this.get<HTMLButtonElement>('runUpdateCheck').onclick = () => void this.check();
    this.get<HTMLButtonElement>('updateBackup').onclick = () => this.backup();
    this.get<HTMLInputElement>('autoUpdateCheck').onchange = (event) => {
      this.temporary = !this.preferences.setAutomatic((event.target as HTMLInputElement).checked); this.render();
    };
    this.root.querySelector<HTMLButtonElement>('#versionButton')!.onclick = () => this.open();
    this.root.querySelector<HTMLButtonElement>('#checkUpdates')!.onclick = () => {
      this.root.querySelector<HTMLElement>('#moreMenu')!.hidden = true; this.open();
    };
    this.render();
  }
  private get<T extends HTMLElement = HTMLElement>(id: string): T { return this.dialog.querySelector<T>(`#${id}`)!; }
  open(): void { this.render(); if (!this.dialog.open) this.dialog.showModal(); void this.check(); }
  async startup(): Promise<void> { if (this.preferences.shouldCheck()) await this.check(); }
  private check(): Promise<void> {
    if (this.pending) return this.pending;
    this.preferences.recordAttempt(); this.status = 'checking'; this.render();
    this.pending = (async () => {
      try {
        const release = await fetchLatestRelease();
        isNewerRelease(this.version, release.version);
        this.release = release; this.status = 'result';
      } catch (error) { this.error = error instanceof UpdateError ? error.code : 'network'; this.status = 'error'; }
      finally { this.pending = undefined; this.render(); }
    })();
    return this.pending;
  }
  render(): void {
    const w = words[this.language()];
    const newer = this.release ? isNewerRelease(this.version, this.release.version) : false;
    this.get('updateHeading').textContent = w.title;
    this.get('updateCurrent').textContent = `${w.current}: ${this.version}`;
    this.get('closeUpdate').setAttribute('aria-label', w.close);
    this.get('updateStatus').textContent = this.status === 'result' && this.release
      ? (newer ? `${w.available}: ${this.release.version}` : this.version.replace(/^v/, '').split('+')[0] === this.release.version.split('+')[0] ? w.latest : w.ahead)
      : this.status === 'error' ? w.errors[this.error] : this.status === 'checking' ? w.checking : w.idle;
    this.get('updateStatus').classList.toggle('is-error', this.status === 'error');
    this.get('updatePrivacy').textContent = w.privacy;
    this.get<HTMLInputElement>('autoUpdateCheck').checked = this.preferences.automatic;
    this.get('autoUpdateLabel').textContent = w.automatic;
    this.get('updateTemporary').hidden = !this.temporary; this.get('updateTemporary').textContent = w.temporary;
    this.get<HTMLButtonElement>('runUpdateCheck').disabled = this.status === 'checking'; this.get('runUpdateCheck').textContent = w.check;
    const link = this.get<HTMLAnchorElement>('updateReleaseLink'); link.textContent = w.release; link.href = this.release?.url ?? RELEASES_PAGE;
    this.get('updateRelease').hidden = this.status !== 'result';
    this.get('updateNotesHeading').textContent = `${w.notes}${this.release ? ` · ${this.release.version}` : ''}`;
    this.get('updateNotes').textContent = this.release?.notes || w.noNotes;
    this.get('updateFallback').textContent = w.fallback; this.get('updateFallback').hidden = !newer || !!this.release?.htmlUrl;
    for (const [id, href, title] of [ ['downloadUpdate', this.release?.htmlUrl, w.download], ['downloadFullUpdate', this.release?.zipUrl, w.full] ] as const) {
      const anchor = this.get<HTMLAnchorElement>(id); anchor.hidden = !newer || !href; anchor.textContent = title;
      if (href) anchor.href = href; else anchor.removeAttribute('href');
    }
    this.get('updateGuideHeading').textContent = w.guide;
    this.get('updateSteps').replaceChildren(...w.steps.map((step) => { const li = document.createElement('li'); li.textContent = step; return li; }));
    this.get('updateBackup').textContent = w.backup; this.get('updateDistinction').textContent = w.distinction;
    const badge = this.root.querySelector<HTMLElement>('#updateBadge')!;
    badge.hidden = !newer; badge.textContent = w.badge;
    this.root.querySelector('#versionButton')!.setAttribute('aria-label', `Loregrid ${this.version} · ${w.check}${newer ? ` · ${w.badge}` : ''}`);
    this.root.querySelector('#checkUpdates')!.textContent = w.check;
  }
}
