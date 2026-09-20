import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Form, Input, InputNumber, Select, Switch, Button, message } from 'antd';
import { T } from '../config/theme';
import { t } from '../i18n/t';
import { dataProvider } from '../providers/dataProvider';
import { getStoredUser } from '../utility';
import { SettingPage, PreviewCard, FlowSteps, Timeline, MemberCard, TemplatePreviewCard, ServicePreviewCard, WorkPreviewCard } from '../components/provider/SettingPage';
import { Pill } from '../components/ui/Pill';

/* ════════════ 模板发布常量（与 providerPages 同源口径，避免跨文件耦合） ════════════ */
const TEMPLATE_CAT_OPTS = [
  { value: 'wedding', label: '婚礼' },
  { value: 'birth_celebration', label: '生日庆典' },
  { value: 'birthday', label: '生日' },
  { value: 'festival', label: '节庆' },
  { value: 'housewarming', label: '乔迁' },
  { value: 'school_promotion', label: '校园推广' },
  { value: 'social_gathering', label: '社交聚会' },
  { value: 'memorial', label: '纪念' },
  { value: 'brand', label: '品牌' },
  { value: 'recruitment', label: '招聘' },
  { value: 'conference', label: '会议' },
  { value: 'opening', label: '开业' },
  { value: 'education', label: '教育' },
  { value: 'biz_social', label: '商务社交' },
  { value: 'marketing', label: '营销' },
];
const TEMPLATE_TAG_OPTS = ['中式', '国潮', '喜庆', '简约', '手绘', '浪漫', '复古', '森系', '商务', '科技', '童趣', '实景', 'H5互动', '电子请柬'].map((v) => ({ value: v, label: v }));
const COVER_COLORS = ['#c24b2e', '#1f3a5f', '#2e7d52', '#8a5a00', '#6a1b4d', '#37474f', '#b71c1c', '#00695c', '#4527a0', '#f3f4f6'];
const TITLE_COLORS = [
  { value: '#c24b2e', label: '品牌红' },
  { value: '#ffffff', label: '纯白' },
  { value: '#d4af37', label: '香槟金' },
  { value: '#1f3a5f', label: '深藏蓝' },
];
const TEMPLATE_STATUS_OPTS = [
  { value: 'DRAFT', label: '草稿' },
  { value: 'PENDING', label: '待审核' },
  { value: 'APPROVED', label: '已发布' },
  { value: 'REJECTED', label: '已驳回' },
  { value: 'TAKEN_DOWN', label: '已下架' },
];

/* ════════════ 常量（与 providerPages.tsx 同源口径，避免跨文件耦合） ════════════ */
const CONTRACT_TYPE: Record<string, string> = {
  MAIN: 'pages.status.contractMain',
  SUPPLEMENT: 'pages.status.contractSupplement',
  RENEW: 'pages.status.contractRenew',
  TERMINATE: 'pages.status.contractTerminate',
};
const CONTRACT_STAGE: Record<string, { key: string; tone: 'warn' | 'ac' | 'ok' | 'mut' | 'bad' }> = {
  NEGOTIATING: { key: 'pages.status.contractStageNegotiating', tone: 'warn' },
  AWAIT_PROVIDER_SIGN: { key: 'pages.status.contractStageAwaitProvider', tone: 'warn' },
  AWAIT_SENIOR_SIGN: { key: 'pages.status.contractStageAwaitSenior', tone: 'warn' },
  APPROVING: { key: 'pages.status.contractStageApproving', tone: 'ac' },
  EFFECTIVE: { key: 'pages.status.contractStageEffective', tone: 'ok' },
  EXPIRED: { key: 'pages.status.contractStageExpired', tone: 'mut' },
  TERMINATED: { key: 'pages.status.contractStageTerminated', tone: 'bad' },
};
const CONTRACT_MODE: Record<string, string> = {
  REGION_EXCLUSIVE: 'pages.status.contractModeRegionExclusive',
  ONLINE: 'pages.status.contractModeOnline',
  ON_SITE: 'pages.status.contractModeOnSite',
  JOINT: 'pages.status.contractModeJoint',
};
const SETTLE: Record<string, string> = { MONTH: 'pages.status.settleMonth', HALF_MONTH: 'pages.status.settleHalfMonth', WEEK: 'pages.status.settleWeek' };
const SVC_OPTIONS = ['摄影摄像', '插花礼仪', '乐队演出', '礼仪执事', '主持人', '婚庆主持', '宴会设计', '花艺布置', '化妆造型', '司仪培训', '婚礼策划', '特约设计', '光影纪录', '司仪主持', '灯光音响'].map((s) => ({ value: s, label: s }));
const REGION_OPTIONS = ['乌鲁木齐市', '喀什市', '伊宁市', '昌吉市', '库尔勒市', '克拉玛依市', '石河子市', '阿克苏市', '和田市', '吐鲁番市'].map((s) => ({ value: s, label: s }));
const TEAM_STATUS: Record<string, { key: string; tone: 'ok' | 'warn' | 'bad' }> = {
  ACTIVE: { key: 'status.ACTIVE', tone: 'ok' },
  PENDING: { key: 'pages.status.teamPending', tone: 'warn' },
  DISABLED: { key: 'status.DISABLED', tone: 'bad' },
};

const fieldStyle = { marginBottom: 14 } as const;
const labelStyle = { fontSize: 12.5, color: T.ink2, fontWeight: 600, marginBottom: 6 } as const;

/** 取列表并按 id 定位单条（后端无单条 GET，列表定位） */
async function fetchOne(resource: string, id: string): Promise<any> {
  const r: any = await dataProvider.custom!({ url: `${resource}?pageSize=200`, method: 'get' });
  const items: any[] = r?.data?.items ?? r?.data ?? [];
  return items.find((x) => x.id === id) ?? null;
}

/* ════════════ 合同管理详情（pg-ctrcfg：整页 + 签署流程） ════════════ */
export const SPContractDetail = () => {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const [form] = Form.useForm();
  const [rec, setRec] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [signing, setSigning] = useState(false);
  const [nego, setNego] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const r = await fetchOne('provider/contracts', id);
        setRec(r);
        if (r) {
          form.setFieldsValue({
            name: r.name,
            type: r.type,
            partyA: r.partyA,
            serviceType: r.serviceType,
            businessMode: r.businessMode,
            region: r.region,
            exclusive: !!r.exclusive,
            platformRate: r.platformRate,
            deposit: r.deposit != null ? Math.round(r.deposit / 100) : undefined,
            settlePeriod: r.settlePeriod,
            expireDate: r.expireDate ? r.expireDate.slice(0, 10) : undefined,
            signStage: r.signStage,
          });
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const save = async () => {
    let v: any;
    try {
      v = await form.validateFields();
    } catch {
      message.warning('请先修正表单中的校验项');
      return;
    }
    setSaving(true);
    try {
      await dataProvider.custom!({ url: `provider/contracts/${id}`, method: 'patch', payload: {
        name: v.name?.trim(),
        type: v.type,
        partyA: v.partyA?.trim(),
        serviceType: v.serviceType,
        businessMode: v.businessMode,
        region: v.region,
        exclusive: !!v.exclusive,
        platformRate: Number(v.platformRate),
        deposit: Math.round(Number(v.deposit) * 100),
        settlePeriod: v.settlePeriod,
        expireDate: v.expireDate || null,
      } });
      message.success('合同已保存');
    } catch (e: any) {
      message.error(e?.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const sign = async () => {
    setSigning(true);
    try {
      const res: any = await dataProvider.custom!({ url: `provider/contracts/${id}/sign`, method: 'post' });
      const stage = res?.data?.signStage || 'AWAIT_SENIOR_SIGN';
      form.setFieldsValue({ signStage: stage });
      setRec((p: any) => ({ ...p, signStage: stage }));
      message.success('在线签署已发起，进入上级审批');
    } catch (e: any) {
      message.error(e?.message || '签署失败');
    } finally {
      setSigning(false);
    }
  };

  const addNego = async () => {
    const text = nego.trim();
    if (!text) return;
    try {
      await dataProvider.custom!({ url: `provider/contracts/${id}/negotiation`, method: 'post', payload: { content: text } });
      setRec((p: any) => ({ ...p, negotiation: [...(p?.negotiation || []), text] }));
      setNego('');
      message.success('协商记录已补充');
    } catch (e: any) {
      message.error(e?.message || '补充失败');
    }
  };

  // signStage 非表单可编辑字段，直接以数据 rec 为唯一真值，避免渲染期调用 form.getFieldValue 触发「useForm 未连接」告警
  const stage = (rec?.signStage || 'NEGOTIATING') as string;
  const stageOrder = ['NEGOTIATING', 'AWAIT_PROVIDER_SIGN', 'AWAIT_SENIOR_SIGN', 'APPROVING', 'EFFECTIVE'];
  const curIdx = stageOrder.indexOf(stage);
  const flowSteps = [
    { title: '多轮协商', state: curIdx > 0 ? 'done' : stage === 'NEGOTIATING' ? 'current' : 'todo' },
    { title: '服务商在线签署', state: stage === 'AWAIT_PROVIDER_SIGN' ? 'current' : curIdx >= 2 ? 'done' : 'todo' },
    { title: '代理商 / 总台审批签署', state: stage === 'AWAIT_SENIOR_SIGN' || stage === 'APPROVING' ? 'current' : curIdx >= 4 ? 'done' : 'todo' },
    { title: '生效归档', state: stage === 'EFFECTIVE' ? 'done' : 'todo' },
  ] as const;

  const aside = (
    <>
      <PreviewCard title="合同信息" hint="实时同步">
        <Line k="合同编号" v={rec?.contractNo || '—'} />
        <Line k="类型" v={rec ? t(CONTRACT_TYPE[rec.type] ?? rec.type) : '—'} />
        <Line k="签约甲方" v={rec?.partyA || '—'} />
        <Line k="当前阶段" v={rec ? t(CONTRACT_STAGE[stage]?.key ?? stage) : '—'} />
        <Line k="到期日期" v={rec?.expireDate ? rec.expireDate.slice(0, 10) : '—'} />
      </PreviewCard>
      <PreviewCard title="签署流程">
        <FlowSteps steps={flowSteps as any} />
      </PreviewCard>
      <PreviewCard title="协商记录" hint={`${rec?.negotiation?.length || 0} 条`}>
        <Timeline items={(rec?.negotiation || []).map((n: string, i: number) => ({ title: `协商 ${i + 1}`, desc: n, tone: 'mut' as const }))} />
      </PreviewCard>
    </>
  );

  return (
    <SettingPage
      title="合同管理详情"
      sub="服务商与代理商 / 管理总台在线签约 · 协商、签署、审批全流程线上化"
      chip="服务商 · 自身作用域"
      backTo="/sp/contract"
      aside={aside}
      loading={loading}
      footer={
        <>
          <Button onClick={() => nav('/sp/contract')}>取消</Button>
          <Button type="primary" loading={saving} onClick={save}>保存合同</Button>
          <Button loading={signing} onClick={sign}>发起在线签署</Button>
        </>
      }
    >
      {rec && (
        <div style={{ fontSize: 12, color: T.ink3, margin: '0 0 12px' }}>
          {rec.contractNo} · {t(CONTRACT_TYPE[rec.type] ?? rec.type)} · <Pill tone={CONTRACT_STAGE[stage]?.tone ?? 'mut'}>{t(CONTRACT_STAGE[stage]?.key ?? stage)}</Pill>
        </div>
      )}
      <Form form={form} layout="vertical" initialValues={{ exclusive: false }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Field label="合同名称"><Form.Item name="name" noStyle rules={[{ required: true, message: '请填写合同名称' }]}><Input placeholder="如：2026 婚庆服务主合同" /></Form.Item></Field>
          <Field label="合同类型"><Form.Item name="type" noStyle rules={[{ required: true }]}><Select options={Object.entries(CONTRACT_TYPE).map(([v, l]) => ({ value: v, label: t(l) }))} style={{ width: '100%' }} /></Form.Item></Field>
          <Field label="签约主体甲方"><Form.Item name="partyA" noStyle rules={[{ required: true, message: '请填写甲方' }]}><Input placeholder="管理总台 / 各代理商" /></Form.Item></Field>
          <Field label="关联服务类型"><Form.Item name="serviceType" noStyle><Select options={SVC_OPTIONS} showSearch optionFilterProp="label" style={{ width: '100%' }} /></Form.Item></Field>
          <Field label="业务开展方式"><Form.Item name="businessMode" noStyle><Select options={Object.entries(CONTRACT_MODE).map(([v, l]) => ({ value: v, label: t(l) }))} style={{ width: '100%' }} /></Form.Item></Field>
          <Field label="签约区域"><Form.Item name="region" noStyle><Select options={REGION_OPTIONS} showSearch optionFilterProp="label" style={{ width: '100%' }} /></Form.Item></Field>
          <Field label="平台抽成比例 (%)"><Form.Item name="platformRate" noStyle rules={[{ required: true, message: '请填写抽成' }]}><InputNumber min={0} max={100} style={{ width: '100%' }} placeholder="如 10" /></Form.Item></Field>
          <Field label="服务保证金 (元)"><Form.Item name="deposit" noStyle><InputNumber min={0} style={{ width: '100%' }} placeholder="如 5000" /></Form.Item></Field>
          <Field label="结算周期"><Form.Item name="settlePeriod" noStyle><Select options={Object.entries(SETTLE).map(([v, l]) => ({ value: v, label: t(l) }))} style={{ width: '100%' }} /></Form.Item></Field>
          <Field label="到期日期"><Form.Item name="expireDate" noStyle><Input type="date" style={{ width: '100%' }} /></Form.Item></Field>
        </div>
        <Field label="区域独家保护">
          <Form.Item name="exclusive" noStyle valuePropName="checked"><Switch /></Form.Item>
        </Field>
        <Field label="补充协商记录">
          <div style={{ display: 'flex', gap: 8 }}>
            <Input.TextArea value={nego} onChange={(e) => setNego(e.target.value)} rows={2} placeholder="记录一轮协商要点，提交后留痕" />
            <Button onClick={addNego} style={{ flex: 'none' }}>补充</Button>
          </div>
        </Field>
      </Form>
    </SettingPage>
  );
};

/* ════════════ 我的团队 · 新建成员（pg-teamcfg：整页 + 名片预览） ════════════ */
export const SPTeamCreate = () => {
  const nav = useNavigate();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [vals, setVals] = useState<any>({});
  // 初始读取一次；后续由 Form 的 onValuesChange 驱动预览，避免渲染期调用 useWatch/getFieldValue 触发「useForm 未连接」告警
  useEffect(() => { setVals(form.getFieldsValue()); }, []);

  const save = async () => {
    let v: any;
    try {
      v = await form.validateFields();
    } catch {
      message.warning('请先修正表单中的校验项');
      return;
    }
    setSaving(true);
    try {
      await dataProvider.custom!({ url: 'provider/team', method: 'post', payload: {
        name: v.name.trim(),
        phone: v.phone.trim(),
        accountStatus: v.accountStatus || 'ACTIVE',
        serviceType: v.serviceType || '',
        teamRole: v.teamRole || '',
      } });
      message.success('成员已添加');
      nav('/sp/team');
    } catch (e: any) {
      message.error(e?.response?.data?.message || e?.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const aside = (
    <MemberCard
      name={vals.name || '成员姓名'}
      memberNo="MT-（自动生成）"
      serviceType={vals.serviceType}
      teamRole={vals.teamRole}
      status={vals.accountStatus ? t(TEAM_STATUS[vals.accountStatus]?.key ?? 'status.ACTIVE') : t('status.ACTIVE')}
      phone={vals.phone}
    />
  );

  return (
    <SettingPage
      title="新建团队成员"
      sub="按服务类型配置成员角色与个性"
      chip="服务商 · 自身作用域"
      backTo="/sp/team"
      aside={aside}
      footer={<><Button onClick={() => nav('/sp/team')}>取消</Button><Button type="primary" loading={saving} onClick={save}>保存成员</Button></>}
    >
      <Form form={form} layout="vertical" initialValues={{ accountStatus: 'ACTIVE', serviceType: SVC_OPTIONS[0]?.value }} onValuesChange={(_, all) => setVals(all)} style={{ marginTop: 8 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Field label="成员姓名"><Form.Item name="name" noStyle rules={[{ required: true, message: '请填写成员姓名' }]}><Input placeholder="如：古丽娜尔" /></Form.Item></Field>
          <Field label="手机号"><Form.Item name="phone" noStyle rules={[{ required: true, message: '请填写手机号' }, { pattern: /^\d{11}$/, message: '须为 11 位数字' }]}><Input placeholder="11 位手机号" maxLength={11} /></Form.Item></Field>
          <Field label="账号状态"><Form.Item name="accountStatus" noStyle><Select options={Object.entries(TEAM_STATUS).map(([v, m]) => ({ value: v, label: t(m.key) }))} style={{ width: '100%' }} /></Form.Item></Field>
          <Field label="服务类型"><Form.Item name="serviceType" noStyle><Select options={SVC_OPTIONS} showSearch optionFilterProp="label" style={{ width: '100%' }} /></Form.Item></Field>
          <Field label="团队角色"><Form.Item name="teamRole" noStyle><Input placeholder="如：花艺师 / 客服专员" /></Form.Item></Field>
        </div>
        <div style={{ fontSize: 11, color: T.ink3, marginTop: 4 }}>工号（MT-xxxx）由系统按当前最大编号自动生成，无需填写。</div>
      </Form>
    </SettingPage>
  );
};

/* ════════════ 我的团队 · 成员详情（pg-teamcfg 查看） ════════════ */
export const SPTeamMember = () => {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const [rec, setRec] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const r = await fetchOne('provider/team', id);
        setRec(r);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const remove = async () => {
    try {
      await dataProvider.custom!({ url: `provider/team/${id}`, method: 'delete' });
      message.success('成员已移除');
      nav('/sp/team');
    } catch (e: any) {
      message.error(e?.message || '移除失败');
    }
  };

  const aside = rec ? (
    <MemberCard name={rec.name} memberNo={rec.memberNo} serviceType={rec.serviceType} teamRole={rec.teamRole} status={rec.accountStatus ? t(TEAM_STATUS[rec.accountStatus]?.key ?? rec.accountStatus) : '—'} phone={rec.phone} />
  ) : null;

  return (
    <SettingPage
      title="团队成员详情"
      sub="角色化团队建设 · 按服务类型差异化角色"
      chip="服务商 · 自身作用域"
      backTo="/sp/team"
      aside={aside}
      loading={loading}
      footer={<><Button onClick={() => nav('/sp/team')}>返回</Button><Button danger onClick={remove}>移除成员</Button></>}
    >
      {rec && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Line k="成员编号" v={rec.memberNo} />
          <Line k="姓名" v={rec.name} />
          <Line k="手机号" v={rec.phone} />
          <Line k="服务类型" v={rec.serviceType || '—'} />
          <Line k="团队角色" v={rec.teamRole || '—'} />
          <Line k="职责" v={Array.isArray(rec.duties) && rec.duties.length ? rec.duties.join('、') : '—'} />
          <Line k="数据权限" v={rec.dataScope || '—'} />
          <Line k="功能权限" v={Array.isArray(rec.funcPerms) && rec.funcPerms.length ? rec.funcPerms.join('、') : '—'} />
          <Line k="账号状态" v={rec.accountStatus ? t(TEAM_STATUS[rec.accountStatus]?.key ?? rec.accountStatus) : '—'} />
        </div>
      )}
    </SettingPage>
  );
};

/* ════════════ 模板发布详情（pg-tplcfg：整页 + 封面预览卡） ════════════ */
export const SPTemplateDetail = () => {
  const { id } = useParams();
  const nav = useNavigate();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pv, setPv] = useState<any>({});
  const [rec, setRec] = useState<any>(null);
  const isEdit = !!id;
  const role = getStoredUser<{ role?: string }>()?.role;
  const isAdmin = role === 'ADMIN';

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      if (!isEdit) {
        const def = {
          name: '', category: TEMPLATE_CAT_OPTS[0]?.value, tags: [], status: 'PENDING',
          isOfficial: false, coverTitle: '', titleColor: TITLE_COLORS[0].value, coverColor: COVER_COLORS[0],
          intro: '', cover: '', price: 0, useCount: 0,
        };
        if (alive) { setRec(def); setPv(def); setLoading(false); }
        return;
      }
      try {
        const r = await fetchOne('provider/services', id);
        const meta = (r?.schema && r.schema.meta) || {};
        const init = {
          name: r.name || '',
          category: r.category || TEMPLATE_CAT_OPTS[0]?.value,
          tags: r.tags || [],
          status: r.status || 'PENDING',
          isOfficial: !!r.isOfficial,
          coverTitle: meta.coverTitle || '',
          titleColor: meta.titleColor || TITLE_COLORS[0].value,
          coverColor: meta.coverColor || COVER_COLORS[0],
          intro: meta.intro || '',
          cover: r.cover || '',
          price: (r.price || 0) / 100,
          useCount: r.useCount ?? 0,
          schema: r.schema,
        };
        if (alive) { setRec(init); setPv(init); }
      } catch (e: any) {
        if (alive) message.error(e?.message || '加载模板失败');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [id]);

  const save = async (action: 'save' | 'draft' | 'submit' | 'publish') => {
    let v: any;
    try { v = await form.validateFields(); } catch { message.warning('请先修正表单中的校验项'); return; }
    setSaving(true);
    try {
      // 服务商仅能 保存草稿(DRAFT) / 提交审核(PENDING)；管理员可 保存(沿用下拉) / 直接发布(APPROVED)。
      // 修复此前「创建并发布」直接置 APPROVED 导致服务商可自我审核通过的越权问题。
      let status: string;
      if (action === 'draft') status = 'DRAFT';
      else if (action === 'submit') status = 'PENDING';
      else if (action === 'publish') status = isAdmin ? 'APPROVED' : 'PENDING';
      else status = v.status || 'DRAFT';
      const payload = {
        name: v.name.trim(),
        category: v.category,
        tags: Array.isArray(v.tags) ? v.tags : [],
        price: Number(v.price),
        status,
        cover: v.cover || '',
        coverTitle: v.coverTitle || '',
        titleColor: v.titleColor || '',
        coverColor: v.coverColor || '',
        intro: v.intro || '',
        isOfficial: !!v.isOfficial,
      };
      const url = isEdit ? `provider/services/${id}` : 'provider/services';
      const method = isEdit ? 'patch' : 'post';
      await dataProvider.custom!({ url, method, payload });
      const tip =
        action === 'draft' ? '草稿已保存'
          : action === 'submit' ? '已提交审核，等待运营端裁定'
            : action === 'publish' ? (isEdit ? '模板已更新并发布' : '模板已发布')
              : (isEdit ? '模板已更新' : '模板已创建');
      message.success(tip);
      nav('/sp/templates');
    } catch (e: any) {
      message.error(e?.response?.data?.message || e?.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const aside = (
    <TemplatePreviewCard
      name={pv.name || '模板名称'}
      category={pv.category}
      status={pv.status}
      tags={pv.tags}
      intro={pv.intro}
      cover={pv.cover}
      coverTitle={pv.coverTitle}
      coverColor={pv.coverColor}
      titleColor={pv.titleColor}
      price={typeof pv.price === 'number' ? pv.price : 0}
      useCount={pv.useCount}
      isOfficial={pv.isOfficial}
      schema={pv.schema}
    />
  );

  const Swatch = ({ color, active, onClick }: { color: string; active: boolean; onClick: () => void }) => (
    <span onClick={onClick} style={{ width: 24, height: 24, borderRadius: 6, background: color, cursor: 'pointer', border: active ? `2px solid ${T.accent}` : `1px solid ${T.border}`, boxSizing: 'border-box' }} />
  );

  return (
    <SettingPage
      title={isEdit ? '模板管理详情' : '新建模板'}
      sub="按平台模板库标准维护 · 保存后前端模板库即时同步"
      chip="服务商 · 自身作用域"
      backTo="/sp/templates"
      aside={aside}
      loading={loading}
      footer={<>
        <Button onClick={() => nav('/sp/templates')}>取消</Button>
        {isAdmin ? (
          <>
            <Button loading={saving} onClick={() => save('save')}>保存</Button>
            <Button type="primary" loading={saving} onClick={() => save('publish')}>直接发布</Button>
          </>
        ) : (
          <>
            <Button loading={saving} onClick={() => save('draft')}>保存草稿</Button>
            <Button type="primary" loading={saving} onClick={() => save('submit')}>提交审核</Button>
          </>
        )}
      </>}
    >
      {rec && (
        <Form
          form={form}
          layout="vertical"
          initialValues={rec}
          onValuesChange={(_, all) => setPv((p: any) => ({ ...p, ...all }))}
          style={{ marginTop: 8 }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Field label="模板名称"><Form.Item name="name" noStyle rules={[{ required: true, message: '请填写模板名称' }]}><Input placeholder="如：天山雪莲·婚礼请柬" maxLength={20} /></Form.Item></Field>
            <Field label="售价（元，0=免费）"><Form.Item name="price" noStyle rules={[{ type: 'number', min: 0, message: '售价不小于 0' }]}><InputNumber min={0} precision={2} style={{ width: '100%' }} placeholder="0" /></Form.Item></Field>
            <Field label="已使用次数"><Form.Item name="useCount" noStyle><InputNumber disabled style={{ width: '100%' }} placeholder="自动统计" /></Form.Item></Field>
            <div style={{ gridColumn: '1 / -1' }}>
              <Field label="模板分类"><Form.Item name="category" noStyle rules={[{ required: true, message: '请选择模板分类' }]}><Select options={TEMPLATE_CAT_OPTS} showSearch optionFilterProp="label" style={{ width: '100%' }} /></Form.Item></Field>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <Field label="模板标签"><Form.Item name="tags" noStyle><Select mode="multiple" options={TEMPLATE_TAG_OPTS} placeholder="可多选" maxTagCount="responsive" style={{ width: '100%' }} /></Form.Item></Field>
            </div>
            {isAdmin && (
              <div style={{ gridColumn: '1 / -1' }}>
                <Field label="状态（管理员可直设）"><Form.Item name="status" noStyle><Select options={TEMPLATE_STATUS_OPTS} style={{ width: '100%' }} /></Form.Item></Field>
              </div>
            )}
          </div>
          <Field label="官方模板"><Form.Item name="isOfficial" noStyle valuePropName="checked"><Switch /></Form.Item></Field>
          <Field label="封面底色">
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {COVER_COLORS.map((c) => (
                <Swatch key={c} color={c} active={(pv.coverColor || COVER_COLORS[0]) === c} onClick={() => form.setFieldValue('coverColor', c)} />
              ))}
            </div>
          </Field>
          <Field label="封面标题"><Form.Item name="coverTitle" noStyle><Input placeholder="模板库卡片主标题（留空则用名称）" maxLength={12} /></Form.Item></Field>
          <Field label="标题色">
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {TITLE_COLORS.map((c) => (
                <span key={c.value} onClick={() => form.setFieldValue('titleColor', c.value)} style={{ padding: '4px 10px', borderRadius: 6, fontSize: 12, cursor: 'pointer', background: c.value, color: c.value === '#ffffff' ? '#333' : '#fff', border: (pv.titleColor || TITLE_COLORS[0].value) === c.value ? `2px solid ${T.accent}` : `1px solid ${T.border}` }}>{c.label}</span>
              ))}
            </div>
          </Field>
          <Field label="模板简介"><Form.Item name="intro" noStyle><Input.TextArea rows={3} maxLength={200} showCount placeholder="一句话介绍模板亮点" /></Form.Item></Field>
          <Field label="封面图 URL（可选）"><Form.Item name="cover" noStyle><Input placeholder="https://… 留空则使用底色封面" /></Form.Item></Field>
        </Form>
      )}
    </SettingPage>
  );
};

/* ════════════ 服务详情设置（pg-svccfg：整页 · 对标服务商卡片 svcp-card） ════════════
   说明：后端 provider/services 复用 Template 模型，仅支撑 name/category/tags/status/price/intro
   这几个真实字段；原型 pg-svccfg 中「所在城市 / 认证徽章 / 客服在线 / 头像底色 / 计价单位 /
   已服务次数 / 好评率 / 评分 / 平均响应时长」暂无后端模型支撑，按项目规范以「即将上线」占位，
   不伪造写入。真实字段照常落库。 */
const SERVICE_STATUS_OPTS = [
  { value: 'PENDING', label: '草稿（不可被预约）' },
  { value: 'APPROVED', label: '在售（即时展示）' },
  { value: 'TAKEN_DOWN', label: '已下架' },
];
const SERVICE_UNIT_OPTS = [
  { value: '场', label: '场' }, { value: '次', label: '次' }, { value: '天', label: '天' }, { value: '月', label: '月' },
];
const SERVICE_BADGE_OPTS = [
  { value: 'official', label: '官方认证' }, { value: 'top', label: '优选服务商' }, { value: 'verified', label: '资质认证' },
];
const SERVICE_RESP_OPTS = [
  { value: '<1h', label: '1 小时内' }, { value: '<3h', label: '3 小时内' }, { value: '<12h', label: '12 小时内' }, { value: '1d', label: '1 天内' },
];
const SERVICE_AVATAR_COLORS = ['#c24b2e', '#1f3a5f', '#2e7d52', '#8a5a00', '#6a1b4d', '#37474f'];
const SOON = <span style={{ fontSize: 11, color: T.ink3, marginLeft: 6, fontWeight: 400 }}>即将上线</span>;

export const SPServiceDetail = () => {
  const { id } = useParams();
  const nav = useNavigate();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pv, setPv] = useState<any>({});
  const [rec, setRec] = useState<any>(null);
  const isEdit = !!id;

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      if (!isEdit) {
        const def = {
          name: '', category: TEMPLATE_CAT_OPTS[0]?.value, tags: [], status: 'PENDING',
          price: 0, intro: '',
          city: undefined, badge: undefined, online: true, avatarColor: SERVICE_AVATAR_COLORS[0],
          unit: '场', served: 0, rate: 99, rating: 4.9, resp: '<3h',
        };
        if (alive) { setRec(def); setPv(def); setLoading(false); }
        return;
      }
      try {
        const r = await fetchOne('provider/services', id);
        const meta = (r?.schema && r.schema.meta) || {};
        const init = {
          id: r.id,
          name: r.name || '',
          category: r.category || TEMPLATE_CAT_OPTS[0]?.value,
          tags: r.tags || [],
          status: r.status || 'PENDING',
          price: (r.price || 0) / 100,
          intro: meta.intro || '',
          cover: r.cover || '',
          schema: r.schema,
          city: undefined, badge: undefined, online: true, avatarColor: SERVICE_AVATAR_COLORS[0],
          unit: '场', served: r.useCount ?? 0, rate: 99, rating: 4.9, resp: '<3h',
        };
        if (alive) { setRec(init); setPv(init); }
      } catch (e: any) {
        if (alive) message.error(e?.message || '加载服务失败');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [id]);

  const save = async (publish: boolean) => {
    let v: any;
    try { v = await form.validateFields(); } catch { message.warning('请先修正表单中的校验项'); return; }
    setSaving(true);
    try {
      const payload = {
        name: v.name.trim(),
        category: v.category,
        tags: Array.isArray(v.tags) ? v.tags : [],
        price: Number(v.price),
        status: publish ? 'APPROVED' : (v.status || 'PENDING'),
        intro: v.intro || '',
      };
      const url = isEdit ? `provider/services/${id}` : 'provider/services';
      const method = isEdit ? 'patch' : 'post';
      await dataProvider.custom!({ url, method, payload });
      message.success(isEdit ? '服务已更新' : (publish ? '服务已创建并上架' : '服务已创建'));
      nav('/sp/services');
    } catch (e: any) {
      message.error(e?.response?.data?.message || e?.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const aside = (
    <ServicePreviewCard
      name={pv.name || '服务名称'}
      category={pv.category}
      price={typeof pv.price === 'number' ? pv.price : 0}
      tags={pv.tags}
      intro={pv.intro}
      status={pv.status}
      cover={pv.cover}
      schema={pv.schema}
    />
  );

  const Swatch = ({ color, active }: { color: string; active: boolean }) => (
    <span style={{ width: 24, height: 24, borderRadius: 6, background: color, opacity: 0.45, cursor: 'not-allowed', border: active ? `2px solid ${T.accent}` : `1px solid ${T.border}`, boxSizing: 'border-box' }} />
  );

  return (
    <SettingPage
      title={isEdit ? '服务详情设置' : '新建服务'}
      sub="按平台服务商卡片标准维护 · 保存后前台服务专区即时同步"
      chip="服务商 · 自身作用域"
      backTo="/sp/services"
      aside={aside}
      loading={loading}
      footer={<>
        <Button onClick={() => nav('/sp/services')}>取消</Button>
        <Button loading={saving} onClick={() => save(false)}>保存草稿</Button>
        <Button type="primary" loading={saving} onClick={() => save(true)}>{isEdit ? '保存并上架' : '创建并上架'}</Button>
      </>}
    >
      {rec && (
        <Form
          form={form}
          layout="vertical"
          initialValues={rec}
          onValuesChange={(_, all) => setPv((p: any) => ({ ...p, ...all }))}
          style={{ marginTop: 8 }}
        >
          <Sec title="基本信息" hint="编号自动生成 · 名称与类型展示在服务商卡片" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Field label="服务编号">
              <Input disabled value={isEdit ? (rec.id || '自动生成') : '自动生成（保存后分配 T-xxxx）'} style={{ color: T.ink3 }} />
            </Field>
            <Field label="服务状态"><Form.Item name="status" noStyle><Select options={SERVICE_STATUS_OPTS} style={{ width: '100%' }} /></Form.Item></Field>
            <Field label="服务名称"><Form.Item name="name" noStyle rules={[{ required: true, message: '请填写服务名称' }]}><Input placeholder="如：「天山雪莲」婚宴请柬设计" maxLength={20} /></Form.Item></Field>
            <Field label="服务类型"><Form.Item name="category" noStyle rules={[{ required: true, message: '请选择服务类型' }]}><Select options={TEMPLATE_CAT_OPTS} showSearch optionFilterProp="label" style={{ width: '100%' }} /></Form.Item></Field>
            <Field label={<span>所在城市{SOON}</span>}><Form.Item name="city" noStyle><Select disabled placeholder="即将上线" style={{ width: '100%' }} /></Form.Item></Field>
          </div>

          <Sec title="展示配置" hint="与前台服务商卡片展示信息一一对应" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Field label={<span>认证徽章{SOON}</span>}><Form.Item name="badge" noStyle><Select disabled placeholder="即将上线" options={SERVICE_BADGE_OPTS} style={{ width: '100%' }} /></Form.Item></Field>
            <Field label={<span>客服在线{SOON}</span>}><Form.Item name="online" noStyle valuePropName="checked"><Switch disabled defaultChecked /></Form.Item></Field>
            <Field label={<span>头像底色{SOON}</span>}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {SERVICE_AVATAR_COLORS.map((c) => (
                  <Swatch key={c} color={c} active={(pv.avatarColor || SERVICE_AVATAR_COLORS[0]) === c} />
                ))}
              </div>
            </Field>
            <Field label="服务项目"><Form.Item name="tags" noStyle rules={[{ required: true, message: '请至少选择一个服务项目' }]}><Select mode="multiple" options={TEMPLATE_TAG_OPTS} placeholder="可多选（建议 2-4 个）" maxTagCount="responsive" style={{ width: '100%' }} /></Form.Item></Field>
          </div>

          <Sec title="价格与数据" hint="对应卡片底部价格与数据统计区" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Field label="起价（元）"><Form.Item name="price" noStyle rules={[{ required: true, type: 'number', min: 0, message: '请填写不小于 0 的起价' }]}><InputNumber min={0} precision={2} style={{ width: '100%' }} placeholder="如：199" /></Form.Item></Field>
            <Field label={<span>计价单位{SOON}</span>}><Form.Item name="unit" noStyle><Select disabled placeholder="即将上线" options={SERVICE_UNIT_OPTS} style={{ width: '100%' }} /></Form.Item></Field>
            <Field label={<span>已服务次数{SOON}</span>}><Form.Item name="served" noStyle><InputNumber disabled style={{ width: '100%' }} placeholder="即将上线" /></Form.Item></Field>
            <Field label={<span>好评率（%）{SOON}</span>}><Form.Item name="rate" noStyle><InputNumber disabled min={0} max={100} style={{ width: '100%' }} placeholder="即将上线" /></Form.Item></Field>
            <Field label={<span>评分{SOON}</span>}><Form.Item name="rating" noStyle><InputNumber disabled min={0} max={5} step={0.1} style={{ width: '100%' }} placeholder="即将上线" /></Form.Item></Field>
            <Field label={<span>平均响应时长{SOON}</span>}><Form.Item name="resp" noStyle><Select disabled placeholder="即将上线" options={SERVICE_RESP_OPTS} style={{ width: '100%' }} /></Form.Item></Field>
          </div>

          <Sec title="服务内容" hint="展示在卡片简介区" />
          <Field label="服务简介"><Form.Item name="intro" noStyle rules={[{ required: true, message: '请填写服务简介' }]}><Input.TextArea rows={3} maxLength={60} showCount placeholder="一句话概括服务内容与亮点，如：本土头部设计工作室，专注婚礼与商务 H5 视觉，原创案例丰富。" /></Form.Item></Field>
        </Form>
      )}
    </SettingPage>
  );
};

/* ════════════ 作品详情（pg-workcfg：整页 · 只读预览首屏） ════════════
   来源：前端「我的作品」Project 记录。运营端只读映射，右侧预览区渲染作品第一页（首屏）。
   后端 GET /api/provider/works/:id 按 userId 作用域返回完整 schema。 */
const dt2 = (v: any) => (v ? new Date(v).toLocaleString('zh-CN', { hour12: false }) : '—');
const WORK_STATUS_LABEL: Record<string, string> = { draft: 'status.draft', published: 'status.PUBLISHED' };

export const SPWorkDetail = () => {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const [rec, setRec] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const r: any = await dataProvider.custom!({ url: `provider/works/${id}`, method: 'get' });
        if (alive) setRec(r?.data ?? null);
      } catch (e: any) {
        if (alive) message.error(e?.message || '加载作品失败');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [id]);

  const aside = rec ? (
    <WorkPreviewCard
      name={rec.title || rec.name || '作品名称'}
      status={rec.status}
      cover={rec.cover}
      schema={rec.schema}
      viewCount={rec.viewCount}
      publishCode={rec.publishCode}
    />
  ) : null;

  return (
    <SettingPage
      title="作品详情（只读）"
      sub="前端「我的作品」请柬 · 实时预览首屏 · 只读映射"
      chip="服务商 · 自身作用域"
      backTo="/sp/works"
      aside={aside}
      loading={loading}
      footer={
        <>
          <Button onClick={() => nav('/sp/works')}>返回</Button>
          <Button type="primary" onClick={() => nav(`/sp/works/${id}/upgrade`)}>
            升级为服务
          </Button>
        </>
      }
    >
      <WorkDetailPanel id={id} rec={rec} />
    </SettingPage>
  );
};

/**
 * 作品详情展示面板（元数据 + 审计留痕）。
 * 路由页 SPWorkDetail 与 hover「详情」抽屉共用：
 * - 路由页传入已拉取的 rec 直接渲染；
 * - 抽屉仅传 id，面板自行拉取作品与审计记录。
 * 审计段按 targetType=PROJECT + targetId 过滤（与 AuditService.log 大写实体名约定一致）。
 */
export function WorkDetailPanel({ id, rec: recProp }: { id: string; rec?: any }) {
  const [rec, setRec] = useState<any>(recProp ?? null);
  const [loading, setLoading] = useState(!recProp);
  const [logs, setLogs] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);

  useEffect(() => {
    if (recProp) {
      setRec(recProp);
      setLoading(false);
      return;
    }
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const r: any = await dataProvider.custom!({ url: `provider/works/${id}`, method: 'get' });
        if (alive) setRec(r?.data ?? null);
      } catch {
        if (alive) setRec(null);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [id, recProp]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLogsLoading(true);
      try {
        const r: any = await dataProvider.custom!({
          url: `admin/audit-logs?targetType=PROJECT&targetId=${encodeURIComponent(id)}`,
          method: 'get',
        });
        if (alive) setLogs(r?.data ?? []);
      } catch {
        if (alive) setLogs([]);
      } finally {
        if (alive) setLogsLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [id]);

  if (loading) return <div style={{ color: T.ink3 }}>加载中…</div>;

  const statusLabel = rec ? (t(WORK_STATUS_LABEL[rec.status] ?? rec.status ?? '—')) : '—';
  return (
    <div>
      {rec && (
        <div style={{ fontSize: 12, color: T.ink3, margin: '0 0 12px' }}>
          {rec.id} · 前端「我的作品」
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <Line k="作品编号" v={rec?.id ?? '—'} />
        <Line k="作品名称" v={rec?.title || rec?.name || '—'} />
        <Line k="来源" v="前端「我的作品」" />
        <Line k="浏览次数" v={String(rec?.viewCount ?? 0)} />
        <Line k="发布码" v={rec?.publishCode || '—'} />
        <Line k="状态" v={statusLabel} />
        <Line k="创建时间" v={dt2(rec?.createdAt)} />
        <Line k="更新时间" v={dt2(rec?.updatedAt)} />
      </div>

      <Sec title="审计留痕" hint="按作品 ID 过滤的审核 / 操作记录" />
      {logsLoading ? (
        <div style={{ color: T.ink3, fontSize: 12 }}>加载审计记录…</div>
      ) : logs.length === 0 ? (
        <div style={{ color: T.ink3, fontSize: 12 }}>暂无审计记录</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {logs.map((l: any) => (
            <div key={l.id} style={{ border: `1px solid ${T.border}`, borderRadius: 8, padding: '8px 10px', fontSize: 12.5 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ color: T.ink1, fontWeight: 600 }}>{l.action}</span>
                <span style={{ color: T.ink3 }}>{dt2(l.createdAt)}</span>
              </div>
              <div style={{ color: T.ink2, marginTop: 4 }}>
                操作人：{l.actorRole ?? '—'}（{l.actorId ?? '—'}）
              </div>
              {l.reason && <div style={{ color: T.ink2, marginTop: 4 }}>意见：{l.reason}</div>}
            </div>
          ))}
        </div>
      )}
      {!rec && !loading && <div style={{ color: T.ink3 }}>未找到该作品或无权查看</div>}
    </div>
  );
}

/* ════════════ 作品升级为服务（桥接页）═══════════
   进入即把作品提交为「草稿(DRAFT)模板」，成功后跳转到标准化「模板管理详情」页补全属性。
   复用 SPTemplateDetail 作为唯一属性设置页，避免重复造表单。 */
export const SPWorkUpgrade = () => {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const [state, setState] = useState<'loading' | 'error'>('loading');
  const [err, setErr] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r: any = await dataProvider.custom!({
          url: 'provider/from-project',
          method: 'post',
          payload: { projectId: id, asDraft: true },
        });
        const newId = r?.data?.id;
        if (!newId) throw new Error('后端未返回新模板 ID');
        if (alive) nav(`/sp/templates/${newId}`, { replace: true });
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.response?.data?.message || e?.message || '升级失败');
        setState('error');
      }
    })();
    return () => { alive = false; };
  }, [id]);

  return (
    <SettingPage
      title="升级为服务"
      sub="正在把作品带入标准化属性设置页…"
      chip="服务商 · 自身作用域"
      backTo={`/sp/works/${id}`}
      loading={state === 'loading'}
      footer={<Button onClick={() => nav(`/sp/works/${id}`)}>返回作品</Button>}
    >
      {state === 'error' && (
        <div style={{ color: T.ink2, fontSize: 13 }}>
          升级失败：{err}
          <div style={{ marginTop: 12 }}>
            <Button type="primary" onClick={() => nav(`/sp/works/${id}`)}>返回作品详情</Button>
          </div>
        </div>
      )}
    </SettingPage>
  );
};

/* 局部小组件 */
function Field({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div style={fieldStyle}>
      <div style={labelStyle}>{label}</div>
      {children}
    </div>
  );
}
/** 整页内分区标题（对标原型 .svcf-grid 各 .panel header） */
function Sec({ title, hint }: { title: string; hint?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 6, marginBottom: 12, paddingBottom: 8, borderBottom: `1px solid ${T.border}` }}>
      <span style={{ fontSize: 14, fontWeight: 700, color: T.ink1 }}>{title}</span>
      {hint && <span style={{ fontSize: 12, color: T.ink3 }}>{hint}</span>}
    </div>
  );
}
function Line({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ display: 'flex', gap: 10, fontSize: 12.5 }}>
      <span style={{ color: T.ink3, flex: 'none', width: 64 }}>{k}</span>
      <span style={{ color: T.ink1, fontWeight: 500, wordBreak: 'break-all' }}>{v}</span>
    </div>
  );
}
