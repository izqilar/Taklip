/**
 * 身份漂移统一提示（Web 端）
 *
 * 由 App 根节点挂载一次 —— 它是「资质变更」唯一的用户可见出口：
 * 已登录状态、任意工作台页面上都会弹出，说明资质已变更并要求重新登录；
 * 用户点「立即重新登录」或倒计时结束后，清空本地登录态与角色/资质缓存并跳登录页。
 *
 * 与 <?reason=identity-changed> 协同：跳转后的登录页会显示同一套文案，
 * 避免用户落地登录页时「不知道为什么被踢出来」。
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useIdentityDriftStore, finishIdentityDrift } from '../store/identityDrift';

/** 自动跳转倒计时秒数（可统一在此调整） */
const AUTO_REDIRECT_SECONDS = 8;

export default function IdentityDriftNotice() {
  const { t } = useTranslation();
  const active = useIdentityDriftStore((s) => s.active);
  const info = useIdentityDriftStore((s) => s.info);
  const [left, setLeft] = useState(AUTO_REDIRECT_SECONDS);

  useEffect(() => {
    if (!active) return;
    setLeft(AUTO_REDIRECT_SECONDS);
    const timer = window.setInterval(() => {
      setLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(timer);
          finishIdentityDrift();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [active]);

  const fromLabel = info?.fromRole ? t(`role.${info.fromRole}`, { defaultValue: info.fromRole }) : '';
  const toLabel = info?.toRole ? t(`role.${info.toRole}`, { defaultValue: info.toRole }) : '';
  const showDetail = Boolean(fromLabel && toLabel);

  if (!active) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4">
      <div
        role="alertdialog"
        aria-modal="true"
        className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl"
      >
        <h2 className="text-lg font-semibold text-gray-900">
          {t('auth.drift.title', { defaultValue: '账号资质已变更' })}
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-gray-600">
          {t('auth.drift.body', {
            defaultValue: '检测到你的账号资质发生变化，需要重新登录后才能继续使用。',
          })}
        </p>
        {showDetail && (
          <p className="mt-2 rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-500">
            {t('auth.drift.detail', {
              defaultValue: '变更：{{from}} → {{to}}',
              from: fromLabel,
              to: toLabel,
            })}
          </p>
        )}
        <p className="mt-2 text-xs text-gray-400">
          {t('auth.drift.countdown', {
            defaultValue: '{{sec}} 秒后自动跳转到登录页',
            sec: left,
          })}
        </p>
        <button
          type="button"
          onClick={finishIdentityDrift}
          className="mt-5 w-full rounded-lg bg-[#c81e42] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#a8172f]"
        >
          {t('auth.drift.confirm', { defaultValue: '立即重新登录' })}
        </button>
      </div>
    </div>
  );
}
