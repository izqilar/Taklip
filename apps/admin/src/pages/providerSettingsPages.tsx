import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Form, Input, InputNumber, Select, Switch, Button, message, Upload } from 'antd';
import { T } from '../config/theme';
import { dataProvider } from '../providers/dataProvider';
import { API_URL, getToken } from '../utility';
import { SettingPage, PreviewCard, FlowSteps, Timeline } from '../components/provider/SettingPage';
import { Pill } from '../components/ui/Pill';
import { t } from '../i18n/t';

/* ════════════ 与 providerPages / consolePages 同源口径的本地常量（避免跨文件耦合） ════════════ */
const LICENSE_TYPES = ['营业执照', '经营许可证', '居民身份证', '演出许可', '资质证书', '其他'].map((v) => ({ value: v, label: v }));
const LICENSE_STATUS = ['待审核', '有效', '已过期', '已驳回'].map((v) => ({ value: v, label: v }));
const REMIND_OPTS = [
  { value: '提前30天', label: '提前30天' },
  { value: '提前90天', label: '提前90天' },
  { value: '不提醒', label: '不提醒' },
];
const maskCert = (no: string) => (!no ? '—' : no.length <= 8 ? no : no.slice(0, 4) + '****' + no.slice(-4));
const licenseStatusTone = (s: string): any =>
  s === '有效' ? 'ok' : s === '待审核' ? 'ac' : s === '已过期' ? 'warn' : 'bad';

const PERIOD: Record<string, string> = {
  FULL: 'pages.status.periodFull', AM: '09:00-12:00', PM1: '12:00-15:00', PM2: '15:00-18:00', PM3: '18:00-21:00', NIGHT: '晚间21:00-23:00',
};
const SCHEDULE_STATUS: Record<string, { key: string; tone: any }> = {
  available: { key: 'pages.status.schAvailable', tone: 'ok' }, locked: { key: 'pages.status.schLocked', tone: 'ac' }, done: { key: 'pages.status.svcCompleted', tone: 'mut' },
};
const PERIOD_OPTS = Object.entries(PERIOD).map(([v, l]) => ({ value: v, label: t(l) }));
const STATUS_OPTS = Object.entries(SCHEDULE_STATUS).map(([v, m]) => ({ value: v, label: t(m.key) }));

const SVC_OPTIONS: { value: string; label: string }[] = [
  '摄影摄像', '插花礼仪', '乐队演出', '礼仪执事', '主持人', '婚庆主持', '宴会设计', '花艺布置',
  '化妆造型', '司仪培训', '婚礼策划', '特约设计', '光影纪录', '司仪主持', '灯光音响',
].map((s) => ({ value: s, label: s }));

const CLIENT_TAG_OPTS = ['重点客户', '普通客户', '潜力客户', 'VIP 客户'].map((v) => ({ value: v, label: v }));

const TICKET_TYPE: Record<string, string> = {
  COMPLAINT: 'pages.fb.complaint', PRAISE: 'pages.status.tkTypePraise', SUGGESTION: 'pages.fb.suggestion', CONSULT: 'pages.col.consult', APPEAL: 'pages.status.tkTypeAppeal', AFTERSALE: 'pages.status.tkTypeAftersale', OTHER: 'pages.status.tkTypeOther',
};
const TICKET_STATUS: Record<string, { key: string; tone: any }> = {
  OPEN: { key: 'pages.status.tkOpenResp', tone: 'warn' }, NEGOTIATING: { key: 'pages.status.negotiating', tone: 'ac' }, ESCALATED: { key: 'pages.status.tkEscalated', tone: 'ac' },
  ARBITRATING: { key: 'pages.status.tkArbitrating', tone: 'ac' }, CLOSED: { key: 'pages.status.tkClosed', tone: 'ok' },
};
const TICKET_TYPE_OPTS = Object.entries(TICKET_TYPE)
  .filter(([v]) => ['AFTERSALE', 'SUGGESTION', 'CONSULT', 'COMPLAINT', 'OTHER'].includes(v))
  .map(([v, l]) => ({ value: v, label: t(l) }));
const DEPT_OPTS = [
  { value: 'AGENT', label: 'pages.status.deptAgent' },
  { value: 'ADMIN', label: 'pages.status.deptAdmin' },
];

const CERT_TYPES = ['营业执照', '经营许可证', '居民身份证', '演出许可', '资质证书', '其他'].map((v) => ({ value: v, label: v }));
const APPLY_FLOW = [
  { key: 'fill', label: 'pages.status.fillData' }, { key: 'upload', label: 'pages.status.uploadCert' }, { key: 'submit', label: 'pages.status.submitReview' },
  { key: 'first', label: 'pages.status.regionFirstReview' }, { key: 'final', label: 'pages.status.consoleFinalReview' }, { key: 'sign', label: 'pages.status.signOpen' },
];
const APPLY_STATUS: Record<string, { key: string; tone: any }> = {
  FIRST_PENDING: { key: 'pages.status.applyFirstPending', tone: 'warn' }, FIRST_PASSED: { key: 'pages.status.applyFirstPassed', tone: 'ac' },
  FINAL_PENDING: { key: 'pages.status.applyFinalPending', tone: 'warn' }, APPROVED: { key: 'status.APPROVED', tone: 'ok' }, REJECTED: { key: 'status.REJECTED', tone: 'bad' },
};
const REGION_OPTIONS: { value: string; label: string }[] = [
  '乌鲁木齐市', '喀什市', '伊宁市', '昌吉市', '库尔勒市', '克拉玛依市', '石河子市', '阿克苏市', '和田市', '吐鲁番市',
].map((s) => ({ value: s, label: s }));

const REACH_TYPE: Record<string, string> = { SERVICE_MSG: 'pages.status.reachServiceMsg', COUPON: 'pages.status.reachCoupon', ACTIVITY: 'pages.status.reachActivity', REWARD: 'pages.status.reachReward' };
const REACH_CHANNEL: Record<string, string> = { INNER_SMS: 'pages.status.reachInnerSms', SMS: 'pages.status.reachSms', WECHAT: 'pages.status.reachWechat', PHONE: 'pages.status.reachPhone' };
const money = (v: any) => (typeof v === 'number' ? `¥${(v / 100).toFixed(2)}` : '¥0.00');
const dt = (v: any) => (v ? String(v).replace('T', ' ').slice(0, 16) : '—');
const arr = (v: any) => (Array.isArray(v) && v.length ? v.join('、') : '—');

const authHeaders = (): Record<string, string> => {
  const tk = getToken();
  const h: Record<string, string> = {};
  if (tk) h.Authorization = `Bearer ${tk}`;
  return h;
};

async function fetchOne(resource: string, id: string) {
  const r: any = await dataProvider.custom!({ url: `${resource}?pageSize=200`, method: 'get' });
  const items: any[] = r?.data?.items ?? r?.data?.data ?? r?.data ?? [];
  return items.find((x) => x.id === id) || null;
}

const Field = ({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) => (
  <div style={{ marginBottom: 14 }}>
    <div style={{ fontSize: 12.5, color: T.ink2, fontWeight: 600, marginBottom: 6 }}>{label}</div>
    {children}
    {hint && <div style={{ fontSize: 11, color: T.ink3, marginTop: 2 }}>{hint}</div>}
  </div>
);
const dateInput = (v: any) => (v ? String(v).slice(0, 10) : '');

/* ════════════ 资质管理详情（pg-qualc · 证照预览 + 脱敏编号 + 附件上传） ════════════ */
export const SPQualificationDetail = () => {
  const { id } = useParams();
  const nav = useNavigate();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [att, setAtt] = useState<any[]>([]);
  const [pv, setPv] = useState<any>({});
  const [rec, setRec] = useState<any>(null);
  const isEdit = !!id;

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      if (!isEdit) {
        const def = { name: '', type: undefined, certNo: '', issuer: '', validFrom: '', validTo: '', longTerm: false, expireRemind: undefined, status: '待审核', description: '' };
        if (alive) { setRec(def); setPv(def); setAtt([]); setLoading(false); }
        return;
      }
      try {
        const r = await fetchOne('provider/qualifications', id);
        const init = {
          name: r.name || '', type: r.type || undefined, certNo: r.certNo || '', issuer: r.issuer || '',
          validFrom: dateInput(r.validFrom), validTo: dateInput(r.validTo), longTerm: !!r.longTerm,
          expireRemind: r.expireRemind || undefined, status: r.status || '待审核', description: r.description || '',
        };
        if (alive) { setRec(init); setPv({ ...init, licNo: r.licNo }); setAtt(Array.isArray(r.attachments) ? r.attachments : []); }
      } catch (e: any) { if (alive) message.error(e?.message || '加载资质失败'); }
      finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [id]);

  const uploadAttach = async ({ file, onSuccess, onError }: any) => {
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(API_URL + '/assets/upload', { method: 'POST', headers: authHeaders(), body: fd });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.message || '上传失败');
      setAtt((prev) => [...prev, { name: file.name, url: j.url }]);
      onSuccess(j);
    } catch (e: any) { onError(e); message.error('附件上传失败：' + (e?.message || '未知错误')); }
  };

  const save = async () => {
    let v: any;
    try { v = await form.validateFields(); } catch { message.warning('请先修正表单中的校验项'); return; }
    if (!v.longTerm && !v.validTo) { message.warning('请填写有效期至，或勾选长期有效'); return; }
    const payload = {
      name: v.name.trim(), type: v.type, certNo: v.certNo.trim(), issuer: v.issuer || '',
      validFrom: v.validFrom ? new Date(v.validFrom).toISOString() : null,
      validTo: v.longTerm ? null : (v.validTo ? new Date(v.validTo).toISOString() : null),
      longTerm: !!v.longTerm, expireRemind: v.expireRemind || null, status: v.status || '待审核',
      description: v.description || '', attachments: att,
    };
    setSaving(true);
    try {
      const url = isEdit ? `provider/qualifications/${id}` : 'provider/qualifications';
      const method = isEdit ? 'patch' : 'post';
      await dataProvider.custom!({ url, method, payload });
      message.success(isEdit ? '资质项已更新' : '资质项已添加');
      nav('/sp/qualification');
    } catch (e: any) { message.error(e?.response?.data?.message || e?.message || '保存失败'); }
    finally { setSaving(false); }
  };

  const aside = (
    <PreviewCard title="证照预览" hint={pv.licNo ? `编号 ${pv.licNo}` : '（保存后生成）'}>
      <div style={{ fontSize: 15, fontWeight: 700, color: T.ink1 }}>{pv.name || '资质名称'}</div>
      <div style={{ fontSize: 12, color: T.ink2, marginTop: 2 }}>{pv.type || '—'}</div>
      <div style={{ marginTop: 10 }}><Pill tone={licenseStatusTone(pv.status)}>{pv.status || '待审核'}</Pill></div>
      <div style={{ margin: '12px 0 0', fontSize: 12.5, color: T.ink2, lineHeight: 1.9 }}>
        <div><span style={{ color: T.ink3 }}>证件编号：</span>{maskCert(pv.certNo)}</div>
        <div><span style={{ color: T.ink3 }}>发证机关：</span>{pv.issuer || '—'}</div>
        <div><span style={{ color: T.ink3 }}>有效期：</span>{pv.longTerm ? '长期有效' : (pv.validTo || '—')}</div>
      </div>
      {att.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 11, color: T.ink3, marginBottom: 4 }}>附件</div>
          {att.map((a, i) => <div key={i} style={{ fontSize: 12, color: T.ink2 }}>· {a.name}</div>)}
        </div>
      )}
    </PreviewCard>
  );

  return (
    <SettingPage
      title={isEdit ? '资质管理详情' : '新增资质'}
      sub="证照信息维护 · 脱敏展示 · 附件留痕"
      chip="服务商 · 自身作用域"
      backTo="/sp/qualification"
      aside={aside}
      loading={loading}
      footer={<>
        <Button onClick={() => nav('/sp/qualification')}>取消</Button>
        <Button type="primary" loading={saving} onClick={save}>{isEdit ? '保存修改' : '保存资质'}</Button>
      </>}
    >
      {rec && (
        <Form form={form} layout="vertical" initialValues={rec} style={{ marginTop: 8 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Field label="资质名称"><Form.Item name="name" noStyle rules={[{ required: true, message: '请填写资质名称' }]}><Input placeholder="如：营业执照" /></Form.Item></Field>
            <Field label="资质类型"><Form.Item name="type" noStyle rules={[{ required: true, message: '请选择资质类型' }]}><Select options={LICENSE_TYPES} placeholder="选择类型" /></Form.Item></Field>
            <Field label="证件编号"><Form.Item name="certNo" noStyle rules={[{ required: true, message: '请填写证件编号' }]}><Input placeholder="如：91650100********2210" maxLength={32} /></Form.Item></Field>
            <Field label="发证机关"><Form.Item name="issuer" noStyle><Input placeholder="如：乌鲁木齐市市场监督管理局" /></Form.Item></Field>
            <Field label="有效期至"><Form.Item name="validTo" noStyle><input type="date" style={{ width: '100%', height: 32, border: `1px solid ${T.border}`, borderRadius: 6, padding: '0 8px', fontSize: 13 }} /></Form.Item></Field>
            <Field label="长期有效"><Form.Item name="longTerm" noStyle valuePropName="checked"><Switch /></Form.Item></Field>
            <Field label="到期提醒"><Form.Item name="expireRemind" noStyle><Select options={REMIND_OPTS} placeholder="选择提醒方式" /></Form.Item></Field>
            <Field label="审核状态"><Form.Item name="status" noStyle><Select options={LICENSE_STATUS} /></Form.Item></Field>
          </div>
          <Field label="资质说明"><Form.Item name="description" noStyle><Input.TextArea rows={2} maxLength={50} showCount placeholder="建议 15-50 字" /></Form.Item></Field>
          <Field label="证照附件" hint="上传后可在下方删除">
            <Upload customRequest={uploadAttach} fileList={[]} showUploadList={false} accept=".jpg,.jpeg,.png,.pdf" multiple>
              <Button>＋ 上传附件（JPG/PNG/PDF ≤10MB）</Button>
            </Upload>
          </Field>
          {att.length > 0 && (
            <div style={{ marginTop: -6 }}>
              {att.map((a, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12.5, color: T.ink2, border: `1px solid ${T.border}`, borderRadius: 6, padding: '6px 10px', marginBottom: 6 }}>
                  <span>{a.name}</span>
                  <span style={{ color: T.down, cursor: 'pointer' }} onClick={() => setAtt(att.filter((_, j) => j !== i))}>删除</span>
                </div>
              ))}
            </div>
          )}
        </Form>
      )}
    </SettingPage>
  );
};

/* ════════════ 档期管理详情（pg-schedcfg · 冲突规则 + 状态） ════════════ */
export const SPScheduleDetail = () => {
  const { id } = useParams();
  const nav = useNavigate();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rec, setRec] = useState<any>(null);
  const isEdit = !!id;

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      if (!isEdit) {
        const def = { date: '', period: 'FULL', serviceType: undefined, status: 'available', customer: '', orderId: '', note: '' };
        if (alive) { setRec(def); setLoading(false); }
        return;
      }
      try {
        const r = await fetchOne('provider/schedules', id);
        const init = {
          date: dateInput(r.date), period: r.period ?? 'FULL', serviceType: r.serviceType || undefined,
          status: r.status ?? 'available', customer: r.customer ?? '', orderId: r.orderId ?? '', note: r.note ?? '',
        };
        if (alive) setRec(init);
      } catch (e: any) { if (alive) message.error(e?.message || '加载档期失败'); }
      finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [id]);

  const save = async () => {
    let v: any;
    try { v = await form.validateFields(); } catch { message.warning('请先修正表单中的校验项'); return; }
    const payload = { date: v.date, period: v.period, serviceType: v.serviceType, status: v.status, customer: v.customer || null, orderId: v.orderId || null, note: v.note || null };
    setSaving(true);
    try {
      if (isEdit) await dataProvider.custom!({ url: `provider/schedules/${id}`, method: 'patch', payload });
      else await dataProvider.custom!({ url: 'provider/schedules', method: 'post', payload });
      message.success(isEdit ? '档期已保存' : '档期已创建');
      nav('/sp/schedule');
    } catch (e: any) { message.error(e?.response?.data?.message || e?.message || '保存失败'); }
    finally { setSaving(false); }
  };

  const aside = (
    <PreviewCard title="冲突规则" hint="排期约束">
      <div style={{ fontSize: 12, color: T.ink2, lineHeight: 1.8 }}>
        同一天同一时段仅允许一个「已锁定」档期；<br />
        「全天」与任一时段互斥；<br />
        「可接单 / 已完成」不参与冲突。
      </div>
    </PreviewCard>
  );

  return (
    <SettingPage
      title={isEdit ? '档期管理详情' : '新建档期'}
      sub="服务档期排期 · 接单自动锁定 · 冲突检测"
      chip="服务商 · 自身作用域"
      backTo="/sp/schedule"
      aside={aside}
      loading={loading}
      footer={<>
        <Button onClick={() => nav('/sp/schedule')}>取消</Button>
        <Button type="primary" loading={saving} onClick={save}>保存档期</Button>
      </>}
    >
      {rec && (
        <Form form={form} layout="vertical" initialValues={rec} style={{ marginTop: 8 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Field label="日期"><Form.Item name="date" noStyle rules={[{ required: true, message: '请选择日期' }]}><Input type="date" /></Form.Item></Field>
            <Field label="时段"><Form.Item name="period" noStyle rules={[{ required: true, message: '请选择时段' }]}><Select options={PERIOD_OPTS} /></Form.Item></Field>
            <Field label="服务类型"><Form.Item name="serviceType" noStyle rules={[{ required: true, message: '请选择服务类型' }]}><Select options={SVC_OPTIONS} showSearch optionFilterProp="label" /></Form.Item></Field>
            <Field label="状态"><Form.Item name="status" noStyle rules={[{ required: true, message: '请选择状态' }]}><Select options={STATUS_OPTS} /></Form.Item></Field>
            <Field label="客户"><Form.Item name="customer" noStyle><Input placeholder="关联客户（选填）" /></Form.Item></Field>
            <Field label="关联订单"><Form.Item name="orderId" noStyle><Input placeholder="订单编号（选填）" /></Form.Item></Field>
          </div>
          <Field label="备注"><Form.Item name="note" noStyle><Input.TextArea rows={3} placeholder="排期说明 / 注意事项" /></Form.Item></Field>
        </Form>
      )}
    </SettingPage>
  );
};

/* ════════════ 我的客户 · 详情 + 精准维护触达（pg-cltcfg） ════════════ */
export const SPClientsDetail = () => {
  const { id } = useParams();
  const nav = useNavigate();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rec, setRec] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [pv, setPv] = useState<any>({});

  useEffect(() => {
    let alive = true;
    if (!id) { setLoading(false); return; }
    (async () => {
      setLoading(true);
      try {
        const r = await fetchOne('provider/clients', id);
        if (alive) setRec(r || {});
        const res: any = await dataProvider.custom!({ url: `provider/clients/${id}/reach`, method: 'get' });
        if (alive) setHistory(res?.data?.items || res?.items || []);
      } catch (e: any) { if (alive) message.error(e?.message || '加载客户失败'); }
      finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [id]);

  const save = async () => {
    let v: any;
    try { v = await form.validateFields(); } catch { message.warning('请先修正表单中的校验项'); return; }
    const payload: any = { type: v.type, channel: v.channel, subject: (v.subject || '').trim(), content: (v.content || '').trim() };
    if (v.type === 'COUPON' || v.type === 'REWARD') {
      const yuan = Number(v.amount);
      if (!yuan || yuan <= 0) { message.warning('权益面额须为正数'); return; }
      payload.amount = Math.round(yuan * 100);
      payload.validTo = v.validTo || null;
    }
    setSaving(true);
    try {
      await dataProvider.custom!({ url: `provider/clients/${id}/maintain`, method: 'post', payload });
      message.success('触达已发起，客户将在消息中心收到；触达记录已留痕');
      const res: any = await dataProvider.custom!({ url: `provider/clients/${id}/reach`, method: 'get' });
      setHistory(res?.data?.items || res?.items || []);
    } catch (e: any) { message.error(e?.response?.data?.message || e?.message || '触达失败'); }
    finally { setSaving(false); }
  };

  const isBenefit = (pv.type === 'COUPON' || pv.type === 'REWARD');
  const aside = (
    <>
      <PreviewCard title="客户 360° 概览">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 13 }}>
          <div>累计消费：<b>{money(rec?.totalSpend)}</b></div>
          <div>互动次数：<b>{rec?.interactions ?? 0}</b></div>
          <div>最近服务：{rec?.lastService || '—'}</div>
          <div>最近维护：{dt(rec?.lastMaintain)}</div>
        </div>
      </PreviewCard>
      <PreviewCard title="维护内容预览" soft>
        <div style={{ fontWeight: 600, color: T.accent, marginBottom: 6 }}>{(REACH_TYPE[pv.type] ? `【${REACH_TYPE[pv.type]}】 ` : '') + (pv.subject || '（维护主题）')}</div>
        <div style={{ fontSize: 12, color: T.ink2, marginBottom: 6, whiteSpace: 'pre-wrap' }}>
          渠道：{REACH_CHANNEL[pv.channel] || pv.channel || '（渠道）'}
          {isBenefit ? `　|　面额：¥${(Number(pv.amount) || 0).toFixed(2)}` : ''}
          {isBenefit && pv.validTo ? `　|　有效期至：${pv.validTo}` : ''}
        </div>
        <div style={{ fontSize: 13, color: T.ink1, whiteSpace: 'pre-wrap' }}>{pv.content || '（维护内容将在右侧实时预览）'}</div>
      </PreviewCard>
      <PreviewCard title={`触达记录时间轴（${history.length}）`} soft>
        {history.length === 0 ? (
          <div style={{ fontSize: 12, color: T.ink3 }}>暂无触达记录</div>
        ) : (
          <Timeline items={history.map((h) => ({
            title: `${REACH_TYPE[h.type] || h.type} · ${REACH_CHANNEL[h.channel] || h.channel}`,
            desc: h.subject + (h.amount ? `　面额 ¥${(h.amount / 100).toFixed(2)}` : ''),
            time: dt(h.createdAt),
          }))} />
        )}
      </PreviewCard>
    </>
  );

  return (
    <SettingPage
      title="客户详情与维护"
      sub="客户档案与精准维护触达"
      chip="服务商 · 自身作用域"
      backTo="/sp/clients"
      aside={aside}
      loading={loading}
      footer={<>
        <Button onClick={() => nav('/sp/clients')}>返回</Button>
        <Button type="primary" loading={saving} onClick={save}>保存并触达</Button>
      </>}
    >
      {rec && (
        <>
          <PreviewCard title={`客户档案 · ${rec.clientNo || ''}`}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13, color: T.ink1 }}>
              <div>编号：<b>{rec.clientNo}</b></div>
              <div>姓名：<b>{rec.name}</b></div>
              <div>手机：<b>{rec.phone}</b></div>
              <div>标签：{arr(rec.tags)}</div>
            </div>
          </PreviewCard>
          <Form form={form} layout="vertical" initialValues={{ type: 'SERVICE_MSG', channel: 'INNER_SMS' }} onValuesChange={(_, all) => setPv(all)} style={{ marginTop: 8 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <Field label="维护类型*">
                <Form.Item name="type" noStyle rules={[{ required: true, message: '请选择维护类型' }]}>
                  <Select options={Object.entries(REACH_TYPE).map(([v, t]) => ({ value: v, label: t }))} />
                </Form.Item>
              </Field>
              <Field label="触达渠道*">
                <Form.Item name="channel" noStyle rules={[{ required: true, message: '请选择触达渠道' }]}>
                  <Select options={Object.entries(REACH_CHANNEL).map(([v, t]) => ({ value: v, label: t }))} />
                </Form.Item>
              </Field>
            </div>
            {isBenefit && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <Field label="权益面额（元）*">
                  <Form.Item name="amount" noStyle rules={[{ required: true, message: '请填写面额' }]}>
                    <InputNumber min={0.01} precision={2} step={1} style={{ width: '100%' }} addonAfter="元" />
                  </Form.Item>
                </Field>
                <Field label="有效期至*">
                  <Form.Item name="validTo" noStyle rules={[{ required: true, message: '请选择有效期' }]}>
                    <input type="date" style={{ width: '100%', height: 32, border: `1px solid ${T.border}`, borderRadius: 6, padding: '0 8px', fontSize: 13 }} />
                  </Form.Item>
                </Field>
              </div>
            )}
            <Field label="维护主题*">
              <Form.Item name="subject" noStyle rules={[{ required: true, message: '请填写维护主题' }, { max: 60, message: '不超过 60 字' }]}>
                <Input placeholder="一句话概括本次维护" maxLength={60} />
              </Form.Item>
            </Field>
            <Field label="维护内容*">
              <Form.Item name="content" noStyle rules={[{ required: true, message: '请填写维护内容' }, { max: 500, message: '不超过 500 字' }]}>
                <Input.TextArea rows={4} placeholder="向客户发送的具体内容" maxLength={500} showCount />
              </Form.Item>
            </Field>
          </Form>
        </>
      )}
    </SettingPage>
  );
};

/* ════════════ 我的客户 · 新建（原 ClientEditorModal） ════════════ */
export const SPClientCreate = () => {
  const nav = useNavigate();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const save = async () => {
    let v: any;
    try { v = await form.validateFields(); } catch { message.warning('请先修正表单中的校验项'); return; }
    const payload = { name: v.name.trim(), phone: v.phone.trim(), tags: Array.isArray(v.tags) ? v.tags : [], prefs: Array.isArray(v.prefs) ? v.prefs : [], channels: Array.isArray(v.channels) ? v.channels : [] };
    setSaving(true);
    try {
      await dataProvider.custom!({ url: 'provider/clients', method: 'post', payload });
      message.success('客户已添加');
      nav('/sp/clients');
    } catch (e: any) { message.error(e?.response?.data?.message || e?.message || '保存失败'); }
    finally { setSaving(false); }
  };
  return (
    <SettingPage
      title="新建客户"
      sub="客户档案录入 · 编号系统自动生成"
      chip="服务商 · 自身作用域"
      backTo="/sp/clients"
      aside={<PreviewCard title="说明"><div style={{ fontSize: 12, color: T.ink2, lineHeight: 1.8 }}>客户编号（PC-xxxx）由系统按当前最大编号自动生成，累计消费与互动次数初始为 0，可在详情页查看与维护。</div></PreviewCard>}
      footer={<>
        <Button onClick={() => nav('/sp/clients')}>取消</Button>
        <Button type="primary" loading={saving} onClick={save}>保存客户</Button>
      </>}
    >
      <Form form={form} layout="vertical" style={{ marginTop: 8 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Field label="客户姓名"><Form.Item name="name" noStyle rules={[{ required: true, message: '请填写客户姓名' }]}><Input placeholder="如：阿依古丽" /></Form.Item></Field>
          <Field label="手机号"><Form.Item name="phone" noStyle rules={[{ required: true, message: '请填写手机号' }, { pattern: /^\d{11}$/, message: '须为 11 位数字' }]}><Input placeholder="11 位手机号" maxLength={11} /></Form.Item></Field>
          <Field label="客户标签"><Form.Item name="tags" noStyle><Select mode="multiple" options={CLIENT_TAG_OPTS} placeholder="可多选" maxTagCount="responsive" /></Form.Item></Field>
          <Field label="服务偏好"><Form.Item name="prefs" noStyle><Select mode="tags" placeholder="可输入多个，如：花艺定制" /></Form.Item></Field>
          <Field label="首选渠道"><Form.Item name="channels" noStyle><Select mode="tags" placeholder="如：微信 / 电话 / 上门" /></Form.Item></Field>
        </div>
      </Form>
    </SettingPage>
  );
};

/* ════════════ 意见反馈 · 详情查看（pg-fbdetail） ════════════ */
export const SPComplaintDetail = () => {
  const { id } = useParams();
  const nav = useNavigate();
  const [loading, setLoading] = useState(true);
  const [rec, setRec] = useState<any>(null);
  useEffect(() => {
    let alive = true;
    if (!id) { setLoading(false); return; }
    (async () => {
      setLoading(true);
      try { const r = await fetchOne('provider/complaints', id); if (alive) setRec(r || {}); }
      catch (e: any) { if (alive) message.error(e?.message || '加载反馈失败'); }
      finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [id]);
  const aside = rec && (
    <PreviewCard title="反馈信息">
      <div style={{ fontSize: 13, color: T.ink1, lineHeight: 1.9 }}>
        <div>类型：{t(TICKET_TYPE[rec.type] ?? rec.type ?? '—')}</div>
        <div>反馈部门：{rec.department === 'AGENT' ? t('pages.status.deptAgent') : rec.department === 'ADMIN' ? t('pages.status.deptAdmin') : (rec.department || '—')}</div>
        <div>状态：<Pill tone={(TICKET_STATUS[rec.status]?.tone) || 'mut'}>{t(TICKET_STATUS[rec.status]?.key ?? rec.status ?? '—')}</Pill></div>
        <div>创建时间：{dt(rec.createdAt)}</div>
      </div>
    </PreviewCard>
  );
  return (
    <SettingPage title="反馈详情" sub="向平台提交意见 / 申诉 · 自下而上升级" chip="服务商 · 自身作用域" backTo="/sp/complaints" aside={aside} loading={loading}>
      {rec && (
        <div style={{ display: 'grid', gap: 12, fontSize: 13, color: T.ink1 }}>
          <div><b>标题：</b>{rec.title}</div>
          <div><b>反馈对象：</b>{rec.target?.nickname || rec.target?.phone || '—'}</div>
          <div><b>内容：</b><div style={{ color: T.ink2, lineHeight: 1.8, marginTop: 4, whiteSpace: 'pre-wrap' }}>{rec.content || '—'}</div></div>
        </div>
      )}
    </SettingPage>
  );
};

/* ════════════ 意见反馈 · 新建（原 ComplainEditorModal） ════════════ */
export const SPComplaintCreate = () => {
  const nav = useNavigate();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [clients, setClients] = useState<{ value: string; label: string }[]>([]);
  useEffect(() => {
    (async () => {
      try {
        const res: any = await dataProvider.custom!({ url: 'provider/clients?pageSize=100', method: 'get' });
        const items = res?.data?.items || res?.items || [];
        setClients(items.map((c: any) => ({ value: c.id, label: c.nickname || c.phone || c.id })));
      } catch { /* 可选增强 */ }
    })();
  }, []);
  const save = async () => {
    let v: any;
    try { v = await form.validateFields(); } catch { message.warning('请先修正表单中的校验项'); return; }
    const payload = { title: v.title.trim(), type: v.type, content: v.content.trim(), department: v.department, targetId: v.targetId || null };
    setSaving(true);
    try {
      await dataProvider.custom!({ url: 'provider/complaints', method: 'post', payload });
      message.success('反馈已提交，将自下而上升级处理');
      nav('/sp/complaints');
    } catch (e: any) { message.error(e?.response?.data?.message || e?.message || '提交失败'); }
    finally { setSaving(false); }
  };
  return (
    <SettingPage
      title="新增反馈"
      sub="向平台提交意见 / 申诉 · 自下而上升级"
      chip="服务商 · 自身作用域"
      backTo="/sp/complaints"
      footer={<>
        <Button onClick={() => nav('/sp/complaints')}>取消</Button>
        <Button type="primary" loading={saving} onClick={save}>提交反馈</Button>
      </>}
    >
      <Form form={form} layout="vertical" initialValues={{ type: 'AFTERSALE', department: 'AGENT' }} style={{ marginTop: 8 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Field label="反馈主题"><Form.Item name="title" noStyle rules={[{ required: true, message: '请填写反馈主题' }, { max: 60, message: '不超过 60 字' }]}><Input placeholder="一句话概括您的反馈" maxLength={60} /></Form.Item></Field>
          <Field label="类型"><Form.Item name="type" noStyle rules={[{ required: true, message: '请选择类型' }]}><Select options={TICKET_TYPE_OPTS} /></Form.Item></Field>
          <Field label="反馈部门" hint="自下而上：服务商 → 代理商 → 平台">
            <Form.Item name="department" noStyle><Select options={DEPT_OPTS} /></Form.Item>
          </Field>
          <Field label="反馈对象（可选）"><Form.Item name="targetId" noStyle><Select options={clients} allowClear placeholder="选择关联客户（可留空）" showSearch optionFilterProp="label" /></Form.Item></Field>
        </div>
        <Field label="反馈内容"><Form.Item name="content" noStyle rules={[{ required: true, message: '请填写反馈内容' }, { max: 1000, message: '不超过 1000 字' }]}><Input.TextArea rows={4} placeholder="请详细描述问题或建议" maxLength={1000} showCount /></Form.Item></Field>
      </Form>
    </SettingPage>
  );
};

/* ════════════ 业务申请 · 入驻 / 资质（pg-p-apply · 多步流程右栏） ════════════ */
export const SPApplyDetail = () => {
  const { id } = useParams();
  const nav = useNavigate();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rec, setRec] = useState<any>(null);
  const isEdit = !!id;

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      if (!isEdit) {
        const def = { applicantName: '', phone: '', regionPath: undefined, serviceScopes: [], certType: undefined, certNo: '', issuer: '', certExpire: '', certLongTerm: false, reason: '' };
        if (alive) { setRec(def); setLoading(false); }
        return;
      }
      try {
        const r = await fetchOne('provider/applications', id);
        const init = {
          applicantName: r.applicantName || '', phone: r.phone || '', regionPath: r.regionPath || undefined,
          serviceScopes: r.serviceScopes || [], certType: r.certType || undefined, certNo: r.certNo || '',
          issuer: r.issuer || '', certExpire: dateInput(r.certExpire), certLongTerm: !!r.certLongTerm, reason: r.reason || '',
        };
        if (alive) setRec(init);
      } catch (e: any) { if (alive) message.error(e?.message || '加载申请失败'); }
      finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [id]);

  const editable = !isEdit || ['FIRST_PENDING', 'FIRST_PASSED'].includes(rec?.status);
  const save = async () => {
    if (!editable) { message.warning('当前状态不可修改'); return; }
    let v: any;
    try { v = await form.validateFields(); } catch { message.warning('请先修正表单中的校验项'); return; }
    const payload = {
      applicantName: v.applicantName.trim(), phone: v.phone.trim(), regionPath: v.regionPath, regionLabel: v.regionPath,
      serviceScopes: Array.isArray(v.serviceScopes) ? v.serviceScopes : [], certType: v.certType || '', certNo: v.certNo.trim(),
      issuer: v.issuer || '', certExpire: v.certLongTerm ? null : (v.certExpire || null), certLongTerm: !!v.certLongTerm, reason: v.reason || '',
    };
    setSaving(true);
    try {
      const url = isEdit ? `provider/applications/${id}` : 'provider/applications';
      const method = isEdit ? 'patch' : 'post';
      await dataProvider.custom!({ url, method, payload });
      message.success(isEdit ? '申请资料已更新' : '入驻申请已提交，进入辖区初审');
      nav('/sp/apply');
    } catch (e: any) { message.error(e?.response?.data?.message || e?.message || '保存失败'); }
    finally { setSaving(false); }
  };

  const applySteps = APPLY_FLOW.map((s, i) => ({ title: t(s.label), desc: i < 3 ? '申请方' : '平台处理', state: i < 3 ? 'done' : 'todo' as any }));
  const aside = (
    <PreviewCard title="申请流程">
      <FlowSteps steps={applySteps} />
    </PreviewCard>
  );

  return (
    <SettingPage
      title={isEdit ? '业务申请详情' : '新建入驻申请'}
      sub="入住 / 资质申请全流程跟踪"
      chip="服务商 · 自身作用域"
      backTo="/sp/apply"
      aside={aside}
      loading={loading}
      footer={<>
        <Button onClick={() => nav('/sp/apply')}>取消</Button>
        <Button type="primary" loading={saving} disabled={!editable} onClick={save}>{isEdit ? '保存修改' : '提交入驻申请'}</Button>
      </>}
    >
      {rec && (
        <>
          {isEdit && !editable && (
            <div style={{ background: T.panel2, color: T.ink2, fontSize: 12.5, padding: '8px 12px', borderRadius: 8, marginBottom: 12 }}>
              当前状态（{t(APPLY_STATUS[rec.status]?.key ?? '')}）不可修改，可在「通知公告」关注审核结果。
            </div>
          )}
          <Form form={form} layout="vertical" initialValues={rec} style={{ marginTop: 8 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <Field label="申请主体名称"><Form.Item name="applicantName" noStyle rules={[{ required: true, message: '请填写申请主体名称' }]}><Input placeholder="如：天山雄鹰文化传媒" /></Form.Item></Field>
              <Field label="手机号"><Form.Item name="phone" noStyle rules={[{ required: true, message: '请填写手机号' }, { pattern: /^\d{11}$/, message: '须为 11 位数字' }]}><Input placeholder="11 位手机号" maxLength={11} /></Form.Item></Field>
              <Field label="申请区域"><Form.Item name="regionPath" noStyle rules={[{ required: true, message: '请选择申请区域' }]}><Select options={REGION_OPTIONS} placeholder="选择业务开展城市" /></Form.Item></Field>
              <Field label="业务范围"><Form.Item name="serviceScopes" noStyle><Select mode="multiple" options={SVC_OPTIONS} placeholder="可多选" showSearch optionFilterProp="label" /></Form.Item></Field>
              <Field label="资质类型"><Form.Item name="certType" noStyle rules={[{ required: true, message: '请选择资质类型' }]}><Select options={CERT_TYPES} /></Form.Item></Field>
              <Field label="证件编号"><Form.Item name="certNo" noStyle rules={[{ required: true, message: '请填写证件编号' }]}><Input placeholder="如：91650100****2210" /></Form.Item></Field>
              <Field label="发证机关"><Form.Item name="issuer" noStyle><Input placeholder="如：乌鲁木齐市市场监督管理局" /></Form.Item></Field>
              <Field label="长期有效" hint="开启后无需填写有效期"><Form.Item name="certLongTerm" noStyle valuePropName="checked"><Switch /></Form.Item></Field>
            </div>
            <Field label="有效期至"><Form.Item name="certExpire" noStyle><input type="date" style={{ width: '100%', height: 32, border: `1px solid ${T.border}`, borderRadius: 6, padding: '0 8px', fontSize: 13 }} /></Form.Item></Field>
            <Field label="申请说明"><Form.Item name="reason" noStyle><Input.TextArea rows={3} maxLength={500} showCount placeholder="补充说明（选填）" /></Form.Item></Field>
          </Form>
        </>
      )}
    </SettingPage>
  );
};
