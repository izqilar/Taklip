/**
 * 代理商 · 入驻审批（辖区，代理一审）。
 * 复用 GET /api/agent/qualifications（后端按代理商 regionPath 强制辖区隔离）。
 * 代理商仅做「代理一审」：FIRST_PENDING → FIRST_PASSED（通过）/ REJECTED（驳回），**不触碰身份变更**；
 * 身份变更（role 落地）仅总台 ADMIN 终审执行。终审环节由总台处理，代理商侧对 FINAL_PENDING 显示「待总台终审」。
 */
import { useCallback, useEffect, useState } from 'react';
import { Modal, message as antdMessage, Descriptions, Drawer, Button, Input, Select, Tag } from 'antd';
import { PageHead } from '../components/ui/PageHead';
import { Panel } from '../components/ui/Panel';
import { DataTable } from '../components/ui/DataTable';
import { Pager } from '../components/ui/Pager';
import { EmptyState } from '../components/common/EmptyState';
import { T } from '../config/theme';
import { t } from '../i18n/t';
import { dataProvider } from '../providers/dataProvider';

const STATUS_TEXT: Record<string, string> = {
  FIRST_PENDING: '待初审',
  FIRST_PASSED: '待补资料',
  FINAL_PENDING: '待终审',
  APPROVED: '已通过',
  REJECTED: '已驳回',
  WITHDRAWN: '已撤回',
};

/** 提交时风险旗标（与后端 riskFlags 同键） */
const RISK_TEXT: Record<string, string> = {
  DUPLICATE_CERT_NO: '重复证件号',
  MATERIAL_MISSING: '材料缺失',
  NO_REGION: '未选区域',
  NO_AGENT_COVERAGE: '辖区无覆盖',
};

const statusPill = (s: string) => {
  const tone =
    s === 'APPROVED'
      ? { bg: 'rgba(29,122,107,0.12)', fg: '#0f5a4e' }
      : s === 'REJECTED'
        ? { bg: 'rgba(192,43,51,0.12)', fg: '#8f1d24' }
        : { bg: 'rgba(183,122,22,0.14)', fg: '#7a4d07' };
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        borderRadius: 999,
        padding: '1px 9px',
        fontSize: 12,
        fontWeight: 600,
        background: tone.bg,
        color: tone.fg,
      }}
    >
      {STATUS_TEXT[s] ?? s}
    </span>
  );
};

const fmt = (v?: string | Date | null) => (v ? new Date(v).toLocaleString('zh-CN', { hour12: false }) : '—');
const PAGE_SIZE = 15;

export const AgentQualifications = () => {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [current, setCurrent] = useState<any>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectNote, setRejectNote] = useState('');
  const [rejectMode, setRejectMode] = useState<'single' | 'batch'>('single');
  const [rejectTargetId, setRejectTargetId] = useState<string | null>(null);
  const [kindFilter, setKindFilter] = useState<string>('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // 代理商一审队列默认只看服务商入驻（代理商自身的入驻申请由总台终审，不进辖区一审）
      const url = kindFilter ? `agent/qualifications?kind=${kindFilter}` : 'agent/qualifications?kind=provider';
      const r: any = await dataProvider.custom!({ url, method: 'get' });
      setRows(Array.isArray(r?.data?.items) ? r.data.items : []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [kindFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const review = async (id: string, pass: boolean, note?: string) => {
    setBusy(true);
    try {
      await dataProvider.custom!({
        url: `agent/qualifications/${id}/review`,
        method: 'patch',
        payload: { pass, note: note ?? null },
      });
      antdMessage.success(t('toast.agentReviewed', '一审已提交'));
      setOpen(false);
      setCurrent(null);
      load();
    } catch (e: any) {
      antdMessage.error(e?.message || t('pages.toast.actionFailed', '操作失败'));
    } finally {
      setBusy(false);
    }
  };

  const batchReview = async (pass: boolean, note?: string) => {
    if (!selectedKeys.length) return;
    setBusy(true);
    try {
      const r: any = await dataProvider.custom!({
        url: 'agent/qualifications/batch-review',
        method: 'patch',
        payload: { ids: selectedKeys, pass, note: note ?? null },
      });
      const d = r?.data ?? r ?? {};
      const ok = d.success ?? 0;
      const fail = Array.isArray(d.failed) ? d.failed : [];
      if (fail.length === 0) {
        antdMessage.success(`${t('toast.batchReviewed', '批量一审已提交')} · ${ok}`);
      } else {
        antdMessage.warning(`${t('toast.batchPartial', '批量一审部分完成')} · ${ok} / ${fail.length}`);
      }
      setSelectedKeys([]);
      load();
    } catch (e: any) {
      antdMessage.error(e?.message || t('pages.toast.actionFailed', '操作失败'));
    } finally {
      setBusy(false);
    }
  };

  const openBatchReject = () => {
    if (!selectedKeys.length) return;
    setRejectMode('batch');
    setRejectNote('');
    setRejectOpen(true);
  };

  const confirmReject = async () => {
    const note = rejectNote.trim();
    if (!note) {
      antdMessage.error(t('pages.toast.rejectReasonRequired', '请填写驳回意见'));
      return;
    }
    setRejectOpen(false);
    try {
      if (rejectMode === 'single' && rejectTargetId) {
        await review(rejectTargetId, false, note);
      } else {
        await batchReview(false, note);
      }
    } finally {
      setRejectNote('');
      setRejectTargetId(null);
    }
  };

  const ask = (row: any, pass: boolean) => {
    if (pass) {
      Modal.confirm({
        title: t('btn.agentFirstPass', '一审通过'),
        content: `${row.user?.realName || row.user?.nickname || '—'} · ${row.kind === 'agent' ? '代理商' : '服务商'} · ${row.regionLabel ?? '—'}`,
        okText: t('common.detail', '确定'),
        cancelText: t('button.cancel', '取消'),
        okButtonProps: { disabled: busy },
        onOk: () => review(row.id, true),
      });
      return;
    }
    setRejectMode('single');
    setRejectTargetId(row.id);
    setRejectNote('');
    setRejectOpen(true);
  };

  const columns: any[] = [
    { title: t('col.applicant', '申请人'), dataIndex: ['user'], width: 140, render: (_: any, r: any) => r.user?.realName || r.user?.nickname || '—' },
    { title: t('col.phone', '手机'), dataIndex: ['user', 'phone'], width: 140 },
    { title: t('col.kind', '入驻层次'), dataIndex: 'kind', width: 110, render: (v: string) => (v === 'agent' ? '代理商' : '服务商') },
    { title: t('col.region', '区域'), dataIndex: 'regionLabel', width: 160, render: (v: string) => v ?? '—' },
    { title: t('col.reason', '申请说明'), dataIndex: 'reason', ellipsis: true },
    { title: t('col.status', '状态'), dataIndex: 'status', width: 110, render: (v: string) => statusPill(v) },
    { title: t('col.createdAt', '提交时间'), dataIndex: 'createdAt', width: 170, render: (v: string) => fmt(v) },
    {
      title: t('col.action', '操作'),
      key: 'op',
      width: 220,
      render: (_: any, r: any) => (
        <div style={{ display: 'flex', gap: 12 }}>
          {r.status === 'FIRST_PENDING' && (
            <>
              <span onClick={(e) => { e.stopPropagation(); ask(r, true); }} style={{ color: T.accent, cursor: 'pointer', fontSize: 13 }}>
                {t('btn.agentFirstPass', '一审通过')}
              </span>
              <span onClick={(e) => { e.stopPropagation(); ask(r, false); }} style={{ color: '#c0392b', cursor: 'pointer', fontSize: 13 }}>
                {t('btn.agentFirstReject', '一审驳回')}
              </span>
            </>
          )}
          {r.status === 'FINAL_PENDING' && (
            <span style={{ color: T.ink3, fontSize: 13 }}>{t('pages.status.consoleFinalReview', '待总台终审')}</span>
          )}
          {(r.status === 'APPROVED' || r.status === 'REJECTED' || r.status === 'FIRST_PASSED') && (
            <span style={{ color: T.ink3, fontSize: 13 }}>—</span>
          )}
        </div>
      ),
    },
  ];

  const rowSelection: any = {
    selectedRowKeys: selectedKeys,
    onChange: (keys: any[]) => setSelectedKeys(keys as string[]),
    getCheckboxProps: (r: any) => ({ disabled: r.status !== 'FIRST_PENDING' }),
  };

  const pendingTotal = rows.filter((r) => ['FIRST_PENDING', 'FINAL_PENDING'].includes(r.status)).length;

  return (
    <>
      <PageHead
        title={t('sec.agentQualification', '入驻审批')}
        sub={t('pages.desc.agentQualificationSub', '辖区入驻资格升级隧道 · 代理一审（不触碰身份变更）· 终审由总台裁定')}
        chip="代理商 · 入驻审批"
      />
      <div
        style={{
          display: 'flex',
          gap: 10,
          alignItems: 'flex-start',
          padding: '11px 14px',
          borderRadius: T.rMd,
          background: T.accent2Soft,
          color: T.accent2,
          fontSize: 13,
          marginBottom: 12,
        }}
      >
        <span>{t('lbl.agentFbHint', '代理商仅做一审，身份变更与资金放行仅总台终审。')}</span>
      </div>
      {selectedKeys.length > 0 && (
        <div
          style={{
            display: 'flex',
            gap: 10,
            alignItems: 'center',
            padding: '8px 14px',
            borderRadius: T.rMd,
            background: T.panel2,
            border: `1px solid ${T.border}`,
            marginBottom: 12,
          }}
        >
          <span style={{ fontSize: 13, color: T.ink2 }}>
            {t('lbl.selectedCount', '已选')} <b style={{ color: T.accent }}>{selectedKeys.length}</b> {t('pages.enum.unit', '条')}
          </span>
          <Button type="primary" size="small" loading={busy} onClick={() => batchReview(true)}>
            {t('btn.batchPass', '批量通过')}
          </Button>
          <Button danger size="small" loading={busy} onClick={openBatchReject}>
            {t('btn.batchReject', '批量驳回')}
          </Button>
          <Button size="small" onClick={() => setSelectedKeys([])}>
            {t('btn.clearSelection', '清空')}
          </Button>
        </div>
      )}
      <Panel
        title={t('sec.agentQualification', '入驻审批')}
        hint={
          <>
            {t('pages.enum.pending', '待审')} <b style={{ color: T.accent }}>{pendingTotal}</b> {t('pages.enum.unit', '条')} ·{' '}
            {t('pages.enum.all', '全部')} <b>{rows.length}</b> {t('pages.enum.unit', '条')}
          </>
        }
      >
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 16px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, color: T.ink3 }}>{t('col.kind', '入驻层次')}</span>
          <Select
            size="small"
            style={{ width: 140 }}
            value={kindFilter || undefined}
            placeholder={t('pages.lbl.providerDefault', '服务商（默认）')}
            onChange={(v) => setKindFilter(v ?? '')}
            allowClear
            options={[
              { value: 'provider', label: t('pages.enum.provider', '服务商') },
              { value: 'agent', label: t('pages.enum.agent', '代理商') },
            ]}
          />
          <span style={{ marginLeft: 'auto', fontSize: 12.5, color: T.ink3 }}>
            {t('lbl.clickRowForDetail', '点击行查看完整材料与审批意见')}
          </span>
        </div>
        <DataTable<any>
          rowKey="id"
          dataSource={rows}
          loading={loading}
          scroll={{ x: 1100 }}
          locale={{ emptyText: <EmptyState description={t('empty.noQualification', '辖区内暂无入驻申请')} /> }}
          columns={columns}
          rowSelection={rowSelection}
          onRow={(r: any) => ({
            onClick: (e: any) => {
              if ((e.target as HTMLElement).closest('.ant-table-selection-column')) return;
              setCurrent(r);
              setOpen(true);
            },
            style: { cursor: 'pointer' },
          })}
        />
        <Pager total={rows.length} current={page} pageSize={PAGE_SIZE} onChange={setPage} />
      </Panel>

      <Drawer title={current?.user?.realName || current?.user?.nickname || t('sec.agentQualification', '入驻审批')} open={open} width={520} onClose={() => setOpen(false)}>
        {current && (
          <Descriptions column={1} bordered size="small" styles={{ label: { width: 96 } }}>
            <Descriptions.Item label={t('col.applicant', '申请人')}>{current.user?.realName || current.user?.nickname || '—'}</Descriptions.Item>
            <Descriptions.Item label={t('col.phone', '手机')}>{current.user?.phone || '—'}</Descriptions.Item>
            <Descriptions.Item label={t('col.kind', '入驻层次')}>{current.kind === 'agent' ? '代理商' : '服务商'}</Descriptions.Item>
            <Descriptions.Item label={t('col.region', '区域')}>{current.regionLabel ?? '—'}</Descriptions.Item>
            <Descriptions.Item label={t('col.status', '状态')}>{statusPill(current.status)}</Descriptions.Item>
            <Descriptions.Item label={t('col.reason', '申请说明')}>{current.reason || '—'}</Descriptions.Item>
            <Descriptions.Item label={t('col.serviceScopes', '服务类型')}>
              {(current.serviceScopes ?? []).length ? (current.serviceScopes ?? []).join(' / ') : '—'}
            </Descriptions.Item>
            {/* ── 主体资质材料（材料前置后一审即可看到真实材料） ── */}
            <Descriptions.Item label={t('col.name', '申请人姓名')}>{current.applicantName || '—'}</Descriptions.Item>
            <Descriptions.Item label={t('col.contactPhone', '联系手机')}>{current.phone || '—'}</Descriptions.Item>
            <Descriptions.Item label={t('col.certType', '证件类型')}>{current.certType || '—'}</Descriptions.Item>
            <Descriptions.Item label={t('col.certNo', '证件编号')}>{current.certNo || '—'}</Descriptions.Item>
            <Descriptions.Item label={t('col.certExpire', '证件有效期')}>
              {current.certLongTerm ? t('pages.enum.longTerm', '长期有效') : current.certExpire || '—'}
            </Descriptions.Item>
            <Descriptions.Item label={t('col.issuer', '发证机关')}>{current.issuer || '—'}</Descriptions.Item>
            <Descriptions.Item label={t('col.attachments', '资质附件')}>
              {(current.attachments ?? []).length ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {(current.attachments ?? []).map((a: string, i: number) => (
                    <a key={i} href={a} target="_blank" rel="noreferrer" style={{ fontSize: 12.5 }}>
                      {a}
                    </a>
                  ))}
                </div>
              ) : (
                '—'
              )}
            </Descriptions.Item>
            <Descriptions.Item label={t('col.riskFlags', '风险旗标')}>
              {(current.riskFlags ?? []).length ? (
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {(current.riskFlags ?? []).map((f: string) => (
                    <Tag key={f} color={f === 'MATERIAL_MISSING' ? 'red' : 'orange'}>
                      {RISK_TEXT[f] ?? f}
                    </Tag>
                  ))}
                </div>
              ) : (
                '—'
              )}
            </Descriptions.Item>
            <Descriptions.Item label={t('col.createdAt', '提交时间')}>{fmt(current.createdAt)}</Descriptions.Item>
            <Descriptions.Item label={t('col.materialSubmittedAt', '材料提交时间')}>
              {fmt(current.materialSubmittedAt)}
            </Descriptions.Item>
            <Descriptions.Item label={t('col.firstReview', '本次一审')}>
              {fmt(current.firstReviewedAt)}
            </Descriptions.Item>
            <Descriptions.Item label={t('col.notified', '结果通知')}>
              {current.notifiedAt ? (
                <Tag color="green">{`${t('pages.enum.notified', '已通知')} · ${fmt(current.notifiedAt)}`}</Tag>
              ) : (
                t('pages.enum.notNotified', '未通知')
              )}
            </Descriptions.Item>
          </Descriptions>
        )}
        {current?.reviewNote && (
          <div
            style={{
              marginTop: 12,
              padding: '10px 12px',
              borderRadius: 8,
              background: 'rgba(192,43,51,0.08)',
              color: '#8f1d24',
              fontSize: 13,
            }}
          >
            <b>{t('col.reviewNote', '审批意见')}：</b>
            {current.reviewNote}
          </div>
        )}
      </Drawer>

      <Modal
        open={rejectOpen}
        title={t('pages.modal.rejectReason', '填写驳回意见')}
        okText={t('common.detail', '确定')}
        cancelText={t('button.cancel', '取消')}
        okButtonProps={{ danger: true, disabled: busy }}
        onOk={confirmReject}
        onCancel={() => setRejectOpen(false)}
        destroyOnClose
      >
        <Input.TextArea
          rows={4}
          value={rejectNote}
          maxLength={500}
          showCount
          onChange={(e) => setRejectNote(e.target.value)}
          placeholder={t('pages.ph.rejectReason', '请说明驳回原因，将记入审计日志')}
        />
      </Modal>
    </>
  );
};

export default AgentQualifications;
