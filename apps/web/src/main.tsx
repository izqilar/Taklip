import React from 'react';
import ReactDOM from 'react-dom/client';
import { consumeBridgeSession } from './bootstrap'; // 必须最先执行：从运营端跳转携带的票据需先于 authStore 初始化换取并写入
import './fontBootstrap'; // 注入字体目录 fetcher，供缩略图等列表态组件惰性拉取自定义字体
import App from './App';
import { useAuthStore } from '@/store/authStore';
import './index.css';
import './i18n';

// 注意：编辑器内核服务（editorServices）**不在此处导入**。
// 它静态依赖 @h5design/editor（Konva/GSAP，约 4MB），若在入口导入会拖慢所有页面首屏。
// 现在由已 code-split 的 pages/Editor.tsx 自行注册，见「按需加载」注释。

(async () => {
  // 跨端桥接：先消费 ?ticket= 换回登录态，再渲染 App，避免首屏以「未登录」闪现
  await consumeBridgeSession();
  // bootstrap 写入的是 localStorage，而 authStore 在模块加载时已缓存过时状态，
  // 这里手动重新同步，确保首屏路由守卫能正确识别已登录并落到工作台
  useAuthStore.getState().rehydrate();
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
})();
