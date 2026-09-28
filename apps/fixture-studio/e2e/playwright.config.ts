import { defineConfig, devices } from '@playwright/test';
import type { PlaywrightTestConfig, PlaywrightTestProject, ReporterDescription } from '@playwright/test';

import { API_PORT, BASE_URL, REPORT_DIR, RESULTS_DIR, UI_PORT, WORKSPACE_ROOT } from './test/common/playwright.const.ts';

type WebServer = NonNullable<PlaywrightTestConfig['webServer']>;

const isCi = Boolean(process.env['CI']);

/** Set by the `e2e-live` target: only the live project talks to a real API. */
const isLive = process.env['STUDIO_E2E_LIVE'] === '1';

/** No live reload: saving a source file during a run must not reload a page mid-test. */
const uiServeArgs = [
  `--port=${UI_PORT}`,
  '--host=127.0.0.1',
  '--proxyConfig=apps/fixture-studio/e2e/e2e-proxy.conf.json',
  '--liveReload=false',
  '--hmr=false'
];

const uiServer: WebServer = {
  command: `pnpm nx run @fixture-automation/fixture-studio:serve ${uiServeArgs.join(' ')}`,
  cwd: WORKSPACE_ROOT,
  reuseExistingServer: !isCi,
  timeout: 180_000,
  url: BASE_URL
};

/** Canned AI answers instead of a paid CLI, and the e2e origin and port. */
const apiEnvEntries: [string, string][] = [
  ['STUDIO_AI_MOCK', '1'],
  ['STUDIO_ALLOWED_ORIGINS', BASE_URL],
  ['STUDIO_API_PORT', String(API_PORT)]
];

const apiEnv = Object.fromEntries(apiEnvEntries);

/** Ready when the port accepts a connection (Playwright probes 127.0.0.1 and ::1), so no API route is load-bearing here. */
const apiServer: WebServer = {
  command: 'node --conditions=@fixture-automation/source apps/fixture-studio-api/src/main.ts',
  cwd: WORKSPACE_ROOT,
  env: apiEnv,
  reuseExistingServer: !isCi,
  timeout: 60_000,
  port: API_PORT
};

const liveServers = [apiServer, uiServer];

const mockedServers = [uiServer];

const webServer = isLive ? liveServers : mockedServers;

const desktopChrome = { ...devices['Desktop Chrome'] };

const LIVE_SPECS = ['**/live.e2e.ts'];

const SCREENSHOT_SPECS = ['**/screenshots.test.ts', '**/screenshots-spec-error.test.ts'];

const mockedIgnore = [...LIVE_SPECS, ...SCREENSHOT_SPECS];

const mocked: PlaywrightTestProject = { name: 'mocked', testIgnore: mockedIgnore, use: desktopChrome };

const live: PlaywrightTestProject = { name: 'live', testMatch: LIVE_SPECS, use: desktopChrome };

const screenshots: PlaywrightTestProject = { name: 'screenshots', testMatch: SCREENSHOT_SPECS, use: desktopChrome };

const projects = [mocked, live, screenshots];

const htmlOptions = { open: 'never', outputFolder: REPORT_DIR };

const reporter: ReporterDescription[] = [['list'], ['html', htmlOptions]];

const use = {
  baseURL: BASE_URL,
  screenshot: 'only-on-failure',
  trace: 'retain-on-failure'
} as const;

export default defineConfig({
  forbidOnly: isCi,
  fullyParallel: true,
  outputDir: RESULTS_DIR,
  projects,
  reporter,
  retries: isCi ? 1 : 0,
  testMatch: '**/*.@(e2e|test).ts',
  use,
  webServer
});
