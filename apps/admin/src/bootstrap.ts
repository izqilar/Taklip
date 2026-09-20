/**
 * 跨端登录态桥接（Web 端 5173 → 运营端 5174）。
 *
 * Web 端跨端打开运营端（静默桥接 / 打开编辑器）会把一次性票据以 URL 参数带过来：
 *   ?ticket=<一次性票据>
 * 本模块在应用启动最早阶段用票据调 /api/auth/exchange 换取登录令牌，写入运营端(5174)
 * 的登录态存储（h5_admin_token / h5_admin_user），从而【保持用户登录状态】。
 * URL 里不再是明文 JWT。
 *
 * 必须是 async 并在 App 渲染前 await，故由 main.tsx 最先调用并等待完成。
 */
import { API_URL, TOKEN_KEY, USER_KEY } from './utility';

export async function consumeBridgeSession(): Promise<void> {
  try {
    const params = new URLSearchParams(window.location.search);
    const ticket = params.get('ticket');
    if (!ticket) return;

    const res = await fetch(`${API_URL}/auth/exchange`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticket }),
    });
    const data = await res.json().catch(() => null);
    if (res.ok && data?.accessToken) {
      localStorage.setItem(TOKEN_KEY, data.accessToken);
      // 与登录流程一致：把服务端给的 home 并入 user 落盘，刷新后工作台路由仍可读
      localStorage.setItem(
        USER_KEY,
        JSON.stringify({ ...(data.user ?? {}), home: data.home }),
      );
    }
    // 清理 URL，避免刷新页面时重复触发
    const url = new URL(window.location.href);
    url.searchParams.delete('ticket');
    window.history.replaceState({}, '', url.pathname + url.search + url.hash);
  } catch {
    // 解析失败则忽略，按未登录处理
  }
}
