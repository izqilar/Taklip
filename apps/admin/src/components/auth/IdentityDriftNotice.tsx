/**
 * 身份漂移统一提示（运营端）
 *
 * 由 App 根节点挂载一次 —— 它是「资质变更」唯一的用户可见出口：
 * 已登录状态、任意工作台页面上都会弹出，说明资质已变更并要求重新登录；
 * 用户点「立即重新登录」或倒计时结束后，清空登录态 / 权限摘要 / 视角与视察对象缓存，跳登录页。
 *
 * 与 `?reason=identity-changed` 协同：落地登录页后展示同一套文案，避免用户不明所以。
 */
import { useEffect, useState } from 'react';
import { Modal, Button } from 'antd';
import { ExclamationCircleFilled } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useIdentityDriftStore, finishIdentityDrift } from '../../providers/identityDrift';
import { roleText } from '../../config/labels';

/** 自动跳转倒计时秒数（统一在此调整） */
const AUTO_REDIRECT_SECONDS = 8;

export const IdentityDriftNotice = () => {
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

  if (!active) return null;

  const fromLabel = info?.fromRole ? roleText(info.fromRole) : '';
  const toLabel = info?.toRole ? roleText(info.toRole) : '';

  return (
    <Modal
      open
      centered
      closable={false}
      maskClosable={false}
      width={420}
      footer={
        <Button type="primary" danger block onClick={finishIdentityDrift}>
          {t('auth.drift.confirm', { defaultValue: '立即重新登录' })}
        </Button>
      }
      title={
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <ExclamationCircleFilled style={{ color: '#c24b2e' }} />
          {t('auth.drift.title', { defaultValue: '账号资质已变更' })}
        </span>
      }
    >
      <p style={{ margin: 0, fontSize: 13, lineHeight: 1.8, color: 'var(--ink-2, #5b5b5b)' }}>
        {t('auth.drift.body', {
          defaultValue: '检测到你的账号资质发生变化，当前登录信息已失效，需要重新登录后才能继续使用。',
        })}
      </p>
      {fromLabel && toLabel && (
        <p
          style={{
            margin: '10px 0 0',
            padding: '8px 10px',
            borderRadius: 6,
            background: 'rgba(0,0,0,0.04)',
            fontSize: 12,
            color: 'var(--ink-2, #5b5b5b)',
          }}
        >
          {t('auth.drift.detail', {
            defaultValue: '变更：{{from}} → {{to}}',
            from: fromLabel,
            to: toLabel,
            nsSeparator: false,
          })}
        </p>
      )}
      <p style={{ margin: '10px 0 0', fontSize: 12, opacity: 0.65 }}>
        {t('auth.drift.countdown', {
          defaultValue: '{{sec}} 秒后自动跳转到登录页',
          sec: left,
        })}
      </p>
    </Modal>
  );
};
