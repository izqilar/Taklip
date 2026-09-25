import { lazy, Suspense, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { Refine, Authenticated, useInvalidate } from '@refinedev/core';
import { ErrorComponent } from '@refinedev/antd';
import routerProvider, { CatchAllNavigate } from '@refinedev/react-router-v6';
import { BrowserRouter, Routes, Route, Outlet, Navigate } from 'react-router-dom';
import { ConfigProvider, App as AntdApp } from 'antd';
import type { ThemeConfig } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import enUS from 'antd/locale/en_US';
import { useTranslation } from 'react-i18next';

import './i18n';
import { i18nProvider } from './providers/i18nProvider';
import { isRTL } from './i18n';

import { dataProvider } from './providers/dataProvider';
import { authProvider } from './providers/authProvider';
import { accessControlProvider } from './providers/accessControlProvider';
import { LayerProvider, useLayer } from './providers/layerContext';
import type { LayerKey } from './config/permGroups';
import { Login } from './pages/Login';

import { resources } from './config/resources';
import { antdTheme } from './config/theme';
import { AdminLayout } from './components/layout/AdminLayout';
import { InspectionGate } from './components/layout/InspectionGate';
import { getStoredUser } from './utility';

/**
 * 以下页面全部按需加载。
 *
 * 背景：此前这些页面是静态导入，只要 App 被求值，全部页面代码（含 providerPages /
 * userPages / consolePages 等聚合 barrel，实测仅在登录页就多下载约 1.4MB 源码）
 * 就一起进了入口 chunk。登录页根本用不到它们，这就是「抽包后运营端变慢」的残余部分。
 *
 * 写法说明：用 import().then((m) => ({ default: m.X })) 而不是字符串索引取导出，
 * 这样导出名一旦拼错/改名，tsc 能直接报错，不会出现运行时白屏。
 */
const UserList = lazy(() => import('./pages/users').then((m) => ({ default: m.UserList })));
const UserShow = lazy(() => import('./pages/users').then((m) => ({ default: m.UserShow })));
const UserEdit = lazy(() => import('./pages/users').then((m) => ({ default: m.UserEdit })));
const ZombieUsersList = lazy(() => import('./pages/zombieUsers').then((m) => ({ default: m.ZombieUsersList })));
const ZombieUserShow = lazy(() => import('./pages/zombieUsers').then((m) => ({ default: m.ZombieUserShow })));
const ProviderReviewList = lazy(() => import('./pages/provider-review').then((m) => ({ default: m.ProviderReviewList })));
const AgentList = lazy(() => import('./pages/agents').then((m) => ({ default: m.AgentList })));
const AgentCreate = lazy(() => import('./pages/agents').then((m) => ({ default: m.AgentCreate })));
const AgentEdit = lazy(() => import('./pages/agents').then((m) => ({ default: m.AgentEdit })));
const RegionTreePage = lazy(() => import('./pages/regions').then((m) => ({ default: m.RegionTreePage })));
const Dashboard = lazy(() => import('./pages/dashboard').then((m) => ({ default: m.Dashboard })));
const WalletList = lazy(() => import('./pages/wallets').then((m) => ({ default: m.WalletList })));
const WithdrawalList = lazy(() => import('./pages/withdrawals').then((m) => ({ default: m.WithdrawalList })));
const AuditLogList = lazy(() => import('./pages/audit-logs').then((m) => ({ default: m.AuditLogList })));
const OrderList = lazy(() => import('./pages/orders').then((m) => ({ default: m.OrderList })));
const FeedbackList = lazy(() => import('./pages/feedback').then((m) => ({ default: m.FeedbackList })));
const MessageList = lazy(() => import('./pages/messages').then((m) => ({ default: m.MessageList })));
const SettingsPage = lazy(() => import('./pages/settings').then((m) => ({ default: m.SettingsPage })));
const FontAdminList = lazy(() => import('./pages/fonts').then((m) => ({ default: m.FontAdminList })));
const TemplateReviewList = lazy(() => import('./pages/templates').then((m) => ({ default: m.TemplateReviewList })));
const RolesPage = lazy(() => import('./pages/roles').then((m) => ({ default: m.RolesPage })));
const TeamManagePage = lazy(() => import('./pages/teamManage').then((m) => ({ default: m.TeamManagePage })));
const QualificationReviewPage = lazy(() =>
  import('./pages/qualificationReview').then((m) => ({ default: m.QualificationReviewPage })),
);
const QualificationDetailPage = lazy(() =>
  import('./pages/qualificationDetail').then((m) => ({ default: m.QualificationDetailPage })),
);
const RedlineWordAdmin = lazy(() =>
  import('./pages/redlineWordAdmin').then((m) => ({ default: m.RedlineWordAdmin })),
);
const ProfilePage = lazy(() => import('./pages/account/ProfilePage').then((m) => ({ default: m.ProfilePage })));
const AgentDashboard = lazy(() => import('./pages/consolePages').then((m) => ({ default: m.AgentDashboard })));
const AgentUsers = lazy(() => import('./pages/consolePages').then((m) => ({ default: m.AgentUsers })));
const AgentProviders = lazy(() => import('./pages/consolePages').then((m) => ({ default: m.AgentProviders })));
const AgentOrders = lazy(() => import('./pages/consolePages').then((m) => ({ default: m.AgentOrders })));
const AgentWallet = lazy(() => import('./pages/consolePages').then((m) => ({ default: m.AgentWallet })));
const FeeConfigPage = lazy(() => import('./pages/consolePages').then((m) => ({ default: m.FeeConfigPage })));
const AgentTemplateReview = lazy(() => import('./pages/agentTemplateReview').then((m) => ({ default: m.AgentTemplateReview })));
const AgentServiceReview = lazy(() => import('./pages/agentServiceReview').then((m) => ({ default: m.AgentServiceReview })));
const AgentComingSoon = lazy(() => import('./pages/agentComingSoon').then((m) => ({ default: m.AgentComingSoon })));
const AgentNotices = lazy(() => import('./pages/agentNotices').then((m) => ({ default: m.AgentNotices })));
const AgentComplaints = lazy(() => import('./pages/agentComplaints').then((m) => ({ default: m.AgentComplaints })));
const AgentQualifications = lazy(() => import('./pages/agentQualifications').then((m) => ({ default: m.AgentQualifications })));
const AgentWithdrawReview = lazy(() => import('./pages/agentWithdrawReview').then((m) => ({ default: m.AgentWithdrawReview })));
const AgentContracts = lazy(() => import('./pages/agentContracts').then((m) => ({ default: m.AgentContracts })));
const AgentInvest = lazy(() => import('./pages/agentInvest').then((m) => ({ default: m.AgentInvest })));
const AgentPool = lazy(() => import('./pages/agentPool').then((m) => ({ default: m.AgentPool })));
const SPStudio = lazy(() => import('./pages/consolePages').then((m) => ({ default: m.SPStudio })));
const SPServices = lazy(() => import('./pages/consolePages').then((m) => ({ default: m.SPServices })));
const SPOrders = lazy(() => import('./pages/consolePages').then((m) => ({ default: m.SPOrders })));
const SPQualification = lazy(() => import('./pages/consolePages').then((m) => ({ default: m.SPQualification })));
const SPWallet = lazy(() => import('./pages/consolePages').then((m) => ({ default: m.SPWallet })));
const UserDashboard = lazy(() => import('./pages/userPages').then((m) => ({ default: m.UserDashboard })));
const UserOrders = lazy(() => import('./pages/userPages').then((m) => ({ default: m.UserOrders })));
const UserProviders = lazy(() => import('./pages/userPages').then((m) => ({ default: m.UserProviders })));
const UserCoupons = lazy(() => import('./pages/userPages').then((m) => ({ default: m.UserCoupons })));
const UserWallet = lazy(() => import('./pages/userPages').then((m) => ({ default: m.UserWallet })));
const UserReviews = lazy(() => import('./pages/userPages').then((m) => ({ default: m.UserReviews })));
const UserComplaints = lazy(() => import('./pages/userPages').then((m) => ({ default: m.UserComplaints })));
const UserNotices = lazy(() => import('./pages/userPages').then((m) => ({ default: m.UserNotices })));
const UserMessages = lazy(() => import('./pages/userPages').then((m) => ({ default: m.UserMessages })));
const UserWorks = lazy(() => import('./pages/userPages').then((m) => ({ default: m.UserWorks })));
const UserComplaintNew = lazy(() => import('./pages/user/UserComplaintNew').then((m) => ({ default: m.UserComplaintNew })));
const UserApply = lazy(() => import('./pages/user/UserApply').then((m) => ({ default: m.UserApply })));
const UserComplaintDetail = lazy(() => import('./pages/user/UserComplaintDetail').then((m) => ({ default: m.UserComplaintDetail })));
const UserNoticeFill = lazy(() => import('./pages/user/UserNoticeFill').then((m) => ({ default: m.UserNoticeFill })));
const ScheduleList = lazy(() => import('./pages/providerPages').then((m) => ({ default: m.ScheduleList })));
const TemplatesList = lazy(() => import('./pages/providerPages').then((m) => ({ default: m.TemplatesList })));
const WorksList = lazy(() => import('./pages/providerPages').then((m) => ({ default: m.WorksList })));
const SPContract = lazy(() => import('./pages/providerPages').then((m) => ({ default: m.SPContract })));
const SPClients = lazy(() => import('./pages/providerPages').then((m) => ({ default: m.SPClients })));
const SPComplaints = lazy(() => import('./pages/providerPages').then((m) => ({ default: m.SPComplaints })));
const SPApply = lazy(() => import('./pages/providerPages').then((m) => ({ default: m.SPApply })));
const SPNotices = lazy(() => import('./pages/providerPages').then((m) => ({ default: m.SPNotices })));
const SPNoticeDetail = lazy(() => import('./pages/providerPages').then((m) => ({ default: m.SPNoticeDetail })));
const SPMessages = lazy(() => import('./pages/providerPages').then((m) => ({ default: m.SPMessages })));
const SPMessageDetail = lazy(() => import('./pages/providerPages').then((m) => ({ default: m.SPMessageDetail })));
const SPIncome = lazy(() => import('./pages/providerPages').then((m) => ({ default: m.SPIncome })));
const SPWithdraw = lazy(() => import('./pages/providerPages').then((m) => ({ default: m.SPWithdraw })));
const SPReviews = lazy(() => import('./pages/providerPages').then((m) => ({ default: m.SPReviews })));
const SPContractDetail = lazy(() => import('./pages/providerDetailPages').then((m) => ({ default: m.SPContractDetail })));
const SPTemplateDetail = lazy(() => import('./pages/providerDetailPages').then((m) => ({ default: m.SPTemplateDetail })));
const SPServiceDetail = lazy(() => import('./pages/providerDetailPages').then((m) => ({ default: m.SPServiceDetail })));
const SPWorkDetail = lazy(() => import('./pages/providerDetailPages').then((m) => ({ default: m.SPWorkDetail })));
const SPWorkUpgrade = lazy(() => import('./pages/providerDetailPages').then((m) => ({ default: m.SPWorkUpgrade })));
const SPQualificationDetail = lazy(() => import('./pages/providerSettingsPages').then((m) => ({ default: m.SPQualificationDetail })));
const SPScheduleDetail = lazy(() => import('./pages/providerSettingsPages').then((m) => ({ default: m.SPScheduleDetail })));
const SPClientsDetail = lazy(() => import('./pages/providerSettingsPages').then((m) => ({ default: m.SPClientsDetail })));
const SPClientCreate = lazy(() => import('./pages/providerSettingsPages').then((m) => ({ default: m.SPClientCreate })));
const SPComplaintDetail = lazy(() => import('./pages/providerSettingsPages').then((m) => ({ default: m.SPComplaintDetail })));
const SPComplaintCreate = lazy(() => import('./pages/providerSettingsPages').then((m) => ({ default: m.SPComplaintCreate })));
const SPApplyDetail = lazy(() => import('./pages/providerSettingsPages').then((m) => ({ default: m.SPApplyDetail })));

/**
 * 模板画布编辑器（@h5design/editor 内核 + Konva + GSAP，约 4MB）必须**按需加载**：
 * 静态导入会让登录页 / 仪表盘 / 所有列表页都先下载整个内核，明显拖慢首屏。
 * 这里改为路由级 code-split，只在进入 /sp/templates/:id/editor 时才拉取；
 * 该页同时负责注入 editorServices 与内核样式。
 */
const SPTemplateEditor = lazy(() =>
  import('./pages/providerDetailPages/SPTemplateEditor').then((m) => ({ default: m.SPTemplateEditor })),
);

/** 作品编辑器（复用内核，数据源为 /provider/works/:id） */
const SPWorkEditor = lazy(() =>
  import('./pages/providerDetailPages/SPWorkEditor').then((m) => ({ default: m.SPWorkEditor })),
);

// 登录即定层：首页落点映射到当前角色视角（文档 §4.1 / §7）。
// 优先用服务端登录响应下发的 home（ROLE_HOME 单一真值），缺失时按角色兜底。
const HomeRedirect = () => {
  const stored = getStoredUser<{ role?: string; home?: { origin?: string; path?: string } }>();
  const role = stored?.role;
  // 终端用户在运营端登录时会被桥接回 web 端，不会走到这里；
  // 这里保留 USER 分支只为 ADMIN 切换「用户视角」监督镜像时使用。
  const home =
    stored?.home?.path ??
    (role === 'AGENT'
      ? '/agent/dashboard'
      : role === 'SERVICE_PROVIDER'
        ? '/sp/studio'
        : role === 'USER'
          ? '/user/dashboard'
          : '/admin/dashboard');
  return <Navigate to={home} replace />;
};

const theme: ThemeConfig = antdTheme;

/**
 * 视察视角 subject 失效重取桥。
 *
 * 缺陷背景：console/agent/provider 视角的菜单页不订阅 objectScope，选中视察对象后
 * subject 只存在于 scopeStore 模块变量（dataProvider.withSubject() 发请求那一刻才读取），
 * 不在 react-query 的 queryKey 内 —— 改 subject 不触发重渲染/重请求，必须等路由切换
 * remount 才用新 subject 重拉（user 视角把 userId 显式并入 queryKey 所以即时）。
 *
 * 实现约束：LayerProvider 包在 <BrowserRouter> 之外，不能直接调 useInvalidate
 * （其内部依赖 Router 上下文，否则 useLocation 崩溃，见 2026-09-22 白屏回归）；
 * 故本桥必须挂在 Router 内部，订阅 objectScope 变化后使当前页全部激活 query 失效重取，
 * 让带 ?subject= 的接口（provider/wallet/export/messages）立即反映被视察对象的数据。
 */
const ObjectScopeInvalidationBridge = () => {
  const { view, objectScope } = useLayer();
  const invalidate = useInvalidate();
  const prevView = useRef<LayerKey | null>(view);
  const prevId = useRef<string | null>(objectScope?.id ?? null);
  const subjectId = objectScope?.id ?? null;
  useEffect(() => {
    // 视角切换：只更新 ref，不失效重取 —— 路由变化会让目标视角菜单页重新挂载，
    // 并以「目标视角」自己的 subject（已由 layerContext.setView 同步到 scopeStore）重新拉取；
    // 此处若失效反倒会先用旧视角的 subject 跑一次错误请求。
    if (view !== prevView.current) {
      prevView.current = view;
      prevId.current = subjectId;
      return;
    }
    if (subjectId === prevId.current) return;
    prevId.current = subjectId;
    // 'all' 失效当前 dataProvider 下全部激活 query（含 useTable 列表与 useCustom 概览）
    void invalidate({ invalidates: ['all'] });
  }, [view, subjectId, invalidate]);
  return null;
};

/** 响应式外壳：按当前语言切换 antd locale 与 RTL 方向（文档 §13） */
const Shell = ({ children }: { children: ReactNode }) => {
  const { i18n } = useTranslation();
  const lang = i18n.language;
  const dir = isRTL(lang) ? 'rtl' : 'ltr';
  const antdLocale = lang === 'en' ? enUS : zhCN;
  // 关键：把 dir 写到 <html> 上，原始 CSS（Tailwind 逻辑属性 border-e / start-* 等）
  // 才能随语言切换 RTL。antd 的 ConfigProvider direction 只管 antd 组件自身，
  // 不触及裸 DOM / 行内样式；不写 document.dir 则前面的逻辑属性改造全部失效。
  // 顺序：所有物理→逻辑属性改造完成后再落 dir（先落会先把 admin 翻成 RTL 又没改造，视觉崩坏）。
  useEffect(() => {
    document.documentElement.dir = dir;
  }, [dir]);
  return (
    <ConfigProvider theme={theme} direction={dir} locale={antdLocale}>
      {children}
    </ConfigProvider>
  );
};

export const App = () => (
  <Shell>
    <AntdApp>
      <Refine
        dataProvider={dataProvider}
        authProvider={authProvider}
        routerProvider={routerProvider}
        accessControlProvider={accessControlProvider}
        i18nProvider={i18nProvider}
        resources={resources}
        options={{
          syncWithLocation: true,
          warnWhenUnsavedChanges: true,
          disableTelemetry: true,
          title: { text: '庆柬云管理后台', icon: '🎉' },
        }}
      >
        {/* LayerProvider 必须在 Refine 内：它要用 useGetIdentity 感知登录态并重新定层 */}
        <LayerProvider>
          <BrowserRouter>
            <ObjectScopeInvalidationBridge />
            <Routes>
              <Route
                element={
                  <Authenticated
                    key="authenticated-layout"
                    fallback={<CatchAllNavigate to="/login" />}
                  >
                    <AdminLayout>
                      <InspectionGate>
                        <Outlet />
                      </InspectionGate>
                    </AdminLayout>
                  </Authenticated>
                }
              >
                {/* ===================== 管理总台（ADMIN） ===================== */}
                <Route index element={<HomeRedirect />} />
                <Route path="/account/profile" element={<ProfilePage />} />
                <Route path="/admin/dashboard" element={<Dashboard />} />
                <Route path="/admin/users" element={<UserList />} />
                <Route path="/admin/users/show/:id" element={<UserShow />} />                <Route path="/admin/users/edit/:id" element={<UserEdit />} />
                <Route path="/admin/zombie-users" element={<ZombieUsersList />} />
                <Route path="/admin/zombie-users/show/:id" element={<ZombieUserShow />} />
                <Route path="/admin/provider-review" element={<ProviderReviewList />} />
                <Route path="/admin/agents" element={<AgentList />} />
                <Route path="/admin/agents/create" element={<AgentCreate />} />
                <Route path="/admin/agents/edit/:id" element={<AgentEdit />} />
                <Route path="/admin/wallets" element={<WalletList />} />
                <Route path="/admin/withdrawals" element={<WithdrawalList />} />
                <Route path="/admin/audit-logs" element={<AuditLogList />} />
                <Route path="/admin/orders" element={<OrderList />} />
                <Route path="/regions" element={<RegionTreePage />} />
                <Route path="/admin/feedback" element={<FeedbackList />} />
                <Route path="/admin/messages" element={<MessageList />} />
                <Route path="/admin/settings" element={<SettingsPage />} />
                {/* 总台：字体管理（CP 目录扫描入库 / 清理失效） */}
                <Route path="/admin/fonts" element={<FontAdminList />} />
                {/* 总台：模板审核 / 角色与权限（M2 真实化） */}
                <Route path="/admin/templates" element={<TemplateReviewList />} />
                <Route path="/admin/roles" element={<RolesPage />} />
                {/* 入驻审批台：用户资格升级（USER → 服务商 / 代理商）两阶段审核 */}
                <Route path="/admin/qualifications" element={<QualificationReviewPage />} />
                <Route path="/admin/qualifications/:id" element={<QualificationDetailPage />} />
                {/* 总台：红线词库管理（决策点 8 · DB 可配置 + 总台可维护） */}
                <Route path="/admin/redline-words" element={<RedlineWordAdmin />} />
                {/* 总台治理模块占位（Phase 0）：内容审核 / 招商拓展 / 财务中心 / 合同中枢
                    后续 Phase 1–4 接真实后端端点，复用对应 agent/SP 组件（ALL 作用域）。 */}
                <Route
                  path="/admin/service-review"
                  element={<AgentServiceReview variant="admin" />}
                />
                <Route
                  path="/admin/work-review"
                  element={<AgentTemplateReview variant="admin" />}
                />
                <Route
                  path="/admin/invest"
                  element={<AgentInvest variant="admin" />}
                />
                <Route
                  path="/admin/pool"
                  element={<AgentPool variant="admin" />}
                />
                <Route
                  path="/admin/settle"
                  element={<AgentWallet variant="admin" />}
                />
                <Route
                  path="/admin/fee-config"
                  element={<FeeConfigPage />}
                />
                <Route
                  path="/admin/contracts"
                  element={<AgentContracts variant="admin" />}
                />

                {/* ===================== 代理商中心（AGENT） ===================== */}
                <Route path="/agent/dashboard" element={<AgentDashboard />} />
                <Route path="/agent/users" element={<AgentUsers />} />
                <Route path="/agent/providers" element={<AgentProviders />} />
                <Route path="/agent/orders" element={<AgentOrders />} />
                <Route path="/agent/wallet" element={<AgentWallet />} />
                <Route path="/agent/feedback" element={<FeedbackList />} />
                <Route path="/agent/messages" element={<MessageList />} />
                {/* 工作台设置：团队管理（加入申请队列） / 员工角色（成员权限） */}
                <Route path="/agent/team" element={<TeamManagePage />} />
                <Route path="/agent/roles" element={<RolesPage />} />
                {/* 内容审核（v2 红线把关核心，独立成组）：模板审核 / 服务审核 —— 真实审核台 */}
                <Route path="/agent/template-review" element={<AgentTemplateReview />} />
                <Route path="/agent/service-review" element={<AgentServiceReview />} />
                {/* 辖区服务商（代理商监督簇）：入驻审批 / 资质审核 / 合同管理 */}
                {/* 资质审核：复用总台「服务商资质审核队列」（后端已 AGENT 辖区收敛，无新增权限） */}
                <Route path="/agent/qualification" element={<ProviderReviewList />} />
                <Route path="/agent/apply" element={<AgentQualifications />} />
                <Route path="/agent/contract" element={<AgentContracts />} />
                {/* 辖区运营：意见反馈（复用辖区工单）/ 通知公告（复用收件箱） */}
                <Route path="/agent/complaints" element={<AgentComplaints />} />
                <Route path="/agent/notices" element={<AgentNotices />} />
                {/* 招商拓展（代理商专有）：招商申请 / 意向池（占位，需新建后端） */}
                <Route path="/agent/invest" element={<AgentInvest />} />
                <Route path="/agent/pool" element={<AgentPool />} />
                {/* 财务中心：结算总览（复用辖区钱包） / 提现初审（占位） */}
                <Route path="/agent/settle" element={<AgentWallet />} />
                <Route path="/agent/withdraw-review" element={<AgentWithdrawReview />} />

                {/* ===================== 服务商中心（SERVICE_PROVIDER） ===================== */}
                <Route path="/sp/studio" element={<SPStudio />} />
                <Route path="/sp/services" element={<SPServices />} />
                <Route path="/sp/services/new" element={<SPServiceDetail />} />
                <Route path="/sp/services/:id" element={<SPServiceDetail />} />
                <Route path="/sp/orders" element={<SPOrders />} />
                <Route path="/sp/qualification" element={<SPQualification />} />
                <Route path="/sp/qualification/new" element={<SPQualificationDetail />} />
                <Route path="/sp/qualification/:id" element={<SPQualificationDetail />} />
                <Route path="/sp/wallet" element={<SPWallet />} />
                <Route path="/sp/feedback" element={<SPReviews />} />
                <Route path="/sp/messages" element={<SPMessages />} />
                <Route path="/sp/messages/:id" element={<SPMessageDetail />} />
                {/* 工作台设置：团队管理（加入申请队列） / 员工角色（成员权限） */}
                <Route path="/sp/team" element={<TeamManagePage />} />
                <Route path="/sp/roles" element={<RolesPage />} />
                {/* 服务商视角新增模块（SELF 作用域端点） */}
                <Route path="/sp/schedule" element={<ScheduleList />} />
                <Route path="/sp/schedule/new" element={<SPScheduleDetail />} />
                <Route path="/sp/schedule/:id" element={<SPScheduleDetail />} />
                <Route path="/sp/works" element={<WorksList />} />
                <Route path="/sp/templates" element={<TemplatesList />} />
                <Route path="/sp/templates/new" element={<SPTemplateDetail />} />
                <Route path="/sp/templates/:id" element={<SPTemplateDetail />} />
                {/* 画布编辑器：复用共享内核 @h5design/editor（运营端实现指向 Template 草稿/发布端点）
                    懒加载，避免把 Konva/GSAP 内核打进其它页面的首屏 */}
                <Route
                  path="/sp/templates/:id/editor"
                  element={
                    <Suspense
                      fallback={
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#8c8c8c' }}>
                          正在加载编辑器…
                        </div>
                      }
                    >
                      <SPTemplateEditor />
                    </Suspense>
                  }
                />
                {/* 作品编辑器：数据源为 /provider/works/:id（含 draftSchema 归一） */}
                <Route
                  path="/sp/works/:id/editor"
                  element={
                    <Suspense
                      fallback={
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#8c8c8c' }}>
                          正在加载编辑器…
                        </div>
                      }
                    >
                      <SPWorkEditor />
                    </Suspense>
                  }
                />
                {/* 内核 handleBack 会 navigate('/dashboard')，重定向回服务商模板列表 */}
                <Route path="/dashboard" element={<Navigate to="/sp/templates" replace />} />
                <Route path="/sp/works/:id" element={<SPWorkDetail />} />
                <Route path="/sp/works/:id/upgrade" element={<SPWorkUpgrade />} />
                <Route path="/sp/complaints" element={<SPComplaints />} />
                <Route path="/sp/complaints/new" element={<SPComplaintCreate />} />
                <Route path="/sp/complaints/:id" element={<SPComplaintDetail />} />
                <Route path="/sp/apply" element={<SPApply />} />
                <Route path="/sp/apply/new" element={<SPApplyDetail />} />
                <Route path="/sp/apply/:id" element={<SPApplyDetail />} />
                <Route path="/sp/contract" element={<SPContract />} />
                <Route path="/sp/contract/:id" element={<SPContractDetail />} />
                <Route path="/sp/income" element={<SPIncome />} />
                <Route path="/sp/withdraw" element={<SPWithdraw />} />
                <Route path="/sp/notices" element={<SPNotices />} />
                <Route path="/sp/notices/:id" element={<SPNoticeDetail />} />
                <Route path="/sp/clients" element={<SPClients />} />
                <Route path="/sp/clients/new" element={<SPClientCreate />} />
                <Route path="/sp/clients/:id" element={<SPClientsDetail />} />

                {/* ===================== 用户视角（USER · 原型四组） =====================
                    交易中心：我的工作台 / 我的服务商 / 我的订单
                    评价与反馈：我的评价 / 我的反馈（新增反馈 + 反馈详情）
                    消息中心：通知公告（填写资料） / 业务消息
                    个人中心：我的钱包 / 优惠与权益 / 入驻申请 / 账户详情
                    （入驻申请 2026-09-24 与 web 端对齐后新增，位于优惠与权益与账户详情之间） */}
                <Route path="/user/dashboard" element={<UserDashboard />} />
                <Route path="/user/orders" element={<UserOrders />} />
                <Route path="/user/works" element={<UserWorks />} />
                <Route path="/user/providers" element={<UserProviders />} />
                <Route path="/user/reviews" element={<UserReviews />} />
                <Route path="/user/complaints" element={<UserComplaints />} />
                <Route path="/user/complaints/new" element={<UserComplaintNew />} />
                <Route path="/user/complaints/:id" element={<UserComplaintDetail />} />
                <Route path="/user/notices" element={<UserNotices />} />
                <Route path="/user/notices/fill" element={<UserNoticeFill />} />
                <Route path="/user/messages" element={<UserMessages />} />
                <Route path="/user/wallet" element={<UserWallet />} />
                <Route path="/user/coupons" element={<UserCoupons />} />
                {/* 入驻申请（JOIN 加入 / SETTLE 入驻双隧道，与 web 端 /user/apply 同构） */}
                <Route path="/user/apply" element={<UserApply />} />

                <Route path="*" element={<ErrorComponent />} />
              </Route>
              <Route
                path="/login"
                element={
                  <Authenticated key="auth-pages" fallback={<Outlet />}>
                    {/* 已登录访问 /login 时同样按角色落到各自视角首页，不能硬编码总台 */}
                    <HomeRedirect />
                  </Authenticated>
                }
              >
                <Route index element={<Login />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </LayerProvider>
      </Refine>
    </AntdApp>
  </Shell>
);
