import { useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { Select } from 'antd';
import { GlobalOutlined, MenuOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { T } from '../../config/theme';
import { useLayer } from '../../providers/layerContext';
import { LAYER_HOME, LAYER_LABEL, resources, type ResourceMeta } from '../../config/resources';
import { getStoredUser } from '../../utility';
import { SUPPORTED_LANGS } from '../../i18n';
import { t } from '../../i18n/t';
import { ProfileDrawer } from '../ui/ProfileDrawer';
import { AccountPill } from './AccountPill';
import { UpgradeActions } from '../user/UpgradeActions';
import type { LayerKey } from '../../config/permGroups';

/** 原型 .viewswitch 四个视角 */
const ALL_VIEWS: { key: LayerKey; label: string }[] = [
  { key: 'console', label: '总台视角' },
  { key: 'agent', label: '代理商视角' },
  { key: 'provider', label: '服务商视角' },
  { key: 'user', label: '用户视角' },
];

/**
 * 视角可见性：与服务端 @Roles 保持一致，避免切到无权限视角后接口 403。
 * - ADMIN 全可见（用户视角即「监督镜像」，配合对象视角选择使用）
 * - AGENT 可看自身代理商视角 + 辖区内用户的监督镜像
 * - SERVICE_PROVIDER 仅自身服务商视角
 * 原型演示态（__UI_PREVIEW__）下放开全部视角以便静态走查。
 */
const VIEW_VISIBLE: Record<string, LayerKey[]> = {
  ADMIN: ['console', 'agent', 'provider', 'user'],
  AGENT: ['agent', 'user'],
  SERVICE_PROVIDER: ['provider'],
  USER: ['user'],
};

const VIEW_CRUMB: Record<LayerKey, string> = {
  console: '管理总台',
  agent: '代理商中心',
  provider: '服务商中心',
  user: '用户视角',
};

/**
 * 顶栏内容（原型 .top）：面包屑 + 视角切换 + 账号胶囊 + 资料入口。
 * 账号模块只表达「我是谁」（操作员锚点）+ 监督视角的「当前对象」（数据主体），
 * 不在此呈现可写/只读等权限文字——权限由各角色层作用域隐式体现。
 *
 * 2026-09-20 响应式（P3-⑥）：窄屏时于最左侧渲染汉堡按钮，点击开合侧栏抽屉。
 */
export const LayerHeader = ({
  showMenu = false,
  onMenu,
}: {
  showMenu?: boolean;
  onMenu?: () => void;
}) => {
  const { i18n } = useTranslation();
  const { view, setView, objectScope } = useLayer();
  const location = useLocation();
  const navigate = useNavigate();

  const role = getStoredUser<{ role?: string }>()?.role;
  const isAdmin = role === 'ADMIN';

  /** 当前角色可切换的视角（与服务端口径一致） */
  const views = ALL_VIEWS.filter((v) =>
    isAdmin ? true : (VIEW_VISIBLE[role ?? ''] ?? []).includes(v.key),
  );

  const onViewChange = (v: LayerKey) => {
    // 注意：不再在切换视角时清空 objectScope（旧全局模型下需清共享槽位）。
    // 现 objectScope 按视角隔离（见 layerContext），清空反而会抹掉「源视角」自己保留的
    // 选中对象。目标视角由 setView 同步其自身槽位的 subject，输入框由 ObjectScopeBar
    // 的 view 副作用回落到目标视角自己的对象（或空），各视角互不串扰。
    setView(v);
    navigate(LAYER_HOME[v]);
  };

  /** 当前页标题：由路由反查资源 meta.label */
  const current = resources.find(
    (r) => r.list && location.pathname === (r.list as string),
  );
  const pageTitle = current
    ? t(`menu.${(current.name as string).replace(/\//g, '.')}`, (current.meta as ResourceMeta).label)
    : '工作台';

  const [profile, setProfile] = useState<{ open: boolean; userId?: string; title: string }>({
    open: false,
    title: '',
  });
  const openProfile = (userId?: string) =>
    setProfile({ open: true, userId, title: userId ? '用户资料' : '账户详情' });

  const objectLabel = objectScope ? objectScope.label.split('（')[0] : '';

  return (
    <>
      {/* ── 窄屏菜单按钮（仅窄屏显示，打开侧栏抽屉） ── */}
      <button
        type="button"
        onClick={onMenu}
        aria-label="打开菜单"
        style={{
          display: showMenu ? 'inline-flex' : 'none',
          alignItems: 'center',
          justifyContent: 'center',
          width: 36,
          height: 36,
          flex: 'none',
          border: `1px solid ${T.border}`,
          borderRadius: T.rSm,
          background: T.bg,
          color: T.ink1,
          cursor: 'pointer',
        }}
      >
        <MenuOutlined />
      </button>

      {/* ── 面包屑 ── */}
      <span style={{ fontSize: 15, fontWeight: 700, whiteSpace: 'nowrap', color: T.ink1 }}>
        {VIEW_CRUMB[view]}
        <span style={{ color: T.ink3, fontWeight: 500, margin: '0 8px' }}>/</span>
        {pageTitle}
      </span>

      {/* ── 视角切换（原型 .viewswitch） ── */}
      {isAdmin && (
        <span
          style={{
            display: 'flex',
            border: `1px solid ${T.border}`,
            borderRadius: T.rSm,
            overflow: 'hidden',
            background: T.page,
            flex: 'none',
          }}
        >
          {views.map((v) => {
            const on = view === v.key;
            return (
              <button
                key={v.key}
                type="button"
                onClick={() => onViewChange(v.key)}
                style={{
                  padding: '6px 16px',
                  fontSize: 13,
                  color: on ? T.accent : T.ink2,
                  background: on ? T.bg : 'transparent',
                  fontWeight: on ? 600 : 400,
                  boxShadow: on ? `inset 0 -2px 0 ${T.accent}` : undefined,
                  border: 0,
                  borderLeft: v.key === 'console' ? 0 : `1px solid ${T.border}`,
                  cursor: 'pointer',
                  minHeight: 0,
                  lineHeight: 1.6,
                  whiteSpace: 'nowrap',
                }}
              >
                {v.label}
              </button>
            );
          })}
        </span>
      )}

      {!isAdmin && (
        <span
          style={{
            fontSize: 12,
            padding: '3px 10px',
            borderRadius: 999,
            background: T.accent2Soft,
            color: T.accent2,
            fontWeight: 600,
          }}
        >
          {LAYER_LABEL[view]}视角
        </span>
      )}

      <span style={{ marginLeft: 'auto' }} />

      {/* ── 监督视角：当前对象（数据主体）资料条 ── */}
      {objectScope && (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '5px 10px',
            borderRadius: 999,
            background: T.accent2Soft,
            color: T.accent2,
            fontSize: 12,
            fontWeight: 600,
            flex: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          <span>当前对象：{objectLabel}</span>
          <button
            type="button"
            onClick={() => openProfile(objectScope.id)}
            style={{
              border: 'none',
              background: 'transparent',
              color: 'inherit',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 600,
              padding: 0,
              textDecoration: 'underline',
            }}
          >
            查看资料
          </button>
        </span>
      )}

      {/* ── 升格入口（原型 #topActs）：用户视角→代理商/服务商，服务商视角→代理商 ── */}
      <UpgradeActions />

      {/* ── 语言 ── */}
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flex: 'none' }}>
        <GlobalOutlined style={{ color: T.ink2 }} />
        <Select
          size="small"
          style={{ width: 120 }}
          value={i18n.language}
          onChange={(lang) => i18n.changeLanguage(lang)}
          options={SUPPORTED_LANGS.map((l) => ({ value: l.key, label: l.label }))}
        />
      </span>

      {/* ── 账号胶囊 + 账号下拉面板（原型 .acc / .accpanel） ── */}
      <AccountPill onViewProfile={openProfile} />

      <ProfileDrawer
        open={profile.open}
        userId={profile.userId}
        title={profile.title}
        onClose={() => setProfile((p) => ({ ...p, open: false }))}
      />
    </>
  );
};
