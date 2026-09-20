import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Avatar, Button, Input, Select, Spin, Upload, message } from 'antd';
import { EditOutlined, SaveOutlined, CloseOutlined, UploadOutlined } from '@ant-design/icons';
import { T, S } from '../../config/theme';
import '../../styles/profile.css';
import { API_URL, authHeaders, getStoredUser, USER_KEY } from '../../utility';
import { roleText, serviceRolesText, cleanCode } from '../../config/labels';
import { SUPPORTED_LANGS } from '../../i18n';
import { t } from '../../i18n/t';
import { StatusTag } from '../../components/common/StatusTag';

/** 账户详情页（运营端）：四层角色通用，按角色渲染 4 个全宽 panel。仅 operator 自身可编辑。 */

export interface AccountProfile {
  id: string;
  phone?: string | null;
  wxOpenid?: string | null;
  nickname?: string | null;
  avatar?: string | null;
  realName?: string | null;
  bio?: string | null;
  email?: string | null;
  idCard?: string | null;
  realNameStatus?: 'UNVERIFIED' | 'PENDING' | 'APPROVED' | 'REJECTED';
  realNameVerifiedAt?: string | null;
  vipLevel?: number;
  locale?: string;
  role?: 'USER' | 'SERVICE_PROVIDER' | 'AGENT' | 'ADMIN';
  serviceRoles?: string[];
  pendingServiceRoles?: string[];
  providerStatus?: 'PENDING' | 'APPROVED';
  regionId?: string | null;
  agentId?: string | null;
  regionPath?: string | null;
  status?: 'ACTIVE' | 'DISABLED';
  providerWallet?: { balance: number; frozen: number; totalIncome: number; withdrawn: number } | null;
  region?: { id: string; code: string; name: string; regionPath: string } | null;
  agent?: { id: string; nickname?: string | null; phone?: string | null } | null;
  _count?: { projects: number; templates: number; orders: number; withdrawals: number };
  createdAt?: string;
  lastLoginAt?: string | null;
  points?: number;
  totalSpent?: number;
  userBalance?: number;
  followingProviderCount?: number;
  // 角色衍生字段
  monthlyTurnover?: number;
  commission?: number;
  userCount?: number;
  providerCount?: number;
  monthlyOrders?: number;
  pendingProviderReviews?: number;
  onSaleServices?: number;
  monthlyIncome?: number;
  adminRole?: string;
  permissionLevel?: number;
  permissionTags?: string[];
  vipTier?: string;
  activeOrders?: number;
}

/** 页内简写（组件内部大量使用，避免全量改名） */
type Profile = AccountProfile;

/** 实名认证状态 → i18n 文案 + StatusTag 色调（文案调用时解析，随语言切换） */
const REALNAME_TONE: Record<string, 'ok' | 'warn' | 'bad' | 'mut'> = {
  UNVERIFIED: 'mut',
  PENDING: 'warn',
  APPROVED: 'ok',
  REJECTED: 'bad',
};
const realnameStatus = (
  s?: string | null,
): { text: string; tone: 'ok' | 'warn' | 'bad' | 'mut' } => {
  const key = s ?? 'UNVERIFIED';
  return { text: t(`status.realname.${key}`), tone: REALNAME_TONE[key] ?? 'mut' };
};

const EDITABLE = ['nickname', 'realName', 'email', 'bio', 'locale', 'idCard', 'avatar'] as const;
type EditableKey = (typeof EDITABLE)[number];

const absUrl = (u?: string | null) =>
  !u ? '' : u.startsWith('http') ? u : API_URL.replace(/\/api$/, '') + u;

const maskPhone = (phone?: string | null) => {
  if (!phone || phone.length < 7) return phone || '—';
  return `${phone.slice(0, 3)}****${phone.slice(-4)}`;
};

const formatDate = (d?: string | null) => {
  if (!d) return '—';
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('zh-CN');
};

const formatDateTime = (d?: string | null) => {
  if (!d) return '—';
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('zh-CN', { hour12: false });
};

const yuan = (cents?: number | null) =>
  cents == null ? '—' : `¥${(cents / 100).toLocaleString('zh-CN')}`;

const num = (n?: number | null) => (n == null ? '—' : n.toLocaleString('zh-CN'));

const tagColor = (type?: 'ok' | 'warn' | 'bad' | 'mut' | 'ac') => {
  switch (type) {
    case 'ok':
      return { color: T.up, bg: T.upBg };
    case 'warn':
      return { color: T.warn, bg: T.warnBg };
    case 'bad':
      return { color: T.down, bg: T.downBg };
    case 'ac':
      return { color: T.accent, bg: T.accentSoft };
    case 'mut':
    default:
      return { color: T.ink3, bg: T.mutBg };
  }
};

/** 把 theme 令牌注入 CSS 变量，供 profile.css 引用（保持配色唯一来源，禁止在 CSS 里硬编码色值） */
export const profileCssVars = {
  '--line': T.border,
  '--accent': T.accent,
  '--accent-soft': T.accentSoft,
  '--ink1': T.ink1,
  '--ink3': T.ink3,
} as React.CSSProperties;

/**
 * 只读版账户详情分区（不含 Hero / 编辑按钮）。
 * 供 ProfileDrawer 在监督视角复用，保证「账户详情」页与「用户资料」抽屉同一套布局。
 */
export const AccountDetailSections = ({ profile }: { profile: AccountProfile }) => (
  <div className="profile-sections" style={profileCssVars}>
    <RoleSections profile={profile} editing={false} form={{}} setForm={() => {}} />
  </div>
);

export const ProfilePage = () => {
  const [params, setParams] = useSearchParams();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Partial<Record<EditableKey, string | null>>>({});

  const load = async () => {
    setLoading(true);
    const res = await fetch(API_URL + '/auth/me', { headers: authHeaders() });
    const data = await res.json();
    setProfile(data);
    setLoading(false);
    if (params.get('mode') === 'edit') setEditing(true);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 若以 ?mode=edit 进入（外部直达同路由），组件已挂载、mount 效应不会重跑，
  // 故这里监听 query 变化，进入页面即进入编辑态。
  useEffect(() => {
    if (profile && params.get('mode') === 'edit' && !editing) {
      startEdit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, profile]);

  const startEdit = () => {
    if (!profile) return;
    setForm({
      nickname: profile.nickname ?? '',
      realName: profile.realName ?? '',
      email: profile.email ?? '',
      bio: profile.bio ?? '',
      locale: profile.locale ?? 'zh-CN',
      idCard: profile.idCard ?? '',
      avatar: profile.avatar ?? '',
    });
    setEditing(true);
  };

  const cancel = () => {
    setForm({});
    setEditing(false);
    setParams({});
  };

  const uploadAvatar = async (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch(API_URL + '/assets/upload', { method: 'POST', headers: authHeaders(), body: fd });
    const data = await res.json();
    if (!res.ok || !data?.url) {
      message.error('头像上传失败');
      return;
    }
    setForm((f) => ({ ...f, avatar: data.url }));
    message.success('头像已选择，保存后生效');
  };

  const save = async () => {
    if (!profile) return;
    const payload: Record<string, string> = {};
    EDITABLE.forEach((k) => {
      const v = form[k];
      if (v !== undefined && v !== (profile as any)[k]) payload[k] = v as string;
    });
    if (Object.keys(payload).length === 0) {
      cancel();
      return;
    }
    setSaving(true);
    const res = await fetch(API_URL + '/auth/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(payload),
    });
    const updated = await res.json();
    setSaving(false);
    if (!res.ok) {
      message.error(updated?.message || '保存失败');
      return;
    }
    setProfile(updated);
    // 仅同步非敏感会话字段，避免把手机号 / 身份证 / 微信 openid / 邮箱 / 真实姓名等 PII 写入 localStorage
    const SAFE_SESSION_KEYS = [
      'id', 'role', 'nickname', 'avatar', 'locale', 'regionPath', 'regionId', 'agentId', 'agent',
      'region', 'status', 'providerStatus', 'vipLevel', 'realNameStatus', 'serviceRoles', 'pendingServiceRoles',
    ];
    const safeUpdated = Object.fromEntries(
      SAFE_SESSION_KEYS.filter((k) => k in (updated as Record<string, unknown>)).map((k) => [
        k,
        (updated as Record<string, unknown>)[k],
      ]),
    );
    localStorage.setItem(USER_KEY, JSON.stringify({ ...getStoredUser(), ...safeUpdated }));
    setForm({});
    setEditing(false);
    message.success('资料已保存');
  };

  if (loading || !profile) {
    return (
      <div style={{ padding: 48, display: 'grid', placeItems: 'center' }}>
        <Spin />
      </div>
    );
  }

  return (
    <div className="profile-page" style={{ padding: '20px 24px 32px', ...profileCssVars }}>
      <Hero profile={profile} editing={editing} saving={saving} onEdit={startEdit} onSave={save} onCancel={cancel} />
      {/* 原型 .profile-hero 的 margin-bottom: 14px */}
      <div className="profile-sections" style={{ marginTop: 14 }}>
        <RoleSections profile={profile} editing={editing} form={form} setForm={setForm} />
      </div>
    </div>
  );
};

/* ───────── 顶部 Hero ───────── */
const Hero = ({
  profile,
  editing,
  saving,
  onEdit,
  onSave,
  onCancel,
}: {
  profile: Profile;
  editing: boolean;
  saving: boolean;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
}) => {
  const displayName = profile.realName || profile.nickname || profile.phone || '未命名';
  const roleLabel = roleText(profile.role);
  const id = cleanCode(profile.id);
  const regionName = profile.region?.name || profile.regionPath || '总部';
  const dateLabel = profile.role === 'USER' ? '注册' : '入驻';
  const dateValue = formatDate(profile.createdAt);

  return (
    <div
      className="profile-hero"
      style={{
        ...S.panel,
        padding: '18px 20px', // 原型 .profile-hero
      }}
    >
      <Avatar
        size={64}
        src={absUrl(profile.avatar) || undefined}
        style={{
          background: `linear-gradient(135deg, ${T.accent}, #a93a20)`,
          color: '#fff',
          fontSize: 26, // 原型 .profile-hero .pav
          fontWeight: 700,
          flex: 'none',
        }}
      >
        {(displayName || '?').slice(0, 1)}
      </Avatar>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <b style={{ fontSize: 18, color: T.ink1 }}>{displayName}</b>
          <StatusTag type="ac">{roleLabel}</StatusTag>
        </div>
        <div style={{ fontSize: 12.5, color: T.ink3, marginTop: 4 }}>
          ID {id} · 手机 {maskPhone(profile.phone)} · {regionName} · {dateLabel} {dateValue}
        </div>
      </div>
      <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center', flex: 'none' }}>
        {editing ? (
          <>
            <Button icon={<SaveOutlined />} type="primary" loading={saving} onClick={onSave}>
              保存
            </Button>
            <Button icon={<CloseOutlined />} onClick={onCancel}>
              取消
            </Button>
          </>
        ) : (
          <Button icon={<EditOutlined />} type="primary" onClick={onEdit}>
            编辑
          </Button>
        )}
      </div>
    </div>
  );
};

/* ───────── 按角色渲染分区 ───────── */
const RoleSections = ({
  profile,
  editing,
  form,
  setForm,
}: {
  profile: Profile;
  editing: boolean;
  form: Partial<Record<EditableKey, string | null>>;
  setForm: React.Dispatch<React.SetStateAction<Partial<Record<EditableKey, string | null>>>>;
}) => {
  const role = profile.role;
  if (role === 'ADMIN') return <AdminSections profile={profile} editing={editing} form={form} setForm={setForm} />;
  if (role === 'AGENT') return <AgentSections profile={profile} editing={editing} form={form} setForm={setForm} />;
  if (role === 'SERVICE_PROVIDER')
    return <ProviderSections profile={profile} editing={editing} form={form} setForm={setForm} />;
  return <UserSections profile={profile} editing={editing} form={form} setForm={setForm} />;
};

const AdminSections = ({
  profile,
  editing,
  form,
  setForm,
}: {
  profile: Profile;
  editing: boolean;
  form: Partial<Record<EditableKey, string | null>>;
  setForm: React.Dispatch<React.SetStateAction<Partial<Record<EditableKey, string | null>>>>;
}) => {
  return (
    <>
      <Panel title="基础数据" hint="身份与联系信息">
        <Field label="用户 ID" value={cleanCode(profile.id)} />
        <EditableField
          label="姓名"
          fieldKey="realName"
          profile={profile}
          editing={editing}
          form={form}
          setForm={setForm}
        />
        <EditableField
          label="昵称"
          fieldKey="nickname"
          profile={profile}
          editing={editing}
          form={form}
          setForm={setForm}
          placeholder="未填写"
        />
        <Field label="手机号" value={maskPhone(profile.phone)} />
        <EditableField
          label="邮箱"
          fieldKey="email"
          profile={profile}
          editing={editing}
          form={form}
          setForm={setForm}
          placeholder="未绑定"
        />
        <AvatarField profile={profile} editing={editing} form={form} setForm={setForm} />
      </Panel>

      <Panel title="归属与作用域" hint="角色层级与数据可见范围">
        <Field label="系统角色" value="管理员（ADMIN）" />
        <Field label="所属区域" value="总部" />
        <Field label="数据作用域" value="全平台（ALL）" />
        <Field label="登录层级" value="管理总台" />
      </Panel>

      <Panel title="账户状态" hint="状态与时间信息">
        <Field label="账户状态" value={<StatusTag type="ok">正常</StatusTag>} />
        <Field label="注册时间" value={formatDate(profile.createdAt)} />
        <Field label="最后登录" value={formatDateTime(profile.lastLoginAt)} />
        <Field label="写操作权限" value={<StatusTag type="ok">可写（可代操作）</StatusTag>} />
      </Panel>

      <Panel
        title="职能与权限"
        hint="管理员特有 · 职能角色与权限位阶"
        footer={
          profile.permissionTags && profile.permissionTags.length > 0 ? (
            <div className="perm-tags">
              {profile.permissionTags.map((p) => (
                <span className="pt" key={p}>
                  {p}
                </span>
              ))}
            </div>
          ) : undefined
        }
      >
        <Field label="职能角色" value={<StatusTag type="ac">{profile.adminRole || '超级管理员'}</StatusTag>} />
        <Field label="权限位阶" value={`${profile.permissionLevel ?? 100}（最高）`} />
        <Field label="角色类型" value="内置角色" />
        <Field label="功能权限" value={`${profile.permissionTags?.length ?? 0} 项`} />
      </Panel>
    </>
  );
};

const AgentSections = ({
  profile,
  editing,
  form,
  setForm,
}: {
  profile: Profile;
  editing: boolean;
  form: Partial<Record<EditableKey, string | null>>;
  setForm: React.Dispatch<React.SetStateAction<Partial<Record<EditableKey, string | null>>>>;
}) => {
  const regionName = profile.region?.name || profile.regionPath || '未分配';
  return (
    <>
      <Panel title="基础数据" hint="身份与联系信息">
        <Field label="代理商 ID" value={cleanCode(profile.id)} />
        <Field label="代理商名称" value={regionName} />
        <EditableField
          label="昵称"
          fieldKey="nickname"
          profile={profile}
          editing={editing}
          form={form}
          setForm={setForm}
          placeholder="未填写"
        />
        <Field label="手机号" value={maskPhone(profile.phone)} />
        <EditableField
          label="邮箱"
          fieldKey="email"
          profile={profile}
          editing={editing}
          form={form}
          setForm={setForm}
          placeholder="未绑定"
        />
        <AvatarField profile={profile} editing={editing} form={form} setForm={setForm} />
      </Panel>

      <Panel title="归属与作用域" hint="角色层级与数据可见范围">
        <Field label="系统角色" value="代理商（AGENT）" />
        <Field label="绑定辖区" value={regionName} />
        <Field label="数据作用域" value="本辖区（REGION）" />
        <Field label="登录层级" value="代理商中心" />
      </Panel>

      <Panel title="账户状态" hint="状态与时间信息">
        <Field
          label="账户状态"
          value={<StatusTag type={profile.status === 'ACTIVE' ? 'ok' : 'bad'}>{t(profile.status === 'ACTIVE' ? 'status.ACTIVE' : 'status.DISABLED')}</StatusTag>}
        />
        <Field label="入驻时间" value={formatDate(profile.createdAt)} />
        <Field label="最后登录" value={formatDateTime(profile.lastLoginAt)} />
        <Field label="写操作权限" value={<StatusTag type="ok">可写（辖区内）</StatusTag>} />
      </Panel>

      <Panel title="辖区经营" hint="代理商特有 · 辖区经营指标（只读）">
        <Field label="月流水" value={yuan(profile.monthlyTurnover)} />
        <Field label="辖区抽成" value={`${yuan(profile.commission)}（10%）`} />
        <Field label="辖区用户数" value={num(profile.userCount)} />
        <Field label="辖区服务商数" value={num(profile.providerCount)} />
        <Field label="本月订单数" value={num(profile.monthlyOrders)} />
        <Field
          label="入驻待初审"
          value={
            profile.pendingProviderReviews ? (
              <StatusTag type="warn">{profile.pendingProviderReviews} 家</StatusTag>
            ) : (
              '—'
            )
          }
        />
      </Panel>
    </>
  );
};

const ProviderSections = ({
  profile,
  editing,
  form,
  setForm,
}: {
  profile: Profile;
  editing: boolean;
  form: Partial<Record<EditableKey, string | null>>;
  setForm: React.Dispatch<React.SetStateAction<Partial<Record<EditableKey, string | null>>>>;
}) => {
  const regionName = profile.region?.name || profile.regionPath || '未分配';
  const mainRole = profile.serviceRoles?.[0] ? serviceRolesText([profile.serviceRoles[0]]) : '—';
  const allRoles = serviceRolesText(profile.serviceRoles);
  const realName = realnameStatus(profile.realNameStatus);
  return (
    <>
      <Panel title="基础数据" hint="身份与联系信息">
        <Field label="服务商 ID" value={cleanCode(profile.id)} />
        <EditableField
          label="姓名"
          fieldKey="realName"
          profile={profile}
          editing={editing}
          form={form}
          setForm={setForm}
        />
        <EditableField
          label="昵称"
          fieldKey="nickname"
          profile={profile}
          editing={editing}
          form={form}
          setForm={setForm}
          placeholder="未填写"
        />
        <Field label="手机号" value={maskPhone(profile.phone)} />
        <EditableField
          label="邮箱"
          fieldKey="email"
          profile={profile}
          editing={editing}
          form={form}
          setForm={setForm}
          placeholder="未绑定"
        />
        <AvatarField profile={profile} editing={editing} form={form} setForm={setForm} />
      </Panel>

      <Panel title="归属与作用域" hint="角色层级与数据可见范围">
        <Field label="系统角色" value="服务商（SERVICE_PROVIDER）" />
        <Field label="所属区域" value={regionName} />
        <Field label="数据作用域" value="自身（SELF）" />
        <Field label="登录层级" value="服务商中心" />
      </Panel>

      <Panel title="账户状态" hint="状态与时间信息">
        <Field
          label="账户状态"
          value={
            <StatusTag type={profile.providerStatus === 'APPROVED' ? 'ok' : 'warn'}>
              {t(profile.providerStatus === 'APPROVED' ? 'status.APPROVED' : 'status.PENDING')}
            </StatusTag>
          }
        />
        <Field label="入驻时间" value={formatDate(profile.createdAt)} />
        <Field label="最后登录" value={formatDateTime(profile.lastLoginAt)} />
        <Field label="写操作权限" value={<StatusTag type="ok">可写（自身服务）</StatusTag>} />
      </Panel>

      <Panel title="服务与资质" hint="服务商特有 · 服务类型与资质认证">
        <Field label="服务类型" value={`${mainRole}（主营）`} />
        <Field
          label="可服务项目"
          value={allRoles ? <StatusTag type="ac">{allRoles}</StatusTag> : '—'}
        />
        <Field
          label="资质认证"
          value={
            <>
              <StatusTag type={realName.tone}>{realName.text}</StatusTag>
              {profile.idCard && <span style={{ marginLeft: 8, color: T.ink3 }}>{maskId(profile.idCard)}</span>}
            </>
          }
        />
        <Field label="在售服务数" value={num(profile.onSaleServices)} />
        <Field label="本月收益" value={yuan(profile.monthlyIncome)} />
        <Field label="可提现余额" value={yuan(profile.providerWallet?.balance)} />
      </Panel>
    </>
  );
};

const UserSections = ({
  profile,
  editing,
  form,
  setForm,
}: {
  profile: Profile;
  editing: boolean;
  form: Partial<Record<EditableKey, string | null>>;
  setForm: React.Dispatch<React.SetStateAction<Partial<Record<EditableKey, string | null>>>>;
}) => {
  const cityName = profile.region?.name || profile.regionPath || '未设置';
  const vipColor = (profile.vipLevel ?? 0) >= 1 ? 'ac' : 'mut';
  return (
    <>
      <Panel title="基础数据" hint="身份与联系信息">
        <Field label="用户 ID" value={cleanCode(profile.id)} />
        <EditableField
          label="姓名"
          fieldKey="realName"
          profile={profile}
          editing={editing}
          form={form}
          setForm={setForm}
        />
        <EditableField
          label="昵称"
          fieldKey="nickname"
          profile={profile}
          editing={editing}
          form={form}
          setForm={setForm}
          placeholder="未填写"
        />
        <Field label="手机号" value={maskPhone(profile.phone)} />
        <EditableField
          label="邮箱"
          fieldKey="email"
          profile={profile}
          editing={editing}
          form={form}
          setForm={setForm}
          placeholder="未绑定"
        />
        <AvatarField profile={profile} editing={editing} form={form} setForm={setForm} />
      </Panel>

      <Panel title="归属与作用域" hint="角色层级与数据可见范围">
        <Field label="系统角色" value="客户（USER）" />
        <Field label="所在城市" value={cityName} />
        <Field label="数据作用域" value="自身（SELF）" />
        <Field label="登录层级" value="用户视角" />
      </Panel>

      <Panel title="账户状态" hint="状态与时间信息">
        <Field
          label="账户状态"
          value={<StatusTag type={profile.status === 'ACTIVE' ? 'ok' : 'bad'}>{t(profile.status === 'ACTIVE' ? 'status.ACTIVE' : 'status.DISABLED')}</StatusTag>}
        />
        <Field label="注册时间" value={formatDate(profile.createdAt)} />
        <Field label="最后登录" value={formatDateTime(profile.lastLoginAt)} />
        <Field label="写操作权限" value={<StatusTag type="mut">只读（个人资料）</StatusTag>} />
      </Panel>

      <Panel title="会员与资产" hint="用户特有 · 会员等级与账户资产">
        <Field
          label="会员等级"
          value={<StatusTag type={vipColor}>{profile.vipTier || '普通用户'}</StatusTag>}
        />
        <Field label="积分" value={num(profile.points)} />
        <Field label="钱包余额" value={yuan(profile.userBalance)} />
        <Field label="累计消费" value={yuan(profile.totalSpent)} />
        <Field label="进行中订单" value={num(profile.activeOrders)} />
        <Field label="关注服务商" value={num(profile.followingProviderCount)} />
      </Panel>
    </>
  );
};

/* ───────── 原子组件 ───────── */
const Panel = ({
  title,
  hint,
  footer,
  children,
}: {
  title: string;
  hint: string;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) => (
  <div className="profile-panel" style={S.panel}>
    <div className="panel-head" style={S.panelHead}>
      <span className="panel-title">{title}</span>
      <span className="panel-hint" style={S.hint}>
        {hint}
      </span>
    </div>
    <div className="profile-grid">{children}</div>
    {footer}
  </div>
);

const Field = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="pfield">
    <span className="pf-label">{label}</span>
    <span className="pf-val">{value ?? '—'}</span>
  </div>
);

const EditableField = ({
  label,
  fieldKey,
  profile,
  editing,
  form,
  setForm,
  placeholder = '未填写',
}: {
  label: string;
  fieldKey: EditableKey;
  profile: Profile;
  editing: boolean;
  form: Partial<Record<EditableKey, string | null>>;
  setForm: React.Dispatch<React.SetStateAction<Partial<Record<EditableKey, string | null>>>>;
  placeholder?: string;
}) => {
  const value = (editing ? form[fieldKey] : (profile as any)[fieldKey]) ?? '';
  if (!editing) {
    const display = (profile as any)[fieldKey];
    return <Field label={label} value={display || <span style={{ color: T.ink3 }}>{placeholder}</span>} />;
  }

  if (fieldKey === 'locale') {
    return (
      <div className="pfield">
        <span className="pf-label">{label}</span>
        <Select
          size="small"
          style={{ width: '100%' }}
          value={(form.locale ?? 'zh-CN') as string}
          onChange={(v) => setForm((f) => ({ ...f, locale: v }))}
          options={SUPPORTED_LANGS.map((l) => ({ value: l.key, label: l.label }))}
        />
      </div>
    );
  }

  return (
    <div className="pfield">
      <span className="pf-label">{label}</span>
      <Input
        size="small"
        value={value as string}
        onChange={(e) => setForm((f) => ({ ...f, [fieldKey]: e.target.value }))}
        placeholder={placeholder}
      />
    </div>
  );
};

const AvatarField = ({
  profile,
  editing,
  form,
  setForm,
}: {
  profile: Profile;
  editing: boolean;
  form: Partial<Record<EditableKey, string | null>>;
  setForm: React.Dispatch<React.SetStateAction<Partial<Record<EditableKey, string | null>>>>;
}) => {
  const currentAvatar = editing ? form.avatar : profile.avatar;
  const displayName = profile.realName || profile.nickname || profile.phone || '未命名';
  return (
    <div className="pfield">
      <span className="pf-label">头像</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Avatar size={32} src={absUrl(currentAvatar) || undefined} style={{ background: T.panel2, color: T.ink2 }}>
          {(displayName || '?').slice(0, 1)}
        </Avatar>
        {editing ? (
          <Upload
            showUploadList={false}
            beforeUpload={(file) => {
              const upload = async () => {
                const fd = new FormData();
                fd.append('file', file as File);
                const res = await fetch(API_URL + '/assets/upload', {
                  method: 'POST',
                  headers: authHeaders(),
                  body: fd,
                });
                const data = await res.json();
                if (res.ok && data?.url) {
                  setForm((f) => ({ ...f, avatar: data.url }));
                  message.success('头像已选择，保存后生效');
                } else {
                  message.error('头像上传失败');
                }
              };
              upload();
              return false;
            }}
          >
            <Button icon={<UploadOutlined />} size="small">
              上传头像
            </Button>
          </Upload>
        ) : currentAvatar ? (
          '已上传'
        ) : (
          <span style={{ color: T.ink3 }}>默认头像（姓名首字）</span>
        )}
      </div>
    </div>
  );
};

const maskId = (id: string) => (id.length > 4 ? `${id.slice(0, 4)}********${id.slice(-4)}` : id);
