import { useMemo, useState } from 'react';
import { Dropdown } from 'antd';
import { useGetIdentity } from '@refinedev/core';
import { useNavigate } from 'react-router-dom';
import { T } from '../../config/theme';
import { useLayer } from '../../providers/layerContext';
import { getStoredUser } from '../../utility';
import { authProvider } from '../../providers/authProvider';
import { cleanCode, roleText } from '../../config/labels';
import { ACCOUNT_MODES, ACCOUNT_NAV, ACCOUNT_TODOS } from '../../config/accountPanel';
import { useBadges } from '../../hooks/useBadges';
import '../../styles/account-panel.css';

/**
 * 顶栏账号胶囊 + 账号下拉面板。
 *
 * 以 UI_Design/index.html 的 .acc / .accpanel 为基准，五段式：
 *   ① 账号头部（头像 52 + 姓名 + 账号 ID 可复制 + 角色/认证标签）
 *   ② 权限模式（仅总台管理员，与 readonly 联动）
 *   ③ 待办事项（4 宫格，数字取自 GET /api/console/badges）
 *   ④ 快捷入口（2 列，带图标）
 *   ⑤ 底部工具 + 退出登录
 *
 * 口径：待办按【操作员角色】分派，快捷入口/工具按【当前视角层】分派
 *       （详见 config/accountPanel.tsx 顶部说明）。
 */

/** 把 theme 令牌注入 CSS 变量，供 account-panel.css 引用（配色唯一来源） */
export const accountCssVars = {
  '--bg': T.bg,
  '--line': T.border,
  '--ink1': T.ink1,
  '--ink2': T.ink2,
  '--ink3': T.ink3,
  '--accent': T.accent,
  '--accent-soft': T.accentSoft,
  '--accent-2': T.accent2,
  '--accent-2-soft': T.accent2Soft,
  '--panel-2': T.panel2,
  '--up-bg': T.upBg,
  '--up-ink': T.upInk,
  '--up': T.up,
  '--warn-bg': T.warnBg,
  '--warn-ink': T.warnInk,
  '--down-bg': T.downBg,
  '--down-ink': T.downInk,
  '--r-sm': `${T.rSm}px`,
  '--r-md': `${T.rMd}px`,
  '--avatar-grad': T.avatarGrad,
  '--head-grad': T.headGrad,
  '--logout-ink': T.logoutInk,
  '--logout-soft': T.logoutSoft,
  '--shadow-pop': T.shadowPop,
  '--font': T.font,
} as React.CSSProperties;

interface Identity {
  id?: string;
  role?: string;
  name?: string;
  nickname?: string;
  realName?: string;
  phone?: string;
  avatar?: string;
  providerStatus?: string | null;
  realNameStatus?: string | null;
  status?: string | null;
}

/** 服务商看资质状态，其余看实名状态（原型 .ap-tags 第二个标签） */
function authTag(user: Identity): { text: string; cls: string } {
  if (user.role === 'SERVICE_PROVIDER') {
    switch (user.providerStatus) {
      case 'APPROVED':
        return { text: '资质有效', cls: 'ok' };
      case 'PENDING':
        return { text: '资质待审', cls: 'warn' };
      case 'REJECTED':
        return { text: '资质已驳回', cls: 'bad' };
      default:
        return { text: '未认证', cls: 'mut' };
    }
  }
  switch (user.realNameStatus) {
    case 'APPROVED':
      return { text: '已实名', cls: 'ok' };
    case 'PENDING':
      return { text: '实名待审', cls: 'warn' };
    case 'REJECTED':
      return { text: '实名已驳回', cls: 'bad' };
    default:
      return { text: '未实名', cls: 'mut' };
  }
}

export const AccountPill = ({ onViewProfile }: { onViewProfile: (userId?: string) => void }) => {
  const { view, readonly, setReadonly, objectScope } = useLayer();
  const navigate = useNavigate();
  const badges = useBadges();
  const { data: identity } = useGetIdentity<Identity>({});
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const stored = getStoredUser<Identity>();
  const user: Identity = useMemo(
    () => ({ ...(stored ?? {}), ...(identity ?? {}) }),
    [stored, identity],
  );

  const role = user.role ?? '';
  const isAdmin = role === 'ADMIN';
  const name =
    user.nickname || user.realName || user.name || user.phone || stored?.phone || '未命名';
  const initial = (name || '?').trim().slice(0, 1);
  const accountId = cleanCode(user.id);
  const auth = authTag(user);

  const todos = ACCOUNT_TODOS[role] ?? [];
  const nav = ACCOUNT_NAV[view] ?? ACCOUNT_NAV.console;

  const go = (to: string) => {
    setOpen(false);
    navigate(to);
  };

  const copyId = async () => {
    const text = String(user.id ?? accountId);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // 非安全上下文（http）下 clipboard 不可用，退回选中提示即可，不臆造成功
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  const logout = async () => {
    setOpen(false);
    await authProvider.logout({ redirectPath: '/login' });
    // 退出登录：清除运营端会话后，跳回运营端自身的登录入口（:5174/login），
    // 而非 Web 端首页。origin 在运营端即 http://localhost:5174。
    window.location.href = `${window.location.origin}/login`;
  };

  const panel = (
    <div className="accpanel" style={accountCssVars}>
      {/* ① 账号头部 */}
      <div className="ap-head">
        <div className="ap-avatar">
          {user.avatar ? <img src={user.avatar} alt="" /> : initial}
        </div>
        <div className="ap-user">
          <div className="ap-name">{name}</div>
          <div className="ap-id">
            账号 ID：<span id="apId">{accountId}</span>
            <span
              className="ap-copy"
              title={copied ? '已复制' : '复制完整 ID'}
              onClick={copyId}
              role="button"
            >
              {copied ? '✓' : '⧉'}
            </span>
          </div>
          <div className="ap-tags">
            <span className="tag ac">{roleText(role)}</span>
            <span className={`tag ${auth.cls}`}>{auth.text}</span>
          </div>
        </div>
      </div>

      {/* ② 权限模式（仅总台管理员） */}
      {isAdmin && (
        <div className="ap-section">
          <div className="ap-sec-title">权限模式</div>
          <div className="ap-modes">
            {ACCOUNT_MODES.map((m) => (
              <div
                key={m.key}
                className={`ap-mode${readonly === m.readonly ? ' on' : ''}`}
                onClick={() => setReadonly(m.readonly)}
                role="button"
              >
                <b>{m.title}</b>
                <span>{m.desc}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 监督视角：当前对象速览（本 app 扩展） */}
      {objectScope && (
        <div className="ap-section">
          <div className="ap-sec-title">当前监督对象</div>
          <div className="ap-object">
            <span>{objectScope.label.split('（')[0]}</span>
            <button
              type="button"
              className="ap-object-btn"
              onClick={() => {
                setOpen(false);
                onViewProfile(objectScope.id);
              }}
            >
              查看资料
            </button>
          </div>
        </div>
      )}

      {/* ③ 待办事项 */}
      {todos.length > 0 && (
        <div className="ap-section">
          <div className="ap-sec-title">待办事项</div>
          <div className="ap-todos">
            {todos.map((t) => {
              const n = badges[t.badge] ?? 0;
              return (
                <button type="button" className="ap-todo" key={t.label} onClick={() => go(t.to)}>
                  <span className={`n${n > 0 && t.hot ? ' hot' : ''}`}>{n > 99 ? '99+' : n}</span>
                  <span className="l">{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ④ 快捷入口 */}
      <div className="ap-section">
        <div className="ap-sec-title">快捷入口</div>
        <div className="ap-links">
          {nav.links.map((l) => (
            <button type="button" className="ap-link" key={l.label} onClick={() => go(l.to)}>
              <span className="ic">{l.icon}</span>
              <span>{l.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ⑤ 底部工具 + 退出 */}
      <div className="ap-footer">
        <div className="ap-tools">
          {nav.tools.map((t) => (
            <button type="button" className="ap-tool" key={t.label} onClick={() => go(t.to)}>
              {t.label}
            </button>
          ))}
        </div>
        <button type="button" className="ap-logout" onClick={logout}>
          退出登录
        </button>
      </div>
    </div>
  );

  return (
    <Dropdown
      popupRender={() => panel}
      trigger={['click']}
      placement="bottomRight"
      open={open}
      onOpenChange={setOpen}
      overlayClassName="accpanel-portal"
    >
      <span className={`acc${open ? ' on' : ''}`} style={accountCssVars}>
        <span className="acc-trigger">
          <span className="acc-av">
            {user.avatar ? <img src={user.avatar} alt="" /> : initial}
          </span>
          <span className="acc-tinfo">
            <span>{name}</span>
            {readonly && isAdmin ? (
              <span className="tag ro">只读</span>
            ) : (
              <span className="tag write">{roleText(role)}</span>
            )}
          </span>
          <span className="dd">⌄</span>
        </span>
      </span>
    </Dropdown>
  );
};
