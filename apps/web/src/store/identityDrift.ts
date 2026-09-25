/**
 * 身份漂移守卫（Web 端）——统一检测「账号角色/资质在服务端被变更」。
 *
 * ## 背景（为什么会报错）
 * JWT 每次请求都由服务端从数据库重读角色，但前端缓存的是**登录那一刻的快照**。
 * 一旦后台改了资质，前端继续按旧身份访问：
 *   - 普通用户 → 服务商：`/api/user/*`（服务端 @Roles ADMIN|AGENT|USER）开始 403；
 *   - 服务商 / 代理商 → 普通用户：web 端仍能跑，但身份已不属于这里。
 * 以前前端只认得 401（会话过期），403 会以原始错误冒到页面上，用户看到「API 403: ...」。
 *
 * ## 统一处理（只此一处，业务页无需各自实现）
 *  1. **被动**：client.ts 响应拦截层发现 `403 + code=ROLE_MISMATCH`，用响应体里回带的
 *     权威身份（服务端 RolesGuard 提供，零额外请求）比对本地快照；
 *  2. **主动**：页面路由变化时节流调用 `/api/auth/me` 比对（覆盖「升级但未触发 403」的情形，
 *     例如 USER → AGENT，`/api/user/*` 对 AGENT 仍然放行）。
 *  两者都汇到 `reportIdentityDrift()`，同一会话只触发一次。
 *
 * ## 触发后
 * 由 `<IdentityDriftNotice />` 弹出统一友好提示 → 用户确认（或倒计时结束）→
 * `finishIdentityDrift()` 清空本地登录态与角色/资质缓存 → 跳转到本端登录页。
 */
import { create } from 'zustand';
import { clearSession, getToken, getStoredUser, setStoredUser } from '../api/session';
import type { UserInfo } from '../api/client';

/** 服务端 RolesGuard 回带的机器可读错误码 */
export const ROLE_MISMATCH_CODE = 'ROLE_MISMATCH';

/**
 * 漂移发生时替换原始错误的统一文案（英文，可被 i18n 覆盖）。
 * 用途：即便某个业务页面直接把 err.message 渲染出来，用户看到的也是这句友好提示，
 * 而不是「API 403: {"message":"权限不足..."}」。真正在用户面前呈现的仍是下面的统一弹窗。
 */
export const IDENTITY_CHANGED_MESSAGE =
  'Identity changed: your account qualification has been updated, please sign in again.';

/** 服务端回带的权威身份片段 */
export interface ServerIdentity {
  id?: string | null;
  role?: string | null;
  providerStatus?: string | null;
  serviceRoles?: string[];
  home?: { origin?: 'web' | 'admin' | null; path?: string | null } | null;
}

export interface IdentityDriftInfo {
  /** 变更前角色（本地快照） */
  fromRole?: string | null;
  /** 变更后角色（服务端权威值） */
  toRole?: string | null;
}

interface IdentityDriftState {
  /** 是否已检测到漂移（弹窗据此展示；同一会话只会置一次） */
  active: boolean;
  info: IdentityDriftInfo | null;
  report: (info: IdentityDriftInfo) => void;
}

/** 统计口径互斥：已处理则不再重复上报，避免反复弹窗 */
let __handled = false;

export const useIdentityDriftStore = create<IdentityDriftState>((set) => ({
  active: false,
  info: null,
  report: (info) => {
    if (__handled) return;
    __handled = true;
    if (import.meta.env.DEV) console.warn('[identity] drift detected:', info);
    set({ active: true, info });
  },
}));

/** 供回调式场景（非 React）读取当前是否已漂移 */
export function isIdentityDrift(): boolean {
  return __handled;
}

/**
 * 清理本地登录态与角色/资质缓存，并跳到本端登录页。
 * 幂等：重复调用不会重复跳转（避免「清理 → 重渲染 → 再次 403 → 再次清理」的循环）。
 */
let __finishing = false;
export function finishIdentityDrift(): void {
  if (__finishing) return;
  __finishing = true;
  try {
    // 清 storage 先于跳转：跳转后的登录页不应再拿着旧快照请求任何需鉴权的接口
    clearSession();
  } catch {
    /* storage 不可用时忽略，跳转仍要发生 */
  }
  const from = window.location.pathname;
  // reason 仅用于登录页展示同一套友好文案（不参与鉴权），避免 query 失控
  const target = `/login?reason=identity-changed`;
  if (from !== '/login') {
    window.location.replace(target);
  } else {
    // 已在登录页：刷新一次以丢弃内存中残留的旧状态
    window.location.reload();
  }
}

/**
 * 比对「服务端权威身份」与「本地快照」，必要时上报漂移。
 * 未漂移时顺带把新鲜字段写回本地，避免下一次误判。
 */
function compareAndReport(prev: UserInfo | null, next: Partial<UserInfo>): boolean {
  if (!prev || !next?.role) return false;

  const prevRole = prev.role ?? null;
  const nextRole = next.role ?? null;
  const prevHome = prev.home?.origin ?? null;
  const nextHome = next.home?.origin ?? null;

  // 只有「角色」或「该账号应去的端」变化才算资质漂移；
  // providerStatus / serviceRoles 等进展性变化只静默刷新本地缓存，不打断用户。
  const drifted = prevRole !== nextRole || (nextHome != null && prevHome !== nextHome);
  if (drifted) {
    useIdentityDriftStore.getState().report({ fromRole: prevRole, toRole: nextRole });
    return true;
  }

  // 静默同步：补齐本次拿到的新鲜字段（保留 home 等旧值，避免被抹掉）
  setStoredUser({ ...prev, ...next, home: next.home ?? prev.home } as UserInfo);
  return false;
}

/** 服务端 403 响应体里带出的身份 → 直接判定（无需再发请求） */
export function reportFromServerIdentity(identity: ServerIdentity): void {
  if (!identity?.role) return;
  compareAndReport(getStoredUser(), {
    role: identity.role as UserInfo['role'],
    providerStatus: identity.providerStatus as UserInfo['providerStatus'],
    serviceRoles: (identity.serviceRoles ?? []) as UserInfo['serviceRoles'],
    home: identity.home ?? undefined,
  } as Partial<UserInfo>);
}

// ───────────────── 主动巡检（路由守卫层调用） ─────────────────

const CHECK_INTERVAL_MS = 30_000;
let __lastCheck = 0;
let __inflight: Promise<void> | null = null;

/**
 * 节流自查：与本服务端口径一致，最多每 30s 一次，且同一时刻只有一个在途请求。
 * 网络抖动不影响判定（catch 后静默），真正报错时还有被动路径兜底。
 */
export function ensureIdentityFresh(force = false): void {
  if (__handled || __finishing) return;
  const token = getToken();
  if (!token) return;
  const now = Date.now();
  if (!force && now - __lastCheck < CHECK_INTERVAL_MS) return;
  __lastCheck = now;
  if (__inflight) return;

  __inflight = (async () => {
    try {
      const res = await fetch('/api/auth/me', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return; // 401/403 等交给 client.ts 的拦截层统一处理
      const fresh = (await res.json()) as Partial<UserInfo>;
      compareAndReport(getStoredUser(), fresh);
    } catch {
      /* 网络异常忽略，下个节流窗口再试 */
    } finally {
      __inflight = null;
    }
  })();
}

/** 登录成功后重置：允许后续会话再次检测（跳转登录页会重载，兜底用） */
export function resetIdentityDrift(): void {
  __handled = false;
  __finishing = false;
  __lastCheck = 0;
  useIdentityDriftStore.setState({ active: false, info: null });
}
