/**
 * 账户详情（原型 u-account）：镜像运营端 ProfilePage 的「客户（USER）」分区布局与配色。
 * 顶部 Hero 资料卡 + 六块 Panel（基础数据 / 身份认证资料 / 账号安全 / 归属与作用域 / 账户状态 / 会员与资产）。
 * 编辑态可补充注册阶段未提交的信息（姓名 / 昵称 / 邮箱 / 身份证号 / 证件影像），
 * 手机号与登录密码在「账号安全」区块各自弹窗修改，第三方账号绑定为占位入口。
 * 数据：GET /api/user/dashboard（profile + 资产字段）；写操作走 PATCH /api/auth/me。
 */
import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '@/api/client';
import { useAuthStore } from '@/store/authStore';
import { PageHead, Panel, StatusBadge, LoadingDots, tierKeyOf, formatCents, cleanCode, maskPhone } from './shared';

/* ───────── 校验（与服务端 AuthService 同口径；前端只做即时提示，服务端仍二次校验） ───────── */

/** 手机号：大陆 11 位、1 开头 */
export const isPhone = (v?: string | null) => !!v && /^1[3-9]\d{9}$/.test(v.trim());

/** 邮箱：宽松通用格式 */
export const isEmail = (v?: string | null) => !!v && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

/**
 * 大陆二代身份证号：18 位 + GB 11643-1999 mod 11-2 校验位验真。
 * 与服务端 `AuthService.isValidIdCard` 同一算法。
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

/** 身份证号脱敏：保留前 6 与后 4，中间以 * 填充（与运营端 maskIdCard 同口径） */
export function maskIdCard(id?: string | null) {
  const v = (id ?? '').trim();
  if (!v) return '—';
  if (v.length <= 8) return v.slice(0, 2) + '*'.repeat(Math.max(v.length - 2, 1));
  return v.slice(0, 4) + '*'.repeat(v.length - 8) + v.slice(-4);
}

/**
 * 镜像运营端 .pfield（profile.css）：2 列网格单元格，标签在上、值在下；
 * 奇数单元格（首列）带行尾边框，末行保留下边框（与运营端 CSS 行为一致）。
 * ⚠️ 必须定义在模块作用域：若在组件体内声明，每次父组件渲染都得到新的组件类型，
 *    React 会卸载/重挂整棵子树，导致其内部的 <img> 反复重新解码（头像闪烁）。
 */
const Field = ({ label, value, num }: { label: string; value: ReactNode; num?: boolean }) => (
  <Cell label={label} num={num}>
    {value || '—'}
  </Cell>
);

/** 单元格外壳：Field 与自定义单元格（证件影像 / 带操作按钮的字段）共用同一套边框与标签样式 */
const Cell = ({ label, num, children }: { label: string; num?: boolean; children: ReactNode }) => (
  <div className="flex min-w-0 flex-col gap-1 border-b border-[rgba(74,60,42,0.10)] px-4 py-[11px] odd:border-e odd:border-[rgba(74,60,42,0.10)]">
    <span className="text-[11.5px] font-bold uppercase tracking-[.3px] text-[#6e5f4a]">{label}</span>
    <span
      className={`flex min-w-0 flex-wrap items-center gap-2 text-[13.5px] text-[#2a2118] ${num ? 'tabular-nums' : ''}`}
      style={num ? { fontFamily: "'Bahnschrift','DIN Alternate',Arial,system-ui,sans-serif" } : undefined}
    >
      {children}
    </span>
  </div>
);

/** 32px 圆形头像预览（镜像运营端 AvatarField：头像字段右侧 32px 头像 + 文案） */
const Avatar32 = ({ src, initial }: { src?: string | null; initial: string }) => (
  <span
    className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-bold text-white"
    style={{ background: 'linear-gradient(135deg,#D24830,#B23A22)' }}
  >
    {src ? <img src={src} alt="" className="h-8 w-8 rounded-full object-cover" /> : (initial || '?').slice(0, 1)}
  </span>
);

/** 通用表单弹窗（镜像 shared.tsx DetailModal 的暖白卡片视觉） */
const FormModal = ({
  title,
  onClose,
  children,
  footer,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer: ReactNode;
}) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(30,24,16,0.45)] p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-[14px] bg-[#fffefb] p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-[14.5px] font-semibold text-[#2a2118]">{title}</h3>
          <button type="button" onClick={onClose} className="text-[#6e5f4a] hover:text-[#4c4236]">
            ✕
          </button>
        </div>
        <div className="grid gap-2.5">{children}</div>
        <div className="mt-4 flex justify-end gap-2">{footer}</div>
      </div>
    </div>
  );
};

/** 输入行：标签 + 输入框 + 行内错误提示 */
const Row = ({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  error,
  maxLength,
  digitsOnly,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: 'text' | 'password';
  error?: string;
  maxLength?: number;
  digitsOnly?: boolean;
}) => (
  <label className="grid gap-1">
    <span className="text-[12.5px] text-[#6e5f4a]">{label}</span>
    <input
      type={type}
      value={value}
      maxLength={maxLength}
      placeholder={placeholder}
      onChange={(e) => onChange(digitsOnly ? e.target.value.replace(/\D/g, '') : e.target.value)}
      className={`w-full rounded-lg border px-3 py-2 text-[13.5px] outline-none ${
        error ? 'border-[#c02b33]' : 'border-[rgba(74,60,42,0.16)] focus:border-[#D24830]'
      }`}
    />
    {error && <span className="text-xs text-[#8f1d24]">{error}</span>}
  </label>
);

/**
 * 证件影像单元格（镜像运营端 CertImageField）：
 * 缩略图（点击看大图）+「已上传 / 未上传」状态 + 编辑态上传入口。
 */
const CertCell = ({
  label,
  url,
  editing,
  onPreview,
  onUpload,
}: {
  label: string;
  url?: string | null;
  editing: boolean;
  onPreview: (url: string) => void;
  onUpload: (file: File) => Promise<void>;
}) => {
  const { t } = useTranslation();
  return (
    <Cell label={label}>
      {url ? (
        <button
          type="button"
          onClick={() => onPreview(url)}
          className="shrink-0 overflow-hidden rounded border border-[rgba(74,60,42,0.16)]"
          title={t('common:userCenter.account.preview')}
        >
          <img src={url} alt="" className="h-[45px] w-[72px] object-cover" />
        </button>
      ) : (
        <span className="grid h-[45px] w-[72px] shrink-0 place-items-center rounded border border-dashed border-[rgba(74,60,42,0.28)] text-[11px] text-[#6e5f4a]">
          {t('common:userCenter.account.notUploaded')}
        </span>
      )}
      <StatusBadge tone={url ? 'ok' : 'mut'}>
        {url ? t('common:userCenter.account.uploaded') : t('common:userCenter.account.notUploaded')}
      </StatusBadge>
      {url && (
        <button
          type="button"
          onClick={() => onPreview(url)}
          className="text-[13px] text-[#D24830] hover:underline"
        >
          {t('common:userCenter.account.preview')}
        </button>
      )}
      {editing && (
        <label className="cursor-pointer text-[13px] text-[#D24830] hover:underline">
          {url ? t('common:userCenter.account.reupload') : t('common:userCenter.account.upload')}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) await onUpload(f);
            }}
          />
        </label>
      )}
    </Cell>
  );
};

export default function Account() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const changePassword = useAuthStore((s) => s.changePassword);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  // 编辑表单：注册阶段未提交的信息可在此补齐，已填写的同样可改
  const [form, setForm] = useState({
    nickname: '',
    realName: '',
    email: '',
    idCard: '',
    idCardFront: '',
    idCardBack: '',
  });
  const [phoneOpen, setPhoneOpen] = useState(false);
  const [pwdOpen, setPwdOpen] = useState(false);
  const [phoneVal, setPhoneVal] = useState('');
  const [oldPwd, setOldPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [preview, setPreview] = useState<string | null>(null);

  const reload = () =>
    api
      .get<any>('/api/user/dashboard')
      .then((d) => setProfile(d))
      .catch(() => undefined);

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
  // 显示名优先级与顶栏「账号胶囊」保持一致：nickname → realName → phone。
  // ⚠️ 旧逻辑仅取 prof.realName，导致无 realName 的用户（如新注册账号 realName=null）详情页「姓名」空白，
  //    而胶囊已按 nickname 显示——两处不一致。这里对齐胶囊优先级，且 hero 与「姓名」字段共用同一值。
  const name = prof.nickname || prof.realName || prof.phone || user?.nickname || user?.realName || user?.phone || '—';
  const role = user?.role ?? 'USER';
  const roleLabel = t(`common:role.${role}`);
  const vipTier = tierKeyOf(prof.vipLevel);
  const regionName = prof.regionName || '未设置';
  // 用户 ID：与运营端 cleanCode 同口径（剥离测试前缀，真实 cuid 原样返回）
  const fullId = cleanCode(prof.id);
  // 手机号：本人登录且账号正常 → 完整显示；账号异常（停用）→ 脱敏
  const abnormal = prof.status === 'DISABLED' || user?.status === 'DISABLED';
  const phoneText = abnormal ? maskPhone(prof.phone) : prof.phone || '—';
  // 认证状态 → 徽章色调（与运营端 REALNAME_TONE 同口径）
  const rnStatus = (prof.realNameStatus ?? 'UNVERIFIED') as string;
  const rnTone: Record<string, 'ok' | 'warn' | 'bad' | 'mut'> = {
    UNVERIFIED: 'mut',
    PENDING: 'warn',
    APPROVED: 'ok',
    REJECTED: 'bad',
  };
  // ⚠️ i18next 缺 key 时返回 key 本身，必须给 defaultValue 兜底（无 fallback 文案会露出键名）
  const rnLabel: Record<string, string> = {
    UNVERIFIED: t('common:userCenter.account.certUnverified', { defaultValue: '待完善' }),
    PENDING: t('common:userCenter.account.certPending', { defaultValue: '待审核' }),
    APPROVED: t('common:userCenter.account.certApproved', { defaultValue: '已认证' }),
    REJECTED: t('common:userCenter.account.certRejected', { defaultValue: '已驳回' }),
  };
  // 待完善：证件号与两面影像均未提交
  const identityMissing = !prof.idCard && !prof.idCardFront && !prof.idCardBack;
  const idCardInvalid = !!form.idCard && !isValidIdCard(form.idCard);
  const emailInvalid = !!form.email && !isEmail(form.email);

  const startEdit = () => {
    setMsg(null);
    setForm({
      nickname: prof.nickname ?? '',
      realName: prof.realName ?? '',
      email: prof.email ?? user?.email ?? '',
      idCard: prof.idCard ?? '',
      idCardFront: prof.idCardFront ?? '',
      idCardBack: prof.idCardBack ?? '',
    });
    setEditing(true);
  };

  const uploadCert = async (file: File, key: 'idCardFront' | 'idCardBack') => {
    try {
      const asset = await api.uploadAsset(file);
      setForm((f) => ({ ...f, [key]: asset.url }));
      setMsg({ text: t('common:userCenter.account.imageSelected'), ok: true });
    } catch {
      setMsg({ text: t('common:userCenter.account.uploadFailed'), ok: false });
    }
  };

  const save = async () => {
    setMsg(null);
    if (!form.nickname.trim()) {
      setMsg({ text: t('common:userCenter.account.nicknameRequired'), ok: false });
      return;
    }
    if (idCardInvalid) {
      setMsg({ text: t('common:userCenter.account.invalidIdCard'), ok: false });
      return;
    }
    if (emailInvalid) {
      setMsg({ text: t('common:userCenter.account.invalidEmail'), ok: false });
      return;
    }
    const payload: Record<string, string> = {};
    const src: Record<string, string | null | undefined> = {
      nickname: prof.nickname ?? user?.nickname,
      realName: prof.realName ?? user?.realName,
      email: prof.email ?? user?.email,
      idCard: prof.idCard,
      idCardFront: prof.idCardFront,
      idCardBack: prof.idCardBack,
    };
    (Object.keys(form) as (keyof typeof form)[]).forEach((k) => {
      const v = (form[k] ?? '').trim();
      if (v && v !== (src[k] ?? '')) payload[k] = v;
    });
    if (Object.keys(payload).length === 0) {
      setEditing(false);
      return;
    }
    setSaving(true);
    const ok = await updateProfile(payload);
    setSaving(false);
    if (!ok) {
      setMsg({ text: t('common:userCenter.account.saveFailed'), ok: false });
      return;
    }
    await reload();
    setEditing(false);
    setMsg({ text: t('common:userCenter.account.saveSuccess'), ok: true });
  };

  const submitPhone = async () => {
    setMsg(null);
    if (!isPhone(phoneVal)) {
      setMsg({ text: t('common:userCenter.account.invalidPhone'), ok: false });
      return;
    }
    setSaving(true);
    try {
      await api.updateProfile({ phone: phoneVal.trim() });
      await reload();
      setPhoneOpen(false);
      setPhoneVal('');
      setMsg({ text: t('common:userCenter.account.phoneUpdated'), ok: true });
    } catch {
      setMsg({ text: t('common:userCenter.account.phoneUpdateFailed'), ok: false });
    } finally {
      setSaving(false);
    }
  };

  const submitPassword = async () => {
    setMsg(null);
    if (!oldPwd) {
      setMsg({ text: t('common:userCenter.account.oldPasswordRequired'), ok: false });
      return;
    }
    if (newPwd.length < 6) {
      setMsg({ text: t('common:userCenter.account.pwdTooShort'), ok: false });
      return;
    }
    if (newPwd !== confirmPwd) {
      setMsg({ text: t('common:userCenter.account.pwdMismatch'), ok: false });
      return;
    }
    setSaving(true);
    const ok = await changePassword(oldPwd, newPwd);
    setSaving(false);
    if (!ok) {
      setMsg({ text: t('common:userCenter.account.pwdFailed'), ok: false });
      return;
    }
    setPwdOpen(false);
    setOldPwd('');
    setNewPwd('');
    setConfirmPwd('');
    setMsg({ text: t('common:userCenter.account.pwdSuccess'), ok: true });
  };

  const thirdParty = [
    { key: 'wechat', label: t('common:userCenter.account.wechat'), bound: !!user?.wxOpenid },
    { key: 'qq', label: t('common:userCenter.account.qq'), bound: false },
    { key: 'alipay', label: t('common:userCenter.account.alipay'), bound: false },
  ];

  return (
    <div className="space-y-4">
      <PageHead title={t('common:userCenter.account.title')} sub={t('common:userCenter.account.subtitle')} chip={<StatusBadge tone="accent">{roleLabel}</StatusBadge>} />

      {/* Hero 资料卡（镜像 admin profile-hero：S.panel + 64px 渐变头像 + 名称 + 角色 Pill + 信息行） */}
      <Panel>
        <div className="flex flex-wrap items-center gap-4 px-5 py-[18px]">
          <div
            className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full text-2xl font-bold text-white"
            style={{ background: 'linear-gradient(135deg,#D24830,#B23A22)' }}
          >
            {user?.avatar ? <img src={user.avatar} alt="" className="h-16 w-16 rounded-full object-cover" /> : (name ?? 'U').slice(0, 1)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-[18px] font-semibold text-[#2a2118]">{name}</span>
              <StatusBadge tone="accent">{roleLabel}</StatusBadge>
            </div>
            <div className="mt-1 text-[12.5px] text-[#6e5f4a]">
              ID {fullId} · {t('common:userCenter.account.phone')} {phoneText} · {regionName} · 注册 {prof.createdAt ? new Date(prof.createdAt).toLocaleDateString('zh-CN') : '—'}
            </div>
          </div>
          <div className="ms-auto flex shrink-0 gap-2">
            {editing ? (
              <>
                <button
                  type="button"
                  disabled={saving}
                  onClick={save}
                  className="rounded-lg bg-[#D24830] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
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
                onClick={startEdit}
                className="rounded-lg border border-[#D24830] px-3 py-1.5 text-sm font-medium text-[#D24830]"
              >
                {t('common:userCenter.account.edit')}
              </button>
            )}
          </div>
        </div>
        {msg && (
          <div className={`border-t border-[rgba(74,60,42,0.08)] px-5 py-2 text-xs ${msg.ok ? 'text-emerald-600' : 'text-[#8f1d24]'}`}>
            {msg.text}
          </div>
        )}
      </Panel>

      {/* 基础数据（镜像 admin UserSections · 基础数据：profile-grid 2 列） */}
      <Panel title={t('common:userCenter.account.basisData')} hint={t('common:userCenter.account.basisHint')}>
        <div className="grid grid-cols-2">
          <Field label={t('common:userCenter.account.id')} value={fullId} num />
          <Field label={t('common:userCenter.account.name')} value={name} />
          <Cell label={t('common:userCenter.account.nickname')}>
            {editing ? (
              <input
                value={form.nickname}
                onChange={(e) => setForm((f) => ({ ...f, nickname: e.target.value }))}
                className="w-full rounded-lg border border-[rgba(74,60,42,0.16)] px-3 py-1.5 text-[13.5px] outline-none focus:border-[#D24830]"
              />
            ) : (
              prof.nickname || '—'
            )}
          </Cell>
          <Field label={t('common:userCenter.account.phone')} value={phoneText} num />
          <Cell label={t('common:userCenter.account.email')}>
            {editing ? (
              <input
                value={form.email}
                placeholder={t('common:userCenter.account.email')}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className={`w-full rounded-lg border px-3 py-1.5 text-[13.5px] outline-none ${emailInvalid ? 'border-[#c02b33]' : 'border-[rgba(74,60,42,0.16)] focus:border-[#D24830]'}`}
              />
            ) : (
              prof.email ?? user?.email ?? '—'
            )}
          </Cell>
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

      {/* 身份认证资料（镜像 admin IdentityPanel：认证状态 + 证件号 + 人像面 / 国徽面） */}
      <Panel title={t('common:userCenter.account.identityGroup')} hint={t('common:userCenter.account.identityHint')}>
        <div className="grid grid-cols-2">
          <Cell label={t('common:userCenter.account.certStatus')}>
            <StatusBadge tone={rnTone[rnStatus] ?? 'mut'}>{rnLabel[rnStatus] ?? rnStatus}</StatusBadge>
            {rnStatus === 'APPROVED' && prof.realNameVerifiedAt && (
              <span className="text-xs text-[#6e5f4a]">
                {t('common:userCenter.account.verifiedAt')} {new Date(prof.realNameVerifiedAt).toLocaleDateString('zh-CN')}
              </span>
            )}
          </Cell>
          <Cell label={t('common:userCenter.account.idCard')}>
            {editing ? (
              <span className="grid w-full gap-1">
                <input
                  value={form.idCard}
                  maxLength={18}
                  placeholder={t('common:userCenter.account.idCard')}
                  onChange={(e) => setForm((f) => ({ ...f, idCard: e.target.value.replace(/[^\dXx]/g, '').toUpperCase() }))}
                  className={`w-full rounded-lg border px-3 py-1.5 text-[13.5px] outline-none ${idCardInvalid ? 'border-[#c02b33]' : 'border-[rgba(74,60,42,0.16)] focus:border-[#D24830]'}`}
                />
                {idCardInvalid && <span className="text-xs text-[#8f1d24]">{t('common:userCenter.account.invalidIdCard')}</span>}
              </span>
            ) : prof.idCard ? (
              maskIdCard(prof.idCard)
            ) : (
              <StatusBadge tone="warn">{t('common:userCenter.account.incomplete')}</StatusBadge>
            )}
          </Cell>
          <CertCell
            label={t('common:userCenter.account.idCardFront')}
            url={editing ? form.idCardFront : prof.idCardFront}
            editing={editing}
            onPreview={setPreview}
            onUpload={(f) => uploadCert(f, 'idCardFront')}
          />
          <CertCell
            label={t('common:userCenter.account.idCardBack')}
            url={editing ? form.idCardBack : prof.idCardBack}
            editing={editing}
            onPreview={setPreview}
            onUpload={(f) => uploadCert(f, 'idCardBack')}
          />
        </div>
        {identityMissing && (
          <div className="border-t border-[rgba(74,60,42,0.08)] px-4 py-2 text-xs text-[#7a4d07]">
            {t('common:userCenter.account.incompleteGuide')}
          </div>
        )}
      </Panel>

      {/* 账号安全（镜像 admin SecurityPanel：手机号 / 登录密码 / 第三方账号） */}
      <Panel title={t('common:userCenter.account.securityGroup')} hint={t('common:userCenter.account.securityHint')}>
        <div className="grid grid-cols-2">
          <Cell label={t('common:userCenter.account.phone')}>
            {phoneText}
            <button type="button" onClick={() => setPhoneOpen(true)} className="text-[13px] text-[#D24830] hover:underline">
              {t('common:userCenter.account.changePhone')}
            </button>
          </Cell>
          <Cell label={t('common:userCenter.account.password')}>
            <span className="text-[#6e5f4a]">{t('common:userCenter.account.passwordMask')}</span>
            <button type="button" onClick={() => setPwdOpen(true)} className="text-[13px] text-[#D24830] hover:underline">
              {t('common:userCenter.account.changePassword')}
            </button>
          </Cell>
          {thirdParty.map((tp) => (
            <Cell key={tp.key} label={tp.label}>
              <StatusBadge tone={tp.bound ? 'ok' : 'mut'}>
                {tp.bound ? t('common:userCenter.account.bound') : t('common:userCenter.account.unbound')}
              </StatusBadge>
              <button
                type="button"
                onClick={() => setMsg({ text: t('common:userCenter.account.comingSoon'), ok: true })}
                className="text-[13px] text-[#D24830] hover:underline"
              >
                {tp.bound ? t('common:userCenter.account.unbind') : t('common:userCenter.account.bind')}
              </button>
            </Cell>
          ))}
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
              <StatusBadge tone={abnormal ? 'bad' : 'ok'}>
                {abnormal ? t('common:userCenter.account.statusDisabled') : t('common:userCenter.account.statusActive')}
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

      {/* 修改手机号 */}
      {phoneOpen && (
        <FormModal
          title={t('common:userCenter.account.changePhone')}
          onClose={() => setPhoneOpen(false)}
          footer={
            <>
              <button type="button" onClick={() => setPhoneOpen(false)} className="rounded-lg border border-[rgba(74,60,42,0.16)] px-4 py-1.5 text-sm text-[#4c4236]">
                {t('common:button.cancel')}
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={submitPhone}
                className="rounded-lg bg-[#D24830] px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50"
              >
                {t('common:userCenter.account.save')}
              </button>
            </>
          }
        >
          <div className="text-[12.5px] text-[#6e5f4a]">
            {t('common:userCenter.account.currentPhone')}：{phoneText}
          </div>
          <Row
            label={t('common:userCenter.account.newPhone')}
            value={phoneVal}
            onChange={setPhoneVal}
            maxLength={11}
            digitsOnly
            error={phoneVal && !isPhone(phoneVal) ? t('common:userCenter.account.invalidPhone') : undefined}
          />
        </FormModal>
      )}

      {/* 修改登录密码 */}
      {pwdOpen && (
        <FormModal
          title={t('common:userCenter.account.changePassword')}
          onClose={() => setPwdOpen(false)}
          footer={
            <>
              <button type="button" onClick={() => setPwdOpen(false)} className="rounded-lg border border-[rgba(74,60,42,0.16)] px-4 py-1.5 text-sm text-[#4c4236]">
                {t('common:button.cancel')}
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={submitPassword}
                className="rounded-lg bg-[#D24830] px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50"
              >
                {t('common:userCenter.account.save')}
              </button>
            </>
          }
        >
          <Row label={t('common:userCenter.account.oldPassword')} value={oldPwd} onChange={setOldPwd} type="password" />
          <Row
            label={t('common:userCenter.account.newPassword')}
            value={newPwd}
            onChange={setNewPwd}
            type="password"
            error={newPwd && newPwd.length < 6 ? t('common:userCenter.account.pwdTooShort') : undefined}
          />
          <Row
            label={t('common:userCenter.account.confirmPassword')}
            value={confirmPwd}
            onChange={setConfirmPwd}
            type="password"
            error={confirmPwd && confirmPwd !== newPwd ? t('common:userCenter.account.pwdMismatch') : undefined}
          />
        </FormModal>
      )}

      {/* 证件影像预览 */}
      {preview && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[rgba(30,24,16,0.65)] p-6" onClick={() => setPreview(null)}>
          <img src={preview} alt="" className="max-h-[80vh] max-w-full rounded-lg" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}
