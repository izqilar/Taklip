/**
 * 跨端登录态桥接（运营端 5174 → Web 端 5173）。
 *
 * 运营端「返回 Web 端首页」/ 终端用户静默桥接会把一次性票据以 URL 参数带过来：
 *   ?ticket=<一次性票据>
 * 本模块在应用启动最早阶段用票据调 /api/auth/exchange 换取登录令牌，写入 Web 端(5173)
 * 的登录态存储（access_token / user_info），从而【保持用户登录状态】。
 * 相比旧方案，URL 里不再是明文 JWT（避免进历史 / Referer / 网关日志）。
 *
 * 必须是 async 并在 App 渲染前 await，故由 main.tsx 最先调用并等待完成。
 */
export async function consumeBridgeSession(): Promise<void> {
  try {
    const params = new URLSearchParams(window.location.search);
    const ticket = params.get('ticket');
    if (!ticket) return;

    const res = await fetch('/api/auth/exchange', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticket }),
    });
    const data = await res.json().catch(() => null);
    if (res.ok && data?.accessToken) {
      localStorage.setItem('access_token', data.accessToken);
      // 与登录流程一致：把服务端给的 home 并入 user 落盘，刷新后首页路由仍可读
      localStorage.setItem(
        'user_info',
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
