import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { createRequire } from 'node:module';

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
  plugins: [react()],
  resolve: {
    alias: {
      'react-router-dom': reactRouterDom,
      'react-i18next': reactI18next,
      'i18next': i18nextPkg,
    },
    dedupe: ['react', 'react-dom'],
  },
  server: {
    // 同 web(:5173)：显式绑定 IPv4，避免只监听 [::1] 导致 IPv4 访问被拒
    host: '127.0.0.1',
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
