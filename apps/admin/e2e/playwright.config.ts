import { defineConfig, devices } from '@playwright/test';

/**
 * 运营端 E2E 配置（文档 §14 / §15.3）。
 * 前置：先启动服务端 (apps/server :3000) 与运营端 (apps/admin :5174)。
 *   pnpm --filter @h5design/server start
 *   pnpm --filter @h5design/admin dev
 * 然后：pnpm --filter @h5design/admin exec playwright test
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report' }]],
  use: {
    baseURL: 'http://localhost:5174',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'pnpm --filter @h5design/admin dev',
    url: 'http://localhost:5174',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
