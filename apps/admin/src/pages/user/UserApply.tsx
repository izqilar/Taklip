/**
 * 用户视角 · 入驻申请（运营端镜像）
 *
 * 与 web 端 apps/web/src/user/Apply.tsx **同构**：web 是用户自助入口，
 * 本页是运营端「用户视角」下的同一页（ADMIN / AGENT 监督镜像 + USER 自助）。
 * 差异仅在数据作用域：所有端点都带 `userId=<objectScope.id>`，服务端
 * `UserConsoleController.resolveUserId` 决定归属（USER 恒取本人，ADMIN/AGENT 走辖区校验）。
 *
 * 双隧道语义（勿混淆）：
 *   ① 加入 JOIN：加入已有服务商 / 代理商团队，身份仍是普通用户 → 目标团队拥有者审批。
 *   ② 入驻 SETTLE：资格升级，User.role 变更 → 总台 ADMIN 初审 / 终审。
 *
 * ⚠️ 术语：正式文案统一「入驻」，不用「入住」。
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Input, Radio, Select, Checkbox, Tooltip, message } from 'antd';
import { useCustom } from '@refinedev/core';
import { PageHead } from '../../components/ui/PageHead';
import { Panel } from '../../components/ui/Panel';
import { Pill, type PillTone } from '../../components/ui/Pill';
import { DataTable } from '../../components/ui/DataTable';
import { EmptyState } from '../../components/common/EmptyState';
import { useLayer } from '../../providers/layerContext';
import { t } from '../../i18n/t';
import { T } from '../../config/theme';
import { cleanCode } from '../../config/labels';
import { API_URL, authHeaders, jsonHeaders } from '../../utility';

type ApplyMode = 'JOIN' | 'SETTLE';
type OrgLayer = 'PROVIDER' | 'AGENT';

interface RegionNode {
  id: string;
  name: string;
  level: number;
  regionPath: string | null;
  children?: RegionNode[];
}

interface JoinTarget {
  id: string;
  name: string;
  phone: string | null;
  regionLabel: string | null;
  regionPath: string | null;
}

interface AppRow {
  id: string;
  code: string;
  kind: 'JOIN' | 'SETTLE';
  orgName: string;
  layer: OrgLayer;
  status: string;
  createdAt: string;
  reviewNote?: string | null;
}

/** 6 种服务类型（与运营端 SERVICE_ROLE_KEYS 同一语义，键指向 common namespace） */
const SERVICE_SCOPES: { value: string; key: string; zh: string }[] = [
  { value: 'DESIGN', key: 'design', zh: '策划设计' },
  { value: 'PHOTO', key: 'photo', zh: '影像摄影' },
  { value: 'VENUE', key: 'venue', zh: '场地布置' },
  { value: 'FLORAL', key: 'floral', zh: '花艺礼赠' },
  { value: 'STEWARD', key: 'steward', zh: '仪式执事' },
  { value: 'PERFORM', key: 'perform', zh: '演艺星团' },
];

const MAX_REASON = 500;

/** 申请状态 → 色调 + i18n 键（与 web 端 statusText/statusTone 同口径） */
const APP_STATUS: Record<string, { tone: PillTone; i18nKey: string; zh: string }> = {
  PENDING: { tone: 'warn', i18nKey: 'pending', zh: '待接收' },
  APPROVED: { tone: 'ok', i18nKey: 'approved', zh: '已通过' },
  REJECTED: { tone: 'bad', i18nKey: 'rejected', zh: '已拒绝' },
  WITHDRAWN: { tone: 'mut', i18nKey: 'withdrawn', zh: '已撤回' },
  FIRST_PENDING: { tone: 'warn', i18nKey: 'firstPending', zh: '待初审' },
  FIRST_PASSED: { tone: 'ok', i18nKey: 'firstPassed', zh: '初审通过' },
  FINAL_PENDING: { tone: 'warn', i18nKey: 'finalPending', zh: '待终审' },
};

const A = (k: string, zh: string) => t(`common:userCenter.apply.${k}`, zh);

const dt = (v: any) => (v ? new Date(v).toLocaleString('zh-CN', { hour12: false }) : '—');
const maskPhone = (p?: string | null) => (p ? `${p.slice(0, 3)}****${p.slice(-4)}` : '—');

export const UserApply = () => {
  const { objectScope, readonly } = useLayer();
  const uid = objectScope?.id;
  const qs = uid ? `?userId=${uid}` : '';

  /* ── 表单状态 ── */
  const [mode, setMode] = useState<ApplyMode>('JOIN');
  const [layer, setLayer] = useState<OrgLayer>('PROVIDER');
  const [tree, setTree] = useState<RegionNode[]>([]);
  const [provinceId, setProvinceId] = useState('');
  const [cityId, setCityId] = useState('');
  const [districtId, setDistrictId] = useState('');
  const [keyword, setKeyword] = useState('');
  const [targetId, setTargetId] = useState('');
  const [scopes, setScopes] = useState<string[]>([]);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isJoin = mode === 'JOIN';
  const provinces = useMemo(() => tree.filter((r) => r.level === 1), [tree]);
  const cities = useMemo(() => provinces.find((p) => p.id === provinceId)?.children ?? [], [provinces, provinceId]);
  const districts = useMemo(() => cities.find((c) => c.id === cityId)?.children ?? [], [cities, cityId]);

  /** 当前已选区域（取最末一级） */
  const selectedRegion = useMemo(() => {
    const p = provinces.find((x) => x.id === provinceId);
    if (!p) return null;
    const c = cities.find((x) => x.id === cityId);
    const d = districts.find((x) => x.id === districtId);
    const last = d ?? c ?? p;
    const names = [p.name, c?.name, d?.name].filter(Boolean) as string[];
    return { id: last.id, label: names.join(' / '), regionPath: last.regionPath ?? null };
  }, [provinces, cities, districts, provinceId, cityId, districtId]);

  /* ── 列表数据 ── */
  const { data: joinData, isLoading: loadingJoins, refetch: refetchJoins } = useCustom<any[]>({
    url: `user/join-applications${qs}`,
    method: 'get',
    queryOptions: { retry: false },
  });
  const { data: qualData, isLoading: loadingQuals, refetch: refetchQuals } = useCustom<any[]>({
    url: `user/qualifications${qs}`,
    method: 'get',
    queryOptions: { retry: false },
  });
  const { data: dashData } = useCustom<any>({
    url: `user/dashboard${qs}`,
    method: 'get',
    queryOptions: { retry: false },
  });
  const targets = useCustom<JoinTarget[]>({
    url: `user/join-targets?orgType=${layer}&regionId=${selectedRegion?.id ?? ''}&keyword=${encodeURIComponent(keyword)}`,
    method: 'get',
    queryOptions: { retry: false, enabled: isJoin },
  }).data?.data;

  const rows: AppRow[] = useMemo(() => {
    const joins = (Array.isArray(joinData?.data) ? joinData!.data : []) as any[];
    const quals = (Array.isArray(qualData?.data) ? qualData!.data : []) as any[];
    return [
      ...joins.map((j) => ({
        id: j.id,
        code: j.code ?? cleanCode(j.id),
        kind: 'JOIN' as const,
        orgName: j.orgName ?? '—',
        layer: (j.orgType === 'AGENT' ? 'AGENT' : 'PROVIDER') as OrgLayer,
        status: j.status,
        createdAt: j.createdAt,
        reviewNote: j.reviewNote,
      })),
      ...quals.map((q) => ({
        id: q.id,
        code: cleanCode(q.id),
        kind: 'SETTLE' as const,
        orgName: q.kind === 'agent' ? A('layer.agent', '代理商') : A('layer.provider', '服务商'),
        layer: (q.kind === 'agent' ? 'AGENT' : 'PROVIDER') as OrgLayer,
        status: q.status,
        createdAt: q.createdAt,
      })),
    ].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  }, [joinData, qualData]);

  /** 身份卡展示名：优先监督对象名 → 档案昵称 / 实名 */
  const profile = dashData?.data?.profile;
  const displayName = objectScope?.label || profile?.nickname || profile?.realName || '未命名用户';
  /** 已加入团队：由「加入」通道中已通过的申请推出（无需额外端点） */
  const joinedTeams = rows.filter((r) => r.kind === 'JOIN' && r.status === 'APPROVED').map((r) => r.orgName);

  /* ── 区域树 ── */
  useEffect(() => {
    fetch(`${API_URL}/regions/tree`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((b) => setTree(Array.isArray(b) ? b : []))
      .catch(() => setTree([]));
  }, []);

  /* ── 目标切换：旧选择不再在候选列表里则清空 ── */
  useEffect(() => {
    if (targets && !targets.some((x) => x.id === targetId)) setTargetId('');
  }, [targets, targetId]);

  const reload = useCallback(() => {
    refetchJoins();
    refetchQuals();
  }, [refetchJoins, refetchQuals]);

  async function submit() {
    const reasonText = reason.trim();
    if (!reasonText) return void message.warning(A('reasonRequired', '请填写申请说明'));
    if (isJoin && !targetId) return void message.warning(A('needTarget', '请选择要加入的团队'));
    if (!isJoin && layer === 'AGENT' && !selectedRegion) return void message.warning(A('needRegion', '代理商入驻须选择完整辖区（省 / 市 / 区县）'));
    if (!isJoin && layer === 'PROVIDER' && scopes.length === 0) return void message.warning(A('needScope', '请至少选择一项服务类型'));

    setSubmitting(true);
    try {
      const path = isJoin ? 'user/join-applications' : 'user/qualifications';
      const body = isJoin
        ? {
            userId: uid,
            orgType: layer,
            orgId: targetId,
            regionPath: selectedRegion?.regionPath ?? null,
            regionLabel: selectedRegion?.label ?? null,
            reason: reasonText,
          }
        : {
            userId: uid,
            kind: layer === 'AGENT' ? 'agent' : 'provider',
            reason: reasonText,
            serviceScopes: layer === 'PROVIDER' ? scopes : [],
            regionPath: selectedRegion?.regionPath ?? null,
            regionLabel: selectedRegion?.label ?? null,
          };
      const res = await fetch(`${API_URL}/${path}`, {
        method: 'POST',
        headers: jsonHeaders(),
        body: JSON.stringify(body),
      });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(Array.isArray(b?.message) ? b.message.join('; ') : b?.message || '提交失败');
      if (b?.duplicated) message.info(A('duplicated', '你已提交过同类申请，请勿重复提交'));
      else message.success(A('submitted', '申请已提交，请等待审批'));
      setReason('');
      setScopes([]);
      setTargetId('');
      reload();
    } catch (e: any) {
      message.error(e?.message || A('submitFailed', '提交失败，请稍后重试'));
    } finally {
      setSubmitting(false);
    }
  }

  async function withdraw(row: AppRow) {
    try {
      const path = row.kind === 'JOIN' ? `user/join-applications/${row.id}` : `user/qualifications/${row.id}`;
      const res = await fetch(`${API_URL}/${path}${qs}`, { method: 'DELETE', headers: authHeaders() });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b?.message || '撤回失败');
      }
      message.success(A('withdrawn', '已撤回'));
      reload();
    } catch (e: any) {
      message.error(e?.message || A('withdrawFailed', '撤回失败'));
    }
  }

  const canWrite = !readonly;
  const loading = loadingJoins || loadingQuals;

  const columns = [
    { title: A('col.code', '编号'), dataIndex: 'code', width: 150, render: (v: string) => <span style={{ fontFamily: 'monospace' }}>{v}</span> },
    {
      title: A('mode.label', '申请类型'),
      dataIndex: 'kind',
      width: 96,
      render: (v: string) => (
        <Pill tone={v === 'JOIN' ? 'ac' : 'warn'}>{v === 'JOIN' ? A('mode.join', '加入') : A('mode.settle', '入驻')}</Pill>
      ),
    },
    {
      title: A('target.label', '归所团队'),
      dataIndex: 'orgName',
      render: (v: string, r: AppRow) => (
        <span>
          {v} <span style={{ color: T.ink3 }}>· {r.layer === 'AGENT' ? A('layer.agent', '代理商') : A('layer.provider', '服务商')}</span>
        </span>
      ),
    },
    {
      title: A('col.status', '状态'),
      dataIndex: 'status',
      width: 110,
      render: (v: string, r: AppRow) => {
        const meta = APP_STATUS[v] ?? { tone: 'mut' as PillTone, zh: v ?? '—' };
        const tag = <Pill tone={meta.tone}>{A(`status.${meta.i18nKey}`, meta.zh)}</Pill>;
        return r.reviewNote ? (
          <Tooltip title={`${A('reviewNote', '审批反馈')}：${r.reviewNote}`}>
            <span style={{ cursor: 'help' }}>{tag}</span>
          </Tooltip>
        ) : (
          tag
        );
      },
    },
    { title: A('col.createdAt', '提交时间'), dataIndex: 'createdAt', width: 160, render: dt },
    {
      title: A('col.action', '操作'),
      key: 'action',
      width: 90,
      render: (_: any, r: AppRow) =>
        ['PENDING', 'FIRST_PENDING', 'FIRST_PASSED'].includes(r.status) && canWrite ? (
          <span style={{ color: T.accent, cursor: 'pointer' }} onClick={() => withdraw(r)}>
            {A('withdraw', '撤回')}
          </span>
        ) : (
          <span style={{ color: T.ink3 }}>—</span>
        ),
    },
  ];

  const radioCard = (checked: boolean, label: string, desc: string, onClick: () => void) => (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'block',
        width: '100%',
        textAlign: 'left',
        padding: '9px 12px',
        borderRadius: 10,
        border: `1px solid ${checked ? T.accent : T.border}`,
        background: checked ? T.accentSoft ?? T.panel2 : T.bg,
        cursor: 'pointer',
        marginBottom: 8,
      }}
    >
      <div style={{ fontSize: 13.5, fontWeight: checked ? 650 : 500, color: checked ? T.accent : T.ink1 }}>{label}</div>
      <div style={{ fontSize: 12, color: T.ink3, marginTop: 2, lineHeight: 1.4 }}>{desc}</div>
    </button>
  );

  const fieldLabel = (text: string) => (
    <div style={{ marginBottom: 6, fontSize: 12.5, fontWeight: 600, color: T.ink3 }}>{text}</div>
  );

  return (
    <>
      <PageHead
        title={t('common:userCenter.menu.apply', '入驻申请')}
        sub={A('sub', '加入已有代理商 / 服务商团队，或申请升级为服务商 / 代理商')}
        chip={readonly ? A('readonlyChip', '只读') : undefined}
      />

      {/* ── 身份卡 ── */}
      <Panel title={A('identityTitle', '我的身份')}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', flexWrap: 'wrap' }}>
          <span
            style={{
              width: 46,
              height: 46,
              borderRadius: '50%',
              background: T.avatarGrad,
              color: T.onAccent,
              display: 'grid',
              placeItems: 'center',
              fontSize: 19,
              fontWeight: 700,
              flex: 'none',
            }}
          >
            {String(displayName).slice(0, 1)}
          </span>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <b style={{ fontSize: 15, color: T.ink1 }}>{displayName}</b>
              <Pill tone="mut">{cleanCode(profile?.id ?? uid ?? '')}</Pill>
              <Pill tone="ok">{A('identityUser', '普通用户')}</Pill>
            </div>
            <div style={{ marginTop: 3, fontSize: 12.5, color: T.ink3 }}>{maskPhone(profile?.phone)}</div>
            {joinedTeams.length > 0 && (
              <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', fontSize: 12, color: T.ink3 }}>
                <span>{A('joinedTeams', '已加入团队')}</span>
                {joinedTeams.map((n) => (
                  <Pill key={n} tone="ok">
                    {n}
                  </Pill>
                ))}
              </div>
            )}
          </div>
        </div>
      </Panel>

      {/* ── 我的申请 ── */}
      <Panel title={A('myTitle', '我的申请')} hint={A('myHint', '可在审批完成前撤回')}>
        {loading && !rows.length ? (
          <EmptyState description="加载中…" />
        ) : (
          <DataTable<any> rowKey="id" columns={columns as any} dataSource={rows} />
        )}
      </Panel>

      {/* 只读观测模式下提示：用户视角默认只读（观测镜头口径），写入口随「权限模式」解除 */}
      {readonly && (
        <Panel>
          <div style={{ padding: '12px 16px', fontSize: 12.5, color: T.ink3, lineHeight: 1.7 }}>
            当前为<b>只读观测模式</b>，仅展示该用户的入驻 / 加入申请档案。
            如需代为提交申请或撤回，请在顶栏「权限模式」切换到超级管理员后操作。
          </div>
        </Panel>
      )}

      {/* ── 申请方式（只读视角隐藏写入口）── */}
      {canWrite && (
        <>
          <Panel title={A('wayTitle', '申请方式')}>
            <div style={{ padding: '14px 16px', display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))' }}>
              <div>
                {fieldLabel(A('mode.label', '申请类型'))}
                {radioCard(isJoin, A('mode.join', '加入'), A('mode.joinDesc', '加入已有的服务商 / 代理商团队，身份仍为普通用户'), () => setMode('JOIN'))}
                {radioCard(!isJoin, A('mode.settle', '入驻'), A('mode.settleDesc', '资格升级成为服务商 / 代理商主体，由总台审批'), () => setMode('SETTLE'))}
              </div>
              <div>
                {fieldLabel(A('layer.label', '申请层次'))}
                {radioCard(layer === 'PROVIDER', A('layer.provider', '服务商'), A('layer.providerDesc', '提供婚礼服务，管理作品与模板'), () => setLayer('PROVIDER'))}
                {radioCard(layer === 'AGENT', A('layer.agent', '代理商'), A('layer.agentDesc', '管辖指定辖区（省 / 市 / 区县）'), () => setLayer('AGENT'))}
              </div>
            </div>

            <div style={{ padding: '0 16px 14px' }}>
              {fieldLabel(
                `${A('region.label', '所属区域')}${!isJoin && layer === 'PROVIDER' ? `（${A('region.optional', '选填')}）` : ''}`,
              )}
              <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))' }}>
                <Select
                  value={provinceId || undefined}
                  placeholder={A('region.province', '请选择省份')}
                  allowClear
                  options={provinces.map((p) => ({ value: p.id, label: p.name }))}
                  onChange={(v) => {
                    setProvinceId(v ?? '');
                    setCityId('');
                    setDistrictId('');
                  }}
                />
                <Select
                  value={cityId || undefined}
                  placeholder={A('region.city', '请选择城市')}
                  disabled={!provinceId}
                  allowClear
                  options={cities.map((c) => ({ value: c.id, label: c.name }))}
                  onChange={(v) => {
                    setCityId(v ?? '');
                    setDistrictId('');
                  }}
                />
                <Select
                  value={districtId || undefined}
                  placeholder={A('region.district', '请选择区县')}
                  disabled={!cityId}
                  allowClear
                  options={districts.map((d) => ({ value: d.id, label: d.name }))}
                  onChange={(v) => setDistrictId(v ?? '')}
                />
              </div>
            </div>

            {/* 归所团队：仅「加入」隧道可见（「入驻」为资格升级，无需选择目标团队） */}
            {isJoin && (
              <div style={{ padding: '0 16px 14px' }}>
                {fieldLabel(A('target.label', '归所团队'))}
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
                  <Input
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    placeholder={A('target.search', '搜索团队名称 / 手机号…')}
                    style={{ maxWidth: 320 }}
                    allowClear
                  />
                  <span style={{ fontSize: 12, color: T.ink3 }}>
                    {A('target.count', '匹配团队')}：{targets?.length ?? 0}
                  </span>
                </div>
                <Select
                  value={targetId || undefined}
                  placeholder={A('target.placeholder', '请选择要加入的团队')}
                  style={{ width: '100%', maxWidth: 460 }}
                  options={(targets ?? []).map((o) => ({
                    value: o.id,
                    label: `${o.name}${o.regionLabel ? ` · ${o.regionLabel}` : ''}`,
                  }))}
                  onChange={(v) => setTargetId(v ?? '')}
                />
              </div>
            )}

            {/* 服务类型：仅「入驻服务商」需要（资质必填项） */}
            {!isJoin && layer === 'PROVIDER' && (
              <div style={{ padding: '0 16px 14px' }}>
                {fieldLabel(A('scope.label', '服务类型'))}
                <Checkbox.Group
                  value={scopes}
                  onChange={(v) => setScopes(v as string[])}
                  options={SERVICE_SCOPES.map((s) => ({ value: s.value, label: t(`common:userCenter.svc.${s.key}`, s.zh) }))}
                />
              </div>
            )}
          </Panel>

          <Panel title={A('reasonTitle', '申请说明')}>
            <div style={{ padding: '14px 16px' }}>
              <Input.TextArea
                value={reason}
                maxLength={MAX_REASON}
                rows={5}
                onChange={(e) => setReason(e.target.value)}
                placeholder={A('reasonPlaceholder', '请填写你的特长或申请理由，便于团队负责人了解…')}
              />
              <div style={{ marginTop: 6, display: 'flex', justifyContent: 'space-between', fontSize: 12, color: T.ink3 }}>
                <span>{A('reasonHint', '岗位由团队负责人在接收时确定，细粒度权限随后配置')}</span>
                <span>
                  {reason.length} / {MAX_REASON}
                </span>
              </div>
              <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
                <Button type="primary" loading={submitting} onClick={submit}>
                  {A('submit', '提交申请')}
                </Button>
              </div>
            </div>
          </Panel>
        </>
      )}
    </>
  );
};

export default UserApply;
