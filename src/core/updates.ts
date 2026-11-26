export const RELEASE_API = 'https://api.github.com/repos/pheasant79/loregrid/releases/latest';
export const RELEASES_PAGE = 'https://github.com/pheasant79/loregrid/releases';
export const UPDATE_PREFERENCE_KEY = 'loregrid:updates-v1';
export const UPDATE_INTERVAL = 24 * 60 * 60 * 1000;

export interface AppRelease {
  version: string;
  notes: string;
  url: string;
  htmlUrl?: string;
  zipUrl?: string;
}
export type UpdateErrorCode = 'network' | 'timeout' | 'rate-limit' | 'no-release' | 'invalid';
export class UpdateError extends Error {
  constructor(public readonly code: UpdateErrorCode) { super(code); }
}

function versionParts(value: string): { numbers: bigint[]; prerelease: boolean } | null {
  if (value.length > 100) return null;
  const match = /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/.exec(value);
  return match ? { numbers: [BigInt(match[1]!), BigInt(match[2]!), BigInt(match[3]!)], prerelease: Boolean(match[4]) } : null;
}

/** A stable release can update an earlier prerelease of the same version. */
export function isNewerRelease(current: string, candidate: string): boolean {
  const a = versionParts(current), b = versionParts(candidate);
  if (!a || !b || b.prerelease) throw new UpdateError('invalid');
  for (let i = 0; i < 3; i++) {
    if (a.numbers[i] !== b.numbers[i]) return b.numbers[i]! > a.numbers[i]!;
  }
  return a.prerelease;
}

function githubUrl(value: unknown, prefix: string): string | undefined {
  if (typeof value !== 'string' || value.length > 2048) return;
  try {
    const url = new URL(value);
    if (url.protocol === 'https:' && url.hostname === 'github.com' && !url.port && !url.username && !url.password
      && url.pathname.startsWith(prefix) && url.pathname.length > prefix.length) return url.href;
  } catch { /* Remote metadata is untrusted. */ }
}

export function parseRelease(input: unknown): AppRelease {
  if (!input || typeof input !== 'object') throw new UpdateError('invalid');
  const raw = input as Record<string, unknown>;
  const version = typeof raw.tag_name === 'string' ? raw.tag_name.replace(/^v/, '') : '';
  const parts = versionParts(version);
  const url = githubUrl(raw.html_url, '/pheasant79/loregrid/releases/tag/');
  if (raw.draft !== false || raw.prerelease !== false || !parts || parts.prerelease || !url) throw new UpdateError('invalid');
  const result: AppRelease = { version, url, notes: typeof raw.body === 'string' ? raw.body.slice(0, 20_000) : '' };
  if (Array.isArray(raw.assets)) {
    for (const asset of raw.assets.slice(0, 100)) {
      if (!asset || typeof asset !== 'object') continue;
      const item = asset as Record<string, unknown>;
      const download = githubUrl(item.browser_download_url, '/pheasant79/loregrid/releases/download/');
      if (!download) continue;
      if (item.name === `Loregrid-v${version}-update.html` || item.name === 'index.html') result.htmlUrl = download;
      if (item.name === `Loregrid-v${version}-offline.zip`) result.zipUrl = download;
    }
  }
  return result;
}

export async function fetchLatestRelease(fetcher: typeof fetch = fetch, timeoutMs = 10_000): Promise<AppRelease> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetcher(RELEASE_API, {
      signal: controller.signal, credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-store',
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (response.status === 403 || response.status === 429) throw new UpdateError('rate-limit');
    if (response.status === 404) throw new UpdateError('no-release');
    if (!response.ok) throw new UpdateError('network');
    return parseRelease(await response.json());
  } catch (error) {
    if (error instanceof UpdateError) throw error;
    throw new UpdateError(controller.signal.aborted ? 'timeout' : 'network');
  } finally { clearTimeout(timer); }
}

interface UpdatePreference { automatic: boolean; lastAttempt: number }
export class UpdatePreferences {
  private value: UpdatePreference = { automatic: false, lastAttempt: 0 };
  constructor(private storage: Pick<Storage, 'getItem' | 'setItem'> | undefined) {
    try {
      const raw = JSON.parse(storage?.getItem(UPDATE_PREFERENCE_KEY) || 'null') as Partial<UpdatePreference> | null;
      if (raw && typeof raw.automatic === 'boolean' && typeof raw.lastAttempt === 'number' && Number.isFinite(raw.lastAttempt)) {
        this.value = { automatic: raw.automatic, lastAttempt: Math.max(0, raw.lastAttempt) };
      }
    } catch { /* Storage is optional, particularly under file: URLs. */ }
  }
  get automatic(): boolean { return this.value.automatic; }
  setAutomatic(value: boolean): boolean { this.value.automatic = value; return this.save(); }
  shouldCheck(now = Date.now()): boolean {
    return this.automatic && (this.value.lastAttempt === 0 || now - this.value.lastAttempt >= UPDATE_INTERVAL || now < this.value.lastAttempt);
  }
  recordAttempt(now = Date.now()): void { this.value.lastAttempt = now; this.save(); }
  private save(): boolean {
    try {
      if (!this.storage) return false;
      this.storage.setItem(UPDATE_PREFERENCE_KEY, JSON.stringify(this.value)); return true;
    } catch { return false; }
  }
}
