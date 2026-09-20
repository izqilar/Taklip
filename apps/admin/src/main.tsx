import { consumeBridgeSession } from './bootstrap'; // 必须最先执行：从 Web 端跳转携带的票据需先于 App 初始化换取并写入
import './fontBootstrap'; // 注入字体目录 fetcher，供缩略图等列表态组件惰性拉取自定义字体
import './styles/tailwind.css'; // admin 自身（antd 宿主）样式；编辑器子树样式由内核 CSS 提供（已改为按需加载）
import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { ErrorBoundary } from './components/ErrorBoundary';

// 注意：编辑器内核服务（editorServices）与内核样式（@h5design/editor/styles.css）
// **不在此处导入**。它们静态依赖 @h5design/editor（Konva/GSAP，约 4MB），
// 在入口导入会让登录页等无关页面也下载整个画布内核，拖慢首屏。
// 现在由已 code-split 的 SPTemplateEditor.tsx 自行注册与引入。

(async () => {
  // 跨端桥接：先消费 ?ticket= 换回登录态，再渲染 App，避免首屏以「未登录」闪现
  await consumeBridgeSession();
  ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>,
  );
})();
