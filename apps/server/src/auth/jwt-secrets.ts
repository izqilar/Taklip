/**
 * JWT 密钥解析（安全：生产环境禁止回退默认值）。
 *
 * 历史缺陷（审查 M3）：原代码在 `process.env.JWT_SECRET ?? 'h5design_jwt_secret_dev'`
 * 处保留了一个**可预测的硬编码回退值**。若生产环境漏配 `JWT_SECRET`，攻击者可据此
 * 伪造任意角色（含 ADMIN）的令牌，造成完全的身份认证绕过。
 *
 * 修复：生产环境（`NODE_ENV=production`）缺失密钥时**直接抛错**，使进程在启动阶段即失败，
 * 杜绝"配置即沦陷"；非生产环境保留开发回退值以维持本地开发体验。
 */
const DEV_FALLBACK_ACCESS = 'h5design_jwt_secret_dev';
const DEV_FALLBACK_REFRESH = 'h5design_refresh_secret_dev';

function resolveSecret(envKey: string, devFallback: string, label: string): string {
  const value = process.env[envKey];
  if (value) return value;
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      `[security] ${label} 缺失：生产环境必须显式配置 ${envKey}，` +
        `禁止使用开发回退密钥（可被用于伪造令牌）。请在部署配置中注入该环境变量后重启。`,
    );
  }
  // 仅本地开发/测试允许回退，便于免配置启动；生产绝不可达此分支。
  return devFallback;
}

export const JWT_SECRET = resolveSecret('JWT_SECRET', DEV_FALLBACK_ACCESS, 'JWT_SECRET');
export const JWT_REFRESH_SECRET = resolveSecret(
  'JWT_REFRESH_SECRET',
  DEV_FALLBACK_REFRESH,
  'JWT_REFRESH_SECRET',
);
