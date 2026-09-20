import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import TemplateList from './pages/TemplateList';
import ProjectList from './pages/ProjectList';
import Editor from './pages/Editor';
import PublishedPage from './pages/PublishedPage';
import FindServices from './pages/FindServices';
import QuickMakeWizard from './wizard/QuickMakeWizard';
import ProtectedRoute from './components/ProtectedRoute';
import AppLayout from './components/AppLayout';
import { useLanguageDirection } from './hooks/useLanguageDirection';

// 注意：原 web 端「我的订单 / 我的消息 / 账户详情 / 账号设置 / 我的收藏 /
// 代理商工作台 / 审核台 / 服务商后台」等页面与运营端（:5174）同类内容重复，
// 已按需求从 web 端彻底移除，统一到运营端处理。以下仅保留 web 端自有内容。

export default function App() {
  useLanguageDirection();

  return (
    <BrowserRouter>
      <Routes>
        {/* 全站布局：含固定顶部导航 SiteHeader */}
        <Route element={<AppLayout />}>
          {/* 公开路由 */}
          <Route path="/" element={<Home />} />
          <Route path="/templates" element={<TemplateList />} />
          <Route path="/find-services" element={<FindServices />} />
          <Route path="/quick-make" element={<QuickMakeWizard />} />

          {/* 需登录的路由：我的作品（用户自有内容） */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <ProjectList />
              </ProtectedRoute>
            }
          />
        </Route>

        {/* 独立路由：无顶部导航 */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/p/:publishCode" element={<PublishedPage />} />

        {/* 编辑器：工具态，无顶部导航 */}
        <Route
          path="/editor/:projectId"
          element={
            <ProtectedRoute>
              <Editor />
            </ProtectedRoute>
          }
        />

        {/* 兜底 */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
