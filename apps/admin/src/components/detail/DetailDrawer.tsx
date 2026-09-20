import { useState, type ReactNode } from 'react';
import { Drawer, Descriptions, Button, Space, Form, Input, Select, Typography, Alert, Divider } from 'antd';
import { StatusTag } from '../common/StatusTag';
import { formatCents } from '../../utility';
import { PermCheckGroup } from './PermCheckGroup';
import { ReviewActions } from './ReviewActions';
import type { LayerKey } from '../../config/permGroups';
import { t } from "../../i18n/t";
import { T } from '../../config/theme';

const { Text } = Typography;

export type DetailMode = 'view' | 'review' | 'edit' | 'editOnly';

export interface DetailFieldDef {
  label: string;
  dataIndex: string | string[];
  /** 值格式化：金额(分)/日期/状态标签/原生节点 */
  format?: 'cents' | 'date' | 'status' | 'node';
  /** 自定义渲染（优先级高于 format） */
  render?: (value: any, record: any) => ReactNode;
}

export interface PermGroupConfig {
  layer: LayerKey;
  checkedKeys?: string[];
  disabled?: boolean;
  onChange?: (keys: string[]) => void;
}

export interface ReviewConfig {
  approveText?: string;
  rejectText?: string;
  requireReason?: boolean;
  loading?: boolean;
  onApprove?: (reason?: string) => Promise<void> | void;
  onReject?: (reason: string) => Promise<void> | void;
  extra?: ReactNode;
}

export interface EditFieldDef {
  name: string;
  label: string;
  type?: 'input' | 'textarea' | 'select';
  options?: { value: string; label: string }[];
  rules?: { required?: boolean; message?: string }[];
  disabled?: boolean;
}

export interface EditConfig {
  fields: EditFieldDef[];
  initialValues?: Record<string, any>;
  saving?: boolean;
  onSave?: (values: Record<string, any>) => Promise<void> | void;
}

export interface DetailDrawerProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  width?: number;
  /** A 仅查看 / B 查看+审核 / C 查看+编辑 / D 仅编辑（文档 §9.1） */
  mode: DetailMode;
  record?: any;
  fields?: DetailFieldDef[];
  /** 只读态：锁定写按钮（文档 §4.3） */
  readonly?: boolean;
  /** A 类角色页：权限复选框组（§9.2/§9.5） */
  permGroup?: PermGroupConfig;
  /** B 类审核动作 */
  review?: ReviewConfig;
  /** C/D 类编辑表单 */
  edit?: EditConfig;
  /** 页脚附加动作（任何模式均渲染在默认按钮之后，如反馈状态流转） */
  footerExtra?: ReactNode;
}

const getByPath = (obj: any, path: string | string[]): any => {
  const keys = Array.isArray(path) ? path : String(path).split('.');
  return keys.reduce((acc, k) => (acc == null ? acc : acc[k]), obj);
};
const dt = (v: any) => (v ? new Date(v).toLocaleString('zh-CN', { hour12: false }) : '—');

const renderField = (f: DetailFieldDef, record: any): ReactNode => {
  // 守卫：record 为 null 时（抽屉初始关闭态 / 记录未载入）立即返回占位，
  // 避免自定义 render 读取 record.xxx 抛错导致整页白屏（如 templates.author 字段）。
  if (record == null) return <Text type="secondary">—</Text>;
  const raw = getByPath(record, f.dataIndex);
  if (f.render) return f.render(raw, record);
  if (f.format === 'cents') return <Text strong style={{ color: T.accent }}>{formatCents(raw ?? 0)}</Text>;
  if (f.format === 'date') return dt(raw);
  if (f.format === 'status') return <StatusTag value={raw} />;
  if (f.format === 'node' && raw != null) return <>{raw}</>;
  if (raw == null || raw === '') return <Text type="secondary">—</Text>;
  if (Array.isArray(raw)) return raw.length ? raw.join('、') : <Text type="secondary">—</Text>;
  if (typeof raw === 'object') return <pre style={{ margin: 0 }}>{JSON.stringify(raw)}</pre>;
  return String(raw);
};

/**
 * 统一详情对话框（文档 §9）：A 仅查看 / B 查看+审核 / C 查看+编辑 / D 仅编辑。
 * - 状态字段统一走全局 StatusTag（§11.4），列表与对话框一致。
 * - 权限复选框组按层过滤回显（§5.4）。
 * - 审核驳回必填原因、编辑预填不空白（§9.5）。
 * - readonly 锁定全部写按钮，配合布局黄条。
 */
export const DetailDrawer = ({
  open,
  onClose,
  title,
  width = 480,
  mode,
  record,
  fields = [],
  readonly,
  permGroup,
  review,
  edit,
  footerExtra,
}: DetailDrawerProps) => {
  const [editing, setEditing] = useState(false);
  const [form] = Form.useForm();

  const close = () => {
    setEditing(false);
    onClose();
  };

  const renderDescriptions = (
    <Descriptions column={1} bordered size="small">
      {fields.map((f) => {
        const key = Array.isArray(f.dataIndex) ? f.dataIndex.join('.') : f.dataIndex;
        return (
          <Descriptions.Item label={f.label} key={key}>
            {renderField(f, record)}
          </Descriptions.Item>
        );
      })}
    </Descriptions>
  );

  const renderPermGroup = permGroup ? (
    <div style={{ marginTop: 16 }}>
      <Divider style={{ margin: '8px 0 12px' }} />
      <Text strong>{t('common.role')} · 功能权限（按层级过滤回显）</Text>
      <div style={{ marginTop: 10 }}>
        <PermCheckGroup
          layer={permGroup.layer}
          checkedKeys={permGroup.checkedKeys}
          disabled={permGroup.disabled ?? readonly}
          onChange={permGroup.onChange}
        />
      </div>
    </div>
  ) : null;

  // —— 编辑表单（C/D） ——
  const renderEditForm = edit ? (
    <Form
      form={form}
      layout="vertical"
      initialValues={edit.initialValues}
      onFinish={(values) => edit.onSave?.(values)}
    >
      {edit.fields.map((ef) => (
        <Form.Item
          key={ef.name}
          name={ef.name}
          label={ef.label}
          rules={ef.rules as any}
          initialValue={edit.initialValues?.[ef.name]}
        >
          {ef.type === 'textarea' ? (
            <Input.TextArea rows={4} maxLength={4000} disabled={ef.disabled} />
          ) : ef.type === 'select' ? (
            <Select options={ef.options} disabled={ef.disabled} />
          ) : (
            <Input disabled={ef.disabled} />
          )}
        </Form.Item>
      ))}
    </Form>
  ) : null;

  let body: ReactNode = null;
  let footer: ReactNode = null;

  if (mode === 'view') {
    body = (
      <>
        {renderDescriptions}
        {renderPermGroup}
      </>
    );
    footer = (
      <Space wrap>
        <Button onClick={close}>{t('common.close')}</Button>
        {footerExtra}
      </Space>
    );
  } else if (mode === 'review') {
    body = (
      <>
        {renderDescriptions}
        <Divider style={{ margin: '16px 0' }} />
        <ReviewActions
          approveText={review?.approveText}
          rejectText={review?.rejectText}
          requireReason={review?.requireReason}
          readonly={readonly}
          loading={review?.loading}
          onApprove={review?.onApprove}
          onReject={review?.onReject}
          extra={review?.extra}
        />
      </>
    );
    footer = (
      <Space wrap>
        <Button onClick={close}>{t('common.close')}</Button>
        {footerExtra}
      </Space>
    );
  } else if (mode === 'edit') {
    body = editing ? renderEditForm : renderDescriptions;
    footer = editing ? (
      <Space wrap>
        <Button type="primary" style={{ background: T.accent }} loading={edit?.saving} disabled={readonly} onClick={() => form.submit()}>
          {t('common.save')}
        </Button>
        <Button onClick={() => { setEditing(false); form.resetFields(); }}>{t('common.cancel')}</Button>
        {footerExtra}
      </Space>
    ) : (
      <Space wrap>
        <Button type="primary" style={{ background: T.accent }} disabled={readonly} onClick={() => setEditing(true)}>
          {t('common.edit')}
        </Button>
        <Button onClick={close}>{t('common.close')}</Button>
        {footerExtra}
      </Space>
    );
  } else {
    // editOnly (D)
    body = renderEditForm;
    footer = (
      <Space wrap>
        <Button type="primary" style={{ background: T.accent }} loading={edit?.saving} disabled={readonly} onClick={() => form.submit()}>
          {t('common.save')}
        </Button>
        <Button onClick={close}>{t('common.cancel')}</Button>
        {footerExtra}
      </Space>
    );
  }

  return (
    <Drawer title={title} width={width} open={open} onClose={close} footer={footer} destroyOnClose>
      {record ? body : <Text type="secondary">{t('common.empty')}</Text>}
    </Drawer>
  );
};

export default DetailDrawer;
