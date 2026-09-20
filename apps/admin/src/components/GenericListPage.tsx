import { useTable } from '@refinedev/antd';
import { Button } from 'antd';
import { useState, useEffect, useRef, type ReactNode } from 'react';
import { PageHead } from './ui/PageHead';
import { Panel } from './ui/Panel';
import { FilterBar } from './ui/FilterBar';
import { DataTable } from './ui/DataTable';
import { Pager } from './ui/Pager';
import { ReviewModal } from './ui/ReviewModal';
import { StatusTag } from './common/StatusTag';
import { EmptyState } from './common/EmptyState';
import { ErrorState } from './common/ErrorState';
import { T } from '../config/theme';
import { categoryText, serviceRolesText, msgTypeText, msgScopeText, roleText, publisherText, cleanCode } from '../config/labels';
import { formatCents } from '../utility';
import { t } from '../i18n/t';

export interface ColumnDef {
  title: string;
  /** 支持点路径，如 ['provider', 'nickname'] */
  dataIndex: string | string[];
  render?: (value: any, record: any) => ReactNode;
  width?: number;
  ellipsis?: boolean;
  align?: 'left' | 'right' | 'center';
}

export interface DetailFieldDef {
  label: string;
  dataIndex: string | string[];
  /** 详情内的值格式化：金额（分）、日期、状态标签、服务品类、服务子角色、消息类型/范围 */
  format?: 'cents' | 'date' | 'status' | 'category' | 'roles' | 'type' | 'scope' | 'role' | 'publisher' | 'code';
}

/** 胶囊筛选项（原型 .chip） */
export interface ChipFilter {
  label: string;
  value: any;
  /** 命中值；数组表示多值任一命中 */
  match?: any;
  /** 参与匹配的字段路径；不传则走 test() 客户端过滤 */
  field?: string | string[];
  /** 客户端过滤谓词（后端无对应字段时使用，如「未读 / 已读」按已读回执判定） */
  test?: (row: any) => boolean;
}

export interface StaticFilter {
  field: string;
  operator: 'eq' | 'contains';
  value: any;
}

export interface GenericListPageProps {
  title: ReactNode;
  /** 页面副标题 */
  sub?: ReactNode;
  /** 右侧角色标签 */
  chip?: ReactNode;
  /** 后端资源名，如 'agent/users'（dataProvider 拼为 /api/agent/users） */
  resource: string;
  columns?: ColumnDef[];
  /** 是否启用关键字搜索（前端过滤 dataSource） */
  searchable?: boolean;
  /** 参与搜索的字段路径（支持点路径 ['provider','nickname']） */
  searchField?: string | string[];
  /**
   * 关键字改由服务端过滤时的查询字段名（如字体的 'family'）。
   * 不传则沿用旧行为：只对【当前页】的 ~pageSize 行做客户端过滤 —— 资源条目多时
   * （如 95 个字体）在第 1 页搜索第 3 页的字体会搜不到。传了以后关键字会作为
   * permanent filter 下发，由后端统计 total 并翻页。
   */
  searchServerField?: string;
  searchPlaceholder?: string;
  /** 提供则渲染「详情」按钮 + 详情弹窗 */
  detailFields?: DetailFieldDef[];
  /** 胶囊筛选（前端过滤） */
  chipFilters?: ChipFilter[];
  rowKey?: string;
  pageSize?: number;
  /** 固定传给后端的作用域过滤（如 userId 监督视角），透传为查询参数 */
  staticFilters?: StaticFilter[];
  /** 「＋ 新建」按钮文案（默认「＋ 新建」，如反馈页为「＋ 新增反馈」） */
  createLabel?: string;
  /** 「＋ 新建」按钮跳转路径；不传则不显示 */
  createPath?: string;
  onCreate?: () => void;
  /** 详情弹窗左上角标签（原型 #modalTag：订单 / 服务商 / 券 / 流水 / 评价 / 消息 / 反馈） */
  detailTag?: string;
  /** 详情弹窗标题（默认取页面标题，如「订单详情」） */
  detailTitle?: string;
  /** 导出回调；不传则导出按钮置灰 */
  onExport?: () => void;
  /**
   * 自定义行操作（原型 .acts）。提供时替代默认的「详情」列。
   * 返回如 <><span>查看</span><span>通过</span><span>驳回</span></>
   */
  rowActions?: (record: any) => ReactNode;
  /**
   * 工具栏自定义按钮（渲染在「导出 / 新建」之前），用于「扫描目录」「清理失效」等非 CRUD 动作。
   * 形参 ctx.reload 用于动作完成后刷新列表（内部即 tableQueryResult.refetch）。
   */
  toolbarExtra?: (ctx: { reload: () => void }) => ReactNode;
  /** 提供则渲染卡片网格（替代表格）；每行由 gridCard(record) 返回卡片节点，自带「详情 / 编辑」等内部操作 */
  gridCard?: (record: any) => ReactNode;
}

const getByPath = (obj: any, path: string | string[]): any => {
  const keys = Array.isArray(path) ? path : String(path).split('.');
  return keys.reduce((acc: any, k) => (acc == null ? acc : acc[k]), obj);
};

const dt = (v: any) => (v ? new Date(v).toLocaleString('zh-CN', { hour12: false }) : '—');

const renderValue = (v: any): ReactNode => {
  if (v == null) return <span style={{ color: T.ink3 }}>—</span>;
  if (Array.isArray(v)) return v.length ? v.join('、') : '—';
  if (typeof v === 'object') return <pre style={{ margin: 0 }}>{JSON.stringify(v)}</pre>;
  return String(v);
};

/**
 * 通用列表页（原型 #pg-list）：
 *   pghead（标题 + 副标题 + 角色标签）
 * → toolbar（胶囊筛选 + 搜索 + 导出 + 新建）
 * → panel（头部计数 hint + 表格 + 分页条）
 *
 * 对接 Refine useTable；四态由 EmptyState / 骨架 / ErrorState 承担。
 * 用于把四层共 30 个列表页统一到一套结构与间距。
 */
export const GenericListPage = ({
  title,
  sub,
  chip,
  resource,
  columns = [],
  searchable,
  searchField,
  searchPlaceholder,
  searchServerField,
  detailFields,
  chipFilters,
  rowKey = 'id',
  pageSize = 10,
  staticFilters,
  createPath,
  onCreate,
  createLabel = '＋ 新建',
  onExport,
  rowActions,
  toolbarExtra,
  gridCard,
  detailTag = '详情',
  detailTitle,
}: GenericListPageProps) => {
  const [keyword, setKeyword] = useState('');
  const [chipValue, setChipValue] = useState<any>(undefined);
  const [selected, setSelected] = useState<any>(null);
  /** 上一次下发给服务端的关键字（用于判断「关键字变了」而不是「页码变了」） */
  const prevKeywordRef = useRef(keyword);

  // 激活的胶囊 → 服务端筛选：把 chip 的 field 作为 Refine 永久过滤下发，
  // 由 dataProvider 透传为查询参数，后端据此统计 total。
  // 这样「待审核」等胶囊返回的是后端真实待办数，与侧栏角标（同为服务端统计）严格一致；
  // 此前胶囊仅在客户端对单页 ~10 行做过滤，导致「待审核」只数到当前页内的少量行，与角标错位。
  // 仅带 field 的胶囊才下发（设置页等无 field 的胶囊不受影响）。
  const activeChip =
    chipFilters && chipValue !== undefined && chipValue !== 'all'
      ? chipFilters.find((x) => x.value === chipValue)
      : undefined;
  // 关键字是否已在服务端过滤（见 props.searchServerField 说明）
  const keywordOnServer = !!searchServerField;
  const serverFilters = [
    ...(staticFilters ?? []),
    ...(activeChip?.field
      ? [{ field: activeChip.field as string, operator: 'eq' as const, value: activeChip.match ?? activeChip.value }]
      : []),
    ...(keywordOnServer && keyword
      ? [{ field: searchServerField as string, operator: 'contains' as const, value: keyword }]
      : []),
  ];

  const { tableProps, tableQueryResult, setCurrent } = useTable({
    resource,
    filters: serverFilters.length ? { permanent: serverFilters } : undefined,
    pagination: { current: 1, pageSize },
    queryOptions: { retry: false },
  });

  const rows: any[] = (tableProps.dataSource as any[]) || [];

  // 仅保留「客户端关键字搜索」与「无后端字段」胶囊的过滤；带 field 的胶囊与
  // searchServerField 的关键字都已由服务端筛选。
  const dataSource = rows.filter((r) => {
    if (activeChip?.test && !activeChip.test(r)) return false;
    if (!keywordOnServer && searchable && searchField && keyword) {
      const v = getByPath(r, searchField);
      if (!(v != null && String(v).includes(keyword))) return false;
    }
    return true;
  });

  const isLoading = tableQueryResult?.isLoading ?? false;
  const isError = tableQueryResult?.isError ?? false;

  const pagination = tableProps.pagination;
  // 客户端过滤（关键字或无 field 的胶囊）时以过滤后行数为准，
  // 否则沿用服务端 total —— 否则「共 N 条」会与表格实际行数错位。
  const clientFiltered = (!!keyword && !keywordOnServer) || !!activeChip?.test;
  const total = clientFiltered
    ? dataSource.length
    : (pagination && typeof pagination === 'object' ? pagination.total : undefined) ??
      dataSource.length;
  const current =
    (pagination && typeof pagination === 'object' ? pagination.current : undefined) ?? 1;

  // 服务端关键字：命中行数变少后仍停在第 3 页会看到空表，故**关键字变化时**回到第 1 页。
  // ⚠️ 必须用 ref 比对上一次的 keyword：`current` 不能作为「重置」的触发条件，
  // 否则用户点下一页把 current 改成 2 也会被立刻拉回 1，分页条彻底失效。
  useEffect(() => {
    if (!keywordOnServer) return;
    if (prevKeywordRef.current === keyword) return;
    prevKeywordRef.current = keyword;
    if (current !== 1) setCurrent?.(1);
  }, [keyword, current, keywordOnServer]);

  const openDetail = (record: any) => setSelected(record);

  const getRowKey = (r: any) =>
    typeof rowKey === 'string' && r[rowKey] != null ? r[rowKey] : undefined;

  return (
    <>
      <PageHead title={title} sub={sub} chip={chip} />

      <FilterBar
        filters={chipFilters?.map((f) => ({ label: f.label, value: f.value }))}
        activeFilter={chipValue}
        onFilterChange={(v) => setChipValue(v === chipValue ? undefined : v)}
        searchable={searchable}
        searchPlaceholder={searchPlaceholder}
        searchValue={keyword}
        onSearchChange={setKeyword}
        onSearch={setKeyword}
        actions={
          <>
            {toolbarExtra
              ? toolbarExtra({
                  reload: () => {
                    void tableQueryResult?.refetch?.();
                  },
                })
              : null}
            <Button onClick={onExport} disabled={!onExport}>
              导出
            </Button>
            {(createPath || onCreate) && (
              <Button type="primary" onClick={onCreate}>
                {createLabel}
              </Button>
            )}
          </>
        }
      />

      {isError ? (
        <Panel>
          <ErrorState onRetry={() => tableQueryResult?.refetch?.()} />
        </Panel>
      ) : (
        <Panel
          title={<span>{title}</span>}
          hint={
            <>
              共 <b style={{ color: T.accent }}>{total}</b> 条 · 数据隔离由后端强制
            </>
          }
        >
          {isLoading && dataSource.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: T.ink3 }}>加载中…</div>
          ) : dataSource.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center' }}>
              <EmptyState />
            </div>
          ) : gridCard ? (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                gap: 16,
                padding: '4px 4px 16px',
              }}
            >
              {dataSource.map((r: any, i: number) => (
                <div key={getRowKey(r) ?? i} style={{ minWidth: 0 }}>
                  {gridCard(r)}
                </div>
              ))}
            </div>
          ) : (
            <DataTable<any>
              rowKey={rowKey}
              loading={isLoading}
              dataSource={dataSource}
              scroll={{ x: 800 }}
              locale={{ emptyText: <EmptyState /> }}
              columns={[
                ...columns.map((c) => ({
                  title: c.title,
                  dataIndex: c.dataIndex,
                  width: c.width,
                  ellipsis: c.ellipsis,
                  align: c.align,
                  render: c.render,
                })),
                ...(rowActions
                  ? [
                      {
                        title: t('pages.col.action'),
                        dataIndex: '__op',
                        width: 148,
                        render: (_: any, record: any) => (
                          <div style={{ display: 'flex', gap: 12 }}>{rowActions(record)}</div>
                        ),
                      },
                    ]
                  : detailFields
                    ? [
                        {
                          title: t('common.detail'),
                          dataIndex: '__op',
                          width: 72,
                          render: (_: any, record: any) => (
                            <span
                              onClick={() => openDetail(record)}
                              style={{
                                color: T.accent,
                                cursor: 'pointer',
                                fontSize: 13,
                                whiteSpace: 'nowrap',
                              }}
                            >
                              详情
                            </span>
                          ),
                        },
                      ]
                    : []),
              ]}
            />
          )}
          <Pager
            total={total}
            current={current}
            pageSize={pageSize}
            onChange={(p) => setCurrent?.(p)}
          />
        </Panel>
      )}

      {detailFields && (
        <ReviewModal
          open={!!selected}
          tag={detailTag}
          title={detailTitle ?? title}
          onClose={() => setSelected(null)}
          fields={(detailFields ?? []).map((f) => {
            const raw = getByPath(selected ?? {}, f.dataIndex);
            const val =
              f.format === 'cents'
                ? formatCents(raw ?? 0)
                : f.format === 'date'
                  ? dt(raw)
                  : f.format === 'status'
                    ? <StatusTag value={raw} />
                    : f.format === 'category'
                      ? categoryText(raw)
                        : f.format === 'roles'
                        ? serviceRolesText(raw)
                        : f.format === 'role'
                        ? roleText(raw)
                        : f.format === 'publisher'
                          ? publisherText(getByPath(selected ?? {}, 'author'), getByPath(selected ?? {}, 'authorRole'))
                          : f.format === 'type'
                          ? msgTypeText(raw)
                          : f.format === 'scope'
                            ? msgScopeText(raw)
                            : f.format === 'code'
                              ? cleanCode(raw)
                              : renderValue(raw);
            return { label: f.label, value: val };
          })}
        />
      )}
    </>
  );
};

export default GenericListPage;
