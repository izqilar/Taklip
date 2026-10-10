/**
 * PersonPickerDialog — 「人员名单选择」弹窗（§18.3）。
 *
 * UI 与交互完全复刻编辑器 BatchGenerateDialog（名单下拉 + 搜索 + 全选/反选 + 已选 N 人
 * + 人员表 + 锁定提示 + 配额提示），但**不跳转编辑器**：
 *  - 内部 listGuestLists → 选名单 → listGuestRecords 拉人；
 *  - createBatchProject({templateId, listId}) 创建/复用批量项目（拿 projectId + 配额 remaining）；
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
  onClose: () => void;
  onConfirm: (picked: PickedPersons) => void;
  ownerType?: string;
  clientId?: string;
}

export function PersonPickerDialog({ open, templateId, onClose, onConfirm, ownerType, clientId }: PersonPickerDialogProps) {
  const { t } = useTranslation(['common']);

  const [lists, setLists] = useState<ListItem[]>([]);
  const [listId, setListId] = useState('');
  const [rows, setRows] = useState<GuestRow[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [batchProjectId, setBatchProjectId] = useState('');
  const [locked, setLocked] = useState(false);
  const [remaining, setRemaining] = useState(3);
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

        const p = await api.createBatchProject({ templateId, listId, ownerType, clientId });
        if (!alive) return;
        setBatchProjectId(p.id);
        setLocked(!!p.locked);
        setRemaining(p.remaining ?? 0);

        const sel = await api.getGuestSelection(p.id);
        if (!alive || !sel) return;
        const valid = new Set((res?.records ?? []).map((r) => r.id));
        setSelected((sel.selectedRecordIds ?? []).filter((id) => valid.has(id)));
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
  }, [open, listId, templateId]);

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

  const toggle = useCallback(
    (id: string) => {
      if (locked) return;
      setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    },
    [locked],
  );

  const selectAll = useCallback(() => {
    if (locked) return;
    const ordered = filtered.map((r) => r.id);
    setSelected((prev) => [...new Set([...prev, ...ordered])]);
  }, [filtered, locked]);

  const invert = useCallback(() => {
    if (locked) return;
    const inView = new Set(filtered.map((r) => r.id));
    setSelected((prev) => {
      const prevSet = new Set(prev);
      const next = filtered.filter((r) => !prevSet.has(r.id)).map((r) => r.id);
      const keep = prev.filter((id) => !inView.has(id));
      return [...keep, ...next];
    });
  }, [filtered, locked]);

  const confirm = useCallback(async () => {
    setError('');
    if (!batchProjectId) return;
    if (!selected.length) {
      setError(t('common:guest.batch.needOne', { defaultValue: '请至少勾选 1 人' }));
      return;
    }
    setSubmitting(true);
    try {
      // 持久化勾选（锁定后跳过，与编辑器一致）
      // 后端返回「已锁定 ids ∪ 本次提交 ids」的并集，以响应体为准回写调用方（后端契约 note 3）
      let finalIds = selected;
      if (!locked) {
        const saved = await api.setGuestSelection({
          projectId: batchProjectId,
          listId,
          selectedRecordIds: selected,
        });
        if (saved?.selectedRecordIds?.length) finalIds = saved.selectedRecordIds;
      }
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
            {t('common:guest.batch.title', { defaultValue: '选择批量生成人员' })}
          </h3>
          <button onClick={onClose} className="rounded p-1 text-gray-500 hover:bg-gray-100">
            ✕
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-b border-gray-100 px-5 py-3">
          <label className="text-sm text-gray-700">{t('common:guest.batch.list', { defaultValue: '人员名单' })}</label>
          <select
            value={listId}
            disabled={locked || !lists.length}
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
          <button onClick={selectAll} disabled={locked} className="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50">
            {t('common:guest.batch.selectAll', { defaultValue: '全选' })}
          </button>
          <button onClick={invert} disabled={locked} className="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50">
            {t('common:guest.batch.invert', { defaultValue: '反选' })}
          </button>
          <span className="text-sm text-gray-500">
            {t('common:guest.batch.selectedCount', { defaultValue: '已选 {{n}} 人' }).replace('{{n}}', String(selected.length))}
          </span>
        </div>

        {locked && (
          <div className="bg-amber-50 px-5 py-2 text-xs text-amber-700">
            {t('common:guest.batch.lockedTip', { defaultValue: '已锁定名单，修改不影响已生成请柬' })}
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
                        disabled={locked}
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
