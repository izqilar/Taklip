/**
 * Auth Store — 管理当前用户登录状态与 JWT token
 */
import { create } from 'zustand';
import {
  api,
  setTokens,
  clearTokens,
  getStoredUser,
  setStoredUser,
  type UserInfo,
  type ServiceRole,
} from '@/api/client';

interface AuthState {
  user: UserInfo | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  /** 是否为服务商（可发布模板，进审核） */
  isProvider: boolean;
  /** 服务商资质是否已通过审核（混合审核模型：付费模板需 APPROVED 才可观） */
  isProviderApproved: boolean;
  /** 是否为管理员（可审核模板、巡查内容、管理角色） */
  isAdmin: boolean;
  /** 是否为代理商（区域管辖，仅管理辖区内用户/服务商） */
  isAgent: boolean;
  /**
   * 错误信息以 i18n key 形式存储（如 'errors:error.loginFailed'），
   * store 层不持有任何语言文案，由视图层 t() 翻译。
   */
  error: string | null;

  register: (
    phone: string,
    password: string,
    nickname?: string,
    extra?: { realName?: string; regionId?: string; intent?: 'user' | 'provider' | 'agent' },
  ) => Promise<boolean>;
  login: (phone: string, password: string) => Promise<boolean>;
  logout: () => void;
  clearError: () => void;
  /**
   * 从 localStorage 重新同步登录态到 store。
   * 用于跨端桥接场景：bootstrap 在 App 渲染前异步写入 user_info 后，
   * 模块顶层缓存的 store 状态已过时，需手动刷新一次（避免首屏误判未登录停在 /login）。
   */
  rehydrate: () => void;
  /**
   * 申请入驻服务商（复合服务子角色多选）。
   * ⚠️ 语义变更：仅提交入驻申请进入两段审管线，不再即时升级身份
   *（身份变更在总台终审 APPROVED 时落地）。
   */
  applyForProvider: (serviceRoles: ServiceRole[]) => Promise<boolean>;
  // ⚠️ submitProviderReview 已下线（后端自助审批端点移除），资质审核改由总台终审落地。
  /** 已通过审核的服务商申请扩展业务（增加服务子角色） */
  expandServices: (serviceRoles: ServiceRole[]) => Promise<boolean>;
  /** 管理员批准服务商的 pendingServiceRoles */
  approveServiceRoles: (userId: string) => Promise<boolean>;
  /** 更新账户资料（昵称 / 头像 / 手机 / 真实姓名 / 个人简介 / 邮箱） */
  updateProfile: (
    dto: {
      nickname?: string;
      avatar?: string;
      phone?: string;
      realName?: string;
      bio?: string;
      email?: string;
      /** 身份证号 + 证件影像（人像面 / 国徽面）：账户详情「身份认证资料」区块 */
      idCard?: string;
      idCardFront?: string;
      idCardBack?: string;
    },
  ) => Promise<boolean>;
  /** 修改密码 */
  changePassword: (oldPassword: string, newPassword: string) => Promise<boolean>;
}

function roleFlags(user: UserInfo | null) {
  return {
    isProvider: user?.role === 'SERVICE_PROVIDER',
    isProviderApproved: user?.role === 'SERVICE_PROVIDER' && user?.providerStatus === 'APPROVED',
    isAdmin: user?.role === 'ADMIN',
    isAgent: user?.role === 'AGENT',
  };
}

export const useAuthStore = create<AuthState>((set) => ({
  user: getStoredUser(),
  isAuthenticated: !!getStoredUser(),
  isLoading: false,
  isProvider: roleFlags(getStoredUser()).isProvider,
  isProviderApproved: roleFlags(getStoredUser()).isProviderApproved,
  isAdmin: roleFlags(getStoredUser()).isAdmin,
  isAgent: roleFlags(getStoredUser()).isAgent,
  error: null,

  register: async (phone, password, nickname, extra) => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.register(phone, password, nickname, extra);
      // 服务端把落点 home 与 user 平级下发，并入 user 后落盘，刷新后仍可读
      const user = res.home ? { ...res.user, home: res.home } : res.user;
      setTokens(res.accessToken, res.refreshToken);
      setStoredUser(user);
      set({ user, isAuthenticated: true, isLoading: false, ...roleFlags(user) });
      return true;
    } catch (err) {
      if (import.meta.env.DEV) console.error('[auth] register failed:', err);
      set({ error: 'errors:error.registerFailed', isLoading: false });
      return false;
    }
  },

  login: async (phone, password) => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.login(phone, password);
      // 同上：把服务端下发的落点 home 并入 user（统一登录入口按 home.origin 分流）
      const user = res.home ? { ...res.user, home: res.home } : res.user;
      setTokens(res.accessToken, res.refreshToken);
      setStoredUser(user);
      set({ user, isAuthenticated: true, isLoading: false, ...roleFlags(user) });
      return true;
    } catch (err) {
      if (import.meta.env.DEV) console.error('[auth] login failed:', err);
      set({ error: 'errors:error.loginFailed', isLoading: false });
      return false;
    }
  },

  logout: () => {
    clearTokens();
    localStorage.removeItem('user_info');
    set({ user: null, isAuthenticated: false, isProvider: false, isProviderApproved: false, isAdmin: false, isAgent: false, error: null });
  },

  clearError: () => set({ error: null }),

  rehydrate: () => {
    const user = getStoredUser();
    set({ user, isAuthenticated: !!user, ...roleFlags(user) });
  },

  applyForProvider: async (serviceRoles) => {
    set({ isLoading: true, error: null });
    try {
      // 仅提交入驻申请：身份此时不变，故不刷新本地 user（待总台终审通过后生效）
      await api.applyForProvider(serviceRoles);
      set({ isLoading: false });
      return true;
    } catch (err) {
      if (import.meta.env.DEV) console.error('[auth] applyForProvider failed:', err);
      set({ error: 'errors:error.applyProviderFailed', isLoading: false });
      return false;
    }
  },

  // ⚠️ submitProviderReview 实现已移除（后端自助审批端点下线，禁止自助通过资质审核）。

  expandServices: async (serviceRoles) => {
    set({ isLoading: true, error: null });
    try {
      const updated = await api.expandServices(serviceRoles);
      setStoredUser(updated);
      set({ user: updated, isLoading: false, ...roleFlags(updated) });
      return true;
    } catch (err) {
      if (import.meta.env.DEV) console.error('[auth] expandServices failed:', err);
      set({ error: 'errors:error.expandServicesFailed', isLoading: false });
      return false;
    }
  },

  approveServiceRoles: async (userId) => {
    set({ isLoading: true, error: null });
    try {
      const updated = await api.approveServiceRoles(userId);
      setStoredUser(updated);
      set({ user: updated, isLoading: false, ...roleFlags(updated) });
      return true;
    } catch (err) {
      if (import.meta.env.DEV) console.error('[auth] approveServiceRoles failed:', err);
      set({ error: 'errors:error.approveServiceRolesFailed', isLoading: false });
      return false;
    }
  },

  updateProfile: async (dto) => {
    set({ isLoading: true, error: null });
    try {
      const updated = await api.updateProfile(dto);
      setStoredUser(updated);
      set({ user: updated, isLoading: false, ...roleFlags(updated) });
      return true;
    } catch (err) {
      if (import.meta.env.DEV) console.error('[auth] updateProfile failed:', err);
      set({ error: 'errors:error.updateProfileFailed', isLoading: false });
      return false;
    }
  },

  changePassword: async (oldPassword, newPassword) => {
    set({ isLoading: true, error: null });
    try {
      await api.changePassword(oldPassword, newPassword);
      set({ isLoading: false });
      return true;
    } catch (err) {
      if (import.meta.env.DEV) console.error('[auth] changePassword failed:', err);
      set({ error: 'errors:error.changePasswordFailed', isLoading: false });
      return false;
    }
  },
}));
