import { defineConfig } from '@playwright/test';
import base from './playwright.config';

// 临时配置：本沙箱无 CDN 网络，Playwright 1.62.1 要求的 chromium v1234 无法下载；
// 使用已缓存的 v1228 浏览器（此前已验证可正常驱动）实跑。executablePath 绕过修订号校验。
export default defineConfig({
  ...base,
  testDir: '.',
  use: {
    ...base.use,
    launchOptions: {
      executablePath:
        'C:\\Users\\Administrator\\AppData\\Local\\ms-playwright\\chromium-1228\\chrome-win64\\chrome.exe',
    },
  },
});
