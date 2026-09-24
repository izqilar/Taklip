/**
 * 注册页 — 手机号 + 密码注册
 */
import { useState, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/authStore';
import LanguageSwitcher from '@/components/LanguageSwitcher';

export default function Register() {
  const { t } = useTranslation(['common', 'errors']);
  const navigate = useNavigate();
  const register = useAuthStore((s) => s.register);
  const isLoading = useAuthStore((s) => s.isLoading);
  const error = useAuthStore((s) => s.error);
  const clearError = useAuthStore((s) => s.clearError);

  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [nickname, setNickname] = useState('');
  // 账户类型：普通用户 / 入驻服务商 / 入驻代理商（仅为引导语义，注册后端仍是 USER）
  const [intent, setIntent] = useState<'user' | 'provider' | 'agent'>('user');
  const [realName, setRealName] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const settle = intent !== 'user';

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setLocalError(null);
      if (password !== confirmPassword) {
        setLocalError(t('errors:error.passwordMismatch'));
        return;
      }
      if (settle && !realName.trim()) {
        setLocalError(t('errors:register.realNameRequired'));
        return;
      }
      const ok = await register(phone, password, nickname || undefined, {
        intent,
        ...(settle ? { realName: realName.trim() } : {}),
      });
      if (!ok) return;
      // 选了入驻类型 → 直接进入资料填写（此时已是登录态，资质走受保护的入驻接口）
      if (settle) {
        navigate(`/onboarding?intent=${intent}`, { replace: true });
        return;
      }
      // 统一登录入口：落点由服务端 ROLE_HOME 决定（单一真值），与 Login 一致
      const home = useAuthStore.getState().user?.home;
      navigate(home?.path ?? '/user/works', { replace: true });
    },
    [phone, password, confirmPassword, nickname, realName, intent, settle, register, navigate, t],
  );

  return (
    <div className="flex min-h-full items-center justify-center bg-gray-900 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-gray-700 bg-gray-800 p-8">
        <div className="mb-6 flex justify-end">
          <LanguageSwitcher />
        </div>
        <h1 className="mb-6 text-center text-2xl font-bold text-blue-400">
          {t('errors:register.title')} {t('common:app.name')}
        </h1>

        {(error || localError) && (
          <div className="mb-4 rounded-lg bg-red-900/40 px-4 py-2 text-center text-sm text-red-300">
            {localError ?? (error ? t(error) : null)}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 账户类型：注册只建 USER；成为服务商/代理商须走「提交入驻申请 → 代理一审 → 总台终审」 */}
          <div>
            <label className="mb-1 block text-sm text-gray-600">{t('errors:register.accountType')}</label>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { v: 'user', k: 'errors:register.typeUser' },
                  { v: 'provider', k: 'errors:register.typeProvider' },
                  { v: 'agent', k: 'errors:register.typeAgent' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.v}
                  type="button"
                  onClick={() => setIntent(opt.v)}
                  className={`rounded-lg border px-2 py-2 text-sm transition ${
                    intent === opt.v
                      ? 'border-blue-500 bg-blue-600/20 text-white'
                      : 'border-gray-600 bg-gray-700 text-gray-300 hover:border-gray-500'
                  }`}
                >
                  {t(opt.k)}
                </button>
              ))}
            </div>
            {settle && (
              <p className="mt-2 text-xs text-gray-400">{t('errors:register.settleHint')}</p>
            )}
          </div>
          {settle && (
            <div>
              <label className="mb-1 block text-sm text-gray-600">{t('errors:register.realName')}</label>
              <input
                type="text"
                value={realName}
                onChange={(e) => { setRealName(e.target.value); setLocalError(null); }}
                placeholder={t('errors:register.realNamePh')}
                className="w-full rounded-lg border border-gray-600 bg-gray-700 px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
              />
            </div>
          )}
          <div>
            <label className="mb-1 block text-sm text-gray-600">{t('errors:register.phone')}</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => { setPhone(e.target.value); clearError(); setLocalError(null); }}
              placeholder="13800138000"
              required
              pattern="1\d{10}"
              className="w-full rounded-lg border border-gray-600 bg-gray-700 px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-gray-600">{t('errors:register.nickname')}</label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className="w-full rounded-lg border border-gray-600 bg-gray-700 px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-gray-600">{t('errors:register.password')}</label>
            <input
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); clearError(); setLocalError(null); }}
              placeholder="******"
              required
              minLength={6}
              className="w-full rounded-lg border border-gray-600 bg-gray-700 px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-gray-600">{t('errors:register.confirmPassword')}</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => { setConfirmPassword(e.target.value); clearError(); setLocalError(null); }}
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
            {isLoading ? t('common:status.loading') : t('errors:register.submit')}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-600">
          {t('errors:register.hasAccount')}{' '}
          <Link to="/login" className="text-blue-400 hover:text-blue-300">
            {t('errors:register.login')}
          </Link>
        </p>
      </div>
    </div>
  );
}
