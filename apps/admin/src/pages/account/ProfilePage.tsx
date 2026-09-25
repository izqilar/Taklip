import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Avatar, Button, Image, Input, Modal, Select, Spin, Tooltip, Upload, message } from 'antd';
import {
  EditOutlined,
  SaveOutlined,
  CloseOutlined,
  UploadOutlined,
  IdcardOutlined,
  EyeOutlined,
  MobileOutlined,
  LockOutlined,
  WechatOutlined,
  QqOutlined,
  AlipayOutlined,
} from '@ant-design/icons';
import { T, S } from '../../config/theme';
import '../../styles/profile.css';
import { API_URL, authHeaders, getStoredUser, USER_KEY, formatCents } from '../../utility';
import { roleText, serviceRolesText, cleanCode } from '../../config/labels';
import { SUPPORTED_LANGS } from '../../i18n';
import { t } from '../../i18n/t';
import { StatusTag } from '../../components/common/StatusTag';
import { PageHead } from '../../components/ui/PageHead';
import { useLayer } from '../../providers/layerContext';

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
  /** 身份证人像面影像 URL（/uploads/xxx） */
  idCardFront?: string | null;
  /** 身份证国徽面影像 URL */
  idCardBack?: string | null;
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

const EDITABLE = [
  'nickname',
  'realName',
  'email',
  'bio',
  'locale',
  'idCard',
  'idCardFront',
  'idCardBack',
  'avatar',
] as const;
type EditableKey = (typeof EDITABLE)[number];

/* ───────── 字段校验（与服务端 AuthService 同口径，前端只做即时提示，服务端仍二次校验） ───────── */

/** 手机号：大陆 11 位、1 开头、第二位 3-9 */
export const isPhone = (v?: string | null) => !!v && /^1[3-9]\d{9}$/.test(v.trim());

/** 邮箱：宽松通用格式 */
export const isEmail = (v?: string | null) => !!v && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

/**
 * 大陆二代身份证号：18 位 + GB 11643-1999 mod 11-2 校验位验真。
 * 与服务端 `AuthService.isValidIdCard` 同一算法（服务端会二次校验，前端仅为即时反馈）。
 */
export function isValidIdCard(v?: string | null) {
  if (!v) return false;
  const id = v.trim().toUpperCase();
  if (!/^\d{17}[\dX]$/.test(id)) return false;
  const weights = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
  const checks = ['1', '0', 'X', '9', '8', '7', '6', '5', '4', '3', '2'];
  let sum = 0;
  for (let i = 0; i < 17; i += 1) sum += Number(id[i]) * weights[i];
  return checks[sum % 11] === id[17];
}

/** 上传图片到素材库：返回 URL，失败抛错 */
async function uploadImageFile(file: File): Promise<string> {
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch(API_URL + '/assets/upload', { method: 'POST', headers: authHeaders(), body: fd });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.url) throw new Error(data?.message || '上传失败');
  return data.url as string;
}

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

// 金额（分）→ ¥ 字符串：统一收敛到 @h5design/core 的 formatCents（修复此前丢失两位小数：¥123 应显示 ¥123.00）
const yuan = formatCents;

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
    <RoleSections profile={profile} editing={false} form={{}} setForm={() => {}} readOnly />
  </div>
);

export const ProfilePage = () => {
  const [params, setParams] = useSearchParams();
  const { view, objectScope, isOwnView } = useLayer();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  // 视察模式：非总台视角 + 已选定被视察对象 → 只读展示该对象档案，禁止代编辑
  const [inspecting, setInspecting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Partial<Record<EditableKey, string | null>>>({});

  const load = async () => {
    setLoading(true);
    setEditing(false);
    setForm({});
    // 自身视角（ADMIN 总台自查 + 真实 SERVICE_PROVIDER/AGENT/USER 自有工作台）：
    // 展示当前登录账号自身，可编辑。注意：isOwnView 才是正确判据，不能只看 view==='console'，
    // 否则真实角色登录运营端会被误判为「视察」去拉 /admin/users/:id（objectScope 为空=崩溃）。
    // 仅仅 ADMIN 在 agent/provider/user 视察他人（非自身视角）才走只读分支。
    if (isOwnView) {
      setInspecting(false);
      const res = await fetch(API_URL + '/auth/me', { headers: authHeaders() });
      const data = await res.json();
      setProfile(data);
    } else {
      setInspecting(true);
      const res = await fetch(`${API_URL}/admin/users/${encodeURIComponent(objectScope!.id)}`, {
        headers: authHeaders(),
      });
      const data = await res.json();
      setProfile(res.ok ? data : null);
    }
    setLoading(false);
    if (params.get('mode') === 'edit' && !isOwnView) setEditing(true);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, objectScope?.id]);

  // 若以 ?mode=edit 进入（外部直达同路由），组件已挂载、mount 效应不会重跑，
  // 故这里监听 query 变化，进入页面即进入编辑态（仅自身账号允许）。
  useEffect(() => {
    if (profile && params.get('mode') === 'edit' && !editing && !inspecting) {
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
      idCardFront: profile.idCardFront ?? '',
      idCardBack: profile.idCardBack ?? '',
      avatar: profile.avatar ?? '',
    });
    setEditing(true);
  };

  /** 子区块（手机号 / 密码 / 证件影像）单独保存后回填最新档案，避免整页刷新丢失编辑态 */
  const onUpdated = (updated: Profile) => {
    setProfile(updated);
    const SAFE = ['id', 'role', 'nickname', 'avatar', 'locale', 'regionPath', 'regionId', 'agentId'];
    const src = updated as unknown as Record<string, unknown>;
    const patch: Record<string, unknown> = {};
    SAFE.forEach((k) => {
      if (k in src) patch[k] = src[k];
    });
    localStorage.setItem(USER_KEY, JSON.stringify({ ...getStoredUser(), ...patch }));
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
    if (!profile || inspecting) return;
    const payload: Record<string, string> = {};
    EDITABLE.forEach((k) => {
      const v = form[k];
      if (v !== undefined && v !== (profile as any)[k]) payload[k] = v as string;
    });
    if (Object.keys(payload).length === 0) {
      cancel();
      return;
    }
    // 保存前校验（手机号 / 邮箱 / 身份证号）：与服务端同口径，命中即中止并提示，避免 400 后才发现填错
    if (payload.idCard !== undefined && payload.idCard !== '' && !isValidIdCard(payload.idCard)) {
      message.error('身份证号校验失败：应为 18 位，且校验位不正确');
      return;
    }
    if (payload.email !== undefined && payload.email !== '' && !isEmail(payload.email)) {
      message.error('邮箱格式不正确');
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

  // 非自身视角（仅为 ADMIN 视察他人）且未选定任何被视察对象 → 提示先选对象
  const needSelection = !isOwnView && !objectScope?.id;
  if (loading) {
    return (
      <div style={{ padding: 48, display: 'grid', placeItems: 'center' }}>
        <Spin />
      </div>
    );
  }
  if (!profile) {
    return (
      <div style={{ padding: 48, display: 'grid', placeItems: 'center', gap: 8, color: T.ink3 }}>
        {needSelection ? (
          <span>请在顶部检索框选择具体对象后，再查看其账号详情</span>
        ) : (
          <span>未找到该对象的账号档案</span>
        )}
      </div>
    );
  }

  return (
    <div className="profile-page" style={{ padding: '20px 24px 32px', ...profileCssVars }}>
      {/* 页面标题与侧栏菜单「账户详情」共用 menu.account.profile 同一真值，避免两处文案漂移 */}
      <PageHead title={t('menu.account.profile', '账户详情')} chip={inspecting ? '总台 · 视察' : undefined} />
      <Hero
        profile={profile}
        editing={editing}
        saving={saving}
        inspecting={inspecting}
        onEdit={startEdit}
        onSave={save}
        onCancel={cancel}
      />
      {/* 原型 .profile-hero 的 margin-bottom: 14px */}
      <div className="profile-sections" style={{ marginTop: 14 }}>
        <RoleSections
          profile={profile}
          editing={editing}
          form={form}
          setForm={setForm}
          readOnly={inspecting}
          onUpdated={onUpdated}
        />
      </div>
    </div>
  );
};

/* ───────── 顶部 Hero ───────── */
const Hero = ({
  profile,
  editing,
  saving,
  inspecting,
  onEdit,
  onSave,
  onCancel,
}: {
  profile: Profile;
  editing: boolean;
  saving: boolean;
  inspecting: boolean;
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
        {inspecting ? (
          <StatusTag type="mut">视察模式 · 只读</StatusTag>
        ) : editing ? (
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
/** 四层角色分区的公共入参：身份/安全区块需要的「只读标记 + 保存回填」额外透传 */
type SectionProps = {
  profile: Profile;
  editing: boolean;
  form: Partial<Record<EditableKey, string | null>>;
  setForm: React.Dispatch<React.SetStateAction<Partial<Record<EditableKey, string | null>>>>;
  /** 只读（视察他人 / 抽屉复用）：隐藏编辑与上传入口，手机号等敏感字段脱敏 */
  readOnly?: boolean;
  /** 子区块单独保存成功后的档案回填 */
  onUpdated?: (profile: Profile) => void;
};

const RoleSections = ({ profile, editing, form, setForm, readOnly, onUpdated }: SectionProps) => {
  const role = profile.role;
  const p = { profile, editing, form, setForm, readOnly, onUpdated };
  if (role === 'ADMIN') return <AdminSections {...p} />;
  if (role === 'AGENT') return <AgentSections {...p} />;
  if (role === 'SERVICE_PROVIDER') return <ProviderSections {...p} />;
  return <UserSections {...p} />;
};

const AdminSections = ({ profile, editing, form, setForm, readOnly, onUpdated }: SectionProps) => {
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

      <IdentityPanel
        profile={profile}
        editing={editing}
        form={form}
        setForm={setForm}
        readOnly={readOnly}
      />
      <SecurityPanel profile={profile} readOnly={readOnly} onUpdated={onUpdated} />

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

const AgentSections = ({ profile, editing, form, setForm, readOnly, onUpdated }: SectionProps) => {
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

      <IdentityPanel
        profile={profile}
        editing={editing}
        form={form}
        setForm={setForm}
        readOnly={readOnly}
      />
      <SecurityPanel profile={profile} readOnly={readOnly} onUpdated={onUpdated} />

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

const ProviderSections = ({ profile, editing, form, setForm, readOnly, onUpdated }: SectionProps) => {
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

      <IdentityPanel
        profile={profile}
        editing={editing}
        form={form}
        setForm={setForm}
        readOnly={readOnly}
      />
      <SecurityPanel profile={profile} readOnly={readOnly} onUpdated={onUpdated} />

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

const UserSections = ({ profile, editing, form, setForm, readOnly, onUpdated }: SectionProps) => {
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

      <IdentityPanel
        profile={profile}
        editing={editing}
        form={form}
        setForm={setForm}
        readOnly={readOnly}
      />
      <SecurityPanel profile={profile} readOnly={readOnly} onUpdated={onUpdated} />

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

/* ───────── 身份认证资料（四层角色通用） ───────── */

/**
 * 证件影像单元格：缩略图（点击可预览大图）+「已上传 / 未上传」状态 + 上传入口。
 * 上传走既有素材通道 `POST /api/assets/upload`，与头像上传同管线；
 * 仅在编辑态提供上传按钮（只读态只保留预览），落库需随整页「保存」一起提交。
 */
const CertImageField = ({
  label,
  url,
  editing,
  readOnly,
  onChange,
}: {
  label: string;
  url?: string | null;
  editing: boolean;
  readOnly?: boolean;
  onChange: (url: string) => void;
}) => {
  const [uploading, setUploading] = useState(false);
  const src = url ? absUrl(url) : '';
  return (
    <div className="pfield">
      <span className="pf-label">{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        {src ? (
          <Image
            src={src}
            width={72}
            height={45}
            style={{ objectFit: 'cover', borderRadius: 4, border: `1px solid ${T.border}` }}
            preview={{ mask: '预览' }}
          />
        ) : (
          <span
            style={{
              width: 72,
              height: 45,
              borderRadius: 4,
              border: `1px dashed ${T.border}`,
              display: 'grid',
              placeItems: 'center',
              color: T.ink3,
              fontSize: 11,
            }}
          >
            未上传
          </span>
        )}
        <span style={{ fontSize: 12.5, color: src ? T.ink2 : T.ink3 }}>
          {src ? (
            <StatusTag type="ok">已上传</StatusTag>
          ) : (
            <StatusTag type="mut">未上传</StatusTag>
          )}
        </span>
        {editing && !readOnly && (
          <Upload
            showUploadList={false}
            accept="image/*"
            beforeUpload={(file) => {
              setUploading(true);
              uploadImageFile(file as File)
                .then((u) => {
                  onChange(u);
                  message.success('证件影像已选择，保存后生效');
                })
                .catch(() => message.error('证件影像上传失败'))
                .finally(() => setUploading(false));
              return false;
            }}
          >
            <Button size="small" icon={<UploadOutlined />} loading={uploading}>
              {src ? '重新上传' : '上传'}
            </Button>
          </Upload>
        )}
      </div>
    </div>
  );
};

const IdentityPanel = ({
  profile,
  editing,
  form,
  setForm,
  readOnly,
}: {
  profile: Profile;
  editing: boolean;
  form: Partial<Record<EditableKey, string | null>>;
  setForm: React.Dispatch<React.SetStateAction<Partial<Record<EditableKey, string | null>>>>;
  readOnly?: boolean;
}) => {
  const st = realnameStatus(profile.realNameStatus);
  // 待完善：证件号与两面影像全空（注册阶段未提交 → 引导在编辑态补齐）
  const missing = !profile.idCard && !profile.idCardFront && !profile.idCardBack;
  const idValue = (editing ? form.idCard : profile.idCard) ?? '';
  const idInvalid = !!idValue && !isValidIdCard(idValue);

  return (
    <Panel
      title="身份认证资料"
      hint="实名认证与证件影像"
      footer={
        missing && !readOnly ? (
          <div style={{ padding: '8px 14px', fontSize: 12.5, color: T.warn }}>
            资料待完善：请点击右上角「编辑」补充身份证号与证件影像，提交后进入人工审核。
          </div>
        ) : undefined
      }
    >
      <Field
        label="认证状态"
        value={
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <StatusTag type={st.tone}>{st.text}</StatusTag>
            {profile.realNameStatus === 'APPROVED' && profile.realNameVerifiedAt && (
              <span style={{ color: T.ink3, fontSize: 12 }}>
                认证于 {formatDate(profile.realNameVerifiedAt)}
              </span>
            )}
          </span>
        }
      />
      {editing && !readOnly ? (
        <div className="pfield">
          <span className="pf-label">身份证号</span>
          <div>
            <Input
              size="small"
              value={idValue}
              maxLength={18}
              placeholder="18 位身份证号"
              status={idInvalid ? 'error' : undefined}
              onChange={(e) => setForm((f) => ({ ...f, idCard: e.target.value.trim() }))}
            />
            {idInvalid && (
              <div style={{ marginTop: 4, fontSize: 12, color: T.down }}>
                身份证号校验失败：应为 18 位，末位可为 X，校验位不正确
              </div>
            )}
          </div>
        </div>
      ) : (
        <Field
          label="身份证号"
          value={
            profile.idCard ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                {maskId(profile.idCard)}
                {!readOnly && (
                  <Tooltip title="提交后需人工审核，审核期间不可再次修改">
                    <IdcardOutlined style={{ color: T.ink3 }} />
                  </Tooltip>
                )}
              </span>
            ) : missing ? (
              <StatusTag type="warn">待完善</StatusTag>
            ) : (
              '—'
            )
          }
        />
      )}
      <CertImageField
        label="身份证 · 人像面"
        url={editing ? form.idCardFront : profile.idCardFront}
        editing={editing}
        readOnly={readOnly}
        onChange={(u) => setForm((f) => ({ ...f, idCardFront: u }))}
      />
      <CertImageField
        label="身份证 · 国徽面"
        url={editing ? form.idCardBack : profile.idCardBack}
        editing={editing}
        readOnly={readOnly}
        onChange={(u) => setForm((f) => ({ ...f, idCardBack: u }))}
      />
    </Panel>
  );
};

/* ───────── 账号安全（四层角色通用） ───────── */

/** 带操作按钮的单元格（手机号 / 密码 / 第三方绑定） */
const ActionField = ({
  label,
  value,
  action,
}: {
  label: string;
  value: React.ReactNode;
  action?: React.ReactNode;
}) => (
  <div className="pfield">
    <span className="pf-label">{label}</span>
    <span className="pf-val" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      {value}
      {action}
    </span>
  </div>
);

/** 修改手机号：校验格式后 PATCH /api/auth/me（服务端再校验唯一性，冲突返回 409） */
const PhoneModal = ({
  open,
  current,
  onClose,
  onUpdated,
}: {
  open: boolean;
  current?: string | null;
  onClose: () => void;
  onUpdated?: (profile: Profile) => void;
}) => {
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const invalid = !!value && !isPhone(value);

  const submit = async () => {
    if (!isPhone(value)) {
      message.error('请输入正确的 11 位手机号');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(API_URL + '/auth/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ phone: value.trim() }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        message.error(data?.message || '手机号修改失败');
        return;
      }
      message.success('手机号已更新');
      onUpdated?.(data);
      setValue('');
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title="修改手机号"
      okText="确认修改"
      cancelText="取消"
      confirmLoading={saving}
      onOk={submit}
      onCancel={() => {
        setValue('');
        onClose();
      }}
    >
      <div style={{ display: 'grid', gap: 10, padding: '8px 0' }}>
        <div style={{ fontSize: 12.5, color: T.ink3 }}>当前号码：{current || '—'}</div>
        <Input
          value={value}
          maxLength={11}
          placeholder="请输入新的手机号"
          status={invalid ? 'error' : undefined}
          onChange={(e) => setValue(e.target.value.replace(/\D/g, ''))}
        />
        {invalid && <div style={{ fontSize: 12, color: T.down }}>手机号格式不正确（11 位，1 开头）</div>}
      </div>
    </Modal>
  );
};

/** 修改密码：校验原密码通过后再设置新密码（POST /api/auth/change-password） */
const PasswordModal = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  const [oldPwd, setOldPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const mismatch = !!confirm && confirm !== newPwd;
  const tooShort = !!newPwd && newPwd.length < 6;

  const submit = async () => {
    if (!oldPwd) {
      message.error('请输入原密码');
      return;
    }
    if (newPwd.length < 6) {
      message.error('新密码至少 6 位');
      return;
    }
    if (newPwd !== confirm) {
      message.error('两次输入的新密码不一致');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(API_URL + '/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ oldPassword: oldPwd, newPassword: newPwd }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        message.error(data?.message || '原密码不正确，修改失败');
        return;
      }
      message.success('密码已修改，下次登录请使用新密码');
      setOldPwd('');
      setNewPwd('');
      setConfirm('');
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title="修改登录密码"
      okText="确认修改"
      cancelText="取消"
      confirmLoading={saving}
      onOk={submit}
      onCancel={() => {
        setOldPwd('');
        setNewPwd('');
        setConfirm('');
        onClose();
      }}
    >
      <div style={{ display: 'grid', gap: 10, padding: '8px 0' }}>
        <Input.Password
          value={oldPwd}
          placeholder="请输入原密码"
          onChange={(e) => setOldPwd(e.target.value)}
        />
        <Input.Password
          value={newPwd}
          placeholder="请输入新密码（至少 6 位）"
          status={tooShort ? 'error' : undefined}
          onChange={(e) => setNewPwd(e.target.value)}
        />
        <Input.Password
          value={confirm}
          placeholder="请再次输入新密码"
          status={mismatch ? 'error' : undefined}
          onChange={(e) => setConfirm(e.target.value)}
        />
        {tooShort && <div style={{ fontSize: 12, color: T.down }}>新密码至少 6 位</div>}
        {mismatch && <div style={{ fontSize: 12, color: T.down }}>两次输入的新密码不一致</div>}
      </div>
    </Modal>
  );
};

const SecurityPanel = ({
  profile,
  readOnly,
  onUpdated,
}: {
  profile: Profile;
  readOnly?: boolean;
  onUpdated?: (profile: Profile) => void;
}) => {
  const [phoneOpen, setPhoneOpen] = useState(false);
  const [pwdOpen, setPwdOpen] = useState(false);
  // 本人登录且账号正常 → 完整显示；非本人访问（视察）或账号停用（异常）→ 脱敏
  const fullPhone = !readOnly && profile.status !== 'DISABLED';
  const thirdParty = [
    { key: 'wechat', label: '微信', icon: <WechatOutlined />, bound: !!profile.wxOpenid },
    { key: 'qq', label: 'QQ', icon: <QqOutlined />, bound: false },
    { key: 'alipay', label: '支付宝', icon: <AlipayOutlined />, bound: false },
  ];

  return (
    <Panel title="账号安全" hint="手机号 / 登录密码 / 第三方账号">
      <ActionField
        label="手机号"
        value={
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <MobileOutlined style={{ color: T.ink3 }} />
            {fullPhone ? profile.phone || '—' : maskPhone(profile.phone)}
            {!fullPhone && (
              <Tooltip title="非本人访问或账号状态异常，手机号已脱敏">
                <EyeOutlined style={{ color: T.ink3 }} />
              </Tooltip>
            )}
          </span>
        }
        action={
          !readOnly && (
            <Button size="small" type="link" onClick={() => setPhoneOpen(true)}>
              修改
            </Button>
          )
        }
      />
      <ActionField
        label="登录密码"
        value={
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <LockOutlined style={{ color: T.ink3 }} />
            ••••••••
          </span>
        }
        action={
          !readOnly && (
            <Button size="small" type="link" onClick={() => setPwdOpen(true)}>
              修改
            </Button>
          )
        }
      />
      {thirdParty.map((p) => (
        <ActionField
          key={p.key}
          label={p.label}
          value={
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              {p.icon}
              <StatusTag type={p.bound ? 'ok' : 'mut'}>{p.bound ? '已绑定' : '未绑定'}</StatusTag>
            </span>
          }
          action={
            !readOnly && (
              <Button size="small" type="link" onClick={() => message.info('该功能即将上线')}>
                {p.bound ? '解绑' : '绑定'}
              </Button>
            )
          }
        />
      ))}
      <PhoneModal
        open={phoneOpen}
        current={fullPhone ? profile.phone : maskPhone(profile.phone)}
        onClose={() => setPhoneOpen(false)}
        onUpdated={onUpdated}
      />
      <PasswordModal open={pwdOpen} onClose={() => setPwdOpen(false)} />
    </Panel>
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
