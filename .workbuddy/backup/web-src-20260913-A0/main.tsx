import React from 'react';
import ReactDOM from 'react-dom/client';
import './bootstrap'; // 必须最先执行：从运营端跳转携带的 token 需先于 authStore 初始化写入
import App from './App';
import './index.css';
import './i18n';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
