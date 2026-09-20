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
    // 必须显式绑定 IPv4：Vite 默认只监听 localhost（本机解析到 [::1]），
    // 而 Node/Chrome 访问 localhost 优先走 IPv4 127.0.0.1 → 服务端导出（puppeteer）
    // 会拿到 ERR_CONNECTION_REFUSED。绑定 127.0.0.1 让两种解析都能通。
    host: '127.0.0.1',
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
