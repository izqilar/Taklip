/**
 * 账户详情（原型 u-account）：镜像运营端 ProfilePage 的「客户（USER）」分区布局与配色。
 * 顶部 Hero 资料卡 + 四块 Panel（基础数据 / 归属与作用域 / 账户状态 / 会员与资产）。
 * 昵称支持内联编辑（PATCH /api/user 由 authStore.updateProfile 代发）。
 * 数据：GET /api/user/dashboard（profile + 资产字段）。
 */
import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '@/api/client';
import { useAuthStore } from '@/store/authStore';
import { PageHead, Panel, StatusBadge, LoadingDots, tierKeyOf, formatCents, cleanCode, maskPhone } from './shared';

/**
 * 镜像运营端 .pfield（profile.css）：2 列网格单元格，标签在上、值在下；
 * 奇数单元格（首列）带行尾边框，末行保留下边框（与运营端 CSS 行为一致）。
 * ⚠️ 必须定义在模块作用域：若在组件体内声明，每次父组件渲染都得到新的组件类型，
 *    React 会卸载/重挂整棵子树，导致其内部的 <img> 反复重新解码（头像闪烁）。
 */
const Field = ({ label, value, num }: { label: string; value: ReactNode; num?: boolean }) => (
  <div className="flex min-w-0 flex-col gap-1 border-b border-[rgba(74,60,42,0.10)] px-4 py-[11px] odd:border-e odd:border-[rgba(74,60,42,0.10)]">
    <span className="text-[11.5px] font-bold uppercase tracking-[.3px] text-[#6e5f4a]">{label}</span>
    <span
      className={`min-w-0 overflow-hidden text-ellipsis text-[13.5px] text-[#2a2118] ${num ? 'tabular-nums' : ''}`}
      style={num ? { fontFamily: "'Bahnschrift','DIN Alternate',Arial,system-ui,sans-serif" } : undefined}
    >
      {value || '—'}
    </span>
  </div>
);

/** 32px 圆形头像预览（镜像运营端 AvatarField：头像字段右侧 32px 头像 + 文案） */
const Avatar32 = ({ src, initial }: { src?: string | null; initial: string }) => (
  <span
    className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-bold text-white"
    style={{ background: 'linear-gradient(135deg,#c24b2e,#a93a20)' }}
  >
    {src ? <img src={src} alt="" className="h-8 w-8 rounded-full object-cover" /> : (initial || '?').slice(0, 1)}
  </span>
);

export default function Account() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [nickname, setNickname] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    api
      .get<any>('/api/user/dashboard')
      .then((d) => setProfile(d))
      .catch(() => setProfile(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading && !profile) return <LoadingDots />;

  const p = profile ?? {};
  const prof = p.profile ?? {};
  const name = prof.realName || prof.nickname || prof.phone || '—';
  const role = user?.role ?? 'USER';
  const roleLabel = t(`common:role.${role}`);
  const vipTier = tierKeyOf(prof.vipLevel);
  const regionName = prof.regionName || '未设置';
  // 用户 ID：与运营端 cleanCode 同口径（剥离测试前缀，真实 cuid 原样返回）
  const fullId = cleanCode(prof.id);

  const saveNickname = async () => {
    setMsg('');
    if (!nickname.trim()) {
      setMsg(t('common:userCenter.account.nicknameRequired'));
      return;
    }
    setSaving(true);
    const ok = await updateProfile({ nickname: nickname.trim() });
    setSaving(false);
    if (ok) {
      setEditing(false);
      setMsg(t('common:userCenter.account.saved'));
      const d = await api.get<any>('/api/user/dashboard').catch(() => null);
      if (d) setProfile(d);
    } else {
      setMsg(t('common:userCenter.account.saveFailed'));
    }
  };

  return (
    <div className="space-y-4">
      <PageHead title={t('common:userCenter.account.title')} sub={t('common:userCenter.account.subtitle')} chip={<StatusBadge tone="accent">{roleLabel}</StatusBadge>} />

      {/* Hero 资料卡（镜像 admin profile-hero：S.panel + 64px 渐变头像 + 名称 + 角色 Pill + 信息行） */}
      <Panel>
        <div className="flex flex-wrap items-center gap-4 px-5 py-[18px]">
          <div
            className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full text-2xl font-bold text-white"
            style={{ background: 'linear-gradient(135deg,#c24b2e,#a93a20)' }}
          >
            {user?.avatar ? <img src={user.avatar} alt="" className="h-16 w-16 rounded-full object-cover" /> : (name ?? 'U').slice(0, 1)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-[18px] font-semibold text-[#2a2118]">{name}</span>
              <StatusBadge tone="accent">{roleLabel}</StatusBadge>
            </div>
            <div className="mt-1 text-[12.5px] text-[#6e5f4a]">
              ID {fullId} · 手机 {maskPhone(prof.phone)} · {regionName} · 注册 {prof.createdAt ? new Date(prof.createdAt).toLocaleDateString('zh-CN') : '—'}
            </div>
          </div>
          <div className="ms-auto flex shrink-0 gap-2">
            {editing ? (
              <>
                <button
                  type="button"
                  disabled={saving}
                  onClick={saveNickname}
                  className="rounded-lg bg-[#c24b2e] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
                >
                  {saving ? t('common:userCenter.loading') : t('common:userCenter.account.save')}
                </button>
                <button type="button" onClick={() => setEditing(false)} className="rounded-lg border border-[rgba(74,60,42,0.16)] px-3 py-1.5 text-sm text-[#4c4236]">
                  {t('common:button.cancel')}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => { setNickname(prof.nickname || ''); setEditing(true); }}
                className="rounded-lg border border-[#c24b2e] px-3 py-1.5 text-sm font-medium text-[#c24b2e]"
              >
                {t('common:userCenter.account.edit')}
              </button>
            )}
          </div>
        </div>
        {msg && <div className="border-t border-[rgba(74,60,42,0.08)] px-5 py-2 text-xs text-emerald-600">{msg}</div>}
      </Panel>

      {/* 基础数据（镜像 admin UserSections · 基础数据：profile-grid 2 列） */}
      <Panel title={t('common:userCenter.account.basisData')} hint={t('common:userCenter.account.basisHint')}>
        <div className="grid grid-cols-2">
          <Field label={t('common:userCenter.account.id')} value={fullId} num />
          <Field label={t('common:userCenter.account.name')} value={prof.realName} />
          <div className="flex min-w-0 flex-col gap-1 border-b border-[rgba(74,60,42,0.10)] px-4 py-[11px] odd:border-e odd:border-[rgba(74,60,42,0.10)]">
            <span className="text-[11.5px] font-bold uppercase tracking-[.3px] text-[#6e5f4a]">{t('common:userCenter.account.nickname')}</span>
            {editing ? (
              <input
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                className="w-full rounded-lg border border-[rgba(74,60,42,0.16)] px-3 py-1.5 text-[13.5px] outline-none focus:border-[#c24b2e]"
              />
            ) : (
              <span className="min-w-0 overflow-hidden text-ellipsis text-[13.5px] text-[#2a2118]">{prof.nickname || '—'}</span>
            )}
          </div>
          <Field label={t('common:userCenter.account.phone')} value={maskPhone(prof.phone)} num />
          <Field label={t('common:userCenter.account.email')} value={user?.email ?? null} />
          <Field
            label={t('common:userCenter.account.avatar')}
            value={
              <span className="flex items-center gap-2">
                <Avatar32 src={user?.avatar} initial={name} />
                <span>{user?.avatar ? t('common:userCenter.account.uploaded') : t('common:userCenter.account.defaultAvatar')}</span>
              </span>
            }
          />
        </div>
      </Panel>

      {/* 归属与作用域（镜像 admin UserSections · 归属与作用域：profile-grid 2 列） */}
      <Panel title={t('common:userCenter.account.scopeGroup')} hint={t('common:userCenter.account.scopeHint')}>
        <div className="grid grid-cols-2">
          <Field label={t('common:userCenter.account.systemRole')} value={t('common:userCenter.account.customerUser')} />
          <Field label={t('common:userCenter.account.region')} value={regionName} />
          <Field label={t('common:userCenter.account.scope')} value={t('common:userCenter.account.selfScope')} />
          <Field label={t('common:userCenter.account.loginLevel')} value={t('common:userCenter.account.userView')} />
        </div>
      </Panel>

      {/* 账户状态（镜像 admin UserSections · 账户状态：profile-grid 2 列） */}
      <Panel title={t('common:userCenter.account.statusGroup')} hint={t('common:userCenter.account.statusHint')}>
        <div className="grid grid-cols-2">
          <Field
            label={t('common:userCenter.account.accountStatus')}
            value={
              <StatusBadge tone={user?.status === 'DISABLED' ? 'bad' : 'ok'}>
                {user?.status === 'DISABLED' ? t('common:userCenter.account.statusDisabled') : t('common:userCenter.account.statusActive')}
              </StatusBadge>
            }
          />
          <Field label={t('common:userCenter.account.registeredAt')} value={prof.createdAt ? new Date(prof.createdAt).toLocaleDateString('zh-CN') : '—'} />
          <Field label={t('common:userCenter.account.lastLogin')} value={p.lastLoginAt ? new Date(p.lastLoginAt).toLocaleString('zh-CN', { hour12: false }) : '—'} />
          <Field label={t('common:userCenter.account.writePerm')} value={<StatusBadge tone="mut">{t('common:userCenter.account.readonly')}</StatusBadge>} />
        </div>
      </Panel>

      {/* 会员与资产（镜像 admin UserSections · 会员与资产：profile-grid 2 列） */}
      <Panel title={t('common:userCenter.account.vipGroup')} hint={t('common:userCenter.account.vipHint')}>
        <div className="grid grid-cols-2">
          <Field label={t('common:userCenter.account.vipLevel')} value={<StatusBadge tone={(prof.vipLevel ?? 0) >= 1 ? 'accent' : 'mut'}>{vipTier}</StatusBadge>} />
          <Field label={t('common:userCenter.account.points')} value={(p.points ?? 0).toLocaleString('zh-CN')} num />
          <Field label={t('common:userCenter.account.balance')} value={formatCents(p.balanceCents)} num />
          <Field label={t('common:userCenter.account.totalSpent')} value={formatCents(p.totalSpentCents)} num />
          <Field label={t('common:userCenter.account.activeOrders')} value={(p.activeOrders ?? 0).toLocaleString('zh-CN')} num />
          <Field label={t('common:userCenter.account.followingProviders')} value={(p.followingProviderCount ?? 0).toLocaleString('zh-CN')} num />
        </div>
      </Panel>
    </div>
  );
}
