/**
 * 入驻审批台（总台 ADMIN）—— 用户「入驻」资格升级隧道的两阶段审核。
 *
 * 与「加入团队」隧道的区别（勿混用）：
 *   · 加入：由目标团队拥有者审批，只建立员工关系，身份不变；
 *   · 入驻：由总台 ADMIN 审批（初审 → 用户补资料 → 终审），
 *          终审通过后**变更 User.role**（服务商 / 代理商），登录落点自动切换到对应工作台。
 *
 * 数据：GET /api/admin/qualifications；审核：POST /api/user/qualifications/:id/review（ADMIN）。
 * 状态：FIRST_PENDING 待初审 → FIRST_PASSED 待补资料 → FINAL_PENDING 待终审 → APPROVED / REJECTED。
 */
import { useCallback, useEffect, useState } from 'react';
import { Button, Descriptions, Drawer, Input, Modal, Select, Tag, message } from 'antd';
import { PageHead } from '../components/ui/PageHead';
import { Panel } from '../components/ui/Panel';
import { DataTable } from '../components/ui/DataTable';
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

const fmtTime = (v?: string | Date | null) => (v ? new Date(v).toLocaleString('zh-CN', { hour12: false }) : '—');

const RISK_TEXT: Record<string, string> = {
  DUPLICATE_CERT_NO: '重复证件号',
  MATERIAL_MISSING: '材料缺失',
  NO_REGION: '未选区域',
  NO_AGENT_COVERAGE: '辖区无代理商覆盖',
};

const LEVEL_COLOR: Record<string, string> = {
  HIGH: '#8f1d24',
  MID: '#7a4d07',
  LOW: '#6e5f4a',
};

export const QualificationReviewPage = () => {
  const [rows, setRows] = useState<any[]>([]);
  const [all, setAll] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [acting, setActing] = useState(false);
  const [kindFilter, setKindFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [detail, setDetail] = useState<any | null>(null);
  const [precheck, setPrecheck] = useState<any | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectNote, setRejectNote] = useState('');
  const [rejectTarget, setRejectTarget] = useState<{ row: any; final: boolean } | null>(null);
  /** 代理商一审质量护栏（M6）：总台逆向审计第一闸口 */
  const [qualityOpen, setQualityOpen] = useState(false);
  const [quality, setQuality] = useState<any[]>([]);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const r: any = await dataProvider.custom!({ url: 'admin/qualifications', method: 'get' });
      const items = Array.isArray(r?.data?.items) ? r.data.items : [];
      setAll(items);
    } catch {
      setAll([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    setRows(
      all.filter(
        (r) => (!kindFilter || r.kind === kindFilter) && (!statusFilter || r.status === statusFilter),
      ),
    );
  }, [all, kindFilter, statusFilter]);

  const review = async (id: string, pass: boolean, final: boolean, note?: string) => {
    setActing(true);
    try {
      await dataProvider.custom!({
        url: `user/qualifications/${id}/review`,
        method: 'post',
        payload: { pass, final, ...(note ? { note } : {}) },
      });
      message.success(
        final
          ? pass
            ? t('qual.finalPassed', '终审通过，申请人身份已升级')
            : t('qual.finalRejected', '终审已驳回')
          : pass
            ? t('qual.firstPassed', '初审通过，等待申请人补充资料')
            : t('qual.firstRejected', '初审已驳回'),
      );
      await reload();
    } catch (e: any) {
      message.error(e?.message || t('qual.reviewFailed', '审核失败'));
    } finally {
      setActing(false);
    }
  };

  const ask = (row: any, pass: boolean, final: boolean) => {
    const title = final
      ? pass
        ? t('qual.confirmFinalPass', '确认终审通过？通过后该用户将成为服务商 / 代理商主体')
        : t('qual.confirmFinalReject', '确认终审驳回？')
      : pass
        ? t('qual.confirmFirstPass', '确认初审通过？通过后申请人可补充资质资料')
        : t('qual.confirmFirstReject', '确认初审驳回？');
    // 驳回必须填写原因：驳回原因会回传给申请人（站内回执），空原因等于让用户无从整改
    if (!pass) {
      setRejectTarget({ row, final });
      setRejectNote('');
      setRejectOpen(true);
      return;
    }
    Modal.confirm({
      title,
      content: `${row.user?.realName || row.user?.nickname || '—'} · ${row.kind === 'agent' ? '代理商' : '服务商'} · ${row.regionLabel ?? '—'}`,
      okText: t('button.confirm', '确定'),
      cancelText: t('button.cancel', '取消'),
      okButtonProps: { danger: !pass, disabled: acting },
      onOk: () => review(row.id, pass, final),
    });
  };

  const submitReject = async () => {
    if (!rejectTarget) return;
    const note = rejectNote.trim();
    if (!note) {
      message.warning(t('qual.rejectReasonRequired', '请填写驳回原因'));
      return;
    }
    await review(rejectTarget.row.id, false, rejectTarget.final, note);
    setRejectOpen(false);
    setRejectTarget(null);
  };

  /** 风险预检（M5）：只标记不自动放行，供审核人参考 */
  const runPrecheck = async (id: string) => {
    try {
      const r: any = await dataProvider.custom!({
        url: `admin/qualifications/${id}/precheck`,
        method: 'get',
      });
      setPrecheck(r?.data ?? null);
    } catch (e: any) {
      message.error(e?.message || t('qual.precheckFailed', '风险预检失败'));
    }
  };

  /** 一审质量护栏（M6）：代理商既是第一闸口又是受益方，需被逆向校验，防止橡皮图章 */
  const openQuality = async () => {
    setQualityOpen(true);
    try {
      const r: any = await dataProvider.custom!({ url: 'admin/agent-review-quality', method: 'get' });
      setQuality(Array.isArray(r?.data?.items) ? r.data.items : []);
    } catch {
      setQuality([]);
    }
  };

  const openDetail = async (row: any) => {
    setDetail(row);
    setPrecheck(null);
    await runPrecheck(row.id);
  };

  const columns: any[] = [
    {
      title: t('qual.colApplicant', '申请人'),
      dataIndex: ['user'],
      width: 150,
      render: (_: any, r: any) => r.user?.realName || r.user?.nickname || '—',
    },
    { title: t('qual.colPhone', '手机'), dataIndex: ['user', 'phone'], width: 140 },
    {
      title: t('qual.colKind', '入驻层次'),
      dataIndex: 'kind',
      width: 110,
      render: (v: string) => (v === 'agent' ? '代理商' : '服务商'),
    },
    { title: t('qual.colRegion', '区域'), dataIndex: 'regionLabel', width: 180, render: (v: string) => v ?? '—' },
    { title: t('qual.colReason', '申请说明'), dataIndex: 'reason', ellipsis: true },
    { title: t('col.status', '状态'), dataIndex: 'status', width: 110, render: (v: string) => statusPill(v) },
    {
      title: t('qual.colRisk', '风险旗标'),
      dataIndex: 'riskFlags',
      width: 180,
      render: (v: string[]) =>
        (v ?? []).length ? (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {(v ?? []).map((f) => (
              <Tag key={f} color={f === 'MATERIAL_MISSING' ? 'red' : 'orange'} style={{ marginInlineEnd: 0 }}>
                {RISK_TEXT[f] ?? f}
              </Tag>
            ))}
          </div>
        ) : (
          '—'
        ),
    },
    {
      title: t('qual.colNotified', '通知'),
      dataIndex: 'notifiedAt',
      width: 90,
      render: (v: string) => (v ? <Tag color="green">已通知</Tag> : '—'),
    },
    { title: t('qual.colCreatedAt', '提交时间'), dataIndex: 'createdAt', width: 170, render: (v: string) => fmtTime(v) },
    {
      title: t('col.action', '操作'),
      key: 'op',
      width: 240,
      render: (_: any, r: any) => (
        <div style={{ display: 'flex', gap: 12 }}>
          <span onClick={() => openDetail(r)} style={{ color: T.ink2, cursor: 'pointer', fontSize: 13 }}>
            {t('qual.detail', '详情')}
          </span>
          {r.status === 'FIRST_PENDING' && (
            <>
              <span onClick={() => ask(r, true, false)} style={{ color: T.accent, cursor: 'pointer', fontSize: 13 }}>
                {t('qual.firstPass', '初审通过')}
              </span>
              <span onClick={() => ask(r, false, false)} style={{ color: '#c0392b', cursor: 'pointer', fontSize: 13 }}>
                {t('qual.firstReject', '初审驳回')}
              </span>
            </>
          )}
          {r.status === 'FINAL_PENDING' && (
            <>
              <span onClick={() => ask(r, true, true)} style={{ color: T.accent, cursor: 'pointer', fontSize: 13 }}>
                {t('qual.finalPass', '终审通过')}
              </span>
              <span onClick={() => ask(r, false, true)} style={{ color: '#c0392b', cursor: 'pointer', fontSize: 13 }}>
                {t('qual.finalReject', '终审驳回')}
              </span>
            </>
          )}
          {(r.status === 'APPROVED' || r.status === 'REJECTED' || r.status === 'FIRST_PASSED') && (
            <span style={{ color: T.ink3, fontSize: 13 }}>{t('qual.noAction', '—')}</span>
          )}
        </div>
      ),
    },
  ];

  const pendingTotal = rows.filter((r) => ['FIRST_PENDING', 'FINAL_PENDING'].includes(r.status)).length;

  return (
    <>
      <PageHead
        title={t('qual.title', '入驻审批')}
        sub={t('qual.sub', '用户资格升级隧道 · 初审 → 补资料 → 终审（终审通过即变更平台身份）')}
        chip="总台 · 运营监管"
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
        }}
      >
        <span>{t('qual.notice', '「入驻」会变更用户平台身份（USER → 服务商 / 代理商），仅总台可裁定；「加入团队」由各团队拥有者自行审批。')}</span>
      </div>
      <Panel
        title={t('qual.panelTitle', '入驻申请队列')}
        hint={
          <>
            {t('qual.pending', '待审')} <b style={{ color: T.accent }}>{pendingTotal}</b> {t('qual.unit', '条')} ·{' '}
            {t('qual.total', '累计')} <b>{rows.length}</b> {t('qual.unit', '条')}
          </>
        }
      >
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 16px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, color: T.ink3 }}>{t('qual.filterKind', '入驻层次')}</span>
          <Select
            size="small"
            style={{ width: 120 }}
            value={kindFilter || undefined}
            placeholder={t('qual.all', '全部')}
            onChange={(v) => setKindFilter(v ?? '')}
            allowClear
            options={[
              { value: 'provider', label: t('qual.kindProvider', '服务商') },
              { value: 'agent', label: t('qual.kindAgent', '代理商') },
            ]}
          />
          <span style={{ fontSize: 13, color: T.ink3 }}>{t('col.status', '状态')}</span>
          <Select
            size="small"
            style={{ width: 140 }}
            value={statusFilter || undefined}
            placeholder={t('qual.all', '全部')}
            onChange={(v) => setStatusFilter(v ?? '')}
            allowClear
            options={Object.keys(STATUS_TEXT).map((s) => ({ value: s, label: STATUS_TEXT[s] }))}
          />
          <Button size="small" onClick={openQuality} style={{ marginLeft: 'auto' }}>
            {t('qual.firstReviewQuality', '一审质量')}
          </Button>
          <span style={{ fontSize: 12.5, color: T.ink3 }}>
            {t('qual.historyTip', '点击行可查看完整材料与驳回原因')}
          </span>
        </div>
        <DataTable<any>
          rowKey="id"
          dataSource={rows}
          loading={loading}
          scroll={{ x: 1300 }}
          columns={columns}
          onRow={(r: any) => ({ onClick: () => openDetail(r), style: { cursor: 'pointer' } })}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '10px 16px' }}>
          <Button onClick={reload}>{t('button.refresh', '刷新')}</Button>
        </div>
      </Panel>

      {/* ── 申请详情抽屉：材料 / 审核意见 / 风险预检 ── */}
      <Drawer
        width={620}
        open={!!detail}
        onClose={() => setDetail(null)}
        title={t('qual.detailTitle', '入驻申请详情')}
      >
        {detail && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label={t('qual.colApplicant', '申请人')}>
                {detail.user?.realName || detail.user?.nickname || '—'}（{detail.user?.phone ?? '—'}）
              </Descriptions.Item>
              <Descriptions.Item label={t('qual.colKind', '入驻层次')}>
                {detail.kind === 'agent' ? '代理商' : '服务商'}
              </Descriptions.Item>
              <Descriptions.Item label={t('qual.colRegion', '区域')}>{detail.regionLabel ?? '—'}</Descriptions.Item>
              <Descriptions.Item label={t('qual.colStatus', '状态')}>{statusPill(detail.status)}</Descriptions.Item>
              <Descriptions.Item label={t('qual.dAppliedName', '申请人姓名')}>
                {detail.applicantName ?? '—'}
              </Descriptions.Item>
              <Descriptions.Item label={t('qual.dPhone', '联系手机')}>{detail.phone ?? '—'}</Descriptions.Item>
              <Descriptions.Item label={t('qual.dCert', '证件')}>
                {detail.certType ?? '—'} · {detail.certNo ?? '—'}
              </Descriptions.Item>
              <Descriptions.Item label={t('qual.dCertExpire', '证件有效期')}>
                {detail.certLongTerm ? t('qual.longTerm', '长期有效') : detail.certExpire ?? '—'}
              </Descriptions.Item>
              <Descriptions.Item label={t('qual.dIssuer', '发证机关')}>{detail.issuer ?? '—'}</Descriptions.Item>
              <Descriptions.Item label={t('qual.dAttachments', '资质附件')}>
                {(detail.attachments ?? []).length ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {(detail.attachments ?? []).map((a: string, i: number) => (
                      <a key={i} href={a} target="_blank" rel="noreferrer" style={{ fontSize: 12.5 }}>
                        {a}
                      </a>
                    ))}
                  </div>
                ) : (
                  '—'
                )}
              </Descriptions.Item>
              <Descriptions.Item label={t('qual.dFirstReview', '代理商一审')}>
                {detail.firstReviewerName ?? '—'} · {fmtTime(detail.firstReviewedAt)}
              </Descriptions.Item>
              <Descriptions.Item label={t('qual.dFinalReview', '总台终审')}>
                {detail.finalReviewerName ?? '—'} · {fmtTime(detail.finalReviewedAt)}
              </Descriptions.Item>
              <Descriptions.Item label={t('qual.dHistory', '历史被驳回 / 撤回')}>
                {detail.historyCount ?? 0} {t('qual.unit', '条')}
              </Descriptions.Item>
              <Descriptions.Item label={t('qual.dNotified', '结果通知')}>
                {detail.notifiedAt ? (
                  <Tag color="green">{`${t('qual.notified', '已通知')} · ${fmtTime(detail.notifiedAt)}`}</Tag>
                ) : (
                  t('qual.notNotified', '未通知')
                )}
              </Descriptions.Item>
            </Descriptions>

            {detail.reviewNote && (
              <div
                style={{
                  padding: '10px 12px',
                  borderRadius: 8,
                  background: 'rgba(192,43,51,0.08)',
                  color: '#8f1d24',
                  fontSize: 13,
                }}
              >
                <b>{t('qual.reviewNote', '审核意见')}：</b>
                {detail.reviewNote}
              </div>
            )}

            <div>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, color: T.ink2 }}>
                {t('qual.precheck', '风险预检')}
                <span style={{ fontWeight: 400, color: T.ink3, marginLeft: 6, fontSize: 12 }}>
                  {t('qual.precheckHint', '仅作标记，不自动放行；裁定权在审核人')}
                </span>
              </div>
              {!precheck ? (
                <span style={{ fontSize: 12.5, color: T.ink3 }}>{t('status.loading', '加载中…')}</span>
              ) : (precheck.items ?? []).length === 0 ? (
                <Tag color="green">{t('qual.precheckClean', '未发现风险项')}</Tag>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {(precheck.items ?? []).map((it: any) => (
                    <div key={it.code} style={{ fontSize: 12.5, color: LEVEL_COLOR[it.level] ?? T.ink2 }}>
                      <Tag color={it.level === 'HIGH' ? 'red' : it.level === 'MID' ? 'orange' : 'default'}>
                        {it.level}
                      </Tag>
                      {it.text}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Drawer>

      {/* ── 代理商一审质量（M6 逆向审计） ── */}
      <Drawer
        width={720}
        open={qualityOpen}
        onClose={() => setQualityOpen(false)}
        title={t('qual.qualityTitle', '代理商一审质量')}
      >
        <div style={{ fontSize: 12.5, color: T.ink3, marginBottom: 10 }}>
          {t('qual.qualityHint', '推翻率 = 一审通过但被总台终审驳回的占比；数值偏高说明该代理商把关失效，需总台介入复核。')}
        </div>
        <DataTable<any>
          rowKey="agentId"
          dataSource={quality}
          scroll={{ x: 660 }}
          columns={[
            { title: t('qual.qAgent', '代理商'), dataIndex: 'agentName', width: 140 },
            { title: t('qual.qRegion', '辖区'), dataIndex: 'regionPath', width: 160, render: (v: string) => v ?? '—' },
            { title: t('qual.qTotal', '一审量'), dataIndex: 'firstReviewed', width: 90 },
            { title: t('qual.qPassed', '通过'), dataIndex: 'passed', width: 80 },
            { title: t('qual.qRejected', '驳回'), dataIndex: 'rejected', width: 80 },
            {
              title: t('qual.qOverturned', '被推翻'),
              dataIndex: 'overturned',
              width: 90,
              render: (v: number, r: any) => (
                <span style={{ color: r.overturnRate >= 0.3 ? '#8f1d24' : undefined }}>{v}</span>
              ),
            },
            {
              title: t('qual.qRate', '推翻率'),
              dataIndex: 'overturnRate',
              width: 100,
              render: (v: number) => (
                <Tag color={v >= 0.3 ? 'red' : v > 0 ? 'orange' : 'green'}>{`${Math.round(v * 100)}%`}</Tag>
              ),
            },
            {
              title: t('qual.qAvg', '平均一审时长'),
              dataIndex: 'avgFirstReviewHours',
              width: 130,
              render: (v: number) => `${v} h`,
            },
          ]}
        />
      </Drawer>

      {/* ── 驳回原因弹窗（驳回必填，回传给申请人） ── */}
      <Modal
        open={rejectOpen}
        title={rejectTarget?.final ? t('qual.finalRejectReason', '终审驳回原因') : t('qual.firstRejectReason', '初审驳回原因')}
        okText={t('button.confirm', '确定')}
        cancelText={t('button.cancel', '取消')}
        okButtonProps={{ danger: true }}
        onOk={submitReject}
        onCancel={() => {
          setRejectOpen(false);
          setRejectTarget(null);
        }}
      >
        <div style={{ marginBottom: 8, fontSize: 13, color: T.ink3 }}>
          {t('qual.rejectReasonHint', '驳回原因会随站内回执发送给申请人，请填写具体整改要求')}
        </div>
        <Input.TextArea
          rows={4}
          maxLength={500}
          value={rejectNote}
          onChange={(e) => setRejectNote(e.target.value)}
          placeholder={t('qual.rejectReasonPlaceholder', '请填写驳回原因…')}
        />
      </Modal>
    </>
  );
};

export default QualificationReviewPage;
