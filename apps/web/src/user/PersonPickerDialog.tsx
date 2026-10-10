/**
 * PersonPickerDialog — 「宾客名单选择」弹窗（§18.3）。
 *
 * UI 与交互完全复刻编辑器 BatchGenerateDialog（名单下拉 + 搜索 + 全选/反选 + 已选 N 人
 * + 人员表 + 锁定提示 + 配额提示），但**不跳转编辑器**：
 *  - 内部 listGuestLists → 选名单 → listGuestRecords 拉人；
 *  - createBatchProject({templateId, listId, projectId?}) 创建/复用批量项目（拿 projectId + 配额 remaining）；
 *    传入 projectId 时后端强制复用该项目，换名单也不会新建项目（否则已购人次会作废）；
 *  - getGuestSelection / setGuestSelection 持久化勾选；
 *  - 确认时回写 {projectId, listId, selectedRecordIds}，由调用方（InvitationJobs）统一发起批量生成。
 *
 * ⚠️ 直接调用 web `api`（而非 @h5design/editor 的 services 适配层）：
 * 该弹窗出现在用户端「请柬批量生成」页，未必经过编辑器路由（services 仅在编辑器挂载时注入），
 * api 自带鉴权、且无注册依赖，更稳妥。
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toColumnDefs, deriveColumnsFromRecords, type GuestFieldDef } from '@h5design/core';
import { api } from '@/api/client';

type GuestRow = { id: string; seq: number; data: Record<string, string | null> };
type ListItem = { id: string; name: string; recordCount: number };

export interface PickedPersons {
  projectId: string;
  listId: string;
  selectedRecordIds: string[];
}

interface PersonPickerDialogProps {
  open: boolean;
  /** 已选中的模板（批量渲染 templateId） */
  templateId: string;
  /**
   * 既有项目 id（可选）：换名单 / 追加名单时传给后端**强制复用**该项目，
   * 避免 createProject 按 (templateId, listId) 查重不命中而新建项目，导致已购人次作废。
   */
  projectId?: string;
  onClose: () => void;
  onConfirm: (picked: PickedPersons) => void;
  ownerType?: string;
  clientId?: string;
}

export function PersonPickerDialog({
  open,
  templateId,
  projectId,
  onClose,
  onConfirm,
  ownerType,
  clientId,
}: PersonPickerDialogProps) {
  const { t } = useTranslation(['common']);

  const [lists, setLists] = useState<ListItem[]>([]);
  const [listId, setListId] = useState('');
  const [rows, setRows] = useState<GuestRow[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [batchProjectId, setBatchProjectId] = useState('');
  const [locked, setLocked] = useState(false);
  const [remaining, setRemaining] = useState(3);
  /** 已成功渲染的宾客：后端 RENDERED_RECORD_IMMUTABLE —— 从名单移除任意一条即 409，UI 上禁掉取消勾选 */
  const [renderedIds, setRenderedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [keyword, setKeyword] = useState('');
  /** 名单字段定义（来自 listGuestRecords 响应 columnDefs，按所选模板字段结构渲染表头/取数） */
  const [columns, setColumns] = useState<GuestFieldDef[]>([]);

  /* ── 加载名单列表 ── */
  useEffect(() => {
    if (!open) return;
    let alive = true;
    (async () => {
      try {
        const ls = await api.listGuestLists({ ownerType, clientId });
        if (!alive) return;
        setLists(ls ?? []);
        if (ls?.length && !listId) setListId(ls[0].id);
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      alive = false;
    };
  }, [open, ownerType, clientId, listId]);

  /* ── 加载名单人员 + 复用/创建批量项目 + 继承勾选 ── */
  useEffect(() => {
    if (!open || !listId || !templateId) return;
    let alive = true;
    setLoading(true);
    (async () => {
      try {
        const res = await api.listGuestRecords(listId, 1, 200);
        if (!alive) return;
        setRows(res?.records ?? []);
        setColumns(res?.columnDefs ?? []);
        // 当前名单人员 id（用于默认全选，修复「复用已锁定项目渲染新名单」误报 NOTHING_TO_RENDER）
        const currentListIds = (res?.records ?? []).map((r) => String(r.id));

        // 传 projectId → 强制复用既有项目（换名单/追加名单不新建，保住已购人次）
        const p = await api.createBatchProject({
          templateId,
          listId,
          projectId,
          ownerType,
          clientId,
        });
        if (!alive) return;
        setBatchProjectId(p.id);
        setLocked(!!p.locked);
        setRemaining(p.remaining ?? 0);

        // 保留服务端返回的全量勾选（含其他名单的宾客）：提交时必须带上它们，否则后端会
        // 判定为「移除/替换已锁定记录」→ 超过 MINOR_EDIT 限额即 409（跨名单追加场景）。
        // 仅当前名单的人员会渲染成行，其他名单的 id 原样保留在提交集合里。
        const sel = await api.getGuestSelection(p.id);
        if (!alive || !sel) return;
        // 默认勾选当前名单全部人员：复用已锁定项目渲染「新名单」时，继承勾选只含旧名单记录，
        // 若不默认勾选当前名单，用户只点下拉不逐行打勾就确认 → 提交集合只剩已渲染旧记录 →
        // 后端 targets 全为已渲染 → 误报 NOTHING_TO_RENDER。当前名单人员默认全选，
        // 用户仍可手动取消；已锁定记录由 setSelection 并集保留、不会被移除（增删分离不变量）。
        const inherited = (sel.selectedRecordIds ?? []).filter(Boolean).map(String);
        setSelected(Array.from(new Set([...currentListIds, ...inherited])));

        // 取回逐行结果：已成功渲染的宾客不可移除（后端移除即 409 RENDERED_RECORD_IMMUTABLE），
        // 在 UI 上禁掉其取消勾选，避免用户点到必然报错的操作
        try {
          const rs = await api.projectResults(p.id);
          setRenderedIds(new Set((rs.results ?? []).filter((r) => r.status === 'ok').map((r) => r.recordId)));
        } catch {
          /* 拉取失败时不禁用任何勾选，交由后端 409 提示兜底 */
        }
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, listId, templateId, projectId]);

  /** 实际渲染的列：优先用名单字段定义（按所选模板结构）；缺失时按记录实际字段键推导，避免 ext_* 名单整列空白 */
  const cols = useMemo(() => {
    if (Array.isArray(columns) && columns.length) return columns;
    const derived = deriveColumnsFromRecords(rows);
    return derived.length ? derived : toColumnDefs([]);
  }, [columns, rows]);

  const filtered = useMemo(() => {
    const k = keyword.trim().toLowerCase();
    if (!k) return rows;
    return rows.filter((r) => cols.some((d) => ((r.data?.[d.key] ?? '') as string).toLowerCase().includes(k)));
  }, [rows, keyword, cols]);

  const selectedSet = useMemo(() => new Set(selected), [selected]);

  // 冻结态（已首渲/已付费）也允许改勾选：后端 B3 会做「锁定 ids ∪ 本次提交 ids」并集，
  // 且 9583636 起新增/追加不受限（仅「移除/替换」超过 3 条才 409）。此处若在 locked 时
  // 直接 return，用户买完人次也勾不了人，跨名单追加彻底失效。
  const toggle = useCallback(
    (id: string) => {
      // 已渲染宾客不可取消勾选（后端移除已生成记录会 409），只允许保持勾选
      if (renderedIds.has(id)) return;
      setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    },
    [renderedIds],
  );

  const selectAll = useCallback(() => {
    const ordered = filtered.map((r) => r.id);
    setSelected((prev) => [...new Set([...prev, ...ordered])]);
  }, [filtered]);

  const invert = useCallback(() => {
    const inView = new Set(filtered.map((r) => r.id));
    setSelected((prev) => {
      const prevSet = new Set(prev);
      const next = filtered.filter((r) => !prevSet.has(r.id)).map((r) => r.id);
      // 已渲染宾客即使在当前视图内也要保留，避免反选把它们移除而触发 409
      const keep = prev.filter((id) => !inView.has(id) || renderedIds.has(id));
      return [...keep, ...next];
    });
  }, [filtered, renderedIds]);

  const confirm = useCallback(async () => {
    setError('');
    if (!batchProjectId) return;
    if (!selected.length) {
      setError(t('common:guest.batch.needOne', { defaultValue: '请至少勾选 1 人' }));
      return;
    }
    setSubmitting(true);
    try {
      // 冻结态也必须提交：后端做「锁定 ids ∪ 本次提交 ids」并集，且新增/追加不受限。
      // 跳过提交会让新勾的人根本进不了 selection，购买人次后依然加不了人。
      const saved = await api.setGuestSelection({
        projectId: batchProjectId,
        listId,
        selectedRecordIds: selected,
      });
      const finalIds = saved?.selectedRecordIds?.length ? saved.selectedRecordIds : selected;
      onConfirm({ projectId: batchProjectId, listId, selectedRecordIds: finalIds });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }, [batchProjectId, selected, listId, locked, onConfirm, onClose, t]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[80vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
          <h3 className="text-base font-semibold text-gray-800">
            {t('common:guest.batch.title', { defaultValue: '宾客名单选择' })}
          </h3>
          <button onClick={onClose} className="rounded p-1 text-gray-500 hover:bg-gray-100">
            ✕
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-b border-gray-100 px-5 py-3">
          <label className="text-sm text-gray-700">{t('common:guest.batch.list', { defaultValue: '宾客名单' })}</label>
          <select
            value={listId}
            disabled={!lists.length}
            onChange={(e) => setListId(e.target.value)}
            className="min-w-[180px] rounded border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-blue-400 disabled:bg-gray-100"
          >
            {lists.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}（{l.recordCount}）
              </option>
            ))}
          </select>
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder={t('common:guest.batch.search', { defaultValue: '搜索姓名/单位/桌号' })}
            className="min-w-[160px] flex-1 rounded border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-blue-400"
          />
          <button onClick={selectAll} className="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50">
            {t('common:guest.batch.selectAll', { defaultValue: '全选' })}
          </button>
          <button onClick={invert} className="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50">
            {t('common:guest.batch.invert', { defaultValue: '反选' })}
          </button>
          <span className="text-sm text-gray-500">
            {t('common:guest.batch.selectedCount', { defaultValue: '已选 {{n}} 人' }).replace('{{n}}', String(selected.length))}
          </span>
        </div>

        {locked && (
          <div className="bg-amber-50 px-5 py-2 text-xs text-amber-700">
            {t('common:guest.batch.lockedTip', { defaultValue: '名单已锁定，已生成的请柬不受影响；可继续追加人员（不可批量移除已生成人员）' })}
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-auto px-5 py-3">
          {loading ? (
            <div className="py-8 text-center text-sm text-gray-400">…</div>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-gray-600">
                  <th className="w-10 px-2 py-2" />
                  {cols.map((d) => (
                    <th key={d.key} className="px-2 py-2 font-medium">
                      {d.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => toggle(r.id)}
                    className={`cursor-pointer border-b border-gray-100 hover:bg-blue-50 ${selectedSet.has(r.id) ? 'bg-blue-50/60' : ''}`}
                  >
                    <td className="px-2 py-2">
                      <input
                        type="checkbox"
                        checked={selectedSet.has(r.id)}
                        disabled={renderedIds.has(r.id)}
                        title={renderedIds.has(r.id) ? t('common:guest.batch.renderedImmutable', { defaultValue: '已生成的宾客不可从名单移除' }) : ''}
                        onClick={(e) => e.stopPropagation()}
                        onChange={() => toggle(r.id)}
                        className="h-4 w-4 accent-blue-500"
                      />
                    </td>
                    {cols.map((d) => (
                      <td key={d.key} className="px-2 py-2 text-gray-700">
                        {r.data?.[d.key] ?? ''}
                      </td>
                    ))}
                  </tr>
                ))}
                {!filtered.length && (
                  <tr>
                    <td colSpan={cols.length + 1} className="py-8 text-center text-gray-400">
                      {t('common:guest.batch.empty', { defaultValue: '暂无人员，请先导入或在线添加' })}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {error && <div className="px-5 pb-2 text-xs text-red-600">{error}</div>}

        <div className="flex items-center justify-between border-t border-gray-200 px-5 py-3">
          <span className="text-xs text-gray-500">
            {t('common:guest.batch.quotaTip', { defaultValue: '免费赠样 3 人；剩余可生成 {{r}}' }).replace(
              '{{r}}',
              String(remaining),
            )}
          </span>
          <div className="flex gap-2">
            <button onClick={onClose} className="rounded border border-gray-300 px-4 py-1.5 text-sm hover:bg-gray-50">
              {t('common:action.cancel', { defaultValue: '取消' })}
            </button>
            <button
              onClick={confirm}
              disabled={submitting || !selected.length || !batchProjectId}
              className="rounded bg-red-500 px-4 py-1.5 text-sm text-white hover:bg-red-600 disabled:opacity-50"
            >
              {submitting ? t('common:guest.batch.generating', { defaultValue: '处理中…' }) : t('common:guest.batch.confirm', { defaultValue: '确认选择' })}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PersonPickerDialog;
