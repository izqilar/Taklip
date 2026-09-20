// vite.config.ts
import { defineConfig } from "file:///D:/MyWorkBuddy/2026-08-10-22-39-56/node_modules/.pnpm/vite@5.4.21_@types+node@22.20.1_terser@5.49.2/node_modules/vite/dist/node/index.js";
import react from "file:///D:/MyWorkBuddy/2026-08-10-22-39-56/node_modules/.pnpm/@vitejs+plugin-react@4.7.0__adca23f460cf9b25369f43e178ce0e84/node_modules/@vitejs/plugin-react/dist/index.js";
var vite_config_default = defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    proxy: {
      // 静态资源代理：与 web(:5173) 一致，使 schema 内的相对资源路径
      // (/uploads/...、/public/...) 解析到后端 :3000，避免后台缩略图图片 404。
      // 注意：API 数据请求由 dataProvider 直连 API_URL(:3000)，不经此代理。
      "/uploads": {
        target: "http://localhost:3000",
        changeOrigin: true
      },
      "/public": {
        target: "http://localhost:3000",
        changeOrigin: true
      }
    }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJEOlxcXFxNeVdvcmtCdWRkeVxcXFwyMDI2LTA4LTEwLTIyLTM5LTU2XFxcXGFwcHNcXFxcYWRtaW5cIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIkQ6XFxcXE15V29ya0J1ZGR5XFxcXDIwMjYtMDgtMTAtMjItMzktNTZcXFxcYXBwc1xcXFxhZG1pblxcXFx2aXRlLmNvbmZpZy50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vRDovTXlXb3JrQnVkZHkvMjAyNi0wOC0xMC0yMi0zOS01Ni9hcHBzL2FkbWluL3ZpdGUuY29uZmlnLnRzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSAndml0ZSc7XG5pbXBvcnQgcmVhY3QgZnJvbSAnQHZpdGVqcy9wbHVnaW4tcmVhY3QnO1xuXG4vLyBcdTdCQTFcdTc0MDZcdTU0MEVcdTUzRjBcdTcyRUNcdTdBQ0JcdTVERTVcdTdBMEJcdUZGMENcdTdBRUZcdTUzRTMgNTE3NCBcdTkwN0ZcdTUxNERcdTRFMEUgYXBwcy93ZWIoNTE3MykgXHU1MUIyXHU3QTgxXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoe1xuICBwbHVnaW5zOiBbcmVhY3QoKV0sXG4gIHNlcnZlcjoge1xuICAgIHBvcnQ6IDUxNzQsXG4gICAgcHJveHk6IHtcbiAgICAgIC8vIFx1OTc1OVx1NjAwMVx1OEQ0NFx1NkU5MFx1NEVFM1x1NzQwNlx1RkYxQVx1NEUwRSB3ZWIoOjUxNzMpIFx1NEUwMFx1ODFGNFx1RkYwQ1x1NEY3RiBzY2hlbWEgXHU1MTg1XHU3Njg0XHU3NkY4XHU1QkY5XHU4RDQ0XHU2RTkwXHU4REVGXHU1Rjg0XG4gICAgICAvLyAoL3VwbG9hZHMvLi4uXHUzMDAxL3B1YmxpYy8uLi4pIFx1ODlFM1x1Njc5MFx1NTIzMFx1NTQwRVx1N0FFRiA6MzAwMFx1RkYwQ1x1OTA3Rlx1NTE0RFx1NTQwRVx1NTNGMFx1N0YyOVx1NzU2NVx1NTZGRVx1NTZGRVx1NzI0NyA0MDRcdTMwMDJcbiAgICAgIC8vIFx1NkNFOFx1NjEwRlx1RkYxQUFQSSBcdTY1NzBcdTYzNkVcdThCRjdcdTZDNDJcdTc1MzEgZGF0YVByb3ZpZGVyIFx1NzZGNFx1OEZERSBBUElfVVJMKDozMDAwKVx1RkYwQ1x1NEUwRFx1N0VDRlx1NkI2NFx1NEVFM1x1NzQwNlx1MzAwMlxuICAgICAgJy91cGxvYWRzJzoge1xuICAgICAgICB0YXJnZXQ6ICdodHRwOi8vbG9jYWxob3N0OjMwMDAnLFxuICAgICAgICBjaGFuZ2VPcmlnaW46IHRydWUsXG4gICAgICB9LFxuICAgICAgJy9wdWJsaWMnOiB7XG4gICAgICAgIHRhcmdldDogJ2h0dHA6Ly9sb2NhbGhvc3Q6MzAwMCcsXG4gICAgICAgIGNoYW5nZU9yaWdpbjogdHJ1ZSxcbiAgICAgIH0sXG4gICAgfSxcbiAgfSxcbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUFtVSxTQUFTLG9CQUFvQjtBQUNoVyxPQUFPLFdBQVc7QUFHbEIsSUFBTyxzQkFBUSxhQUFhO0FBQUEsRUFDMUIsU0FBUyxDQUFDLE1BQU0sQ0FBQztBQUFBLEVBQ2pCLFFBQVE7QUFBQSxJQUNOLE1BQU07QUFBQSxJQUNOLE9BQU87QUFBQTtBQUFBO0FBQUE7QUFBQSxNQUlMLFlBQVk7QUFBQSxRQUNWLFFBQVE7QUFBQSxRQUNSLGNBQWM7QUFBQSxNQUNoQjtBQUFBLE1BQ0EsV0FBVztBQUFBLFFBQ1QsUUFBUTtBQUFBLFFBQ1IsY0FBYztBQUFBLE1BQ2hCO0FBQUEsSUFDRjtBQUFBLEVBQ0Y7QUFDRixDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=
