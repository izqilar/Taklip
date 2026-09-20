import {
  Form,
  Input,
  Button,
  Modal,
  Select,
  Tag,
  Typography,
  Space,
  message,
} from 'antd';
import { useCustomMutation } from '@refinedev/core';
import { useEffect, useState, type ReactNode } from 'react';
import { GenericListPage } from '../components/GenericListPage';
import { StatusTag } from '../components/common/StatusTag';
import { ReviewModal } from '../components/ui/ReviewModal';
import { RegionCascader } from '../components/RegionCascader';
import { dataProvider } from '../providers/dataProvider';
import { T } from '../config/theme';
import { serviceRolesText } from '../config/labels';
import { useLayer } from '../providers/layerContext';
import { t } from '../i18n/t';

const { Text } = Typography;

interface ProviderReviewRow {
  id: string;
  phone?: string;
  nickname?: string;
  realName?: string;
  serviceRoles?: string[];
  pendingServiceRoles?: string[];
  regionPath?: string | null;
  regionId?: string | null;
  /** 省/市/区 中文名称路径（如 新疆维吾尔自治区/乌鲁木齐市/新市区） */
  regionNamePath?: string | null;
  providerStatus?: string;
}

const rolesCell = (v?: string[], color = 'cyan'): ReactNode =>
  (v || []).length ? (
    <Space wrap size={4}>
      {v!.map((s) => (
        <Tag key={s} color={color} style={{ marginInlineEnd: 0 }}>
          {serviceRolesText([s])}
        </Tag>
      ))}
    </Space>
  ) : (
    <Text type="secondary">无</Text>
  );

/** 行操作链接（原型 .acts .l）：查看中性 / 审核绿 / 编辑中性，仅只读态置灰不可点 */
const actLink = (
  label: string,
  tone: 'ok' | 'dim' | 'plain',
  onClick: () => void,
  disabled?: boolean,
) => {
  const color = tone === 'ok' ? T.upInk : tone === 'dim' ? T.ink3 : T.ink2;
  return (
    <span
      onClick={disabled ? undefined : onClick}
      style={{
        fontSize: 13,
        cursor: disabled ? 'not-allowed' : 'pointer',
        color: disabled ? T.ink3 : color,
        opacity: disabled ? 0.55 : 1,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  );
};

/** 弹窗标题头（对齐 index.html .modal h3） */
const ModalHead = ({
  tag,
  title,
  onClose,
}: {
  tag: string;
  title: string;
  onClose: () => void;
}) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      fontSize: 16,
      fontWeight: 700,
      color: T.ink1,
    }}
  >
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: 22,
        padding: '0 8px',
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
        background: T.accentSoft,
        color: T.accent,
      }}
    >
      {tag}
    </span>
    <span>{title}</span>
    <span
      onClick={onClose}
      style={{ marginLeft: 'auto', color: T.ink3, cursor: 'pointer', fontSize: 14 }}
      role="button"
      aria-label="关闭"
    >
      ✕
    </span>
  </div>
);

/** 查看弹窗：kv 布局，只读（原型 .modal .kv）。辖区显示中文名称路径。 */
const ViewModal = ({
  open,
  row,
  onClose,
}: {
  open: boolean;
  row?: ProviderReviewRow;
  onClose: () => void;
}) => {
  if (!row) return null;
  const name = row.nickname || row.realName || row.phone || '—';
  const items = [
    { label: t('pages.col.applicant'), value: name },
    { label: t('pages.col.phone'), value: row.phone || '—' },
    { label: t('pages.col.approvedServices'), value: rolesCell(row.serviceRoles) },
    { label: t('pages.col.pendingServices'), value: rolesCell(row.pendingServiceRoles, 'gold') },
    // 辖区改用中文名称路径（如 新疆维吾尔自治区/乌鲁木齐市/新市区）
    { label: t('pages.field.jurisdiction'), value: row.regionNamePath || '未分配' },
    {
      label: t('pages.col.qualificationStatus'),
      value: <StatusTag value={row.providerStatus} />,
    },
  ];

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      closable={false}
      width={520}
      destroyOnHidden
      styles={{ content: { borderRadius: T.rLg, padding: 20, background: T.bg }, body: { padding: 0 } }}
      title={
        <ModalHead
          tag={t('pages.tag.provider')}
          title={t('pages.sec.providerDetail')}
          onClose={onClose}
        />
      }
    >
      <dl
        style={{
          display: 'grid',
          gridTemplateColumns: '86px 1fr',
          gap: '6px 12px',
          fontSize: 13,
          margin: '14px 0 0',
        }}
      >
        {items.map((it, idx) => (
          <div key={idx} style={{ display: 'contents' }}>
            <dt style={{ color: T.ink3 }}>{it.label}</dt>
            <dd style={{ color: T.ink1, fontWeight: 600, margin: 0 }}>{it.value}</dd>
          </div>
        ))}
      </dl>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 18 }}>
        <Button onClick={onClose}>{t('common.close')}</Button>
      </div>
    </Modal>
  );
};

const PROVIDER_STATUS_OPTIONS = [
  { label: 'status.PENDING', value: 'PENDING' },
  { label: 'status.APPROVED', value: 'APPROVED' },
  { label: 'status.REJECTED', value: 'REJECTED' },
];

/** 编辑弹窗（原型 .modal .fd）。可编辑姓名/辖区/资质状态 + 编辑理由（必填，留操作痕迹） */
const EditModal = ({
  open,
  row,
  onClose,
  onSaved,
}: {
  open: boolean;
  row?: ProviderReviewRow;
  onClose: () => void;
  onSaved: () => void;
}) => {
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !row) return;
    form.setFieldsValue({
      nickname: row.nickname,
      regionId: row.regionId ?? undefined,
      providerStatus: row.providerStatus,
      reason: '', // 每次重新打开都要求重新填写编辑理由
    });
  }, [open, row, form]);

  const save = async () => {
    if (!row) return;
    const values = (await form.validateFields().catch(() => null)) as
      | { nickname?: string; regionId?: string; providerStatus?: string; reason?: string }
      | null;
    if (!values) return;
    if (!values.regionId) {
      message.warning(t('pages.toast.selectRegion'));
      return;
    }
    if (!values.reason || !values.reason.trim()) {
      message.warning(t('pages.msg.requiredReason'));
      return;
    }
    setSaving(true);
    try {
      await dataProvider.custom!({
        url: `admin/provider-review/${row.id}`,
        method: 'patch',
        payload: values,
      });
      message.success(t('pages.toast.saveOk'));
      onSaved();
    } catch (e: any) {
      message.error(e?.message || t('pages.toast.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      closable={false}
      width={520}
      destroyOnHidden
      styles={{ content: { borderRadius: T.rLg, padding: 20, background: T.bg }, body: { padding: 0 } }}
      title={
        <ModalHead
          tag={t('pages.tag.provider')}
          title={t('pages.sec.providerDetail')}
          onClose={onClose}
        />
      }
    >
      <Form form={form} layout="vertical" style={{ marginTop: 14 }}>
        <Form.Item
          label={t('pages.col.providerName')}
          name="nickname"
          rules={[{ required: true, message: t('pages.msg.required') }]}
        >
          <Input placeholder={t('pages.col.providerName')} />
        </Form.Item>
        <Form.Item
          label={t('pages.field.bindRegion')}
          name="regionId"
          rules={[{ required: true, message: t('pages.toast.selectRegion') }]}
        >
          <RegionCascader />
        </Form.Item>
        <Form.Item
          label={t('pages.col.qualificationStatus')}
          name="providerStatus"
          rules={[{ required: true, message: t('pages.msg.required') }]}
        >
          <Select options={PROVIDER_STATUS_OPTIONS.map((o) => ({ ...o, label: t(o.label) }))} placeholder={t('pages.ph.pleaseSelect')} />
        </Form.Item>
        {/* 编辑理由：留操作痕迹，必填（管理员/代理商对服务商资料的任何改动都应留下文字说明） */}
        <Form.Item
          label={t('pages.field.editReason')}
          name="reason"
          rules={[
            { required: true, message: t('pages.msg.requiredReason') },
            { min: 2, message: t('pages.msg.requiredReason') },
          ]}
        >
          <Input.TextArea
            rows={3}
            maxLength={200}
            placeholder={t('pages.ph.editReasonPlaceholder')}
          />
        </Form.Item>
        {/* 资质相关的服务子集维持只读展示，避免误改；如需调整走「审核」流程 */}
        <div style={{ color: T.ink3, fontSize: 12.5, marginBottom: 8 }}>
          {t('pages.note.serviceRolesReadonly')}
        </div>
        <dl
          style={{
            display: 'grid',
            gridTemplateColumns: '86px 1fr',
            gap: '6px 12px',
            fontSize: 13,
          }}
        >
          <dt style={{ color: T.ink3 }}>{t('pages.col.approvedServices')}</dt>
          <dd style={{ margin: 0 }}>{rolesCell(row?.serviceRoles)}</dd>
          <dt style={{ color: T.ink3 }}>{t('pages.col.pendingServices')}</dt>
          <dd style={{ margin: 0 }}>{rolesCell(row?.pendingServiceRoles, 'gold')}</dd>
        </dl>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 18 }}>
          <Button type="primary" loading={saving} onClick={save}>
            {t('common.save')}
          </Button>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
        </div>
      </Form>
    </Modal>
  );
};

/**
 * 服务商资质审核队列（原型 总台 · 服务商管理）。
 * 行操作：
 *   查看 — 只读弹窗（中文辖区）
 *   审核 — 直接挂接原 通过/驳回 弹窗
 *   编辑 — 单独的可编辑弹窗（昵称/辖区/资质状态）
 * 通过 → 合并待审子角色进 serviceRoles；驳回 → 清空 pending（原因后端记录）。
 */
export const ProviderReviewList = () => {
  const { readonly } = useLayer();
  const { mutateAsync: approve } = useCustomMutation();
  const { mutateAsync: reject } = useCustomMutation();
  const [current, setCurrent] = useState<ProviderReviewRow | null>(null);
  const [mode, setMode] = useState<'view' | 'ok' | 'no' | 'edit'>('view');
  const [busy, setBusy] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);

  const open = (r: ProviderReviewRow, m: 'view' | 'ok' | 'no' | 'edit') => {
    setCurrent(r);
    setMode(m);
  };
  // 关闭必须同时重置 current 与 mode，并加 destroyOnHidden 真正从 DOM 卸载弹窗。
  // 仅清 current 会让 modal 仍按 mode === 'ok'/'no'/'edit' 维持 open 状态，
  // 但 fields / row 都已变 undefined，呈现"字段全消失、按钮全部无反应"的破窗状态。
  const close = () => {
    setCurrent(null);
    setMode('view');
  };

  const doApprove = async (opinion: string) => {
    if (!current) return;
    setBusy(true);
    try {
      await approve({
        url: `admin/provider-review/${current.id}/approve`,
        method: 'post',
        values: { note: opinion },
      });
      message.success(t('pages.enum.approvedReview'));
      setRefreshTick((t) => t + 1);
      close();
    } catch (e: any) {
      message.error(e?.response?.data?.message || e?.message || t('pages.toast.actionFailed'));
    } finally {
      setBusy(false);
    }
  };

  const doReject = async (reason: string) => {
    if (!current) return;
    setBusy(true);
    try {
      await reject({
        url: `admin/provider-review/${current.id}/reject`,
        method: 'post',
        values: { reason },
      });
      message.success(t('pages.enum.rejected'));
      setRefreshTick((t) => t + 1);
      close();
    } catch (e: any) {
      message.error(e?.response?.data?.message || e?.message || t('pages.toast.actionFailed'));
    } finally {
      setBusy(false);
    }
  };

  const onSaved = () => {
    setRefreshTick((t) => t + 1);
    close();
  };

  const name = current
    ? current.nickname || current.realName || current.phone || '—'
    : '—';

  return (
    <>
      <GenericListPage
        key={refreshTick}
        title={t('menu.admin.provider-review')}
        sub="入驻审核队列 · 总台统一把关"
        chip="总台 · 审核队列"
        resource="admin/provider-review"
        searchable
        searchField="nickname"
        searchPlaceholder="搜索昵称 / 手机号…"
        chipFilters={[
          { label: t('pages.enum.all'), value: 'all' },
          { label: t('status.PENDING'), value: 'PENDING', field: 'providerStatus' },
          { label: t('status.APPROVED'), value: 'APPROVED', field: 'providerStatus' },
          { label: t('status.REJECTED'), value: 'REJECTED', field: 'providerStatus' },
        ]}
        columns={[
          {
            title: t('pages.col.nickname'),
            dataIndex: 'nickname',
            width: 130,
            render: (v: string, r: ProviderReviewRow) => v || r.realName || '—',
          },
          { title: t('pages.col.phone'), dataIndex: 'phone', width: 140 },
          {
            title: t('pages.col.approvedServices'),
            dataIndex: 'serviceRoles',
            render: (v?: string[]) => rolesCell(v),
          },
          {
            title: t('pages.col.pendingServices'),
            dataIndex: 'pendingServiceRoles',
            render: (v?: string[]) => rolesCell(v, 'gold'),
          },
          {
            title: t('pages.field.jurisdiction'),
            dataIndex: 'regionNamePath',
            width: 180,
            render: (v: string) =>
              v ? <span style={{ color: T.ink1 }}>{v}</span> : <Text type="secondary">未分配</Text>,
          },
          {
            title: t('pages.col.qualificationStatus'),
            dataIndex: 'providerStatus',
            width: 100,
            render: (v: string) => <StatusTag value={v} />,
          },
        ]}
        rowActions={(r: ProviderReviewRow) => {
          // 「查看」「审核」「编辑」三个链接始终展示；运维管理员只读下「审核」「编辑」禁用。
          return (
            <>
              {actLink(t('common.view'), 'plain', () => open(r, 'view'))}
              {actLink(t('common.review'), 'ok', () => open(r, 'ok'), readonly)}
              {actLink(t('common.edit'), 'plain', () => open(r, 'edit'), readonly)}
            </>
          );
        }}
      />

      {/* 只读查看弹窗 */}
      <ViewModal open={mode === 'view' && current != null} row={current ?? undefined} onClose={close} />

      {/* 审核弹窗：复用原 通过/驳回 ReviewModal，辖区显示中文名称路径 */}
      <ReviewModal
        open={(mode === 'ok' || mode === 'no') && current != null}
        tag="审核"
        title="服务商入驻审核"
        readonly={readonly}
        loading={busy}
        onClose={close}
        opinion={mode !== 'view'}
        opinionRequired={mode === 'no'}
        approveText={mode === 'no' ? '确认驳回' : t('common.approve')}
        onApprove={mode === 'no' ? doReject : mode === 'ok' ? doApprove : undefined}
        onReject={mode === 'ok' ? doReject : undefined}
        fields={
          current
            ? [
                { label: t('pages.col.applicant'), value: name },
                { label: t('pages.col.phone'), value: current.phone || '—' },
                { label: t('pages.col.approvedServices'), value: rolesCell(current.serviceRoles) },
                {
                  label: t('pages.col.pendingServices'),
                  value: rolesCell(current.pendingServiceRoles, 'gold'),
                },
                // 辖区字段：中文名称路径
                { label: t('pages.field.jurisdiction'), value: current.regionNamePath || '未分配' },
                {
                  label: t('pages.col.qualificationStatus'),
                  value: <StatusTag value={current.providerStatus} />,
                },
              ]
            : []
        }
      />

      {/* 编辑弹窗：可改姓名/辖区/资质状态 + 编辑理由 */}
      <EditModal open={mode === 'edit' && current != null} row={current ?? undefined} onClose={close} onSaved={onSaved} />
    </>
  );
};

export default ProviderReviewList;