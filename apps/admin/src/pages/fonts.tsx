import { App as AntdApp, Button } from 'antd';
import { DeleteOutlined, ReloadOutlined } from '@ant-design/icons';
import { useCustomMutation } from '@refinedev/core';
import { GenericListPage } from '../components/GenericListPage';
import { Pill } from '../components/ui/Pill';
import { T } from '../config/theme';
import { t } from '../i18n/t';

/**
 * 字体管理（运营端 · 系统设置）。
 *
 * 数据来源即 UFont U 表（`apps/server/src/console/font.controller.ts`）：
 *  - 列表      GET  /api/admin/fonts?page=1&pageSize=20[&family=关键字][&isPaid=true|false]
 *  - 扫描目录  POST /api/admin/fonts/refresh           （ADMIN）
 *  - 清理失效  POST /api/admin/fonts/refresh?prune=1   （ADMIN）
 *
 * 说明：目前「上传字体」尚未提供后台入口（B 层待做），字体文件仍由运维放入
 * uploads/fonts/FreeFonts（免费）或 uploads/fonts/LicensedFonts（付费，
 * 目录名含 licen/paid/收费/商用/vip 即判定为付费），放完后点「扫描目录」即可入库，
 * 无需改 fonts.json —— 那只是可选元数据清单。
 */
export interface FontRow {
  id: string;
  family: string;
  displayName: string;
  files: Record<string, string> | null;
  isPaid: boolean;
  category?: string | null;
  sortOrder?: number;
  createdAt?: string;
}

/** POST /api/admin/fonts/refresh 的返回（用于结果弹窗展示本次扫描统计） */
type RefreshResult = Record<string, any>;

const fileList = (files: Record<string, string> | null | undefined): { text: string; title: string } => {
  if (!files || typeof files !== 'object') return { text: '—', title: '' };
  const entries = Object.entries(files).filter(([, v]) => !!v);
  if (!entries.length) return { text: '—', title: '' };
  return {
    text: entries.map(([k]) => k.toUpperCase()).join(' / '),
    title: entries.map(([, v]) => v).join('\n'),
  };
};

const dt = (v?: string) => (v ? new Date(v).toLocaleString('zh-CN', { hour12: false }) : '—');

export const FontAdminList = () => {
  const { modal, message } = AntdApp.useApp();
  const { mutate: postRefresh, isLoading } = useCustomMutation<RefreshResult>();

  /** 扫描 / 清理后统一处理：成功→弹统计并刷新列表；失败→错误提示 */
  const runRefresh = (prune: boolean, reload: () => void) => {
    const url = `admin/fonts/refresh${prune ? '?prune=1' : ''}`;
    postRefresh(
      { url, method: 'post', values: {}, successNotification: false, errorNotification: false },
      {
        onSuccess: (res) => {
          const r = (res?.data ?? {}) as RefreshResult;
          modal.success({
            title: prune ? '清理完成' : '扫描完成',
            content: (
              <div style={{ fontSize: 13, lineHeight: 1.9 }}>
                <div>
                  入库（ upsert ）：<b>{r.synced ?? 0}</b> 条 · 目录扫到：
                  <b>{r.scanned ?? 0}</b> 条
                </div>
                <div>
                  免费：<b>{r.free ?? 0}</b> · 付费：<b>{r.paid ?? 0}</b>
                  {r.pruned ? <span> · 清理失效：<b>{r.pruned}</b> 条</span> : null}
                </div>
                {Array.isArray(r.conflicts) && r.conflicts.length ? (
                  <div style={{ color: T.warnInk }}>
                    同名冲突（免费/付费目录各有一份，已保留先扫到的）：
                    {r.conflicts.join('、')}
                  </div>
                ) : null}
              </div>
            ),
          });
          reload();
        },
        onError: (err: any) => {
          message.error(err?.message ?? '刷新失败，请确认已用管理员账号登录');
        },
      },
    );
  };

  const confirmPrune = (reload: () => void) => {
    modal.confirm({
      title: '清理失效字体',
      content:
        '将删除「目录与 fonts.json 中都不存在」的历史记录。若你曾手动新增过指向远程 URL 的字体，也会被一并清理，确定继续？',
      okText: '确定清理',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: () => runRefresh(true, reload),
    });
  };

  return (
    <GenericListPage
      title={t('menu.admin.fonts', '字体管理')}
      sub="字体素材放 uploads/fonts/FreeFonts（免费）或 LicensedFonts（付费），放入后点「扫描目录」即可入库；付费字体在编辑器下拉中显示 🔒"
      chip="总台 · 系统设置"
      resource="admin/fonts"
      rowKey="id"
      pageSize={20}
      chipFilters={[
        { label: '全部', value: 'all' },
        { label: '免费', value: 'false', field: 'isPaid' },
        { label: '付费 🔒', value: 'true', field: 'isPaid' },
      ]}
      searchable
      searchField="family"
      searchServerField="family"
      searchPlaceholder="搜索家族名 / 显示名…"
      toolbarExtra={({ reload }) => (
        <>
          <Button icon={<ReloadOutlined />} loading={isLoading} onClick={() => runRefresh(false, reload)}>
            扫描目录
          </Button>
          <Button
            danger
            icon={<DeleteOutlined />}
            disabled={isLoading}
            onClick={() => confirmPrune(reload)}
          >
            清理失效
          </Button>
        </>
      )}
      columns={[
        {
          title: '字体家族',
          dataIndex: 'family',
          width: 220,
          render: (v: string) => (
            <span style={{ fontFamily: T.fontNum, color: T.ink1, wordBreak: 'break-all' }}>{v || '—'}</span>
          ),
        },
        {
          title: '显示名',
          dataIndex: 'displayName',
          width: 180,
          ellipsis: true,
        },
        {
          title: '授权',
          dataIndex: 'isPaid',
          width: 96,
          align: 'center',
          render: (v: boolean) =>
            v ? <Pill tone="warn">付费 🔒</Pill> : <Pill tone="ok">免费</Pill>,
        },
        {
          title: '分类',
          dataIndex: 'category',
          width: 120,
          render: (v?: string | null) => v || '—',
        },
        {
          title: '文件格式',
          dataIndex: 'files',
          width: 130,
          render: (v: Record<string, string> | null) => {
            const { text, title } = fileList(v);
            return (
              <span title={title} style={{ color: T.ink2 }}>
                {text}
              </span>
            );
          },
        },
        {
          title: '排序',
          dataIndex: 'sortOrder',
          width: 72,
          align: 'center',
          render: (v?: number) => <span style={{ fontFamily: T.fontNum }}>{v ?? '—'}</span>,
        },
        {
          title: '入库时间',
          dataIndex: 'createdAt',
          width: 168,
          render: (v?: string) => dt(v),
        },
      ]}
      detailTag="字体"
      detailTitle="字体详情"
      detailFields={[
        { label: '字体家族', dataIndex: 'family' },
        { label: '显示名', dataIndex: 'displayName' },
        { label: '授权', dataIndex: 'isPaid' },
        { label: '分类', dataIndex: 'category' },
        { label: '排序', dataIndex: 'sortOrder' },
        { label: '文件清单', dataIndex: 'files' },
        { label: '入库时间', dataIndex: 'createdAt', format: 'date' },
      ]}
    />
  );
};

export default FontAdminList;
