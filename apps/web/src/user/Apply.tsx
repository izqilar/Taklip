/**
 * 入驻申请（原型 u-apply）
 *
 * 双隧道入口（用户→服务商/代理商的资格通道）：
 *  ① 加入（JOIN）：加入已有服务商 / 代理商团队，**身份仍是普通用户**，
 *     审批通过后在目标组织获得员工关系（OrgStaff），参与该团队的活动。
 *     数据：GET /api/user/join-targets → POST /api/user/join-applications
 *  ② 入驻（SETTLE）：资格升级，成为服务商 / 代理商主体，**平台身份 User.role 变更**，
 *     由总台 ADMIN 做初审 / 终审。
 *     数据：POST /api/user/qualifications（既有 QualificationApplication 双阶段模型）
 *
 * ⚠️ 术语：正式文案统一用「入驻」（settle in），不用「入住」（hotel check-in）。
 *
 * 页面结构（对齐交互草图）：
 *  身份卡（头像 / 账号编号 / 手机号 / 当前身份徽章 / 已加入团队）
 *  → 我的申请（在途可撤回，含拒绝详情）
 *  → Panel「申请方式」（类型单选 + 层次单选 + 省/市/区三联动 + 归所团队检索）
 *  → Panel「申请说明」（≤500 字）
 *  → 提交
 */
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '@/api/client';
import { useAuthStore } from '@/store/authStore';
import {
  PageHead,
  Panel,
  StatusBadge,
  EmptyState,
  maskPhone,
  cleanCode,
} from './shared';

type ApplyMode = 'JOIN' | 'SETTLE';
type OrgLayer = 'PROVIDER' | 'AGENT';

interface RegionNode {
  id: string;
  code: string;
  name: string;
  level: number;
  regionPath: string | null;
  children: RegionNode[];
}

interface JoinTarget {
  id: string;
  name: string;
  phone: string | null;
  regionLabel: string | null;
  regionPath: string | null;
}

interface MyApplication {
  id: string;
  code: string;
  kind: 'JOIN' | 'SETTLE';
  /** 加入：团队名；入驻：服务商 / 代理商（目标层） */
  orgName: string;
  layer: OrgLayer;
  status: string;
  createdAt: string;
  reviewNote?: string | null;
}

/** 6 种服务类型（与 admin SERVICE_ROLE_KEYS 同一语义，键指向 userCenter.svc.*） */
const SERVICE_SCOPES: { value: string; key: string }[] = [
  { value: 'DESIGN', key: 'userCenter.svc.design' },
  { value: 'PHOTO', key: 'userCenter.svc.photo' },
  { value: 'VENUE', key: 'userCenter.svc.venue' },
  { value: 'FLORAL', key: 'userCenter.svc.floral' },
  { value: 'STEWARD', key: 'userCenter.svc.steward' },
  { value: 'PERFORM', key: 'userCenter.svc.perform' },
];

const MAX_REASON = 500;

/** 申请 / 入驻状态 → 徽章色（与运营端 StatusBadge tone 同口径） */
const statusTone = (s?: string): 'warn' | 'ok' | 'bad' | 'mut' => {
  if (!s) return 'mut';
  if (['APPROVED', 'FIRST_PASSED'].includes(s)) return 'ok';
  if (['REJECTED', 'WITHDRAWN'].includes(s)) return 'bad';
  return 'warn';
};

const statusText = (t: any, s?: string): string => {
  const map: Record<string, string> = {
    PENDING: 'userCenter.apply.status.pending',
    APPROVED: 'userCenter.apply.status.approved',
    REJECTED: 'userCenter.apply.status.rejected',
    WITHDRAWN: 'userCenter.apply.status.withdrawn',
    FIRST_PENDING: 'userCenter.apply.status.firstPending',
    FIRST_PASSED: 'userCenter.apply.status.firstPassed',
    FINAL_PENDING: 'userCenter.apply.status.finalPending',
  };
  return s && map[s] ? t(map[s]) : s ?? '—';
};

export default function Apply() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);

  /* ── 表单状态 ── */
  const [mode, setMode] = useState<ApplyMode>('JOIN');
  const [layer, setLayer] = useState<OrgLayer>('PROVIDER');
  const [tree, setTree] = useState<RegionNode[]>([]);
  const [provinceId, setProvinceId] = useState('');
  const [cityId, setCityId] = useState('');
  const [districtId, setDistrictId] = useState('');
  const [keyword, setKeyword] = useState('');
  const [targets, setTargets] = useState<JoinTarget[]>([]);
  const [targetId, setTargetId] = useState('');
  const [scopes, setScopes] = useState<string[]>([]);
  const [reason, setReason] = useState('');
  const [mine, setMine] = useState<MyApplication[]>([]);
  const [teams, setTeams] = useState<string[]>([]);
  const [loadingMine, setLoadingMine] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const provinces = tree.filter((r) => r.level === 1);
  const cities = provinces.find((p) => p.id === provinceId)?.children ?? [];
  const districts = cities.find((c) => c.id === cityId)?.children ?? [];

  /** 当前已选区域（取最末一级） */
  const selectedRegion = useMemo<{ id: string; label: string; regionPath: string | null } | null>(() => {
    const p = provinces.find((x) => x.id === provinceId);
    if (!p) return null;
    const c = cities.find((x) => x.id === cityId);
    const d = districts.find((x) => x.id === districtId);
    const last = d ?? c ?? p;
    const names = [p.name, c?.name, d?.name].filter(Boolean) as string[];
    return { id: last.id, label: names.join(' / '), regionPath: last.regionPath };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tree, provinceId, cityId, districtId]);

  const isJoin = mode === 'JOIN';

  /* ── 初始化：区域树 + 我的申请 ── */
  useEffect(() => {
    api.get<any[]>('/api/regions/tree').then((r) => setTree(r ?? [])).catch(() => setTree([]));
    loadMine();
    // 当前已加入的团队（身份卡徽章展示）
    api
      .get<any>('/api/user/dashboard')
      .then((d: any) => setTeams(Array.isArray(d?.teams) ? d.teams.map((x: any) => x.name ?? x.orgName) : []))
      .catch(() => setTeams([]));
  }, []);

  /* ── 层次 / 区域变化 → 重新检索可加入团队 ── */
  useEffect(() => {
    if (!isJoin) {
      setTargets([]);
      setTargetId('');
      return;
    }
    let alive = true;
    api
      .get<JoinTarget[]>('/api/user/join-targets', {
        orgType: layer,
        regionId: selectedRegion?.id ?? '',
        keyword: keyword || '',
      })
      .then((rows) => {
        if (!alive) return;
        setTargets(rows ?? []);
        if (!rows?.some((r) => r.id === targetId)) setTargetId('');
      })
      .catch(() => alive && setTargets([]));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layer, selectedRegion?.id, keyword, isJoin]);

  async function loadMine() {
    setLoadingMine(true);
    const [joins, quals] = await Promise.all([
      api.get<any[]>('/api/user/join-applications').catch(() => [] as any[]),
      api.get<any[]>('/api/user/qualifications').catch(() => [] as any[]),
    ]);
    setMine([
      ...(joins ?? []).map((j) => ({
        id: j.id,
        code: j.code ?? cleanCode(j.id),
        kind: 'JOIN' as const,
        orgName: j.orgName ?? '—',
        layer: j.orgType as OrgLayer,
        status: j.status,
        createdAt: j.createdAt,
        reviewNote: j.reviewNote,
      })),
      ...(quals ?? []).map((q) => ({
        id: q.id,
        code: cleanCode(q.id),
        kind: 'SETTLE' as const,
        orgName: q.kind === 'agent' ? t('userCenter.apply.layer.agent') : t('userCenter.apply.layer.provider'),
        layer: (q.kind === 'agent' ? 'AGENT' : 'PROVIDER') as OrgLayer,
        status: q.status,
        createdAt: q.createdAt,
      })),
    ]);
    setLoadingMine(false);
  }

  async function submit() {
    setError('');
    setToast('');
    if (!reason.trim()) {
      setError(t('userCenter.apply.reasonRequired'));
      return;
    }
    if (isJoin && !targetId) {
      setError(t('userCenter.apply.needTarget'));
      return;
    }
    if (!isJoin && layer === 'AGENT' && !selectedRegion) {
      setError(t('userCenter.apply.needRegion'));
      return;
    }
    if (!isJoin && layer === 'PROVIDER' && scopes.length === 0) {
      setError(t('userCenter.apply.needScope'));
      return;
    }
    setSubmitting(true);
    try {
      if (isJoin) {
        await api.post('/api/user/join-applications', {
          orgType: layer,
          orgId: targetId,
          regionPath: selectedRegion?.regionPath ?? null,
          regionLabel: selectedRegion?.label ?? null,
          reason: reason.trim(),
        });
      } else {
        await api.post('/api/user/qualifications', {
          kind: layer === 'AGENT' ? 'agent' : 'provider',
          reason: reason.trim(),
          serviceScopes: layer === 'PROVIDER' ? scopes : [],
          regionPath: selectedRegion?.regionPath ?? null,
          regionLabel: selectedRegion?.label ?? null,
        });
      }
      setToast(t('userCenter.apply.submitted'));
      setReason('');
      setScopes([]);
      setTargetId('');
      await loadMine();
    } catch (e: any) {
      setError(e?.message || t('userCenter.apply.submitFailed'));
    } finally {
      setSubmitting(false);
    }
  }

  async function withdraw(id: string, kind: 'JOIN' | 'SETTLE') {
    try {
      if (kind === 'JOIN') {
        await api.del<{ ok: boolean }>(`/api/user/join-applications/${id}`);
      } else {
        await api.del<{ ok: boolean }>(`/api/user/qualifications/${id}`);
      }
      await loadMine();
    } catch (e: any) {
      setError(e?.message || t('userCenter.apply.withdrawFailed'));
    }
  }

  const Radio = ({
    checked,
    label,
    desc,
    onClick,
  }: {
    checked: boolean;
    label: string;
    desc?: string;
    onClick: () => void;
  }) => (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-start gap-2.5 rounded-[10px] border px-3 py-2.5 text-left transition ${
        checked
          ? 'border-[#D24830] bg-[rgba(210,72,48,0.06)]'
          : 'border-[rgba(74,60,42,0.14)] bg-[#fffefb] hover:border-[#D24830]/40'
      }`}
    >
      <span
        className={`mt-[3px] flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
          checked ? 'border-[#D24830]' : 'border-[rgba(74,60,42,0.30)]'
        }`}
      >
        {checked && <span className="h-2 w-2 rounded-full bg-[#D24830]" />}
      </span>
      <span className="min-w-0">
        <span className={`block text-[13.5px] ${checked ? 'font-semibold text-[#D24830]' : 'font-medium text-[#2a2118]'}`}>
          {label}
        </span>
        {desc && <span className="mt-0.5 block text-[12px] leading-snug text-[#6e5f4a]">{desc}</span>}
      </span>
    </button>
  );

  const Label = ({ children }: { children: React.ReactNode }) => (
    <div className="mb-1.5 text-[12.5px] font-semibold text-[#6e5f4a]">{children}</div>
  );

  const selectCls =
    'h-[36px] w-full rounded-md border border-[rgba(74,60,42,0.16)] bg-[#fffefb] px-2.5 text-[13.5px] text-[#2a2118] outline-none focus:border-[#D24830]';

  return (
    <div className="space-y-4">
      <PageHead
        title={t('common:userCenter.menu.apply')}
        sub={t('userCenter.apply.sub')}
        chip={user?.nickname || maskPhone((user as any)?.phone)}
      />

      {/* ── 身份卡 ── */}
      <Panel title={t('userCenter.apply.identityTitle')}>
        <div className="flex flex-wrap items-center gap-4 px-4 py-4">
          <span
            className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full text-lg font-bold text-white"
            style={{ background: 'linear-gradient(135deg,#D24830,#B23A22)' }}
          >
            {(user as any)?.avatar ? (
              <img src={(user as any).avatar} alt="" className="h-14 w-14 rounded-full object-cover" />
            ) : (
              (user?.nickname || 'U').slice(0, 1)
            )}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[15px] font-semibold text-[#2a2118]">{user?.nickname || t('userCenter.accountFallback')}</span>
              <StatusBadge tone="accent">{cleanCode((user as any)?.id ?? '')}</StatusBadge>
              <StatusBadge tone={(user as any)?.role === 'USER' ? 'mut' : 'ok'}>
                {(user as any)?.role === 'USER' ? t('userCenter.apply.identityUser') : (user as any)?.role}
              </StatusBadge>
            </div>
            <div className="mt-1 text-[12.5px] text-[#6e5f4a]">{maskPhone((user as any)?.phone)}</div>
            {teams.length > 0 && (
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[12px] text-[#6e5f4a]">
                <span>{t('userCenter.apply.joinedTeams')}</span>
                {teams.map((n) => (
                  <StatusBadge key={n} tone="ok">
                    {n}
                  </StatusBadge>
                ))}
              </div>
            )}
          </div>
        </div>
      </Panel>

      {/* ── 我的申请 ── */}
      <Panel title={t('userCenter.apply.myTitle')} hint={t('userCenter.apply.myHint')}>
        <div className="px-4 py-3">
          {loadingMine ? (
            <div className="py-6 text-center text-[13px] text-[#6e5f4a]">{t('common:userCenter.loading')}</div>
          ) : mine.length === 0 ? (
            <EmptyState text={t('common:userCenter.empty')} />
          ) : (
            <ul className="space-y-2">
              {mine.map((m) => (
                <li key={m.id} className="rounded-[10px] border border-[rgba(74,60,42,0.10)] bg-[#faf7f1] px-3 py-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[12.5px] text-[#4c4236]">{m.code}</span>
                    <StatusBadge tone={m.kind === 'JOIN' ? 'accent' : 'warn'}>
                      {m.kind === 'JOIN' ? t('userCenter.apply.mode.join') : t('userCenter.apply.mode.settle')}
                    </StatusBadge>
                    <span className="text-[13px] text-[#2a2118]">
                      {m.orgName} · {t(`userCenter.apply.layer.${m.layer === 'AGENT' ? 'agent' : 'provider'}`)}
                    </span>
                    <StatusBadge tone={statusTone(m.status)}>{statusText(t, m.status)}</StatusBadge>
                    <span className="ml-auto text-[12px] text-[#6e5f4a]">
                      {new Date(m.createdAt).toLocaleString('zh-CN', { hour12: false })}
                    </span>
                    {['PENDING', 'FIRST_PENDING', 'FIRST_PASSED'].includes(m.status) && (
                      <button
                        type="button"
                        onClick={() => withdraw(m.id, m.kind)}
                        className="rounded-lg border border-[rgba(74,60,42,0.16)] px-3 py-1 text-[12.5px] text-[#4c4236] transition hover:border-[#D24830]/40 hover:text-[#D24830]"
                      >
                        {t('userCenter.apply.withdraw')}
                      </button>
                    )}
                  </div>
                  {m.reviewNote && (
                    <div className="mt-1.5 rounded-md bg-[rgba(192,43,51,0.06)] px-2.5 py-1.5 text-[12.5px] text-[#8f1d24]">
                      {t('userCenter.apply.reviewNote')}：{m.reviewNote}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </Panel>

      {/* ── 申请方式 ── */}
      <Panel title={t('userCenter.apply.wayTitle')}>
        <div className="space-y-4 px-4 py-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>{t('userCenter.apply.mode.label')}</Label>
              <div className="space-y-2">
                <Radio
                  checked={mode === 'JOIN'}
                  label={t('userCenter.apply.mode.join')}
                  desc={t('userCenter.apply.mode.joinDesc')}
                  onClick={() => setMode('JOIN')}
                />
                <Radio
                  checked={mode === 'SETTLE'}
                  label={t('userCenter.apply.mode.settle')}
                  desc={t('userCenter.apply.mode.settleDesc')}
                  onClick={() => setMode('SETTLE')}
                />
              </div>
            </div>
            <div>
              <Label>{t('userCenter.apply.layer.label')}</Label>
              <div className="space-y-2">
                <Radio
                  checked={layer === 'PROVIDER'}
                  label={t('userCenter.apply.layer.provider')}
                  desc={t('userCenter.apply.layer.providerDesc')}
                  onClick={() => setLayer('PROVIDER')}
                />
                <Radio
                  checked={layer === 'AGENT'}
                  label={t('userCenter.apply.layer.agent')}
                  desc={t('userCenter.apply.layer.agentDesc')}
                  onClick={() => setLayer('AGENT')}
                />
              </div>
            </div>
          </div>

          <div>
            <Label>
              {t('userCenter.apply.region.label')}
              {!isJoin && layer === 'PROVIDER' && (
                <span className="ml-1.5 font-normal text-[#6e5f4a]">（{t('userCenter.apply.region.optional')}）</span>
              )}
            </Label>
            <div className="grid gap-2.5 md:grid-cols-3">
              <select className={selectCls} value={provinceId} onChange={(e) => {
                setProvinceId(e.target.value);
                setCityId('');
                setDistrictId('');
              }}>
                <option value="">{t('userCenter.apply.region.province')}</option>
                {provinces.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <select
                className={selectCls}
                value={cityId}
                disabled={!provinceId}
                onChange={(e) => {
                  setCityId(e.target.value);
                  setDistrictId('');
                }}
              >
                <option value="">{t('userCenter.apply.region.city')}</option>
                {cities.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <select
                className={selectCls}
                value={districtId}
                disabled={!cityId}
                onChange={(e) => setDistrictId(e.target.value)}
              >
                <option value="">{t('userCenter.apply.region.district')}</option>
                {districts.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 归所：仅「加入」隧道可见（「入驻」为资格升级，无需选择目标团队） */}
          {isJoin && (
            <div>
              <Label>{t('userCenter.apply.target.label')}</Label>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <input
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder={t('userCenter.apply.target.search')}
                  className="h-[36px] w-full max-w-[320px] rounded-md border border-[rgba(74,60,42,0.16)] px-2.5 text-[13.5px] outline-none focus:border-[#D24830]"
                />
                <span className="text-[12px] text-[#6e5f4a]">
                  {t('userCenter.apply.target.count')}：{targets.length}
                </span>
              </div>
              <select className={selectCls} value={targetId} onChange={(e) => setTargetId(e.target.value)}>
                <option value="">{t('userCenter.apply.target.placeholder')}</option>
                {targets.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                    {o.regionLabel ? ` · ${o.regionLabel}` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* 服务类型：仅「入驻服务商」需要（资质必填项） */}
          {!isJoin && layer === 'PROVIDER' && (
            <div>
              <Label>{t('userCenter.apply.scope.label')}</Label>
              <div className="flex flex-wrap gap-2">
                {SERVICE_SCOPES.map((s) => {
                  const on = scopes.includes(s.value);
                  return (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => setScopes(on ? scopes.filter((x) => x !== s.value) : [...scopes, s.value])}
                      className={`rounded-full border px-3 py-1 text-[12.5px] transition ${
                        on
                          ? 'border-[#D24830] bg-[rgba(210,72,48,0.10)] font-semibold text-[#D24830]'
                          : 'border-[rgba(74,60,42,0.14)] text-[#4c4236] hover:border-[#D24830]/40'
                      }`}
                    >
                      {t(`common:${s.key}`)}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </Panel>

      {/* ── 申请说明 ── */}
      <Panel title={t('userCenter.apply.reasonTitle')}>
        <div className="px-4 py-4">
          <textarea
            value={reason}
            maxLength={MAX_REASON}
            onChange={(e) => setReason(e.target.value)}
            rows={5}
            placeholder={t('userCenter.apply.reasonPlaceholder')}
            className="w-full rounded-[10px] border border-[rgba(74,60,42,0.16)] p-3 text-[13.5px] outline-none focus:border-[#D24830]"
          />
          <div className="mt-1 flex items-center justify-between text-[12px] text-[#6e5f4a]">
            <span>{t('userCenter.apply.reasonHint')}</span>
            <span className="tabular-nums">
              {reason.length} / {MAX_REASON}
            </span>
          </div>
          {error && <p className="mt-2 text-[13px] text-[#8f1d24]">{error}</p>}
          {toast && <p className="mt-2 text-[13px] text-[#0f5a4e]">{toast}</p>}
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              disabled={submitting}
              onClick={submit}
              className="rounded-lg bg-[#D24830] px-5 py-2 text-sm font-medium text-white transition hover:bg-[#B23A22] disabled:opacity-50"
            >
              {submitting ? t('common:userCenter.loading') : t('userCenter.apply.submit')}
            </button>
          </div>
        </div>
      </Panel>
    </div>
  );
}
