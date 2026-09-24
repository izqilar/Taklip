/**
 * 红线词库管理（总台 ADMIN）—— 决策点 8「红线词库 DB 可配置（总台可维护）」的落地界面。
 *
 * 后端：GET/POST/PATCH/DELETE  /api/console/redline-words（ADMIN）；
 *       GET /api/console/redline-categories；POST /api/console/redline-words/reload。
 * 作用：总台在此维护红线词（增删改 + 启停），并一键刷新机审内存词库，
 *       使服务/模板发布时的红线机审即时生效，避免硬编码、不可运营。
 */
import { useCallback, useEffect, useState } from 'react';
import { Button, Modal, Form, Input, Select, Switch, Tag, Popconfirm, message, Space, Typography } from 'antd';
import { PageHead } from '../components/ui/PageHead';
import { Panel } from '../components/ui/Panel';
import { T } from '../config/theme';
import { t } from '../i18n/t';
import { dataProvider } from '../providers/dataProvider';

const { Text } = Typography;

interface RedlineWordRow {
  id: string;
  word: string;
  category: string;
  enabled: boolean;
}
interface RedlineCategory {
  key: string;
  label: string;
}

export const RedlineWordAdmin = () => {
  const [rows, setRows] = useState<RedlineWordRow[]>([]);
  const [cats, setCats] = useState<RedlineCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [catLoading, setCatLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<RedlineWordRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  const loadCats = useCallback(async () => {
    setCatLoading(true);
    try {
      const { data } = await dataProvider.custom!({ url: 'console/redline-categories', method: 'get' });
      setCats(Array.isArray(data) ? data : []);
    } catch (e) {
      message.error(t('pages.redlineAdmin.loadCatFail', '红线类别加载失败'));
    } finally {
      setCatLoading(false);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await dataProvider.custom!({ url: 'console/redline-words', method: 'get' });
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      message.error(t('pages.redlineAdmin.loadFail', '红线词库加载失败'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCats();
    load();
  }, [loadCats, load]);

  const catLabel = (key: string) => cats.find((c) => c.key === key)?.label ?? key;

  const openAdd = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ enabled: true, category: cats[0]?.key });
    setModalOpen(true);
  };

  const openEdit = (row: RedlineWordRow) => {
    setEditing(row);
    form.resetFields();
    form.setFieldsValue({ word: row.word, category: row.category, enabled: row.enabled });
    setModalOpen(true);
  };

  const save = async () => {
    const v = await form.validateFields();
    setSaving(true);
    try {
      if (editing) {
        await dataProvider.custom!({
          url: `console/redline-words/${editing.id}`,
          method: 'patch',
          payload: v,
        });
        message.success(t('pages.redlineAdmin.updated', '已更新'));
      } else {
        await dataProvider.custom!({ url: 'console/redline-words', method: 'post', payload: v });
        message.success(t('pages.redlineAdmin.created', '已新增'));
      }
      setModalOpen(false);
      await load();
    } catch (e: any) {
      message.error(e?.message || t('pages.redlineAdmin.saveFail', '保存失败'));
    } finally {
      setSaving(false);
    }
  };

  const toggleEnabled = async (row: RedlineWordRow, enabled: boolean) => {
    try {
      await dataProvider.custom!({
        url: `console/redline-words/${row.id}`,
        method: 'patch',
        payload: { enabled },
      });
      message.success(enabled ? t('pages.redlineAdmin.enabled', '已启用') : t('pages.redlineAdmin.disabled', '已停用'));
      await load();
    } catch (e) {
      message.error(t('pages.redlineAdmin.toggleFail', '状态切换失败'));
    }
  };

  const remove = async (id: string) => {
    try {
      await dataProvider.custom!({ url: `console/redline-words/${id}`, method: 'delete' });
      message.success(t('pages.redlineAdmin.deleted', '已删除'));
      await load();
    } catch (e) {
      message.error(t('pages.redlineAdmin.deleteFail', '删除失败'));
    }
  };

  const reloadCache = async () => {
    try {
      const { data } = await dataProvider.custom!({ url: 'console/redline-words/reload', method: 'post' });
      message.success(
        `${t('pages.redlineAdmin.reloaded', '机审词库已刷新')}（${t('pages.redlineAdmin.activeCount', '生效词数')}: ${data?.activeCount ?? 0}）`,
      );
    } catch (e) {
      message.error(t('pages.redlineAdmin.reloadFail', '刷新失败'));
    }
  };

  return (
    <div style={{ padding: '20px 24px', maxWidth: 1040, margin: '0 auto' }}>
      <PageHead
        title={t('pages.redlineAdmin.title', '红线词库管理')}
        sub={t('pages.redlineAdmin.desc', '维护内容审核红线词（增删改 / 启停），并一键刷新机审词库，使服务与模板发布时的红线机审即时生效。')}
      />
      <Panel>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <Text type="secondary" style={{ fontSize: 13 }}>
            {t('pages.redlineAdmin.total', '共')} {rows.length} {t('pages.redlineAdmin.items', '条')}
          </Text>
          <Space>
            <Button onClick={reloadCache}>{t('pages.redlineAdmin.reload', '刷新机审词库')}</Button>
            <Button type="primary" onClick={openAdd} loading={catLoading}>
              + {t('pages.redlineAdmin.add', '新增红线词')}
            </Button>
          </Space>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: 'left', color: T.ink3, borderBottom: `1px solid ${T.border}` }}>
              <th style={{ padding: '8px 10px' }}>{t('pages.redlineAdmin.word', '敏感词')}</th>
              <th style={{ padding: '8px 10px' }}>{t('pages.redlineAdmin.category', '红线类别')}</th>
              <th style={{ padding: '8px 10px' }}>{t('pages.redlineAdmin.enabled', '状态')}</th>
              <th style={{ padding: '8px 10px', textAlign: 'right' }}>{t('pages.redlineAdmin.actions', '操作')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} style={{ borderBottom: `1px solid ${T.border}` }}>
                <td style={{ padding: '8px 10px', color: T.ink1, fontWeight: 600 }}>{r.word}</td>
                <td style={{ padding: '8px 10px' }}>
                  <Tag color="red" style={{ marginInlineEnd: 0 }}>
                    {catLabel(r.category)}
                  </Tag>
                </td>
                <td style={{ padding: '8px 10px' }}>
                  <Switch
                    size="small"
                    checked={r.enabled}
                    onChange={(val) => toggleEnabled(r, val)}
                  />
                </td>
                <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                  <Space size={4}>
                    <span
                      onClick={() => openEdit(r)}
                      style={{ color: T.accent, cursor: 'pointer', fontSize: 13 }}
                    >
                      {t('pages.redlineAdmin.edit', '编辑')}
                    </span>
                    <Popconfirm
                      title={t('pages.redlineAdmin.deleteConfirm', '确认删除该红线词？')}
                      onConfirm={() => remove(r.id)}
                      okText={t('common.ok', '确定')}
                      cancelText={t('common.cancel', '取消')}
                    >
                      <span style={{ color: '#c02b33', cursor: 'pointer', fontSize: 13 }}>
                        {t('pages.redlineAdmin.delete', '删除')}
                      </span>
                    </Popconfirm>
                  </Space>
                </td>
              </tr>
            ))}
            {rows.length === 0 && !loading && (
              <tr>
                <td colSpan={4} style={{ padding: '24px 10px', textAlign: 'center', color: T.ink3 }}>
                  {t('pages.redlineAdmin.empty', '暂无红线词，点击右上角新增')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {loading && (
          <div style={{ padding: '24px 10px', textAlign: 'center', color: T.ink3 }}>
            {t('pages.redlineAdmin.loading', '加载中…')}
          </div>
        )}
      </Panel>

      <Modal
        open={modalOpen}
        title={editing ? t('pages.redlineAdmin.editTitle', '编辑红线词') : t('pages.redlineAdmin.addTitle', '新增红线词')}
        onCancel={() => setModalOpen(false)}
        onOk={save}
        confirmLoading={saving}
        okText={t('common.ok', '确定')}
        cancelText={t('common.cancel', '取消')}
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item
            name="word"
            label={t('pages.redlineAdmin.word', '敏感词')}
            rules={[{ required: true, message: t('pages.redlineAdmin.wordRequired', '请输入敏感词') }]}
          >
            <Input placeholder={t('pages.redlineAdmin.wordPlaceholder', '如：违规示例词')} maxLength={60} />
          </Form.Item>
          <Form.Item
            name="category"
            label={t('pages.redlineAdmin.category', '红线类别')}
            rules={[{ required: true, message: t('pages.redlineAdmin.categoryRequired', '请选择红线类别') }]}
          >
            <Select
              loading={catLoading}
              options={cats.map((c) => ({ value: c.key, label: c.label }))}
              placeholder={t('pages.redlineAdmin.categoryPlaceholder', '选择红线类别')}
            />
          </Form.Item>
          <Form.Item name="enabled" label={t('pages.redlineAdmin.enabled', '状态')} valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
