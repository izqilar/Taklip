/**
 * 入驻审核详情（总台 ADMIN）—— 从「消息中心 · 入驻终审待办」直达的整页。
 *
 * 设计（对应需求2）：
 *  · 默认 / ?mode=view —— 只读展示待审核内容；
 *  · ?mode=review 或直接点「审核」—— 部分需纠正字段变为可编辑 + 填写修改意见，
 *    点「审核通过」结束终审流程（可顺带纠正申请方材料笔误），点「驳回」须填原因。
 *
 * 数据：GET /api/admin/qualifications/:id（详情）；GET /api/admin/qualifications/:id/precheck（风险预检）；
 * 审核：POST /api/user/qualifications/:id/review（final pass + 可选 corrections）。
 */
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Button, Descriptions, Input, Modal, Select, Tag, message as antdMessage } from 'antd';
import { PageHead } from '../components/ui/PageHead';
import { Panel } from '../components/ui/Panel';
import { T } from '../config/theme';
import { useLayer } from '../providers/layerContext';
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

const CERT_TEXT: Record<string, string> = {
  ID_CARD: '身份证',
  BUSINESS_LICENSE: '营业执照',
  OTHER: '其它',
};

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

export const QualificationDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { readonly } = useLayer();
  const initialMode = params.get('mode') === 'review' ? 'review' : 'view';

  const [loading, setLoading] = useState(true);
  const [app, setApp] = useState<any | null>(null);
  const [precheck, setPrecheck] = useState<any | null>(null);
  const [editing, setEditing] = useState(!readonly && initialMode === 'review');
  const [acting, setActing] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectNote, setRejectNote] = useState('');

  // 可编辑的纠正字段（仅审核模式下可改）
  const [fApplicantName, setFApplicantName] = useState('');
  const [fPhone, setFPhone] = useState('');
  const [fCertType, setFCertType] = useState('ID_CARD');
  const [fCertNo, setFCertNo] = useState('');
  const [fCertExpire, setFCertExpire] = useState('');
  const [fCertLongTerm, setFCertLongTerm] = useState(false);
  const [fIssuer, setFIssuer] = useState('');
  const [opinion, setOpinion] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const r: any = await dataProvider.custom!({ url: `admin/qualifications/${id}`, method: 'get' });
      const a = r?.data ?? null;
      setApp(a);
      // 初始化可编辑字段
      setFApplicantName(a?.applicantName ?? '');
      setFPhone(a?.phone ?? '');
      setFCertType(a?.certType ?? 'ID_CARD');
      setFCertNo(a?.certNo ?? '');
      setFCertExpire(a?.certExpire ?? '');
      setFCertLongTerm(!!a?.certLongTerm);
      setFIssuer(a?.issuer ?? '');
      const pc: any = await dataProvider.custom!({ url: `admin/qualifications/${id}/precheck`, method: 'get' });
      setPrecheck(pc?.data ?? null);
    } catch (e: any) {
      antdMessage.error(e?.message || t('qual.loadFailed', '加载失败'));
      setApp(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const startReview = () => {
    if (readonly) return;
    setEditing(true);
  };

  const review = async (pass: boolean) => {
    if (!id || !app) return;
    setActing(true);
    try {
      const payload: any = { pass, final: true };
      if (pass) {
        payload.note = opinion.trim() || null;
        // 仅在确有改动时附带 corrections，避免无意义覆盖
        const corrections: any = {};
        if (fApplicantName.trim() !== (app.applicantName ?? '')) corrections.applicantName = fApplicantName;
        if (fPhone.trim() !== (app.phone ?? '')) corrections.phone = fPhone;
        if (fCertType !== (app.certType ?? 'ID_CARD')) corrections.certType = fCertType;
        if (fCertNo.trim() !== (app.certNo ?? '')) corrections.certNo = fCertNo;
        if (fCertLongTerm !== !!app.certLongTerm) corrections.certLongTerm = fCertLongTerm;
        if (fCertExpire !== (app.certExpire ?? '')) corrections.certExpire = fCertExpire;
        if (fIssuer.trim() !== (app.issuer ?? '')) corrections.issuer = fIssuer;
        if (Object.keys(corrections).length) payload.corrections = corrections;
      } else {
        payload.note = rejectNote.trim() || null;
        if (!payload.note) {
          antdMessage.warning(t('qual.rejectReasonRequired', '请填写驳回原因'));
          setActing(false);
          return;
        }
      }
      await dataProvider.custom!({
        url: `user/qualifications/${id}/review`,
        method: 'post',
        payload,
      });
      antdMessage.success(pass ? t('qual.finalPassed', '终审通过，申请人身份已升级') : t('qual.finalRejected', '终审已驳回'));
      setRejectOpen(false);
      setRejectNote('');
      await load();
      setEditing(false);
      setOpinion('');
    } catch (e: any) {
      antdMessage.error(e?.message || t('qual.reviewFailed', '审核失败'));
    } finally {
      setActing(false);
    }
  };

  const openReject = () => {
    setRejectNote('');
    setRejectOpen(true);
  };

  const CERT_OPTS = [
    { value: 'ID_CARD', label: CERT_TEXT.ID_CARD },
    { value: 'BUSINESS_LICENSE', label: CERT_TEXT.BUSINESS_LICENSE },
    { value: 'OTHER', label: CERT_TEXT.OTHER },
  ];

  const labelStyle = { fontSize: 13, color: T.ink3 } as const;
  const editable = editing && !readonly;

  return (
    <>
      <PageHead
        title={t('qual.detailTitle', '入驻申请详情')}
        sub={t('qual.sub', '用户资格升级隧道 · 终审裁定')}
        chip="总台 · 运营监管"
        onBack={() => navigate('/admin/messages')}
        extra={
          !editing && app && ['FINAL_PENDING'].includes(app.status) && !readonly ? (
            <button
              type="button"
              onClick={startReview}
              style={{
                border: `1px solid ${T.accent}`,
                borderRadius: T.rSm,
                padding: '6px 14px',
                background: T.accent,
                color: T.onAccent,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {t('qual.review', '审核')}
            </button>
          ) : undefined
        }
      />

      {loading ? (
        <Panel title={t('qual.detailTitle', '入驻申请详情')}>
          <div style={{ padding: 20, color: T.ink3 }}>{t('status.loading', '加载中…')}</div>
        </Panel>
      ) : !app ? (
        <Panel title={t('qual.detailTitle', '入驻申请详情')}>
          <div style={{ padding: 20, color: T.ink3 }}>{t('qual.notFound', '申请不存在或无权查看')}</div>
        </Panel>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Panel title={t('qual.basic', '基本信息')}>
            <Descriptions column={2} size="small" bordered>
              <Descriptions.Item label={t('qual.colApplicant', '申请人')}>
                {app.user?.realName || app.user?.nickname || '—'}（{app.user?.phone ?? '—'}）
              </Descriptions.Item>
              <Descriptions.Item label={t('qual.colKind', '入驻层次')}>
                {app.kind === 'agent' ? '代理商' : '服务商'}
              </Descriptions.Item>
              <Descriptions.Item label={t('qual.colRegion', '区域')}>{app.regionLabel ?? '—'}</Descriptions.Item>
              <Descriptions.Item label={t('qual.colStatus', '状态')}>{statusPill(app.status)}</Descriptions.Item>
              <Descriptions.Item label={t('qual.colReason', '申请说明')} span={2}>
                {app.reason || '—'}
              </Descriptions.Item>
              <Descriptions.Item label={t('qual.dAppliedName', '申请人姓名')} span={2}>
                {editable ? (
                  <Input
                    value={fApplicantName}
                    onChange={(e) => setFApplicantName(e.target.value)}
                    style={{ maxWidth: 320 }}
                  />
                ) : (
                  app.applicantName ?? '—'
                )}
              </Descriptions.Item>
              <Descriptions.Item label={t('qual.dPhone', '联系手机')}>
                {editable ? (
                  <Input value={fPhone} onChange={(e) => setFPhone(e.target.value)} style={{ maxWidth: 220 }} />
                ) : (
                  app.phone ?? '—'
                )}
              </Descriptions.Item>
              <Descriptions.Item label={t('qual.dCert', '证件类型')}>
                {editable ? (
                  <Select value={fCertType} onChange={setFCertType} options={CERT_OPTS} style={{ width: 160 }} />
                ) : (
                  CERT_TEXT[app.certType as string] ?? app.certType ?? '—'
                )}
              </Descriptions.Item>
              <Descriptions.Item label={t('qual.dCertNo', '证件编号')}>
                {editable ? (
                  <Input value={fCertNo} onChange={(e) => setFCertNo(e.target.value)} style={{ maxWidth: 280 }} />
                ) : (
                  app.certNo ?? '—'
                )}
              </Descriptions.Item>
              <Descriptions.Item label={t('qual.dCertExpire', '证件有效期')}>
                {editable ? (
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <Input
                      type="date"
                      value={fCertExpire}
                      disabled={fCertLongTerm}
                      onChange={(e) => setFCertExpire(e.target.value)}
                      style={{ maxWidth: 200 }}
                    />
                    <label style={{ fontSize: 13, color: T.ink2 }}>
                      <input
                        type="checkbox"
                        checked={fCertLongTerm}
                        onChange={(e) => setFCertLongTerm(e.target.checked)}
                        style={{ marginRight: 4 }}
                      />
                      {t('qual.longTerm', '长期有效')}
                    </label>
                  </div>
                ) : app.certLongTerm ? (
                  t('qual.longTerm', '长期有效')
                ) : (
                  app.certExpire ?? '—'
                )}
              </Descriptions.Item>
              <Descriptions.Item label={t('qual.dIssuer', '发证机关')}>
                {editable ? (
                  <Input value={fIssuer} onChange={(e) => setFIssuer(e.target.value)} style={{ maxWidth: 280 }} />
                ) : (
                  app.issuer ?? '—'
                )}
              </Descriptions.Item>
              <Descriptions.Item label={t('qual.dAttachments', '资质附件')} span={2}>
                {(app.attachments ?? []).length ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {(app.attachments ?? []).map((a: string, i: number) => (
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
                {app.firstReviewerName ?? '—'} · {fmtTime(app.firstReviewedAt)}
              </Descriptions.Item>
              <Descriptions.Item label={t('qual.dFinalReview', '总台终审')}>
                {app.finalReviewerName ?? '—'} · {fmtTime(app.finalReviewedAt)}
              </Descriptions.Item>
              <Descriptions.Item label={t('qual.dHistory', '历史被驳回 / 撤回')}>
                {app.historyCount ?? 0} {t('qual.unit', '条')}
              </Descriptions.Item>
              <Descriptions.Item label={t('qual.dNotified', '结果通知')}>
                {app.notifiedAt ? (
                  <Tag color="green">{`${t('qual.notified', '已通知')} · ${fmtTime(app.notifiedAt)}`}</Tag>
                ) : (
                  t('qual.notNotified', '未通知')
                )}
              </Descriptions.Item>
            </Descriptions>
          </Panel>

          {app.reviewNote && (
            <Panel title={t('qual.reviewNote', '审核意见')}>
              <div
                style={{
                  padding: '10px 12px',
                  borderRadius: 8,
                  background: 'rgba(192,43,51,0.08)',
                  color: '#8f1d24',
                  fontSize: 13,
                }}
              >
                {app.reviewNote}
              </div>
            </Panel>
          )}

          <Panel title={t('qual.precheck', '风险预检')}>
            <div style={{ fontSize: 12.5, color: T.ink3, marginBottom: 8 }}>
              {t('qual.precheckHint', '仅作标记，不自动放行；裁定权在审核人')}
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
          </Panel>

          {editing && (
            <Panel title={t('qual.reviewOpinion', '审核意见 / 修改意见')}>
              <Input.TextArea
                rows={4}
                maxLength={500}
                value={opinion}
                onChange={(e) => setOpinion(e.target.value)}
                placeholder={t('qual.opinionPlaceholder', '可填写对申请人的整改要求或审核备注（可选）')}
              />
              <div
                style={{
                  display: 'flex',
                  gap: 10,
                  marginTop: 12,
                  justifyContent: 'flex-end',
                  position: 'sticky',
                  bottom: 0,
                  background: T.bg,
                  padding: '12px 0',
                  borderTop: `1px solid ${T.border}`,
                  zIndex: 5,
                }}
              >
                <Button onClick={() => setEditing(false)} disabled={acting}>
                  {t('button.cancel', '取消')}
                </Button>
                <Button danger onClick={openReject} disabled={acting}>
                  {t('qual.finalReject', '驳回')}
                </Button>
                <Button type="primary" onClick={() => review(true)} loading={acting}>
                  {t('qual.finalPass', '审核通过')}
                </Button>
              </div>
            </Panel>
          )}
        </div>
      )}

      <Modal
        open={rejectOpen}
        title={t('qual.finalRejectReason', '终审驳回原因')}
        okText={t('button.confirm', '确定')}
        cancelText={t('button.cancel', '取消')}
        okButtonProps={{ danger: true }}
        onOk={() => review(false)}
        confirmLoading={acting}
        onCancel={() => setRejectOpen(false)}
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

export default QualificationDetailPage;
