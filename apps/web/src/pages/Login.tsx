/**
 * 登录页 — 多方式登录（手机号 / 邮箱 / 用户ID / 用户名 + 微信/QQ 扫码）
 * 改造自原「手机号 + 密码」单入口（2026-10-12）。
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/authStore';
import { api, buildAdminUrl } from '@/api/client';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import QRCode from 'qrcode';

type LoginTab = 'password' | 'sms' | 'qr';
type IdType = 'phone' | 'email' | 'userId' | 'username';

const ID_TYPES: IdType[] = ['phone', 'email', 'userId', 'username'];
const ID_TYPE_LABEL: Record<IdType, string> = {
  phone: '手机号',
  email: '邮箱',
  userId: '用户 ID',
  username: '用户名/昵称',
};

export default function Login() {
  const { t } = useTranslation(['common', 'errors']);
  const navigate = useNavigate();
  const location = useLocation();
  const login = useAuthStore((s) => s.login);
  const isLoading = useAuthStore((s) => s.isLoading);
  const error = useAuthStore((s) => s.error);
  const clearError = useAuthStore((s) => s.clearError);

  const from = (location.state as { from?: string } | null)?.from ?? null;
  const identityChangedReason =
    new URLSearchParams(location.search).get('reason') === 'identity-changed';

  const [tab, setTab] = useState<LoginTab>('password');
  const [idType, setIdType] = useState<IdType>('phone');
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');

  /** 登录成功后的统一落点分发（沿用既有 ROLE_HOME 逻辑，不改动） */
  const dispatchHome = useCallback(async () => {
    const home = useAuthStore.getState().user?.home;
    if (home?.origin === 'admin') {
      window.location.href = await buildAdminUrl(home.path);
      return;
    }
    navigate(from ?? home?.path ?? '/user/works', { replace: true });
  }, [navigate, from]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const ok = await login(idType, account.trim(), password);
      if (!ok) return;
      await dispatchHome();
    },
    [login, idType, account, password, dispatchHome],
  );

  return (
    <div className="flex min-h-full items-center justify-center bg-gray-900 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-gray-700 bg-gray-800 p-8">
        <div className="mb-6 flex justify-end">
          <LanguageSwitcher />
        </div>
        <h1 className="mb-4 text-center text-2xl font-bold text-blue-400">
          {t('errors:login.title')} {t('common:app.name')}
        </h1>

        {/* 入口切换 Tab */}
        <div className="mb-5 flex rounded-lg bg-gray-700 p-1 text-sm">
          {(
            [
              ['password', t('errors:login.tabPassword', '密码登录')],
              ['sms', t('errors:login.tabSms', '验证码登录')],
              ['qr', t('errors:login.tabQr', '扫码登录')],
            ] as [LoginTab, string][]
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => {
                setTab(k);
                clearError();
              }}
              className={`flex-1 rounded-md py-1.5 font-medium transition ${
                tab === k ? 'bg-blue-600 text-white' : 'text-gray-300 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-900/40 px-4 py-2 text-center text-sm text-red-300">
            {t(error)}
          </div>
        )}

        {identityChangedReason && !error && (
          <div className="mb-4 rounded-lg bg-amber-900/40 px-4 py-2 text-center text-sm text-amber-200">
            {t('auth.drift.loginHint', {
              defaultValue: '你的账号资质已发生变化，请重新登录。',
            })}
          </div>
        )}

        {tab === 'password' && (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 标识类型选择 */}
            <div className="flex flex-wrap gap-2">
              {ID_TYPES.map((it) => (
                <button
                  key={it}
                  type="button"
                  onClick={() => {
                    setIdType(it);
                    clearError();
                  }}
                  className={`rounded-full border px-3 py-1 text-xs transition ${
                    idType === it
                      ? 'border-blue-500 bg-blue-500/10 text-blue-300'
                      : 'border-gray-600 text-gray-400 hover:border-gray-400'
                  }`}
                >
                  {ID_TYPE_LABEL[it]}
                </button>
              ))}
            </div>

            <div>
              <label className="mb-1 block text-sm text-gray-400">
                {t('errors:login.account', '账号')}
              </label>
              <input
                type={idType === 'phone' ? 'tel' : idType === 'email' ? 'email' : 'text'}
                value={account}
                onChange={(e) => {
                  setAccount(e.target.value);
                  clearError();
                }}
                placeholder={
                  idType === 'phone'
                    ? '13800138000'
                    : idType === 'email'
                      ? 'you@example.com'
                      : idType === 'userId'
                        ? '用户 ID（cuid）'
                        : '用户名 / 昵称'
                }
                required
                className="w-full rounded-lg border border-gray-600 bg-gray-700 px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm text-gray-400">
                {t('errors:login.password')}
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  clearError();
                }}
                placeholder="******"
                required
                minLength={6}
                className="w-full rounded-lg border border-gray-600 bg-gray-700 px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div className="text-right text-sm">
              <Link to="/forgot-password" className="text-blue-400 hover:text-blue-300">
                {t('errors:login.forgot', '忘记密码？')}
              </Link>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-lg bg-blue-600 py-2.5 font-medium text-white transition hover:bg-blue-500 disabled:opacity-50"
            >
              {isLoading ? t('common:status.loading') : t('errors:login.submit')}
            </button>
          </form>
        )}

        {tab === 'sms' && <SmsPlaceholder />}

        {tab === 'qr' && (
          <div className="grid grid-cols-2 gap-3">
            <QrCard provider="wechat" onLoggedIn={dispatchHome} />
            <QrCard provider="qq" onLoggedIn={dispatchHome} />
          </div>
        )}

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

/** 验证码登录占位（D8：依赖短信网关，本期占位） */
function SmsPlaceholder() {
  const { t } = useTranslation(['errors']);
  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1 block text-sm text-gray-400">{t('errors:login.phone', '手机号')}</label>
        <input
          type="tel"
          pattern="1\d{10}"
          disabled
          placeholder="13800138000"
          className="w-full rounded-lg border border-gray-600 bg-gray-700 px-3 py-2 text-white opacity-60 focus:outline-none"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm text-gray-400">{t('errors:login.code', '验证码')}</label>
        <input
          type="text"
          disabled
          placeholder="------"
          className="w-full rounded-lg border border-gray-600 bg-gray-700 px-3 py-2 text-white opacity-60 focus:outline-none"
        />
      </div>
      <button
        type="button"
        disabled
        className="w-full rounded-lg bg-gray-600 py-2.5 font-medium text-gray-300"
      >
        {t('errors:login.smsSoon', '短信验证码登录即将上线（依赖短信网关）')}
      </button>
    </div>
  );
}

/** 扫码登录卡片（微信 / QQ 同构）：发起 → 渲染二维码 → 轮询 → 落地 */
function QrCard({
  provider,
  onLoggedIn,
}: {
  provider: 'wechat' | 'qq';
  onLoggedIn: () => void;
}) {
  const { t } = useTranslation(['errors']);
  const pollQrLogin = useAuthStore((s) => s.pollQrLogin);
  const [state, setState] = useState<string | null>(null);
  const [qr, setQr] = useState<string>('');
  const [configured, setConfigured] = useState(true);
  const [polling, setPolling] = useState(false);
  const stateRef = useRef<string | null>(null);
  stateRef.current = state;

  const start = useCallback(async () => {
    try {
      setPolling(true);
      const res = await api.qrStart(provider);
      setState(res.state);
      stateRef.current = res.state;
      setConfigured(res.configured);
      if (res.configured && res.qrcodeUrl) {
        const dataUrl = await QRCode.toDataURL(res.qrcodeUrl, { width: 200, margin: 1 });
        setQr(dataUrl);
      }
    } catch {
      setPolling(false);
    }
  }, [provider]);

  useEffect(() => {
    start();
    return () => setPolling(false);
  }, [start]);

  useEffect(() => {
    if (!polling || !state) return;
    const timer = setInterval(async () => {
      const ok = await pollQrLogin(provider, state);
      if (ok) {
        setPolling(false);
        clearInterval(timer);
        onLoggedIn();
      }
    }, 2000);
    return () => clearInterval(timer);
  }, [polling, state, provider, pollQrLogin, onLoggedIn]);

  const devScan = async () => {
    if (!stateRef.current) return;
    await api.qrDevScan(provider, stateRef.current);
  };

  const title = provider === 'wechat' ? t('errors:login.wechat', '微信扫码') : t('errors:login.qq', 'QQ 扫码');

  return (
    <div className="flex flex-col items-center rounded-lg border border-gray-700 bg-gray-900/40 p-3">
      <div className="mb-2 text-sm font-medium text-gray-200">{title}</div>
      {!configured ? (
        <div className="flex h-40 w-full items-center justify-center rounded bg-gray-800 px-2 text-center text-xs text-amber-300">
          {t('errors:login.qrNotConfigured', '未配置开放平台资质（需服务端 WX_*/QQ_* 环境变量）')}
        </div>
      ) : qr ? (
        <img src={qr} alt={title} className="h-40 w-40 rounded bg-white p-1" />
      ) : (
        <div className="flex h-40 w-40 items-center justify-center rounded bg-gray-800 text-xs text-gray-500">
          {t('errors:login.loadingQr', '二维码生成中…')}
        </div>
      )}
      <div className="mt-2 text-xs text-gray-500">{t('errors:login.scanHint', '请使用对应 App 扫码登录')}</div>
      <div className="mt-2 flex w-full gap-2">
        <button
          type="button"
          onClick={start}
          className="flex-1 rounded border border-gray-600 py-1 text-xs text-gray-300 hover:border-gray-400"
        >
          {t('errors:login.refreshQr', '刷新')}
        </button>
        {import.meta.env.DEV && (
          <button
            type="button"
            onClick={devScan}
            className="flex-1 rounded border border-blue-600 py-1 text-xs text-blue-300 hover:bg-blue-600/10"
          >
            {t('errors:login.devScan', '模拟扫码(开发)')}
          </button>
        )}
      </div>
    </div>
  );
}
