import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'node:fs';

const chrome = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
  ?? (process.platform === 'win32' && existsSync('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe')
    ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
    : undefined);
const firefox = process.env.PLAYWRIGHT_FIREFOX_EXECUTABLE;

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: './test-results/playwright',
  snapshotPathTemplate: '{testDir}/__screenshots__/{projectName}/{arg}{ext}',
  fullyParallel: true,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { outputFolder: 'test-results/playwright-report', open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:4174',
    viewport: { width: 1440, height: 900 },
    colorScheme: 'dark',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'node_modules\\.bin\\vite.cmd --host 127.0.0.1 --port 4174',
    url: 'http://127.0.0.1:4174',
    reuseExistingServer: true,
    timeout: 30_000,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], launchOptions: chrome ? { executablePath: chrome } : undefined } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'], launchOptions: firefox ? { executablePath: firefox } : undefined } },
  ],
});
