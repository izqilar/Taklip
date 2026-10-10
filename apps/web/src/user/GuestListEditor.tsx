import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { authFetch } from '@/api/client';
import { useNavigate, useParams } from 'react-router-dom';
import { GUEST_FIELD_DEFS, type GuestData, type GuestFieldDef } from '@h5design/core';

/**
 * 名单在线编辑（§9.2）
 *
 * - 表格化增删改：新增空行 / 编辑单元格 / 删除行
 * - 防抖 600ms 自动保存（E10 走 `updatedAt` 乐观锁，冲突返回 409）
 * - 「保存并返回」：离开页面前把已填写内容**全部落库**，空行不写入
 * - 顶部提供「下载模板」「从文件导入」入口（与文件导入共用同一数据真值，B17）
 *
 * ★两条落库路径不可混淆（记录丢失的根本原因）：
 *  1. **已落库行**：`patchCell` → 防抖 PUT（乐观锁）
 *  2. **新增行**（`tmp_` 前缀，仅本地占位）：只在「失焦」或「保存并返回」时 POST 创建；
 *     绝不走 PUT —— 服务端无此记录会 404，旧实现据此 `load()` 重拉，把未落库的新行整行清空。
 *
 * ★空行判据与字段设计解耦：只看「该行所有已登记列是否全空」。
 *  旧实现硬编码 `guest_name`（新增行初始化 `{guest_name:null}` + 提交前判 `!guest_name` 直接 return），
 *  导致**不含 `guest_name` 的自定义模板**（如「丈夫/妻子」，见系统模板 sys_wedd）新增行永远无法落库。
 */

interface Row {
  id: string;
  seq: number;
  data: GuestData;
  updatedAt?: string;
}

export default function UserGuestListEditor() {
  const { listId = '' } = useParams();
  const { t } = useTranslation(['common']);
  const navigate = useNavigate();

  const [rows, setRows] = useState<Row[]>([]);
  /** 列定义：优先用名单创建时快照的模板字段（columnDefs），否则回落当前作用域的字段设计 */
  const [fieldDefs, setFieldDefs] = useState<GuestFieldDef[]>([]);
  const cols = fieldDefs.length ? fieldDefs : ([...GUEST_FIELD_DEFS] as GuestFieldDef[]);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingCount, setSavingCount] = useState(0);
  const saving = savingCount > 0;

  const fileRef = useRef<HTMLInputElement>(null);
  /**
   * 行数据镜像。state 更新是异步批处理的，而「保存并返回」必须读到用户**最新**输入，
   * 故所有行变更统一走 `writeRows`（同时写 ref + state），不依赖渲染时序。
   */
  const rowsRef = useRef<Row[]>([]);
  const colsRef = useRef<GuestFieldDef[]>(cols);
  colsRef.current = cols;
  /** 名单原名：用于判断是否需要补一次改名 PUT */
  const originalName = useRef('');
  /** 待触发的防抖保存定时器（rowId → timer） */
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  /** 有未落库改动的「已落库行」id */
  const dirty = useRef<Set<string>>(new Set());
  /** 新增行 tmpId → 已创建的真实 id（重复提交守卫） */
  const createdIds = useRef<Record<string, string>>({});
  /** 在途 POST（tmpId → promise）：失焦与「保存并返回」可能同时触发，须复用同一请求防重复插入 */
  const postInflight = useRef<Record<string, Promise<string | null>>>({});
  /**
   * PUT 保存链（rowId → 队列尾 promise）：同一行**串行**保存。
   * 并发 PUT 会各带自己的 `updatedAt`，后到的那个可能带着过期值 → 服务端 409，
   * 故同一行必须排队；每个 PUT 在执行时从镜像读最新数据与 updatedAt，天然避免脏读。
   */
  const putChain = useRef<Record<string, Promise<boolean>>>({});
  /** 「保存并返回」防重入（不用 disabled，见 saveAndReturn 注释） */
  const leaving = useRef(false);
  const tmpSeq = useRef(0);

  /** 行变更唯一入口：ref 与 state 同步写 */
  const writeRows = useCallback((updater: (prev: Row[]) => Row[]) => {
    const next = updater(rowsRef.current);
    rowsRef.current = next;
    setRows(next);
  }, []);

  /** 计数式保存态（并发请求下不会互相「提前解除」） */
  const withSaving = useCallback(async <T,>(fn: () => Promise<T>): Promise<T> => {
    setSavingCount((c) => c + 1);
    try {
      return await fn();
    } finally {
      setSavingCount((c) => Math.max(0, c - 1));
    }
  }, []);

  /** 一行是否「全空」：所有已登记列 + 行内已出现的键皆为空/空白。空行不落库 */
  const isRowEmpty = useCallback((row: Row, defs: readonly GuestFieldDef[]) => {
    const keys = new Set<string>([...defs.map((f) => f.key), ...Object.keys(row.data ?? {})]);
    for (const k of keys) {
      const v = row.data?.[k];
      if (v != null && String(v).trim() !== '') return false;
    }
    return true;
  }, []);

  /** 必填字段是否齐备。失焦时若不齐备则**不**提交：否则每填一格都会发一次注定 422 的请求，并弹出误导性错误 */
  const canCommit = useCallback((row: Row, defs: readonly GuestFieldDef[]) => {
    return defs.every((f) => !f.required || (row.data?.[f.key] != null && String(row.data[f.key]).trim() !== ''));
  }, []);

  const load = useCallback(async () => {
    if (!listId) return;
    setLoading(true);
    try {
      const res = await authFetch(`/api/guest-lists/${listId}/records?page=1&size=200`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json();
      writeRows(() => (d?.records ?? []) as Row[]);
      dirty.current.clear();
      const cd = (d?.columnDefs as GuestFieldDef[] | undefined) ?? [];
      if (Array.isArray(cd) && cd.length) {
        setFieldDefs(cd);
      } else {
        // 无模板快照 → 回落到当前作用域的字段设计。
        // 若此处仍用标准字段，自定义字段设计的名单会「列不一致」→ 保存的键被服务端丢弃（表现为记录丢失）。
        let defs: GuestFieldDef[] = [...GUEST_FIELD_DEFS] as GuestFieldDef[];
        try {
          const fres = await authFetch('/api/guest-lists/field-design');
          if (fres.ok) {
            const fd = await fres.json();
            const fields = Array.isArray(fd?.fields) ? (fd.fields as GuestFieldDef[]) : [];
            if (fields.length) defs = fields;
          }
        } catch {
          /* 回落标准字段 */
        }
        setFieldDefs(defs);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [listId, writeRows]);

  /** 拉取名单元数据（名称等），用于顶部输入框回填；与记录列表加载解耦，避免回填时冲掉用户正在编辑的名称 */
  const loadMeta = useCallback(async () => {
    if (!listId) return;
    try {
      const res = await authFetch(`/api/guest-lists/${listId}`);
      if (!res.ok) return;
      const d = await res.json();
      if (d?.name) {
        setName(d.name);
        originalName.current = d.name;
      }
    } catch {
      /* ignore */
    }
  }, [listId]);

  useEffect(() => {
    void load();
    void loadMeta();
  }, [load, loadMeta]);

  /**
   * 真正发 PUT：**执行时**从镜像取该行最新 data / updatedAt（乐观锁口径）。
   * 因为读取发生在请求发起瞬间，故可安全串行排队而不会带过期 `updatedAt`。
   */
  const doPut = useCallback(
    async (rowId: string): Promise<boolean> => {
      const row = rowsRef.current.find((r) => r.id === rowId);
      if (!row || row.id.startsWith('tmp_')) return true; // 行已被删除 / 仍是临时行 → 视为无需保存
      try {
        const res = await authFetch(`/api/guest-lists/${listId}/records/${rowId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: row.data, updatedAt: row.updatedAt }),
        });
        if (res.status === 409) {
          setError(t('common:guest.conflict', { defaultValue: '数据已变更，请刷新后再编辑' }));
          void load();
          return false;
        }
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          setError(d?.message || `HTTP ${res.status}`);
          void load();
          return false;
        }
        const saved = await res.json();
        dirty.current.delete(rowId);
        writeRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, updatedAt: saved.updatedAt } : r)));
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        return false;
      }
    },
    [listId, load, t, writeRows],
  );

  /** 排队保存一行已落库记录（同一行串行，避免乐观锁互相踩踏） */
  const putRow = useCallback(
    (rowId: string): Promise<boolean> => {
      const prev = putChain.current[rowId] ?? Promise.resolve(true);
      const next = prev.then(() => withSaving(() => doPut(rowId)));
      putChain.current[rowId] = next;
      void next.then(() => {
        if (putChain.current[rowId] === next) delete putChain.current[rowId];
      });
      return next;
    },
    [doPut, withSaving],
  );

  /** 防抖保存单行（仅限已落库行；临时行由 commitTempRow 负责） */
  const saveRow = useCallback(
    (row: Row) => {
      // 临时行（tmp_ 前缀，尚未落库）只做本地占位，提交由失焦/离开页面时的 commitTempRow 负责。
      // 若此处对临时行发起 PUT，服务端无此记录返回 404，会触发 void load() 把未保存的临时行整个清空。
      if (row.id.startsWith('tmp_')) return;
      window.clearTimeout(timers.current[row.id]);
      timers.current[row.id] = setTimeout(() => {
        delete timers.current[row.id];
        void putRow(row.id);
      }, 600);
    },
    [putRow],
  );

  const patchCell = useCallback(
    (id: string, key: string, value: string) => {
      writeRows((prev) => prev.map((r) => (r.id === id ? { ...r, data: { ...r.data, [key]: value === '' ? null : value } } : r)));
      const target = rowsRef.current.find((r) => r.id === id);
      if (!target || target.id.startsWith('tmp_')) return; // 新增行等提交时机，不 PUT
      dirty.current.add(id);
      saveRow(target);
    },
    [saveRow, writeRows],
  );

  const addRow = useCallback(() => {
    // 新行先本地占位（全空行不落库），填写后在失焦 / 保存并返回时创建
    const tempId = `tmp_${Date.now()}_${++tmpSeq.current}`;
    // 注意：data 不预置任何字段（旧实现预置 guest_name:null，对自定义模板是无效字段）
    writeRows((prev) => [...prev, { id: tempId, seq: prev.length + 1, data: {} }]);
  }, [writeRows]);

  /**
   * 提交一行新增记录（POST）。
   * - 全空行 → 返回 null（调用方视为「跳过」，不写入）
   * - 同一 tmpId 并发调用复用同一请求（失焦 + 保存并返回同时触发时不会插入两条）
   */
  const commitTempRow = useCallback(
    (row: Row): Promise<string | null> => {
      if (!row.id.startsWith('tmp_')) return Promise.resolve(row.id);
      const already = createdIds.current[row.id];
      if (already) return Promise.resolve(already);
      const pending = postInflight.current[row.id];
      if (pending) return pending;
      if (isRowEmpty(row, colsRef.current)) return Promise.resolve(null);

      const req = withSaving(async (): Promise<string | null> => {
        try {
          const res = await authFetch(`/api/guest-lists/${listId}/records`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: row.data }),
          });
          if (!res.ok) {
            const d = await res.json().catch(() => ({}));
            setError(d?.message || `HTTP ${res.status}`);
            return null;
          }
          const created = await res.json();
          createdIds.current[row.id] = created.id;
          dirty.current.delete(row.id);
          setError(''); // 成功落库 → 清掉此前（如中途必填未齐）留下的误导性错误
          writeRows((prev) => prev.map((r) => (r.id === row.id ? { ...created, data: created.data } : r)));
          return created.id as string;
        } catch (e) {
          setError(e instanceof Error ? e.message : String(e));
          return null;
        } finally {
          delete postInflight.current[row.id];
        }
      });
      postInflight.current[row.id] = req;
      return req;
    },
    [isRowEmpty, listId, withSaving, writeRows],
  );

  const removeRow = useCallback(
    async (id: string) => {
      if (id.startsWith('tmp_')) {
        writeRows((prev) => prev.filter((r) => r.id !== id));
        return;
      }
      try {
        const res = await authFetch(`/api/guest-lists/${listId}/records/${id}`, {
          method: 'DELETE',
        });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          throw new Error(d?.message || `HTTP ${res.status}`);
        }
        void load();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [listId, load, writeRows],
  );

  /** Excel 多列粘贴 → 批量写入 */
  const pasteRows = useCallback(
    async (text: string) => {
      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      if (!lines.length) return;
      // 若首行是表头（与当前列 label/key 逐列匹配，含「姓名*」式必填标记），则跳过，
      // 与「文件导入」首行视为表头的语义一致，避免把表头当数据写入（尤其从模板整段复制时）。
      let start = 0;
      if (lines.length > 1 && cols.length) {
        const hc = lines[0].split('\t').map((c) => c.trim());
        const looksHeader = cols.every(
          (f, i) => hc[i] != null && (hc[i] === f.label || hc[i] === f.key || hc[i] === `${f.label}*`),
        );
        if (looksHeader) start = 1;
      }
      const records = lines.slice(start).map((line) => {
        const cells = line.split('\t');
        const data: Record<string, string> = {};
        cols.forEach((f, i) => {
          if (cells[i] != null) data[f.key] = cells[i].trim();
        });
        return { data };
      });
      try {
        const res = await authFetch(`/api/guest-lists/${listId}/records/batch`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ records, mode: 'append' }),
        });
        const d = await res.json();
        if (!res.ok) throw new Error(d?.message || `HTTP ${res.status}`);
        setError(
          d?.failed?.length
            ? `写入 ${d.created} 条，跳过 ${d.failed.length} 条（${d.failed[0]?.reason ?? ''}）`
            : `写入 ${d.created} 条`,
        );
        void load();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [listId, load, cols],
  );

  const upload = useCallback(async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    fd.append('listId', listId);
    fd.append('mode', 'append');
    try {
      const res = await authFetch('/api/guest-lists/import', { method: 'POST', body: fd });
      const d = await res.json();
      if (!res.ok) throw new Error(d?.message || `HTTP ${res.status}`);
      void load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [listId, load]);

  const rename = useCallback(async () => {
    const nm = name.trim();
    if (!nm || nm === originalName.current) return;
    try {
      const res = await authFetch(`/api/guest-lists/${listId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: nm }),
      });
      if (res.ok) originalName.current = nm;
      else setError(`HTTP ${res.status}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [listId, name]);

  /**
   * 「保存并返回」：把当前页面上已填写的内容全部落库后再离开。
   *  1. 取消所有待触发的防抖保存（改为下面立刻保存，避免离开后才发请求的竞态）
   *  2. 等待在途保存落地（此后队列为空，随后补存用最新 updatedAt，不会撞乐观锁 409）
   *  3. 逐行落库：新增行 → POST（全空则跳过）；已落库且有改动 → 立即 PUT
   *  4. 任一失败则停在当前页（不导航），避免「静默丢数据」
   */
  const saveAndReturn = useCallback(async () => {
    // 防重入：按钮**不可**用 disabled 表达「保存中」——用户在新行输入后点击时，
    // mousedown 先触发失焦 → commitTempRow → saving 置真 → 重渲染禁用按钮 →
    // mouseup 落在 disabled 控件上，浏览器直接丢弃 click（表现为「点了没反应」）。
    if (leaving.current) return;
    leaving.current = true;
    setSavingCount((c) => c + 1);
    setError('');
    try {
      Object.values(timers.current).forEach((tm) => window.clearTimeout(tm));
      timers.current = {};

      // 等在途保存落地（此后队列为空，随后补存用最新 updatedAt，不会撞乐观锁 409）
      await Promise.all(Object.values(putChain.current));
      await rename();

      let failed = false;
      for (const r of [...rowsRef.current]) {
        if (r.id.startsWith('tmp_')) {
          if (isRowEmpty(r, colsRef.current)) continue; // 空行不写入
          const id = await commitTempRow(r);
          if (!id) failed = true;
        } else if (dirty.current.has(r.id)) {
          if (!(await putRow(r.id))) failed = true;
        }
      }

      if (failed) {
        setError((prev) => prev || t('common:guest.saveFailedStay', { defaultValue: '部分记录保存失败，请修正后重试（为避免丢失数据，未离开本页）' }));
        return;
      }
      navigate('/user/invitations/lists');
    } finally {
      leaving.current = false;
      setSavingCount((c) => Math.max(0, c - 1));
    }
  }, [commitTempRow, isRowEmpty, navigate, putRow, rename, t]);

  /** 标红：非空行但缺少必填字段（空行不标红；判据与字段设计一致，不硬编码 guest_name） */
  const invalidRows = useMemo(() => {
    const s = new Set<string>();
    for (const r of rows) {
      if (isRowEmpty(r, cols)) continue;
      if (cols.some((f) => f.required && !r.data?.[f.key])) s.add(r.id);
    }
    return s;
  }, [rows, cols, isRowEmpty]);

  return (
    <div className="p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button
          onClick={() => void saveAndReturn()}
          aria-busy={saving}
          data-testid="save-and-back"
          className="rounded border border-gray-300 px-2 py-1 text-sm text-gray-600 hover:bg-gray-50 hover:underline aria-busy:opacity-60"
        >
          ← {t('common:button.saveAndBack', { defaultValue: '保存并返回' })}
        </button>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={rename}
          placeholder={t('common:guest.listNamePlaceholder', { defaultValue: '名单名称' })}
          className="rounded border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-blue-400"
        />
        <span className="text-xs text-gray-500">
          {saving ? t('common:status.saving', { defaultValue: '保存中…' }) : ''}
        </span>
        <div className="ml-auto flex gap-2">
          <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls,.json" className="text-sm" />
          <button onClick={upload} className="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50">
            {t('common:guest.import', { defaultValue: '导入' })}
          </button>
        </div>
      </div>

      {error && <div className="mb-3 rounded bg-red-50 px-3 py-2 text-xs text-red-600">{error}</div>}

      {loading ? (
        <div className="py-10 text-center text-sm text-gray-400">…</div>
      ) : (
        <div className="overflow-auto">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-gray-600">
                <th className="w-10 px-2 py-2">#</th>
                {cols.map((f) => (
                  <th key={f.key} className="px-2 py-2 font-medium">
                    {f.label}
                    {f.required ? ' *' : ''}
                  </th>
                ))}
                <th className="w-20 px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id} className={`border-b border-gray-100 ${invalidRows.has(r.id) ? 'bg-red-50/40' : ''}`}>
                  <td className="px-2 py-1 text-gray-400">{i + 1}</td>
                  {cols.map((f) => (
                    <td key={f.key} className="px-1 py-1">
                      <input
                        value={r.data?.[f.key] ?? ''}
                        maxLength={f.maxLen ?? 100}
                        onChange={(e) => patchCell(r.id, f.key, e.target.value)}
                        // 新增行（未落库）失焦时创建；必填未齐备则先不提交（等填完或「保存并返回」统一落库）
                        onBlur={() => {
                          if (r.id.startsWith('tmp_') && canCommit(r, cols)) void commitTempRow(r);
                        }}
                        className="w-full rounded border border-transparent px-2 py-1 outline-none focus:border-blue-400"
                      />
                    </td>
                  ))}
                  <td className="px-2 py-1">
                    <button onClick={() => removeRow(r.id)} className="text-gray-500 hover:text-red-600">
                      {t('common:button.delete', { defaultValue: '删除' })}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-3 flex items-center gap-2">
            <button onClick={addRow} className="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50">
              {t('common:guest.addRow', { defaultValue: '新增一行' })}
            </button>
            <textarea
              placeholder={t('common:guest.pasteTip', { defaultValue: '从 Excel 复制多行后粘贴到此处，自动批量写入' })}
              onPaste={(e) => {
                const text = e.clipboardData.getData('text');
                if (text.includes('\t') || text.includes('\n')) {
                  e.preventDefault();
                  void pasteRows(text);
                }
              }}
              className="min-h-[38px] flex-1 rounded border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-blue-400"
            />
          </div>
        </div>
      )}
    </div>
  );
}
