/**
 * 登录页 — 手机号 + 密码登录
 */
import { useState, useCallback } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/authStore';
import { buildAdminUrl } from '@/api/client';
import LanguageSwitcher from '@/components/LanguageSwitcher';

export default function Login() {
  const { t } = useTranslation(['common', 'errors']);
  const navigate = useNavigate();
  const location = useLocation();
  const login = useAuthStore((s) => s.login);
  const isLoading = useAuthStore((s) => s.isLoading);
  const error = useAuthStore((s) => s.error);
  const clearError = useAuthStore((s) => s.clearError);

  // 登录后优先跳回触发登录的来源页（如模板库 / 一键制作）；无来源页时用服务端给的落点
  const from = (location.state as { from?: string } | null)?.from ?? null;

  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const ok = await login(phone, password);
      if (!ok) return;

      // 统一登录入口：落点由服务端 ROLE_HOME 决定（单一真值），本端只做路由分发。
      // - origin=admin（服务商 / 代理商 / 总台管理员）：创作与管理全在运营端，跨端跳过去；
      //   buildAdminUrl 会把登录态（token+user）以 URL 参数带给运营端，
      //   由运营端 bootstrap.ts 消费后自动登录，无需二次输入账号密码。
      // - origin=web（终端用户）：留在本端，回来源页；无来源页则去服务端给的落点。
      const home = useAuthStore.getState().user?.home;
      if (home?.origin === 'admin') {
        window.location.href = await buildAdminUrl(home.path);
        return;
      }
      navigate(from ?? home?.path ?? '/user/works', { replace: true });
    },
    [phone, password, login, navigate, from],
  );

  return (
    <div className="flex min-h-full items-center justify-center bg-gray-900 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-gray-700 bg-gray-800 p-8">
        <div className="mb-6 flex justify-end">
          <LanguageSwitcher />
        </div>
        <h1 className="mb-6 text-center text-2xl font-bold text-blue-400">
          {t('errors:login.title')} {t('common:app.name')}
        </h1>

        {error && (
          <div className="mb-4 rounded-lg bg-red-900/40 px-4 py-2 text-center text-sm text-red-300">
            {t(error)}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm text-gray-600">{t('errors:login.phone')}</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => { setPhone(e.target.value); clearError(); }}
              placeholder="13800138000"
              required
              pattern="1\d{10}"
              className="w-full rounded-lg border border-gray-600 bg-gray-700 px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-gray-600">{t('errors:login.password')}</label>
            <input
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); clearError(); }}
              placeholder="******"
              required
              minLength={6}
              className="w-full rounded-lg border border-gray-600 bg-gray-700 px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-lg bg-blue-600 py-2.5 font-medium text-white transition hover:bg-blue-500 disabled:opacity-50"
          >
            {isLoading ? t('common:status.loading') : t('errors:login.submit')}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-600">
          {t('errors:login.noAccount')}{' '}
          <Link to="/register" className="text-blue-400 hover:text-blue-300">
            {t('errors:login.register')}
          </Link>
        </p>
      </div>
    </div>
  );
}
