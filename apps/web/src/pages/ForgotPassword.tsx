/**
 * 找回密码页（G-4）：
 * 步骤一：提交任一登录标识，定位账户并发放重置凭证（D1 模拟送达 → 弹窗显示验证码）；
 * 步骤二：输入重置令牌/验证码 + 新密码（二次确认）→ 重置 → 成功跳登录页。
 * 兼容邮件链接直达（URL 带 ?token= 或 ?code= 自动进入步骤二）。
 */
import { useState, useCallback, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/authStore';
import LanguageSwitcher from '@/components/LanguageSwitcher';

export default function ForgotPassword() {
  const { t } = useTranslation(['common', 'errors']);
  const navigate = useNavigate();
  const location = useLocation();
  const forgotPassword = useAuthStore((s) => s.forgotPassword);
  const resetPassword = useAuthStore((s) => s.resetPassword);
  const isLoading = useAuthStore((s) => s.isLoading);
  const error = useAuthStore((s) => s.error);

  const [step, setStep] = useState<1 | 2>(1);
  const [identifier, setIdentifier] = useState('');
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [devChannel, setDevChannel] = useState<string>('');
  const [done, setDone] = useState(false);

  // 邮件链接直达：?token= 或 ?code= 自动进入步骤二
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    const tk = q.get('token') || q.get('code');
    if (tk) {
      setToken(tk);
      setStep(2);
    }
  }, [location.search]);

  const submitIdentifier = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const res = await forgotPassword(identifier.trim());
      if (!res) return;
      // D1 模拟送达：弹窗展示验证码（生产接入真实渠道后此分支不触发）
      if (res.devCode) {
        setDevCode(res.devCode);
        setDevChannel(res.devChannel || '');
      }
      setStep(2);
    },
    [forgotPassword, identifier],
  );

  const submitReset = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (newPassword !== confirm) {
        useAuthStore.setState({ error: 'errors:error.passwordMismatch' });
        return;
      }
      const ok = await resetPassword(token.trim(), newPassword);
      if (ok) setDone(true);
    },
    [resetPassword, token, newPassword, confirm],
  );

  return (
    <div className="flex min-h-full items-center justify-center bg-gray-900 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-gray-700 bg-gray-800 p-8">
        <div className="mb-6 flex justify-end">
          <LanguageSwitcher />
        </div>
        <h1 className="mb-6 text-center text-2xl font-bold text-blue-400">
          {t('errors:forgot.title', '找回密码')}
        </h1>

        {error && (
          <div className="mb-4 rounded-lg bg-red-900/40 px-4 py-2 text-center text-sm text-red-300">
            {t(error)}
          </div>
        )}

        {/* D1 模拟送达弹窗：开发/测试阶段以弹窗展示验证码 */}
        {devCode && (
          <div className="mb-4 rounded-lg border border-amber-500/50 bg-amber-900/30 px-4 py-3 text-center text-sm text-amber-200">
            <div className="mb-1 font-medium">
              {t('errors:forgot.devHint', '【模拟送达】重置验证码')}
            </div>
            <div className="select-all text-lg font-bold tracking-widest text-amber-100">
              {devCode}
            </div>
            <div className="mt-1 text-xs text-amber-300/80">
              {devChannel === 'email'
                ? t('errors:forgot.devEmail', '（渠道：邮件）')
                : devChannel === 'sms'
                  ? t('errors:forgot.devSms', '（渠道：短信）')
                  : t('errors:forgot.devNone', '（账户无可用联系方式，开发模式直接展示）')}
            </div>
          </div>
        )}

        {done ? (
          <div className="space-y-4">
            <div className="rounded-lg bg-green-900/40 px-4 py-3 text-center text-sm text-green-300">
              {t('errors:forgot.success', '密码已重置，请重新登录')}
            </div>
            <button
              type="button"
              onClick={() => navigate('/login', { replace: true })}
              className="w-full rounded-lg bg-blue-600 py-2.5 font-medium text-white transition hover:bg-blue-500"
            >
              {t('errors:login.submit', '登录')}
            </button>
          </div>
        ) : step === 1 ? (
          <form onSubmit={submitIdentifier} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm text-gray-400">
                {t('errors:forgot.identifier', '手机号 / 邮箱 / 用户ID / 用户名')}
              </label>
              <input
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="13800138000 / you@example.com"
                required
                className="w-full rounded-lg border border-gray-600 bg-gray-700 px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-lg bg-blue-600 py-2.5 font-medium text-white transition hover:bg-blue-500 disabled:opacity-50"
            >
              {isLoading ? t('common:status.loading') : t('errors:forgot.next', '发送重置凭证')}
            </button>
            <p className="text-center text-xs text-gray-500">{t('errors:forgot.sent', '若账户存在，重置凭证已发送')}</p>
          </form>
        ) : (
          <form onSubmit={submitReset} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm text-gray-400">
                {t('errors:forgot.token', '重置令牌 / 验证码')}
              </label>
              <input
                type="text"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="------"
                required
                className="w-full rounded-lg border border-gray-600 bg-gray-700 px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-gray-400">
                {t('errors:forgot.newPassword', '新密码')}
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                minLength={6}
                required
                className="w-full rounded-lg border border-gray-600 bg-gray-700 px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-gray-400">
                {t('errors:forgot.confirm', '确认新密码')}
              </label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                minLength={6}
                required
                className="w-full rounded-lg border border-gray-600 bg-gray-700 px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-lg bg-blue-600 py-2.5 font-medium text-white transition hover:bg-blue-500 disabled:opacity-50"
            >
              {isLoading ? t('common:status.loading') : t('errors:forgot.reset', '重置密码')}
            </button>
            <button
              type="button"
              onClick={() => {
                setStep(1);
                setDevCode(null);
              }}
              className="w-full text-center text-xs text-gray-500 hover:text-gray-300"
            >
              {t('errors:forgot.back', '返回上一步')}
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-gray-600">
          <Link to="/login" className="text-blue-400 hover:text-blue-300">
            {t('errors:login.backToLogin', '返回登录')}
          </Link>
        </p>
      </div>
    </div>
  );
}
