import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    // 局域网/公网一键切换：
    //   - 默认 host:true → Vite 监听所有网卡（含 127.0.0.1 / [::1] 回环 + 局域网 IP），
    //     既保证 puppeteer/localhost 正常，又让同网段手机/设备能直接访问，便于扫码调试。
    //   - 如需仅本机：设 VITE_DEV_HOST=127.0.0.1；如需仅指定网卡也可填具体 IP。
    // 注意：浏览器侧的 API 走 vite proxy（target 仍是本机 localhost:3000，服务端转发），
    // 所以手机扫码访问时无需手机直连后端，只要能访问本机 :5173 即可。
    host: (process.env.VITE_DEV_HOST as string | undefined) ?? true,
    port: 5173,
    proxy: {
      // 开发期代理后端 API，避免跨域
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
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
