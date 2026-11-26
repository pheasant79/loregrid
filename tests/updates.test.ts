import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchLatestRelease, isNewerRelease, parseRelease, RELEASE_API, UPDATE_INTERVAL, UPDATE_PREFERENCE_KEY, UpdatePreferences } from '../src/core/updates';
import { releaseZip } from '../scripts/release-zip';
import { inflateRawSync } from 'node:zlib';

const rawRelease = () => ({
  tag_name: 'v2.1.0', draft: false, prerelease: false, html_url: 'https://github.com/pheasant79/loregrid/releases/tag/v2.1.0',
  body: '<script>unsafe()</script>\nChanges', assets: [
    { name: 'Loregrid-v2.1.0-update.html', browser_download_url: 'https://github.com/pheasant79/loregrid/releases/download/v2.1.0/Loregrid-v2.1.0-update.html' },
    { name: 'Loregrid-v2.1.0-offline.zip', browser_download_url: 'https://github.com/pheasant79/loregrid/releases/download/v2.1.0/Loregrid-v2.1.0-offline.zip' },
  ],
});
afterEach(() => { vi.useRealTimers(); localStorage.clear(); });

describe('stable release updates', () => {
  it.each([
    ['2.9.0', 'v2.10.0', true], ['2.0.0-rc.9', '2.0.0', true], ['2.0.0', '2.0.0', false],
    ['2.1.0', '2.0.1', false], ['2.0.0+abc', '2.0.0+def', false], ['2.99.0', '3.0.0', true],
  ])('compares %s and %s numerically', (current, candidate, result) => {
    expect(isNewerRelease(current, candidate)).toBe(result);
  });
  it('rejects unknown versions and prerelease candidates instead of declaring up to date', () => {
    expect(() => isNewerRelease('unknown', '2.0.0')).toThrow();
    expect(() => isNewerRelease('2.0.0', '2.1.0-rc.1')).toThrow();
    expect(() => parseRelease({ ...rawRelease(), prerelease: true })).toThrow();
    expect(() => parseRelease({ ...rawRelease(), draft: true })).toThrow();
  });
  it('keeps notes as bounded text and only recognizes safe assets for the published version', () => {
    expect(parseRelease(rawRelease()).htmlUrl).toContain('Loregrid-v2.1.0-update.html');
    expect(parseRelease(rawRelease()).notes).toContain('<script>');
    const unsafe = rawRelease();
    unsafe.assets[0]!.browser_download_url = 'https://github.com.evil.test/pheasant79/loregrid/releases/download/update.html';
    unsafe.assets[1]!.name = 'Loregrid-v9.0.0-offline.zip';
    expect(parseRelease(unsafe).htmlUrl).toBeUndefined();
    expect(parseRelease(unsafe).zipUrl).toBeUndefined();
    expect(parseRelease({ ...rawRelease(), body: 'x'.repeat(25_000) }).notes).toHaveLength(20_000);
    for (const html_url of ['javascript:alert(1)', 'http://github.com/pheasant79/loregrid/releases/tag/v2', 'https://github.com/another/repo/releases/tag/v2']) {
      expect(() => parseRelease({ ...rawRelease(), html_url })).toThrow();
    }
  });
  it('handles old releases without inventing standalone HTML downloads', () => {
    const release = parseRelease({ ...rawRelease(), assets: [] });
    expect(release.htmlUrl).toBeUndefined(); expect(release.zipUrl).toBeUndefined(); expect(release.url).toContain('/releases/tag/');
  });
  it('queries only the fixed release API without credentials, tree data or a referrer', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => rawRelease() });
    expect((await fetchLatestRelease(fetcher)).version).toBe('2.1.0');
    expect(fetcher).toHaveBeenCalledWith(RELEASE_API, expect.objectContaining({ credentials: 'omit', referrerPolicy: 'no-referrer' }));
    expect(fetcher.mock.calls[0]![1]).not.toHaveProperty('body');
  });
  it.each([[403, 'rate-limit'], [429, 'rate-limit'], [404, 'no-release'], [500, 'network']])('distinguishes HTTP %s failures', async (status, code) => {
    await expect(fetchLatestRelease(vi.fn().mockResolvedValue({ ok: false, status }))).rejects.toMatchObject({ code });
  });
  it('distinguishes failed connections, invalid metadata and timeouts', async () => {
    await expect(fetchLatestRelease(vi.fn().mockRejectedValue(new TypeError('offline')))).rejects.toMatchObject({ code: 'network' });
    await expect(fetchLatestRelease(vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }))).rejects.toMatchObject({ code: 'invalid' });
    vi.useFakeTimers();
    const pending = fetchLatestRelease(vi.fn().mockImplementation((_url, options: RequestInit) => new Promise((_resolve, reject) => {
      options.signal!.addEventListener('abort', () => reject(new Error('abort')));
    })), 50);
    const assertion = expect(pending).rejects.toMatchObject({ code: 'timeout' });
    await vi.advanceTimersByTimeAsync(60); await assertion;
  });
});

describe('optional startup checks', () => {
  it('defaults to offline and throttles opted-in checks, including failed attempts', () => {
    const preferences = new UpdatePreferences(localStorage);
    expect(preferences.shouldCheck()).toBe(false);
    preferences.setAutomatic(true); expect(preferences.shouldCheck(1000)).toBe(true);
    preferences.recordAttempt(1000);
    const restored = new UpdatePreferences(localStorage);
    expect(restored.automatic).toBe(true); expect(restored.shouldCheck(1001)).toBe(false);
    expect(restored.shouldCheck(1000 + UPDATE_INTERVAL)).toBe(true);
    restored.setAutomatic(false); expect(restored.shouldCheck(Date.now())).toBe(false);
  });
  it('handles corrupted/unavailable storage and clock changes without breaking learning', () => {
    localStorage.setItem(UPDATE_PREFERENCE_KEY, '{bad'); expect(new UpdatePreferences(localStorage).automatic).toBe(false);
    const preferences = new UpdatePreferences(undefined); expect(preferences.setAutomatic(true)).toBe(false);
    preferences.recordAttempt(2000); expect(preferences.shouldCheck(1000)).toBe(true);
    const denied = new UpdatePreferences({ getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } });
    expect(denied.automatic).toBe(false); expect(denied.setAutomatic(true)).toBe(false);
  });
});

it('packages deterministic UTF-8 ZIP entries with valid compressed data and CRC', () => {
  const files = [{ name: 'Loregrid/使用说明.txt', data: Buffer.from('123456789') }];
  const archive = releaseZip(files);
  expect(archive.equals(releaseZip(files))).toBe(true);
  expect(archive.readUInt32LE(14)).toBe(0xcbf43926); // Known CRC32 vector.
  const start = 30 + archive.readUInt16LE(26);
  expect(inflateRawSync(archive.subarray(start, start + archive.readUInt32LE(18))).toString()).toBe('123456789');
  expect(() => releaseZip([{ name: '../private.json', data: Buffer.from('') }])).toThrow('Unsafe ZIP path');
});
