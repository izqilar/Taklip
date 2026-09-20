/**
 * 跨端登录态桥接（运营端 5174 → Web 端 5173）。
 *
 * 运营端「返回 Web 端首页」会把当前登录态以 URL 参数带过来：
 *   ?token=<JWT>&user=<urlencoded JSON>
 * 本模块在应用启动最早阶段消费这些参数，写入 Web 端(5173) 的登录态存储
 * （access_token / user_info），从而【保持用户登录状态】。
 *
 * 必须在 App（及其导入的 authStore）之前执行，故由 main.tsx 第一个 import 触发。
 */
(function bridgeAdminSession() {
  try {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const userRaw = params.get('user');
    if (token) {
      localStorage.setItem('access_token', token);
      if (userRaw) {
        const user = JSON.parse(decodeURIComponent(userRaw));
        localStorage.setItem('user_info', JSON.stringify(user));
      }
      // 清理 URL，避免刷新页面时重复触发
      const url = new URL(window.location.href);
      url.searchParams.delete('token');
      url.searchParams.delete('user');
      window.history.replaceState({}, '', url.pathname + url.search + url.hash);
    }
  } catch {
    // 解析失败则忽略，按未登录处理
  }
})();
