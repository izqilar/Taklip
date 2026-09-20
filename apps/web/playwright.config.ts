import { defineConfig, devices } from '@playwright/test';

/**
 * 用户端 (apps/web :5173) E2E 配置。
 * 前置：
 *   1) 先启动服务端 (apps/server :3000)：pnpm --filter @h5design/server start
 *   2) 安装浏览器：npx playwright install chromium
 *   3) 运行：pnpm --filter @h5design/web exec playwright test
 * webServer 仅负责拉起用户端；服务端需另行启动（reuseExistingServer）。
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report' }]],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'pnpm --filter @h5design/web dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
