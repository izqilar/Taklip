/**
 * 合同管理（代理商辖区只读 / 总台全量治理）。
 * 复用 GET /api/agent/contracts：后端对 ADMIN 不去 regionPath 过滤，返回全平台合同；
 * 对 AGENT 按 provider.regionPath 辖区收敛。签约 / 编辑属服务商自身职能，本页均只读。
 *
 * 总台（variant='admin'）额外拥有三项治理职能（均受 contract:manage 权限门控）：
 *  - 「推进合同」POST /api/provider/contracts/:id/advance（@Roles('ADMIN')，补全签署生命周期）
 *  - 「编辑」    PATCH /api/provider/contracts/:id（ADMIN 可改商务条款 / 签署阶段 / 重置协商）
 *  - 「作废」    POST /api/provider/contracts/:id/void（@Roles('ADMIN')，置 VOIDED 并按方向挂起/降级）
 * 注意：所有写操作走 provider/ 前缀（控制器为 @Controller('api/provider')），切勿用 provider-console/。
 */
import { useCallback, useEffect, useState } from 'react';
import dayjs from 'dayjs';
import { Descriptions, Drawer, Modal, Input, Button, message, Form, Select, Switch, InputNumber, DatePicker, Radio, Space } from 'antd';
import { useCan } from '@refinedev/core';
import { PageHead } from '../components/ui/PageHead';
import { Panel } from '../components/ui/Panel';
import { DataTable } from '../components/ui/DataTable';
import { Pager } from '../components/ui/Pager';
import { EmptyState } from '../components/common/EmptyState';
import { T } from '../config/theme';
import { t } from '../i18n/t';
import { dataProvider } from '../providers/dataProvider';

const pill = (text: string, tone: 'ok' | 'warn' | 'bad' | 'mut') => {
  const c =
    tone === 'ok'
      ? { bg: 'rgba(29,122,107,0.12)', fg: '#0f5a4e' }
      : tone === 'bad'
        ? { bg: 'rgba(192,43,51,0.12)', fg: '#8f1d24' }
        : tone === 'warn'
          ? { bg: 'rgba(183,122,22,0.14)', fg: '#7a4d07' }
          : { bg: 'rgba(120,120,130,0.12)', fg: '#4a4a52' };
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', borderRadius: 999, padding: '1px 9px', fontSize: 12, fontWeight: 600, background: c.bg, color: c.fg }}>
      {text}
    </span>
  );
};

const signStagePill = (s?: string) => {
  if (s === 'AWAIT_PROVIDER_SIGN') return pill(t('pages.status.contractStageAwaitProvider', '待服务商签署'), 'warn');
  if (s === 'AWAIT_SENIOR_SIGN') return pill(t('pages.status.contractStageAwaitSenior', '待上级签署'), 'warn');
  if (s === 'APPROVING') return pill(t('pages.status.contractStageApproving', '审批中'), 'warn');
  if (s === 'EFFECTIVE') return pill(t('pages.status.contractStageEffective', '已生效'), 'ok');
  if (s === 'TERMINATED') return pill(t('pages.status.contractStageTerminated', '已终止'), 'bad');
  if (s === 'NEGOTIATING') return pill(t('pages.status.contractStageNegotiating', '协商中'), 'warn');
  if (s === 'EXPIRED') return pill(t('pages.status.contractStageExpired', '已到期'), 'mut');
  if (s === 'VOIDED') return pill(t('pages.status.contractStageVoided', '已作废'), 'bad');
  return pill(s ?? '—', 'mut');
};

const STAGE_OPTIONS = [
  { value: 'NEGOTIATING', label: t('pages.status.contractStageNegotiating', '协商中') },
  { value: 'AWAIT_PROVIDER_SIGN', label: t('pages.status.contractStageAwaitProvider', '待服务商签署') },
  { value: 'AWAIT_SENIOR_SIGN', label: t('pages.status.contractStageAwaitSenior', '待上级签署') },
  { value: 'APPROVING', label: t('pages.status.contractStageApproving', '审批中') },
  { value: 'EFFECTIVE', label: t('pages.status.contractStageEffective', '已生效') },
  { value: 'EXPIRED', label: t('pages.status.contractStageExpired', '已到期') },
  { value: 'TERMINATED', label: t('pages.status.contractStageTerminated', '已终止') },
  { value: 'VOIDED', label: t('pages.status.contractStageVoided', '已作废') },
];
const MODE_OPTIONS = [
  { value: 'REGION_EXCLUSIVE', label: t('pages.status.contractModeRegionExclusive', '区域独家') },
  { value: 'ONLINE', label: t('pages.status.contractModeOnline', '线上接单') },
  { value: 'ON_SITE', label: t('pages.status.contractModeOnSite', '线下驻场') },
  { value: 'JOINT', label: t('pages.status.contractModeJoint', '联合运营') },
];
const SETTLE_OPTIONS = [
  { value: 'MONTH', label: t('pages.status.settleMonth', '月结') },
  { value: 'HALF_MONTH', label: t('pages.status.settleHalfMonth', '半月结') },
  { value: 'WEEK', label: t('pages.status.settleWeek', '周结') },
];

const fmt = (v?: string | Date | null) => (v ? new Date(v).toLocaleString('zh-CN', { hour12: false }) : '—');
const PAGE_SIZE = 15;

const isAdmin = (v?: 'agent' | 'admin') => v === 'admin';

export const AgentContracts = ({ variant = 'agent' }: { variant?: 'agent' | 'admin' }) => {
  const admin = isAdmin(variant);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [current, setCurrent] = useState<any>(null);
  const [open, setOpen] = useState(false);
  // 总台推进合同（admin 专属）
  const [advOpen, setAdvOpen] = useState(false);
  const [advStage, setAdvStage] = useState<'APPROVING' | 'EFFECTIVE'>('APPROVING');
  const [advNote, setAdvNote] = useState('');
  const [advancing, setAdvancing] = useState(false);
  // 总台编辑合同（admin 专属）
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reinit, setReinit] = useState(false);
  const [form] = Form.useForm();
  // 总台作废合同（admin 专属）
  const [voidOpen, setVoidOpen] = useState(false);
  const [voidDirection, setVoidDirection] = useState<'SUSPEND' | 'DEMOTE'>('SUSPEND');
  const [voidNote, setVoidNote] = useState('');
  const [voiding, setVoiding] = useState(false);

  // 权限门控：contract:manage 才能编辑 / 作废（仅 ADMIN 基线含该权限）
  const { data: editCan } = useCan({ resource: 'admin/contracts', action: 'edit' });
  const { data: voidCan } = useCan({ resource: 'admin/contracts', action: 'void' });
  const canEdit = !!admin && !!editCan?.can;
  const canVoid = !!admin && !!voidCan?.can;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r: any = await dataProvider.custom!({ url: 'agent/contracts', method: 'get' });
      setRows(Array.isArray(r?.data?.items) ? r.data.items : []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // 打开编辑抽屉时回填表单（含详情上下文）
  useEffect(() => {
    if (editOpen && current) {
      form.setFieldsValue({
        partyA: current.partyA ?? '',
        serviceType: current.serviceType ?? '',
        businessMode: current.businessMode ?? undefined,
        region: current.region ?? '',
        exclusive: !!current.exclusive,
        platformRate: current.platformRate ?? undefined,
        deposit: current.deposit ?? undefined,
        settlePeriod: current.settlePeriod ?? undefined,
        signStage: current.signStage ?? undefined,
        expireDate: current.expireDate ? dayjs(current.expireDate) : null,
      });
    }
  }, [editOpen, current, form]);

  const columns: any[] = [
    { title: t('col.name', '名称'), dataIndex: 'name', ellipsis: true },
    { title: t('col.partyA', '甲方'), dataIndex: 'partyA', width: 160, ellipsis: true },
    { title: t('col.provider', '服务商'), dataIndex: ['provider', 'nickname'], width: 140, render: (_: any, r: any) => r.provider?.nickname || '—' },
    ...(admin
      ? [{
          title: t('col.type', '类型'),
          dataIndex: 'type',
          width: 110,
          render: (v: string) =>
            v === 'AGENCY'
              ? pill(t('pages.status.contractTypeAgency', '代理协议'), 'mut')
              : pill(t('pages.status.contractTypeMain', '主合同'), 'ok'),
        }]
      : []),
    { title: t('col.signStage', '签署阶段'), dataIndex: 'signStage', width: 120, render: (v: string) => signStagePill(v) },
    { title: t('col.regionProvider', '服务商辖区'), dataIndex: ['provider', 'regionPath'], width: 140, render: (v: string) => v ?? '—' },
    { title: t('col.createdAt', '创建时间'), dataIndex: 'createdAt', width: 170, render: (v: string) => fmt(v) },
    {
      title: t('col.action', '操作'),
      key: 'op',
      width: 200,
      render: (_: any, r: any) => (
        <Space size={8}>
          <span
            onClick={(e) => { e.stopPropagation(); setCurrent(r); setOpen(true); }}
            style={{ color: T.ink2, cursor: 'pointer', fontSize: 13 }}
          >
            {t('common.detail', '详情')}
          </span>
          {canEdit && (
            <span
              onClick={(e) => { e.stopPropagation(); setCurrent(r); setEditOpen(true); }}
              style={{ color: T.accent, cursor: 'pointer', fontSize: 13 }}
            >
              {t('pages.btn.editContract', '编辑')}
            </span>
          )}
          {canVoid && (
            <span
              onClick={(e) => { e.stopPropagation(); setCurrent(r); setVoidOpen(true); }}
              style={{ color: '#c0242b', cursor: 'pointer', fontSize: 13 }}
            >
              {t('pages.btn.voidContract', '作废')}
            </span>
          )}
        </Space>
      ),
    },
  ];

  const canAdvance = (s?: string) => !!s && ['AWAIT_PROVIDER_SIGN', 'AWAIT_SENIOR_SIGN', 'APPROVING', 'NEGOTIATING'].includes(s);

  const doAdvance = useCallback(async () => {
    if (!current) return;
    setAdvancing(true);
    try {
      await dataProvider.custom!({
        url: `provider/contracts/${current.id}/advance`,
        method: 'post',
        payload: { stage: advStage, note: advNote },
      });
      message.success(t('msg.contractAdvanced', '合同阶段已推进'));
      setAdvOpen(false);
      setAdvNote('');
      await load();
      setCurrent({ ...current, signStage: advStage });
    } catch (e: any) {
      message.error(e?.message || t('msg.advanceFailed', '推进失败'));
    } finally {
      setAdvancing(false);
    }
  }, [current, advStage, advNote, load]);

  const doSaveEdit = useCallback(async () => {
    if (!current) return;
    setSaving(true);
    try {
      const v = form.getFieldsValue();
      const payload: any = {};
      if (v.partyA != null && v.partyA !== '') payload.partyA = v.partyA;
      if (v.serviceType != null && v.serviceType !== '') payload.serviceType = v.serviceType;
      if (v.businessMode != null) payload.businessMode = v.businessMode;
      if (v.region != null && v.region !== '') payload.region = v.region;
      if (v.exclusive != null) payload.exclusive = !!v.exclusive;
      if (v.platformRate != null) payload.platformRate = Number(v.platformRate);
      if (v.deposit != null) payload.deposit = Number(v.deposit);
      if (v.settlePeriod != null) payload.settlePeriod = v.settlePeriod;
      if (v.signStage != null) payload.signStage = v.signStage;
      if (v.expireDate) payload.expireDate = dayjs(v.expireDate).toISOString();
      if (Object.keys(payload).length === 0) {
        message.info(t('pages.msg.noChange', '没有可保存的改动'));
        return;
      }
      await dataProvider.custom!({
        url: `provider/contracts/${current.id}`,
        method: 'patch',
        payload,
      });
      message.success(t('pages.msg.contractUpdated', '合同已更新'));
      setEditOpen(false);
      setCurrent(null);
      await load();
    } catch (e: any) {
      message.error(e?.message || t('pages.toast.saveFailed', '保存失败'));
    } finally {
      setSaving(false);
    }
  }, [current, form, load]);

  const doReinit = useCallback(async () => {
    if (!current) return;
    setReinit(true);
    try {
      // 重新发起协商流程：阶段退回「协商中」+ 追加一条协商记录
      await dataProvider.custom!({
        url: `provider/contracts/${current.id}`,
        method: 'patch',
        payload: { signStage: 'NEGOTIATING' },
      });
      await dataProvider.custom!({
        url: `provider/contracts/${current.id}/negotiation`,
        method: 'post',
        payload: { text: t('pages.btn.reinitNegotiate', '重新发起协商') },
      });
      message.success(t('pages.msg.negotiationReinit', '已重新发起协商'));
      setEditOpen(false);
      setCurrent(null);
      await load();
    } catch (e: any) {
      message.error(e?.message || t('pages.msg.reinitFailed', '重新发起协商失败'));
    } finally {
      setReinit(false);
    }
  }, [current, load]);

  const doVoid = useCallback(async () => {
    if (!current) return;
    setVoiding(true);
    try {
      await dataProvider.custom!({
        url: `provider/contracts/${current.id}/void`,
        method: 'post',
        payload: { direction: voidDirection, note: voidNote },
      });
      message.success(t('pages.msg.contractVoided', '合同已作废'));
      setVoidOpen(false);
      setVoidNote('');
      setVoidDirection('SUSPEND');
      setCurrent(null);
      await load();
    } catch (e: any) {
      message.error(e?.message || t('pages.msg.voidFailed', '作废失败'));
    } finally {
      setVoiding(false);
    }
  }, [current, voidDirection, voidNote, load]);

  const detailDescriptions = (r: any) => (
    <Descriptions column={1} bordered size="small" styles={{ label: { width: 110 } }}>
      <Descriptions.Item label={t('col.name', '名称')}>{r.name || '—'}</Descriptions.Item>
      <Descriptions.Item label={t('col.partyA', '甲方')}>{r.partyA || '—'}</Descriptions.Item>
      <Descriptions.Item label={t('col.provider', '服务商')}>{r.provider?.nickname || '—'}</Descriptions.Item>
      <Descriptions.Item label={t('col.type', '类型')}>{t(`pages.status.${r.type ?? ''}`, r.type || '—')}</Descriptions.Item>
      <Descriptions.Item label={t('col.serviceType', '服务类型')}>{r.serviceType || '—'}</Descriptions.Item>
      <Descriptions.Item label={t('col.businessMode', '开展方式')}>{t(`pages.status.${r.businessMode ?? ''}`, r.businessMode || '—')}</Descriptions.Item>
      <Descriptions.Item label={t('col.region', '区域')}>{r.region || '—'}</Descriptions.Item>
      <Descriptions.Item label={t('col.exclusive', '独家')}>{r.exclusive ? t('common.yes', '是') : t('common.no', '否')}</Descriptions.Item>
      <Descriptions.Item label={t('col.platformRate', '平台抽成(%)')}>{r.platformRate ?? '—'}</Descriptions.Item>
      <Descriptions.Item label={t('col.deposit', '保证金(分)')}>{r.deposit ?? '—'}</Descriptions.Item>
      <Descriptions.Item label={t('col.settlePeriod', '结算周期')}>{t(`pages.status.${r.settlePeriod ?? ''}`, r.settlePeriod || '—')}</Descriptions.Item>
      <Descriptions.Item label={t('col.expireDate', '到期日')}>{r.expireDate ? fmt(r.expireDate) : '—'}</Descriptions.Item>
      <Descriptions.Item label={t('col.signStage', '签署阶段')}>{signStagePill(r.signStage)}</Descriptions.Item>
      {Array.isArray(r.negotiation) && r.negotiation.length > 0 && (
        <Descriptions.Item label={t('col.negotiation', '协商记录')}>
          {r.negotiation.map((n: string, i: number) => (
            <div key={i} style={{ fontSize: 12, color: T.ink2, marginBottom: 4 }}>{n}</div>
          ))}
        </Descriptions.Item>
      )}
      <Descriptions.Item label={t('col.createdAt', '创建时间')}>{fmt(r.createdAt)}</Descriptions.Item>
    </Descriptions>
  );

  return (
    <>
      <PageHead
        title={admin ? t('sec.platformContract', '平台合同管理') : t('sec.agentContract', '辖区合同')}
        sub={admin
          ? t('pages.desc.platformContractSub', '全平台服务商合同 · 总台可见全部主体（签约 / 编辑由服务商自身完成）')
          : t('pages.desc.agentContractSub', '辖区内服务商合同 · 只读可见（签约 / 编辑由服务商自身完成）')}
        chip={admin ? '总台 · 全盘治理' : '代理商 · 合同管理'}
      />
      <Panel
        title={admin ? t('sec.platformContract', '平台合同管理') : t('sec.agentContract', '辖区合同')}
        hint={<>{t('pages.enum.all', '全部')} <b style={{ color: T.accent }}>{rows.length}</b> {t('pages.enum.unit', '条')} · {admin ? t('pages.desc.platformContractHint', '全平台') : t('pages.desc.agentContractHint', '辖区可见')}</>}
      >
        <DataTable<any>
          rowKey="id"
          dataSource={rows}
          loading={loading}
          scroll={{ x: 1000 }}
          locale={{ emptyText: <EmptyState description={t('empty.noContract', '辖区内暂无合同')} /> }}
          columns={columns}
          onRow={(r: any) => ({ onClick: () => { setCurrent(r); setOpen(true); }, style: { cursor: 'pointer' } })}
        />
        <Pager total={rows.length} current={page} pageSize={PAGE_SIZE} onChange={setPage} />
      </Panel>

      {/* 详情（只读） */}
      <Drawer title={current?.name || t('sec.agentContract', '辖区合同')} open={open} width={540} onClose={() => setOpen(false)}
        extra={admin && canAdvance(current?.signStage) ? (
          <Button type="primary" onClick={() => { setAdvStage('APPROVING'); setAdvNote(''); setAdvOpen(true); }}>
            {t('common.advance', '推进合同')}
          </Button>
        ) : undefined}
      >
        {current && detailDescriptions(current)}
      </Drawer>

      {/* 编辑（admin 专属，受 contract:manage 门控）：查看详情 + 编辑信息 + 重新发起协商 */}
      <Drawer
        title={t('pages.btn.editContract', '编辑合同')}
        open={editOpen}
        width={560}
        onClose={() => setEditOpen(false)}
        extra={canVoid ? (
          <Button danger onClick={() => { setEditOpen(false); setVoidOpen(true); }}>
            {t('pages.btn.voidContract', '作废')}
          </Button>
        ) : undefined}
      >
        {current && (
          <>
            {detailDescriptions(current)}
            <div style={{ fontSize: 13, color: T.ink2, margin: '16px 0 8px' }}>
              {t('pages.desc.editContractHint', '编辑合同商务条款 / 签署阶段，或重新发起协商流程。')}
            </div>
            <Form form={form} layout="vertical">
              <Form.Item label={t('col.partyA', '甲方')} name="partyA"><Input placeholder={t('pages.ph.partyA', '签约甲方')} /></Form.Item>
              <Form.Item label={t('col.serviceType', '服务类型')} name="serviceType"><Input /></Form.Item>
              <Form.Item label={t('col.businessMode', '开展方式')} name="businessMode"><Select options={MODE_OPTIONS} allowClear /></Form.Item>
              <Form.Item label={t('col.region', '区域')} name="region"><Input /></Form.Item>
              <Form.Item label={t('col.exclusive', '独家')} name="exclusive" valuePropName="checked"><Switch /></Form.Item>
              <Form.Item label={t('col.platformRate', '平台抽成(%)')} name="platformRate"><InputNumber min={0} max={60} style={{ width: '100%' }} /></Form.Item>
              <Form.Item label={t('col.deposit', '保证金(分)')} name="deposit"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
              <Form.Item label={t('col.settlePeriod', '结算周期')} name="settlePeriod"><Select options={SETTLE_OPTIONS} allowClear /></Form.Item>
              <Form.Item label={t('col.expireDate', '到期日')} name="expireDate"><DatePicker style={{ width: '100%' }} /></Form.Item>
              <Form.Item label={t('col.signStage', '签署阶段')} name="signStage"><Select options={STAGE_OPTIONS} allowClear /></Form.Item>
            </Form>
            <Space>
              <Button type="primary" loading={saving} onClick={doSaveEdit}>{t('pages.btn.saveChanges', '保存修改')}</Button>
              <Button loading={reinit} onClick={doReinit}>{t('pages.btn.reinitNegotiate', '重新发起协商流程')}</Button>
              <Button onClick={() => setEditOpen(false)}>{t('common.cancel', '取消')}</Button>
            </Space>
          </>
        )}
      </Drawer>

      {/* 作废确认（admin 专属，受 contract:manage 门控） */}
      <Modal
        title={t('pages.modal.voidTitle', '作废合同')}
        open={voidOpen}
        confirmLoading={voiding}
        okButtonProps={{ danger: true }}
        onOk={doVoid}
        onCancel={() => setVoidOpen(false)}
        okText={t('common.confirm', '确认')}
        cancelText={t('common.cancel', '取消')}
      >
        <div style={{ marginBottom: 12, fontSize: 13, color: T.ink2 }}>
          {t('pages.desc.voidConfirm', '确认作废该合同？作废后合同状态变更为「已作废」，并按所选方向处置对应身份。')}
        </div>
        <div style={{ marginBottom: 8, fontSize: 13, fontWeight: 600 }}>{t('pages.col.voidDirection', '处理方式')}</div>
        <Radio.Group value={voidDirection} onChange={(e) => setVoidDirection(e.target.value)}>
          <Space direction="vertical">
            <Radio value="SUSPEND">{t('pages.modal.voidDirectionSuspend', '挂起（停用账号，保留资质）')}</Radio>
            <Radio value="DEMOTE">{t('pages.modal.voidDirectionDemote', '降为普通用户（撤销经营能力）')}</Radio>
          </Space>
        </Radio.Group>
        <div style={{ margin: '12px 0 8px', fontSize: 13, fontWeight: 600 }}>{t('col.note', '备注')}</div>
        <Input.TextArea
          value={voidNote}
          onChange={(e) => setVoidNote(e.target.value)}
          rows={3}
          placeholder={t('pages.modal.voidNotePlaceholder', '可选：作废说明')}
        />
      </Modal>

      <Modal
        title={t('common.advanceContract', '推进合同阶段')}
        open={advOpen}
        confirmLoading={advancing}
        onOk={doAdvance}
        onCancel={() => setAdvOpen(false)}
        okText={t('common.confirm', '确认')}
        cancelText={t('common.cancel', '取消')}
      >
        <div style={{ marginBottom: 12, fontSize: 13, color: T.ink2 }}>
          {t('pages.desc.advanceHint', '将合同从「待上级签署 / 审批中」推进至下一阶段。')}
        </div>
        <div style={{ marginBottom: 8, fontSize: 13, fontWeight: 600 }}>{t('col.targetStage', '目标阶段')}</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button type={advStage === 'APPROVING' ? 'primary' : 'default'} onClick={() => setAdvStage('APPROVING')}>
            {t('pages.status.contractStageApproving', '审批中')}
          </Button>
          <Button type={advStage === 'EFFECTIVE' ? 'primary' : 'default'} onClick={() => setAdvStage('EFFECTIVE')}>
            {t('pages.status.contractStageEffective', '已生效')}
          </Button>
        </div>
        <div style={{ margin: '12px 0 8px', fontSize: 13, fontWeight: 600 }}>{t('col.note', '备注')}</div>
        <Input.TextArea
          value={advNote}
          onChange={(e) => setAdvNote(e.target.value)}
          rows={3}
          placeholder={t('pages.desc.advanceNotePlaceholder', '可选：本次推进的说明')}
        />
      </Modal>
    </>
  );
};

export default AgentContracts;
