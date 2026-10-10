import { useState } from 'react';
import { App as AntdApp, Button, Divider, Form, Input, Modal, Select, Switch, Tag } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useInvalidate } from '@refinedev/core';
import { GenericListPage } from '../components/GenericListPage';
import { T } from '../config/theme';
import { t } from '../i18n/t';
import { API_URL, authHeaders } from '../utility';

/**
 * 占位符管理（运营端 · 系统设置）。
 *
 * 数据来源：PlaceHolderRegistry 表（v2 占位符管理真相源）。
 *  - 列表      GET  /api/admin/placeholders[?type=&scope=&keyword=]
 *  - 新建      POST /api/admin/placeholders
 *  - 编辑      PATCH /api/admin/placeholders/:id
 *  - 删除      DELETE /api/admin/placeholders/:id （系统内置 legacy 不可删）
 *
 * 语义层：运营端独占写；编辑器只绑定、不创建。key 稳定 ASCII；标签/提示/默认值按 locale 存 JSONB。
 */

const TYPES = [
  { value: 'text', label: '文本' },
  { value: 'image', label: '图像' },
  { value: 'datetime', label: '日期时间' },
  { value: 'address', label: '地址' },
];

const SCOPES = [
  { value: 'record', label: '名单字段（从每条记录取数）' },
  { value: 'batch', label: '批次常量（生成期一次性填写）' },
];

const STATUSES = [
  { value: 'visible', label: '可见' },
  { value: 'hidden', label: '隐藏' },
];

interface PlaceholderRow {
  id?: string;
  key?: string;
  type?: string;
  scope?: string;
  requiredDef?: boolean;
  status?: string;
  /** 单语言标签（管理员按当前语言录入） */
  label?: string;
  hint?: string;
  defaultValue?: string;
  legacy?: boolean;
}

/** 标签：单语言内容，回落 key */
const labelOf = (rec?: PlaceholderRow): string => rec?.label || rec?.key || '—';

const typeLabel = (v?: string) => TYPES.find((x) => x.value === v)?.label ?? v ?? '—';
const scopeLabel = (v?: string) => SCOPES.find((x) => x.value === v)?.label ?? v ?? '—';

export const PlaceholderRegistryAdmin = () => {
  const { message, modal } = AntdApp.useApp();
  const invalidate = useInvalidate();
  const [form] = Form.useForm();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PlaceholderRow | null>(null);
  const [saving, setSaving] = useState(false);

  const refresh = () =>
    invalidate({ resource: 'admin/placeholders', invalidates: ['list'] });

  const openCreate = () => {
    setEditing(null);
    form.setFieldsValue({
      key: '',
      type: 'text',
      scope: 'batch',
      requiredDef: false,
      status: 'visible',
      label: '',
      hint: '',
      defaultValue: '',
    });
    setOpen(true);
  };

  const openEdit = (rec: PlaceholderRow) => {
    setEditing(rec);
    form.setFieldsValue({
      key: rec.key,
      type: rec.type ?? 'text',
      scope: rec.scope ?? 'batch',
      requiredDef: !!rec.requiredDef,
      status: rec.status ?? 'visible',
      label: rec.label ?? '',
      hint: rec.hint ?? '',
      defaultValue: rec.defaultValue ?? '',
    });
    setOpen(true);
  };

  const submit = async () => {
    const v = await form.validateFields();
    const payload: Record<string, any> = {
      type: v.type,
      scope: v.scope,
      requiredDef: !!v.requiredDef,
      status: v.status,
      label: v.label ?? '',
      hint: v.hint ?? '',
      defaultValue: v.defaultValue ?? '',
    };
    if (!editing) payload.key = String(v.key ?? '').trim();

    setSaving(true);
    try {
      const url = editing
        ? `${API_URL}/admin/placeholders/${editing.id}`
        : `${API_URL}/admin/placeholders`;
      const res = await fetch(url, {
        method: editing ? 'PATCH' : 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e?.message || `HTTP ${res.status}`);
      }
      message.success(editing ? '已保存' : '已创建');
      setOpen(false);
      refresh();
    } catch (e: any) {
      message.error(e?.message || '操作失败，请确认已用管理员账号登录');
    } finally {
      setSaving(false);
    }
  };

  const askDelete = (rec: PlaceholderRow) => {
    if (rec.legacy) {
      message.warning('系统内置占位符不可删除');
      return;
    }
    modal.confirm({
      title: '删除占位符',
      content: `确定删除「${labelOf(rec)}」(${rec.key})？删除后已绑定该占位符的模板在生成时按兜底值处理。`,
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        try {
          const res = await fetch(`${API_URL}/admin/placeholders/${rec.id}`, {
            method: 'DELETE',
            headers: authHeaders(),
          });
          if (!res.ok) {
            const e = await res.json().catch(() => ({}));
            throw new Error(e?.message || `HTTP ${res.status}`);
          }
          message.success('已删除');
          refresh();
        } catch (e: any) {
          message.error(e?.message || '删除失败');
        }
      },
    });
  };

  const phType = Form.useWatch('type', form);

  return (
    <>
      <GenericListPage
        title={t('menu.admin.placeholders', '占位符管理')}
        sub={t('placeholders.sub', {
          defaultValue:
            '运营端独占配置真相源：新建占位符只在此完成，编辑器仅可绑定已注册项。key 为稳定 ASCII；标签/提示/默认值按当前语言录入单一内容，界面框架文案由系统 i18n 统一多语言。',
        })}
        chip="总台 · 系统设置"
        resource="admin/placeholders"
        rowKey="id"
        pageSize={20}
        searchable
        searchField="key"
        searchPlaceholder="搜索变量名 / 标签…"
        toolbarExtra={() => (
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            新建占位符
          </Button>
        )}
        rowActions={(rec: PlaceholderRow) => (
          <>
            <span
              onClick={() => openEdit(rec)}
              style={{ color: T.accent, cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap' }}
            >
              编辑
            </span>
            <span
              onClick={() => askDelete(rec)}
              style={{
                color: rec.legacy ? T.ink3 : '#d4380d',
                cursor: rec.legacy ? 'not-allowed' : 'pointer',
                fontSize: 13,
                marginLeft: 12,
              }}
            >
              删除
            </span>
          </>
        )}
        columns={[
          {
            title: '变量名 (key)',
            dataIndex: 'key',
            width: 170,
            render: (v: string) => <code style={{ fontFamily: T.fontNum, color: T.ink1 }}>{v}</code>,
          },
          {
            title: t('placeholders.colLabel', { defaultValue: '标签' }),
            dataIndex: 'label',
            width: 200,
            ellipsis: true,
            render: (v: string, rec: PlaceholderRow) => (
              <span style={{ color: T.ink1 }}>{labelOf(rec)}</span>
            ),
          },
          {
            title: '类型',
            dataIndex: 'type',
            width: 96,
            render: (v: string) => <Tag>{typeLabel(v)}</Tag>,
          },
          {
            title: '作用域',
            dataIndex: 'scope',
            width: 130,
            render: (v: string) => <span style={{ color: T.ink2, fontSize: 13 }}>{scopeLabel(v)}</span>,
          },
          {
            title: '必填',
            dataIndex: 'requiredDef',
            width: 72,
            align: 'center',
            render: (v: boolean) => (v ? <Tag color="red">必填</Tag> : <span style={{ color: T.ink3 }}>—</span>),
          },
          {
            title: '状态',
            dataIndex: 'status',
            width: 84,
            align: 'center',
            render: (v: string) =>
              v === 'hidden' ? <Tag>隐藏</Tag> : <Tag color="green">可见</Tag>,
          },
        ]}
      />

      <Modal
        open={open}
        title={editing ? '编辑占位符' : '新建占位符'}
        onCancel={() => setOpen(false)}
        onOk={submit}
        confirmLoading={saving}
        okText="保存"
        cancelText="取消"
        width={760}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 8 }}>
          <Form.Item
            label="变量名 (key)"
            name="key"
            tooltip="ASCII 字母/数字/下划线，以字母开头；创建后不可修改，绑定到模板的底层 binding.key 即此值"
            rules={[
              { required: true, message: '请输入变量名' },
              { pattern: /^[a-zA-Z][a-zA-Z0-9_]*$/, message: '须为 ASCII 字母/数字/下划线，且以字母开头' },
            ]}
          >
            <Input disabled={!!editing} placeholder="如 groom / weddingDate / weddingImg1" />
          </Form.Item>

          <div style={{ display: 'flex', gap: 16 }}>
            <Form.Item label="类型" name="type" rules={[{ required: true }]} style={{ flex: 1 }}>
              <Select options={TYPES} />
            </Form.Item>
            <Form.Item label="作用域" name="scope" rules={[{ required: true }]} style={{ flex: 1 }}>
              <Select options={SCOPES} />
            </Form.Item>
          </div>

          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <Form.Item label="默认必填" name="requiredDef" valuePropName="checked" style={{ marginBottom: 0 }}>
              <Switch />
            </Form.Item>
            <Form.Item label="状态" name="status" rules={[{ required: true }]} style={{ flex: 1, marginBottom: 0 }}>
              <Select options={STATUSES} />
            </Form.Item>
          </div>

          <Divider orientation="left" style={{ marginTop: 20 }}>
            {t('placeholders.labelSection', { defaultValue: '标签' })}
          </Divider>
          <Form.Item
            label={t('placeholders.label', { defaultValue: '标签' })}
            name="label"
            tooltip={t('placeholders.labelTip', {
              defaultValue: '在当前语言环境下录入的单语言标签，编辑器绑定下拉直接展示此值',
            })}
            style={{ marginBottom: 12 }}
            rules={[{ required: true, message: t('placeholders.labelRequired', { defaultValue: '请输入标签' }) }]}
          >
            <Input placeholder={t('placeholders.labelPh', { defaultValue: '如：新郎 / 姓名 / 婚礼日期' })} />
          </Form.Item>

          <Divider orientation="left">
            {t('placeholders.hintSection', { defaultValue: '编辑提示（可选）' })}
          </Divider>
          <Form.Item
            label={t('placeholders.hint', { defaultValue: '编辑提示' })}
            name="hint"
            style={{ marginBottom: 12 }}
          >
            <Input placeholder={t('placeholders.hintPh', { defaultValue: '编辑时的占位说明' })} />
          </Form.Item>

          <Divider orientation="left">
            {t('placeholders.defaultSection', { defaultValue: '默认值（可选）' })}
          </Divider>
          <Form.Item
            label={t('placeholders.defaultValue', { defaultValue: '默认值' })}
            name="defaultValue"
            style={{ marginBottom: 12 }}
          >
            <Input
              placeholder={
                phType === 'datetime'
                  ? t('placeholders.defaultPhDatetime', { defaultValue: 'YYYY年MM月DD日 HH:mm' })
                  : phType === 'address'
                    ? t('placeholders.defaultPhAddress', { defaultValue: '{province}{city}{detail}' })
                    : phType === 'image'
                      ? t('placeholders.defaultPhImage', { defaultValue: '图库图片资源 key' })
                      : t('placeholders.defaultPhText', { defaultValue: '留空则按兜底值处理' })
              }
            />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default PlaceholderRegistryAdmin;
