// 后端 API 基址（与 apps/server 一致的 /api 基路径，非文档里的 /api/v1）
export const API_URL =
  (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3000/api';

// 静态资源基址（用于 /uploads/... 等相对路径）
export const STATIC_URL = API_URL.replace(/\/api$/, '') || 'http://localhost:3000';

export const TOKEN_KEY = 'h5_admin_token';
export const USER_KEY = 'h5_admin_user';

// Web 端（用户端 H5）基址：运营端「返回 Web 端首页」跨端跳转、以及发布后分享二维码
// 都依赖它拼接 `WEB_BASE/p/<publishCode>`。
// 局域网/公网一键切换：通过 VITE_WEB_BASE 覆盖；不设置时回退 localhost（本机自测）。
//   - 局域网调试（手机/同网段设备扫码）：VITE_WEB_BASE=http://<本机局域网IP>:5173
//   - 生产公网：VITE_WEB_BASE=https://<你的公网域名>
export const WEB_BASE =
  (import.meta.env.VITE_WEB_BASE as string | undefined) ?? 'http://localhost:5173';

let __webBaseCache: { value: string; ts: number } | null = null;

/**
 * 解析 web 端基址，三层回退 + 30s 模块级缓存（多卡片/弹窗共享，避免重复打 /__lan_info）：
 *  1. VITE_WEB_BASE（手动覆盖 / 生产公网域名）；
 *  2. 开发期向 admin dev server 的 /__lan_info 探测本机 LAN IP（IP 变化自动跟随）；
 *  3. 兜底 http://localhost:5173。
 */
export async function resolveWebBase(): Promise<string> {
  const now = Date.now();
  if (__webBaseCache && now - __webBaseCache.ts < 30000) return __webBaseCache.value;
  const env = (import.meta.env.VITE_WEB_BASE as string | undefined)?.trim();
  let base = WEB_BASE;
  if (env) {
    base = env;
  } else {
    try {
      const res = await fetch('/__lan_info');
      if (res.ok) {
        const data = (await res.json()) as { ip?: string | null };
        if (data?.ip) base = `http://${data.ip}:5173`;
      }
    } catch {
      /* 生产构建无该接口，降级到兜底 */
    }
  }
  __webBaseCache = { value: base, ts: now };
  return base;
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setSession(token: string, user: unknown) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function getStoredUser<T = any>(): T | null {
  const raw = localStorage.getItem(USER_KEY);
  return raw ? (JSON.parse(raw) as T) : null;
}

export function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** 今日 MM-DD（看板「截至今日」文案统一口径） */
export function todayKey(d: Date = new Date()): string {
  return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** 分 → ¥ 字符串（保留两位，如 12345 → ¥123.45） */
export function formatCents(cents?: number | null): string {
  if (cents == null) return '-';
  return `¥${(cents / 100).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function jsonHeaders(): Record<string, string> {
  return { 'Content-Type': 'application/json', ...authHeaders() };
}

export interface AccessInfo {
  id: string;
  role: 'USER' | 'SERVICE_PROVIDER' | 'AGENT' | 'ADMIN';
  regionId: string | null;
  regionPath: string | null;
  scope: 'ALL' | 'REGION' | 'SELF';
  permissions: string[];
}

/**
 * 向服务端申请一次性跨端票据（需已登录的 accessToken）。
 * 用于把登录态从该端安全带到另一端，避免把 JWT 明文放进 URL。
 * 失败返回 null（调用方降级为不带登录态跳转，让用户到对端重新登录）。
 */
export async function issueBridgeTicket(token: string): Promise<string | null> {
  if (!token) return null;
  try {
    const res = await fetch(`${API_URL}/auth/ticket`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.ticket ?? null;
  } catch {
    return null;
  }
}
