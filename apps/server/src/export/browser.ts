import { existsSync } from 'fs';

/**
 * 无头浏览器管理（服务端导出专用）
 *
 * 选用 puppeteer-core 而非 puppeteer：后者安装时会拉取一整个 Chromium（约 150MB+），
 * 在国内网络/受限环境下极易失败；而本机通常已存在 Chrome / Edge，
 * puppeteer-core 只需指向现成的可执行文件即可，安装快、体积小、无下载环节。
 *
 * 可通过环境变量 PUPPETEER_EXECUTABLE_PATH 显式指定浏览器路径。
 */

/** 按优先级探测本机可用的 Chromium 系浏览器 */
export function findBrowserExecutable(): string {
  const candidates = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
  ].filter((v): v is string => !!v);

  for (const p of candidates) {
    if (p && existsSync(p)) return p;
  }
  throw new Error(
    '未找到可用的 Chrome/Edge 可执行文件，无法进行服务端导出。请设置环境变量 PUPPETEER_EXECUTABLE_PATH。',
  );
}

let browserPromise: Promise<import('puppeteer-core').Browser> | null = null;

/** 复用同一个浏览器实例（每次导出新建会带来数秒的冷启动开销） */
export function getBrowser(): Promise<import('puppeteer-core').Browser> {
  if (browserPromise) return browserPromise;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const puppeteer = require('puppeteer-core');
  const launched: Promise<import('puppeteer-core').Browser> = puppeteer.launch({
    executablePath: findBrowserExecutable(),
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      // 关闭字体渲染微调，避免不同机器导出的字重视觉不一致
      '--font-render-hinting=none',
    ],
  });
  // 启动失败要清掉单例缓存，否则后续请求会一直拿到同一个 rejected promise
  launched.catch(() => {
    browserPromise = null;
  });
  browserPromise = launched;
  return launched;
}

/** 释放浏览器实例（进程退出 / 热重载时调用） */
export async function closeBrowser(): Promise<void> {
  if (!browserPromise) return;
  const b = await browserPromise.catch(() => null);
  browserPromise = null;
  await b?.close().catch(() => undefined);
}

/** 服务端导出渲染页地址（默认指向本机 web dev server） */
export function getRenderBaseUrl(): string {
  return (
    process.env.EXPORT_RENDER_URL ||
    process.env.WEB_BASE_URL ||
    // web dev server 已显式绑定 127.0.0.1（见 apps/web/vite.config.ts），
    // 这里直接用 IPv4 字面量，避免 Node 把 localhost 解析成 [::1]。
    'http://127.0.0.1:5173'
  ).replace(/\/+$/, '');
}

/**
 * 生成渲染页候选地址：主地址 + IPv4/IPv6 回环互备。
 *
 * 起因（实测）：Vite dev server 默认只监听 IPv6 回环 `[::1]`，而 Chrome/Node 解析
 * `localhost` 时优先走 IPv4 `127.0.0.1` —— 于是 puppeteer 直接拿到
 * `net::ERR_CONNECTION_REFUSED`，而 curl 访问同一个地址却是 200（curl 解析到了 ::1）。
 * 这里把两种写法都列为候选，逐个尝试直到成功。
 */
export function buildRenderUrls(path: string): string[] {
  const base = getRenderBaseUrl();
  const urls = [`${base}${path}`];
  const swap = (host: string) => {
    if (/^\[::1\]$/.test(host)) return base.replace('[::1]', '127.0.0.1') + path;
    return base.replace(/(localhost|127\.0\.0\.1)/i, '[::1]') + path;
  };
  try {
    const host = new URL(base).hostname;
    const alt = swap(host);
    if (alt !== urls[0]) urls.push(alt);
  } catch {
    /* base 非法时忽略兜底 */
  }
  return urls;
}
