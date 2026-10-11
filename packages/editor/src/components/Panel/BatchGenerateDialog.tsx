import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toColumnDefs, deriveColumnsFromRecords, type GuestFieldDef } from '@h5design/core';
import { services } from '../../services';

/**
 * 批量生成对话框（规范 §9.3 + §16 决策 D4）
 *
 * 位置铁律：批量生成面板放在**编辑器内**（变量绑定就近），
 * web `/editor/:id` 与 admin `/sp/works/:id/editor` 两宿主共用同一 `EditorApp`，
 * 因此这里只依赖 `services` 适配层，不直接碰任何后端 SDK —— 无需两处实现。
 *
 * 规则落点：
 *  - 首渲取勾选子集**前 3 人**（C2）；赠样用尽后引导购买（B5）
 *  - 锁定后勾选面板只读，提示「修改不影响已生成请柬」（B4 / FR-3）
 */

type GuestRow = { id: string; seq: number; data: Record<string, string | null> };
type ListItem = { id: string; name: string; recordCount: number };

interface Props {
  open: boolean;
  /** 当前作品（模板）id；编辑器 store 的 projectId 允许为 null（未加载完成） */
  projectId: string | null;
  onClose: () => void;
  /** 生成已受理回调（宿主可据此跳进度页） */
  onSubmitted?: (info: { jobId: string | null; total: number; status?: string; message?: string }) => void;
  /** SP 代客上下文（运营端注入；用户端不传，走 SELF 域） */
  ownerType?: string;
  clientId?: string;
  /** 由 URL ?batchList=<id> 预选的名单（编辑器自动开面板时传入，§17.8） */
  initialListId?: string;
}

export default function BatchGenerateDialog({
  open,
  projectId,
  onClose,
  onSubmitted,
  ownerType,
  clientId,
  initialListId,
}: Props) {
  const { t } = useTranslation(['editor']);

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
  /** 名单字段定义（来自 listRecords 响应的 columnDefs，按所选模板字段结构渲染表头/取数） */
  const [columns, setColumns] = useState<GuestFieldDef[]>([]);

  const ready = !!services.listGuestLists && !!services.batchGenerate;

  /* ── 加载名单列表 ── */
  useEffect(() => {
    if (!open || !ready) return;
    let alive = true;
    (async () => {
      try {
        const ls = await services.listGuestLists!({ ownerType, clientId });
        if (!alive) return;
        setLists(ls ?? []);
        if (ls?.length) {
          if (initialListId && ls.some((l) => l.id === initialListId)) setListId(initialListId);
          else if (!listId) setListId(ls[0].id);
        }
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      alive = false;
    };
  }, [open, ready, ownerType, clientId, listId, initialListId]);

  /* ── 加载名单人员 + 已有勾选 ── */
  useEffect(() => {
    if (!open || !listId) return;
    let alive = true;
    setLoading(true);
    (async () => {
      try {
        const res = await services.listGuestRecords!(listId, 1, 200);
        if (!alive) return;
        setRows(res?.records ?? []);
        setColumns(res?.columnDefs ?? []);

        // 复用/创建批量渲染项目（绑定模板 + 名单）
        let pid = batchProjectId;
        if (services.createBatchProject) {
          const p = await services.createBatchProject({ templateId: projectId ?? '', listId, ownerType, clientId });
          if (!alive) return;
          pid = p.id;
          setBatchProjectId(p.id);
          setLocked(!!p.locked);
          setRemaining(p.remaining ?? 0);
        }
        // 继承上一次勾选（必须用本次刚拿到的 pid，而非上一轮 state）
        if (pid && services.getGuestSelection) {
          const sel = await services.getGuestSelection!(pid);
          if (!alive || !sel) return;
          const valid = new Set((res?.records ?? []).map((r) => r.id));
          setSelected((sel.selectedRecordIds ?? []).filter((id) => valid.has(id)));
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
  }, [open, listId]);

  /** 实际渲染的列：优先用名单字段定义（按所选模板结构）；缺失时按记录实际字段键推导，避免 ext_* 名单整列空白 */
  const cols = useMemo(() => {
    if (Array.isArray(columns) && columns.length) return columns;
    const derived = deriveColumnsFromRecords(rows);
    return derived.length ? derived : toColumnDefs([]);
  }, [columns, rows]);

  const filtered = useMemo(() => {
    const k = keyword.trim().toLowerCase();
    if (!k) return rows;
    return rows.filter((r) =>
      cols.some((d) => ((r.data?.[d.key] ?? '') as string).toLowerCase().includes(k)),
    );
  }, [rows, keyword, cols]);

  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const toggle = useCallback((id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);

  const selectAll = useCallback(() => {
    // 按列表 seq 顺序追加，保证顺序稳定（顺序即出图顺序）
    const ordered = filtered.map((r) => r.id);
    setSelected((prev) => [...new Set([...prev, ...ordered])]);
  }, [filtered]);

  const invert = useCallback(() => {
    const inView = new Set(filtered.map((r) => r.id));
    setSelected((prev) => {
      const prevSet = new Set(prev);
      const next = filtered.filter((r) => !prevSet.has(r.id)).map((r) => r.id);
      const keep = prev.filter((id) => !inView.has(id));
      return [...keep, ...next];
    });
  }, [filtered]);

  /* ── 保存勾选 + 发起渲染 ── */
  const submit = useCallback(async () => {
    setError('');
    if (!batchProjectId) return;
    if (!selected.length) {
      setError(t('editor:batch.needOne', { defaultValue: '请至少勾选 1 人' })); // B16
      return;
    }
    setSubmitting(true);
    try {
      if (!locked && services.setGuestSelection) {
        await services.setGuestSelection({ projectId: batchProjectId, listId, selectedRecordIds: selected });
      }
      const res = await services.batchGenerate!({ projectId: batchProjectId });
      onSubmitted?.({ jobId: res.jobId, total: res.total });
      onClose();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }, [batchProjectId, selected, listId, locked, onSubmitted, onClose, t]);

  const saveSelection = useCallback(async () => {
    if (!batchProjectId || locked || !services.setGuestSelection) return;
    try {
      await services.setGuestSelection({ projectId: batchProjectId, listId, selectedRecordIds: selected });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [batchProjectId, locked, listId, selected]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[80vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg bg-white shadow-xl">
        {/* 头部 */}
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
          <h3 className="text-base font-semibold text-gray-800">
            {t('editor:batch.title', { defaultValue: '批量生成专属请柬' })}
          </h3>
          <button onClick={onClose} className="rounded p-1 text-gray-500 hover:bg-gray-100">
            ✕
          </button>
        </div>

        {!ready && (
          <div className="px-5 py-8 text-center text-sm text-gray-500">
            {t('editor:batch.notReady', { defaultValue: '宿主未接入批量请柬服务' })}
          </div>
        )}

        {ready && (
          <>
            {/* 名单选择 + 搜索 */}
            <div className="flex flex-wrap items-center gap-3 border-b border-gray-100 px-5 py-3">
              <label className="text-sm text-gray-700">
                {t('editor:batch.list', { defaultValue: '人员名单' })}
              </label>
              <select
                value={listId}
                disabled={locked}
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
                placeholder={t('editor:batch.search', { defaultValue: '搜索姓名/单位/桌号' })}
                className="min-w-[160px] flex-1 rounded border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-blue-400"
              />
              <button onClick={selectAll} className="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50">
                {t('editor:batch.selectAll', { defaultValue: '全选' })}
              </button>
              <button onClick={invert} className="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50">
                {t('editor:batch.invert', { defaultValue: '反选' })}
              </button>
              <span className="text-sm text-gray-500">
                {t('editor:batch.selectedCount', { defaultValue: '已选 {{n}} 人' }).replace('{{n}}', String(selected.length))}
              </span>
            </div>

            {locked && (
              <div className="bg-amber-50 px-5 py-2 text-xs text-amber-700">
                {t('editor:batch.lockedTip', { defaultValue: '已锁定名单，修改不影响已生成请柬' })}
              </div>
            )}

            {/* 人员表格 */}
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
                        onClick={() => !locked && toggle(r.id)}
                        className={`cursor-pointer border-b border-gray-100 hover:bg-blue-50 ${selectedSet.has(r.id) ? 'bg-blue-50/60' : ''}`}
                      >
                        <td className="px-2 py-2">
                          <input
                            type="checkbox"
                            checked={selectedSet.has(r.id)}
                            disabled={locked}
                            // 阻止事件冒泡到 <tr onClick>：否则一次点击会 toggle 两次（onChange + 行点击）互相抵消
                            onClick={(e) => e.stopPropagation()}
                            onChange={() => !locked && toggle(r.id)}
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
                          {t('editor:batch.empty', { defaultValue: '暂无人员，请先导入或在线添加' })}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>

            {error && <div className="px-5 pb-2 text-xs text-red-600">{error}</div>}

            {/* 底部动作 */}
            <div className="flex items-center justify-between border-t border-gray-200 px-5 py-3">
              <span className="text-xs text-gray-500">
                {t('editor:batch.quotaTip', { defaultValue: '免费赠样 3 人；已购人次 {{n}}；剩余可生成 {{r}}' })
                  .replace('{{n}}', String(Math.max(0, remaining - 3)))
                  .replace('{{r}}', String(remaining))}
              </span>
              <div className="flex gap-2">
                <button onClick={onClose} className="rounded border border-gray-300 px-4 py-1.5 text-sm hover:bg-gray-50">
                  {t('common:action.cancel', { defaultValue: '取消' })}
                </button>
                {!locked && (
                  <button
                    onClick={saveSelection}
                    className="rounded border border-gray-300 px-4 py-1.5 text-sm hover:bg-gray-50"
                  >
                    {t('editor:batch.saveSelection', { defaultValue: '保存勾选' })}
                  </button>
                )}
                <button
                  onClick={submit}
                  disabled={submitting || !selected.length}
                  className="rounded bg-red-500 px-4 py-1.5 text-sm text-white hover:bg-red-600 disabled:opacity-50"
                >
                  {submitting
                    ? t('editor:batch.generating', { defaultValue: '生成中…' })
                    : t('editor:batch.generate', { defaultValue: '生成请柬' })}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
