import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { createRequire } from 'node:module';
import os from 'node:os';

// 探测本机用于局域网分享的 IPv4（排除回环 / 虚拟网卡 / 容器 / 隧道网段）。
// 仅 dev server 生效；生产构建无此中间件，前端回退到 VITE_WEB_BASE。
function pickLanIp(): string | null {
  const ifaces = os.networkInterfaces();
  const candidates: string[] = [];
  for (const list of Object.values(ifaces)) {
    for (const ni of list ?? []) {
      if (ni.family !== 'IPv4' || ni.internal) continue;
      const ip = ni.address;
      if (/^169\.254\./.test(ip)) continue; // 链路本地
      if (/^100\./.test(ip)) continue; // CGNAT / VPN 常见
      if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) continue; // Docker 桥接 172.16–31
      if (/^192\.168\.(5[6-9]|6\d|7\d|8\d|9\d)\./.test(ip)) continue; // VirtualBox/VMware 56–99
      candidates.push(ip);
    }
  }
  // 优先 192.168.x（家用/办公最常见）
  candidates.sort(
    (a, b) => (a.startsWith('192.168.') ? -1 : 1) - (b.startsWith('192.168.') ? -1 : 1),
  );
  return candidates[0] ?? null;
}

// 管理后台独立工程，端口 5174 避免与 apps/web(5173) 冲突
const require = createRequire(import.meta.url);
// 解析到「宿主 admin 视角」的 react-router-dom 单一实例（v6 / Refine v6）。
// 共享内核 @h5design/editor 内部 useNavigate 必须复用与之相同的实例，
// 否则内核在 admin 构建里会解析到独立的 react-router-dom@7 副本，其 useNavigate
// 拿不到 Router Context → 画布白屏。别名仅作用于 admin 构建，不影响 web（web 用自己的 v7）。
const resolveFromAdmin = (m: string): string => {
  try {
    return require.resolve(m, { paths: [process.cwd()] });
  } catch {
    return m;
  }
};
// 共享内核 @h5design/editor 与宿主 admin 必须共用同一份实例：
// 1) react-router-dom：内核 useNavigate 需复用 admin 的 Router Context（v6 / Refine v6），
//    否则内核解析到独立的 react-router-dom@7 副本 → 画布白屏。
// 2) react-i18next / i18next：内核仅消费 useTranslation，不自行 init；admin 在
//    i18n/index.ts 初始化。pnpm 隔离下内核解析到 react-i18next@17/i18next@26，
//    admin 是 15/23，两份独立实例 → 内核读到未初始化的默认实例 → 文案回退成键名。
// 别名强制内核走 admin 单一实例，仅作用于 admin 构建，不影响 web（web 用自己的配置）。
const reactRouterDom = resolveFromAdmin('react-router-dom');
const reactI18next = resolveFromAdmin('react-i18next');
const i18nextPkg = resolveFromAdmin('i18next');

export default defineConfig({
  plugins: [
    {
      // 暴露本机 LAN IP 给前端，用于动态生成可扫码的分享二维码（IP 变化自动跟随）
      name: 'lan-info-endpoint',
      configureServer(server) {
        server.middlewares.use('/__lan_info', (_req, res) => {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ip: pickLanIp(), webPort: 5173, adminPort: 5174 }));
        });
      },
    },
    react(),
  ],
  resolve: {
    alias: {
      'react-router-dom': reactRouterDom,
      'react-i18next': reactI18next,
      'i18next': i18nextPkg,
    },
    dedupe: ['react', 'react-dom'],
  },
  server: {
    // 局域网/公网一键切换：默认 host:true → 监听所有网卡（含回环 + 局域网 IP），
    // 既可本机 localhost:5174 访问，也让平板/同网段设备能开运营端。
    // 设 VITE_DEV_HOST=127.0.0.1 可退回仅本机。
    host: (process.env.VITE_DEV_HOST as string | undefined) ?? true,
    port: 5174,
    proxy: {
      // 静态资源代理：与 web(:5173) 一致，使 schema 内的相对资源路径
      // (/uploads/...、/public/...) 解析到后端 :3000，避免后台缩略图图片 404。
      // 注意：API 数据请求由 dataProvider 直连 API_URL(:3000)，不经此代理。
      '/uploads': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/public': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
