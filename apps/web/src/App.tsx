import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import ProtectedRoute from './components/ProtectedRoute';
import AppLayout from './components/AppLayout';
import { useLanguageDirection } from './hooks/useLanguageDirection';

/**
 * 编辑器（含 @h5design/editor 内核 + Konva + GSAP，约 4MB 未压缩）必须**按需加载**：
 * 静态导入会让登录页/首页/作品列表等所有页面都先下载整个画布内核，
 * 直接拖慢首屏。这里改为路由级 code-split，只在进入 /editor/:projectId 时才拉取。
 */
const Editor = lazy(() => import('./pages/Editor'));

/**
 * 登录页（/login）是绝大多数用户的第一个入口，它只应该下载「登录」本身。
 * 但此前 Home / Register / TemplateList / ProjectList / FindServices / QuickMakeWizard
 * 全部是静态导入 —— 只要 App 被求值，这些页面的代码就一起进主 chunk，
 * 实测让登录页多下载了 20+ 个模块（含 qrcode、widgetModules 等重型依赖）。
 * 这里统一改为路由级按需加载，只保留 Login 静态（首屏必需）。
 */
const Home = lazy(() => import('./pages/Home'));
const Register = lazy(() => import('./pages/Register'));
const TemplateList = lazy(() => import('./pages/TemplateList'));
const ProjectList = lazy(() => import('./pages/ProjectList'));
const FindServices = lazy(() => import('./pages/FindServices'));
const QuickMakeWizard = lazy(() => import('./wizard/QuickMakeWizard'));

/** 用户中心（Phase 2 · 2.4）：终端用户的唯一功能性家。各模块路由级按需加载。 */
const UserCenterLayout = lazy(() => import('./user/UserCenterLayout'));
const UserOverview = lazy(() => import('./user/Overview'));
const UserOrders = lazy(() => import('./user/Orders'));
const UserWallet = lazy(() => import('./user/Wallet'));
const UserCoupons = lazy(() => import('./user/Coupons'));
const UserReviews = lazy(() => import('./user/Reviews'));
const UserFeedback = lazy(() => import('./user/Feedback'));
const UserProviders = lazy(() => import('./user/Providers'));
const UserMessages = lazy(() => import('./user/Messages'));
const UserNotices = lazy(() => import('./user/Notices'));
const UserAccount = lazy(() => import('./user/Account'));
const UserApply = lazy(() => import('./user/Apply'));
const Onboarding = lazy(() => import('./pages/Onboarding'));

/**
 * 发布页（/p/:publishCode）需要注入 GSAP 动画播放器，会额外带上 gsap（约 166KB 未压缩）。
 * 它并不属于登录/首页/作品列表等常规首屏，故同样做路由级 code-split，
 * 避免把 gsap 打进主 chunk 拖慢所有页面。
 * 注意：发布页本身就有全屏 loading（要先拉 schema），Suspense 兜底与之一致，视觉无跳变。
 */
const PublishedPage = lazy(() => import('./pages/PublishedPage'));

/**
 * 服务端导出渲染页（/export-render）—— 无登录态、无导航壳。
 * 只在服务端导出模块以无头浏览器打开时使用，普通用户不会访问到。
 */
const ExportRenderPage = lazy(() => import('./pages/ExportRenderPage'));

// 注意：原 web 端「我的订单 / 我的消息 / 账户详情 / 账号设置 / 我的收藏 /
// 代理商工作台 / 审核台 / 服务商后台」等页面与运营端（:5174）同类内容重复，
// 已按需求从 web 端彻底移除，统一到运营端处理。以下仅保留 web 端自有内容。

/** 懒加载路由的统一占位：与页面自身的 loading 态保持一致，避免闪烁跳变。 */
function RouteFallback({ label = '…' }: { label?: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-900 text-gray-400">
      {label}
    </div>
  );
}

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

          {/* 用户中心（Phase 2 · 2.4）：订单 / 钱包 / 优惠券 / 评价 / 反馈 / 服务商 / 消息 / 公告 / 账户 / 我的作品 */}
          <Route
            path="/user"
            element={
              <ProtectedRoute>
                <UserCenterLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<UserOverview />} />
            <Route path="works" element={<ProjectList />} />
            <Route path="orders" element={<UserOrders />} />
            <Route path="wallet" element={<UserWallet />} />
            <Route path="coupons" element={<UserCoupons />} />
            <Route path="reviews" element={<UserReviews />} />
            <Route path="feedback" element={<UserFeedback />} />
            <Route path="providers" element={<UserProviders />} />
            <Route path="messages" element={<UserMessages />} />
            <Route path="notices" element={<UserNotices />} />
            <Route path="account" element={<UserAccount />} />
            {/* 入驻申请：加入团队 / 资格升级双隧道入口 */}
            <Route path="apply" element={<UserApply />} />
          </Route>

          {/* 旧「我的作品」独立路由：重定向到个人中心内的同名页（保留深链 / 书签兼容） */}
          <Route path="/dashboard" element={<Navigate to="/user/works" replace />} />
        </Route>

        {/* 独立路由：无顶部导航 */}
        <Route path="/login" element={<Login />} />
        <Route
          path="/register"
          element={
            <Suspense fallback={<RouteFallback />}>
              <Register />
            </Suspense>
          }
        />
        {/* 注册即入驻第二步：资料填写（需登录态；提交后进入既有入驻审核管线） */}
        <Route
          path="/onboarding"
          element={
            <ProtectedRoute>
              <Suspense fallback={<RouteFallback />}>
                <Onboarding />
              </Suspense>
            </ProtectedRoute>
          }
        />
        <Route
          path="/p/:publishCode"
          element={
            <Suspense fallback={<RouteFallback />}>
              <PublishedPage />
            </Suspense>
          }
        />

        {/* 服务端导出渲染目标页：无壳、无鉴权渲染器劫持，仅供无头浏览器截图 */}
        <Route
          path="/export-render"
          element={
            <Suspense fallback={<RouteFallback />}>
              <ExportRenderPage />
            </Suspense>
          }
        />

        {/* 编辑器：工具态，无顶部导航（懒加载，避免拖慢其它页面首屏） */}
        <Route
          path="/editor/:projectId"
          element={
            <ProtectedRoute>
              <Suspense fallback={<RouteFallback label="正在加载编辑器…" />}>
                <Editor />
              </Suspense>
            </ProtectedRoute>
          }
        />

        {/* 兜底 */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
