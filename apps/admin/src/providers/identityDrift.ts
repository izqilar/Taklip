/**
 * 身份漂移守卫（运营端）——统一检测「账号角色/资质在服务端被变更」。
 *
 * ## 背景（为什么运营端会报错）
 * JWT 每次请求都由服务端从数据库重读角色，但前端缓存的是**登录那一刻的快照**
 * （localStorage 的 h5_admin_user + accessControlProvider 的权限摘要 cache）。
 * 后台一旦改了资质，前端继续按旧身份访问：
 *   - 服务商 / 代理商降级为普通用户 → `/api/provider/*`、`/api/agent/*` 开始 403；
 *   - 普通用户升级为服务商 / 代理商 → 该账号本就不属于运营端视角也会串进来。
 * 此前前端只认 401（会话过期），403 会以 Refine 的原始错误冒到页面上。
 *
 * ## 统一处理（只此一处，业务页无需各自实现）
 *  1. **被动**：dataProvider.parse() 发现 `403 + code=ROLE_MISMATCH`，用响应体回带的
 *     权威身份（服务端 RolesGuard 提供，零额外请求）比对本地快照；
 *  2. **主动**：`<IdentityWatch />` 在路由变化时节流调用 `/api/auth/me`，
 *     覆盖「没有立刻报错」的变更情形。
 *  两者都汇到 report()，同一会话只触发一次。
 *
 * ## 触发后
 * `<IdentityDriftNotice />` 弹统一友好提示 → 确认（或倒计时）→
 * `finishIdentityDrift()` 清空登录态 + 权限摘要缓存 + 视角/视察对象缓存 → 跳运营端登录页。
 */
import { create } from 'zustand';
import {
  API_URL,
  clearSession,
  getStoredUser,
  getToken,
  USER_KEY,
} from '../utility';
import { onAuthChanged } from './accessControlProvider';
import { setSubject } from './scopeStore';

/** 服务端 RolesGuard 回带的机器可读错误码 */
export const ROLE_MISMATCH_CODE = 'ROLE_MISMATCH';

/**
 * 漂移发生时替换原始错误的统一文案。
 * 即便某个页面把 err.message 直接渲染出来，用户看到的也是这句友好提示。
 */
export const IDENTITY_CHANGED_MESSAGE =
  '账号资质已变更，请重新登录';

/** 服务端回带的权威身份片段 */
export interface ServerIdentity {
  id?: string | null;
  role?: string | null;
  providerStatus?: string | null;
  serviceRoles?: string[];
  home?: { origin?: 'web' | 'admin' | null; path?: string | null } | null;
}

export interface IdentityDriftInfo {
  fromRole?: string | null;
  toRole?: string | null;
}

interface IdentityDriftState {
  active: boolean;
  info: IdentityDriftInfo | null;
  report: (info: IdentityDriftInfo) => void;
}

/** 同一会话只处理一次，避免重复弹窗 / 重复跳转 */
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

/** 非 React 场景（拦截器）读取当前是否已在漂移处理流程中 */
export function isIdentityDrift(): boolean {
  return __handled;
}

/** 曾服务当 READ profile 的本地快照 key（与 utility USER_KEY 同源） */
type StoredUser = {
  id?: string;
  role?: string | null;
  providerStatus?: string | null;
  serviceRoles?: string[];
  home?: { origin?: 'web' | 'admin' | null; path?: string | null } | null;
};

/**
 * 清理本端全部登录态与角色/资质缓存快照。
 *
 * 除令牌与 user 之外，还必须失效：
 *  - accessControlProvider 的权限摘要 cache（含 role / permissions），否则菜单仍按旧身份投影；
 *  - layer.view（视角）与 sider 折叠态、scopeStore 的视察对象 subject —— 都是旧身份的派生物。
 */
function clearIdentityCaches(): void {
  clearSession();
  try {
    onAuthChanged();
  } catch {
    /* ignore */
  }
  try {
    setSubject(null);
  } catch {
    /* ignore */
  }
  try {
    localStorage.removeItem('layer.view');
    // 侧栏折叠态按视角分组，一并清理避免串味
    Object.keys(localStorage)
      .filter((k) => k.startsWith('sider.fold.'))
      .forEach((k) => localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}

/** 幂等：重复调用不会重复跳转，避免「清理 → 重渲染 → 再 403 → 再清理」的循环 */
let __finishing = false;
export function finishIdentityDrift(): void {
  if (__finishing) return;
  __finishing = true;
  clearIdentityCaches();
  const target = '/login?reason=identity-changed';
  if (window.location.pathname !== '/login') {
    window.location.replace(target);
  } else {
    window.location.reload();
  }
}

/** 比对服务端权威身份与本地快照，必要时上报；未漂移则静默补写新鲜字段 */
function compareAndReport(prev: StoredUser | null, next: StoredUser): boolean {
  if (!prev || !next?.role) return false;
  const prevRole = prev.role ?? null;
  const nextRole = next.role ?? null;
  const prevHome = prev.home?.origin ?? null;
  const nextHome = next.home?.origin ?? null;

  // 角色变化、或该账号应去的端变化 → 资质漂移；providerStatus 等进展性变化只静默补写
  const drifted = prevRole !== nextRole || (nextHome != null && prevHome !== nextHome);
  if (drifted) {
    useIdentityDriftStore.getState().report({ fromRole: prevRole, toRole: nextRole });
    return true;
  }
  try {
    localStorage.setItem(
      USER_KEY,
      JSON.stringify({ ...prev, ...next, home: next.home ?? prev.home }),
    );
  } catch {
    /* ignore */
  }
  return false;
}

/** 服务端 403 响应体带出的权威身份 → 直接判定（无需再发请求） */
export function reportFromServerIdentity(identity: ServerIdentity): void {
  if (!identity?.role) return;
  compareAndReport(getStoredUser<StoredUser>(), {
    role: identity.role,
    providerStatus: identity.providerStatus,
    serviceRoles: identity.serviceRoles ?? [],
    home: identity.home ?? null,
  });
}

// ───────────────── 主动巡检（App 根挂载） ─────────────────

const CHECK_INTERVAL_MS = 30_000;
let __lastCheck = 0;
let __inflight: Promise<void> | null = null;

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
      const res = await fetch(`${API_URL}/auth/me`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return; // 401/403 交给 dataProvider 拦截层与 authProvider.onError
      const fresh = (await res.json()) as StoredUser;
      compareAndReport(getStoredUser<StoredUser>(), fresh);
    } catch {
      /* 网络异常忽略 */
    } finally {
      __inflight = null;
    }
  })();
}

/** 登录成功后重置（跳转登录页会整页重载，此函数用于同 SPA 会话内兜底） */
export function resetIdentityDrift(): void {
  __handled = false;
  __finishing = false;
  __lastCheck = 0;
  useIdentityDriftStore.setState({ active: false, info: null });
}
