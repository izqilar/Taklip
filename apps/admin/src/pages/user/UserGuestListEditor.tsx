import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { GUEST_FIELD_DEFS, type GuestData, type GuestFieldDef } from '@h5design/core';
import { API_URL, authHeaders } from '../../utility';
import { useLayer } from '../../providers/layerContext';

/**
 * 运营端（用户视角）· 名单在线编辑（§9.2）
 *
 * 唯一基准 = web 端 `apps/web/src/user/GuestListEditor.tsx`，逐行对齐其布局与行为：
 *  - 表格化增删改：新增空行 / 编辑单元格 / 删除行；
 *  - 防抖 600ms 自动保存（`updatedAt` 乐观锁，409 → 提示并重拉）；
 *  - 「保存并返回」：离开前把已填写内容**全部落库**，空行不写入；
 *  - 顶部「下载模板」入口由列表页提供；本页提供「从文件导入」；
 *  - Excel 多列粘贴 → 批量写入；必填缺失行标红。
 *
 * ★ 两条落库路径不可混淆（记录丢失的根本原因，见 MEMORY §12/§13）：
 *  1. **已落库行**：`patchCell` → 防抖 PUT（乐观锁）；
 *  2. **新增行**（`tmp_` 前缀，仅本地占位）：只在「失焦」或「保存并返回」时 POST 创建；
 *     绝不走 PUT —— 服务端无此记录会 404，旧实现据此 `load()` 重拉，把未落库的新行整行清空。
 * ★ 空行判据与字段设计解耦：只看该行所有已登记列是否全空，不硬编码 guest_name。
 * ★「保存并返回」按钮**不可**用 disabled 表达「保存中」（mousedown 失焦 → saving 置真 → 按钮禁用 →
 *    mouseup 丢弃 click，表现为「点了没反应」）；用 leaving ref + aria-busy 防重入。
 */

interface Row {
  id: string;
  seq: number;
  data: GuestData;
  updatedAt?: string;
}

const C = {
  brand: '#c81e42',
  blue: '#2563eb',
  ink1: '#1f2937',
  ink2: '#4b5563',
  ink3: '#6b7280',
  ink4: '#9ca3af',
  line: '#e5e7eb',
  lineSoft: '#f3f4f6',
  head: '#f9fafb',
  green: '#15803d',
  err: '#dc2626',
  errBg: '#fef2f2',
  warnBg: '#fef2f2',
};

export default function UserGuestListEditor() {
  /*
   * ★ 路由参数名：运营端路由是 `/user/invitations/lists/:id`（App.tsx），
   *   而 web 端是 `invitations/lists/:listId`。本组件当初照抄基准页的
   *   `const { listId } = useParams()`，在运营端恒为 undefined → 空串，
   *   导致 load()/loadMeta() 首行 `if (!listId) return` 直接返回 —— 名单名称与记录都拉不到，
   *   且 loading 停在 true，表现为「进入记录填写页白屏转圈、数据不回填」。
   *   这里兼容两种参数名，避免后续任一端改路由再次踩此坑。
   */
  const params = useParams();
  const listId = params.id ?? params.listId ?? '';
  const navigate = useNavigate();
  const { objectScope, isOwnView, readonly } = useLayer();
  const subject = isOwnView ? undefined : objectScope?.id;
  const canWrite = isOwnView || !readonly;

  /** 作用域查询串（GET 从 query 读取） */
  const url = useCallback(
    (path: string, extra?: string) => {
      const parts = [subject ? `subject=${encodeURIComponent(subject)}` : '', extra]
        .filter(Boolean)
        .join('&');
      return `${API_URL}${path}${parts ? `?${parts}` : ''}`;
    },
    [subject],
  );
  const subjBody = subject ? { subject } : {};

  const [rows, setRows] = useState<Row[]>([]);
  /** 列定义：优先用名单创建时快照的模板字段（columnDefs），否则回落当前作用域字段设计 */
  const [fieldDefs, setFieldDefs] = useState<GuestFieldDef[]>([]);
  const cols = fieldDefs.length ? fieldDefs : ([...GUEST_FIELD_DEFS] as GuestFieldDef[]);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingCount, setSavingCount] = useState(0);
  const saving = savingCount > 0;

  const fileRef = useRef<HTMLInputElement>(null);
  /** 行数据镜像：state 更新异步批处理，「保存并返回」须读用户最新输入 */
  const rowsRef = useRef<Row[]>([]);
  const colsRef = useRef<GuestFieldDef[]>(cols);
  colsRef.current = cols;
  /** 名单原名：判断是否需要补一次改名 PUT */
  const originalName = useRef('');
  /** 待触发的防抖保存定时器（rowId → timer） */
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  /** 有未落库改动的「已落库行」id */
  const dirty = useRef<Set<string>>(new Set());
  /** 新增行 tmpId → 已创建的真实 id（重复提交守卫） */
  const createdIds = useRef<Record<string, string>>({});
  /** 在途 POST（tmpId → promise） */
  const postInflight = useRef<Record<string, Promise<string | null>>>({});
  /** PUT 保存链（rowId → 队列尾 promise）：同一行串行，避免乐观锁互相踩踏 */
  const putChain = useRef<Record<string, Promise<boolean>>>({});
  /** 「保存并返回」防重入 */
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

  /** 一行是否「全空」：所有已登记列 + 行内已出现的键皆为空。空行不落库 */
  const isRowEmpty = useCallback((row: Row, defs: readonly GuestFieldDef[]) => {
    const keys = new Set<string>([...defs.map((f) => f.key), ...Object.keys(row.data ?? {})]);
    for (const k of keys) {
      const v = row.data?.[k];
      if (v != null && String(v).trim() !== '') return false;
    }
    return true;
  }, []);

  /** 必填是否齐备。失焦时若不齐备则不提交（否则每填一格都发注定 422 的请求） */
  const canCommit = useCallback((row: Row, defs: readonly GuestFieldDef[]) => {
    return defs.every(
      (f) => !f.required || (row.data?.[f.key] != null && String(row.data[f.key]).trim() !== ''),
    );
  }, []);

  const load = useCallback(async () => {
    if (!listId) {
      // 不再静默 return：静默会让页面永远停在 loading，掩盖参数/路由类问题
      setLoading(false);
      setError('缺少名单 ID（路由参数不匹配），无法加载记录');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(url(`/guest-lists/${listId}/records`, 'page=1&size=200'), {
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json();
      writeRows(() => (d?.records ?? []) as Row[]);
      dirty.current.clear();
      const cd = (d?.columnDefs as GuestFieldDef[] | undefined) ?? [];
      if (Array.isArray(cd) && cd.length) {
        setFieldDefs(cd);
      } else {
        let defs: GuestFieldDef[] = [...GUEST_FIELD_DEFS] as GuestFieldDef[];
        try {
          const fres = await fetch(url('/guest-lists/field-design'), { headers: authHeaders() });
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
  }, [listId, url, writeRows]);

  /** 拉名称回填（与记录列表解耦，避免回填冲掉用户正在编辑的名称） */
  const loadMeta = useCallback(async () => {
    if (!listId) return;
    try {
      const res = await fetch(url(`/guest-lists/${listId}`), { headers: authHeaders() });
      if (!res.ok) return;
      const d = await res.json();
      if (d?.name) {
        setName(d.name);
        originalName.current = d.name;
      }
    } catch {
      /* ignore */
    }
  }, [listId, url]);

  useEffect(() => {
    void load();
    void loadMeta();
  }, [load, loadMeta]);

  /** 真正发 PUT：执行时从镜像取最新 data / updatedAt（乐观锁口径） */
  const doPut = useCallback(
    async (rowId: string): Promise<boolean> => {
      const row = rowsRef.current.find((r) => r.id === rowId);
      if (!row || row.id.startsWith('tmp_')) return true;
      try {
        const res = await fetch(url(`/guest-lists/${listId}/records/${rowId}`), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify({ data: row.data, updatedAt: row.updatedAt, ...subjBody }),
        });
        if (res.status === 409) {
          setError('数据已变更，请刷新后再编辑');
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [listId, load, url, writeRows, subject],
  );

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
      writeRows((prev) =>
        prev.map((r) => (r.id === id ? { ...r, data: { ...r.data, [key]: value === '' ? null : value } } : r)),
      );
      const target = rowsRef.current.find((r) => r.id === id);
      if (!target || target.id.startsWith('tmp_')) return;
      dirty.current.add(id);
      saveRow(target);
    },
    [saveRow, writeRows],
  );

  const addRow = useCallback(() => {
    // 新行先本地占位（全空行不落库）；data 不预置任何字段（旧实现预置 guest_name:null 对自定义模板无效）
    const tempId = `tmp_${Date.now()}_${++tmpSeq.current}`;
    writeRows((prev) => [...prev, { id: tempId, seq: prev.length + 1, data: {} }]);
  }, [writeRows]);

  /** 提交一行新增记录（POST）；全空行 → null（跳过）；同 tmpId 并发复用同一请求 */
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
          const res = await fetch(url(`/guest-lists/${listId}/records`), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeaders() },
            body: JSON.stringify({ data: row.data, ...subjBody }),
          });
          if (!res.ok) {
            const d = await res.json().catch(() => ({}));
            setError(d?.message || `HTTP ${res.status}`);
            return null;
          }
          const created = await res.json();
          createdIds.current[row.id] = created.id;
          dirty.current.delete(row.id);
          setError('');
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isRowEmpty, listId, url, withSaving, writeRows, subject],
  );

  const removeRow = useCallback(
    async (id: string) => {
      if (id.startsWith('tmp_')) {
        writeRows((prev) => prev.filter((r) => r.id !== id));
        return;
      }
      try {
        const res = await fetch(url(`/guest-lists/${listId}/records/${id}`), {
          method: 'DELETE',
          headers: authHeaders(),
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
    [listId, load, url, writeRows],
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
        const res = await fetch(url(`/guest-lists/${listId}/records/batch`), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify({ records, mode: 'append', ...subjBody }),
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cols, listId, load, url, subject],
  );

  const upload = useCallback(async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    fd.append('listId', listId);
    fd.append('mode', 'append');
    if (subject) fd.append('subject', subject);
    try {
      const res = await fetch(`${API_URL}/guest-lists/import`, {
        method: 'POST',
        headers: authHeaders(),
        body: fd,
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d?.message || `HTTP ${res.status}`);
      if (fileRef.current) fileRef.current.value = '';
      void load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [listId, load, subject]);

  const rename = useCallback(async () => {
    const nm = name.trim();
    if (!nm || nm === originalName.current) return;
    try {
      const res = await fetch(url(`/guest-lists/${listId}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ name: nm, ...subjBody }),
      });
      if (res.ok) originalName.current = nm;
      else setError(`HTTP ${res.status}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listId, name, url, subject]);

  /**
   * 「保存并返回」：把当前页面上已填写的内容全部落库后再离开。
   *  1. 取消待触发防抖；2. 等在途保存落地；3. 逐行落库（新增 POST / 改动 PUT）；4. 失败留在本页。
   */
  const saveAndReturn = useCallback(async () => {
    if (leaving.current) return;
    leaving.current = true;
    setSavingCount((c) => c + 1);
    setError('');
    try {
      Object.values(timers.current).forEach((tm) => window.clearTimeout(tm));
      timers.current = {};

      await Promise.all(Object.values(putChain.current));
      await rename();

      let failed = false;
      for (const r of [...rowsRef.current]) {
        if (r.id.startsWith('tmp_')) {
          if (isRowEmpty(r, colsRef.current)) continue;
          const id = await commitTempRow(r);
          if (!id) failed = true;
        } else if (dirty.current.has(r.id)) {
          if (!(await putRow(r.id))) failed = true;
        }
      }

      if (failed) {
        setError((prev) => prev || '部分记录保存失败，请修正后重试（为避免丢失数据，未离开本页）');
        return;
      }
      navigate('/user/invitations/lists');
    } finally {
      leaving.current = false;
      setSavingCount((c) => Math.max(0, c - 1));
    }
  }, [commitTempRow, isRowEmpty, navigate, putRow, rename]);

  /** 标红：非空行但缺少必填字段（空行不标红；不硬编码 guest_name） */
  const invalidRows = useMemo(() => {
    const s = new Set<string>();
    for (const r of rows) {
      if (isRowEmpty(r, cols)) continue;
      if (cols.some((f) => f.required && !r.data?.[f.key])) s.add(r.id);
    }
    return s;
  }, [rows, cols, isRowEmpty]);

  return (
    <div style={{ padding: 16 }}>
      <div style={{ marginBottom: 12, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
        <button
          onClick={() => void saveAndReturn()}
          aria-busy={saving}
          data-testid="save-and-back"
          style={{
            borderRadius: 4,
            border: `1px solid #d1d5db`,
            background: '#fff',
            padding: '4px 8px',
            fontSize: 14,
            color: C.ink3,
            cursor: 'pointer',
            opacity: saving ? 0.6 : 1,
          }}
        >
          ← 保存并返回
        </button>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={rename}
          placeholder="名单名称"
          disabled={!canWrite}
          style={{
            borderRadius: 4,
            border: `1px solid #d1d5db`,
            padding: '6px 10px',
            fontSize: 14,
            outline: 'none',
          }}
        />
        <span style={{ fontSize: 12, color: C.ink3 }}>{saving ? '保存中…' : ''}</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls,.json" style={{ fontSize: 14 }} />
          <button
            onClick={upload}
            disabled={!canWrite}
            style={{ borderRadius: 4, border: `1px solid #d1d5db`, background: '#fff', padding: '6px 14px', fontSize: 14, cursor: 'pointer' }}
          >
            导入
          </button>
        </div>
      </div>

      {error && (
        <div
          style={{
            marginBottom: 12,
            borderRadius: 4,
            background: /写入|导入成功|成功/.test(error) ? '#f0fdf4' : C.errBg,
            padding: '8px 12px',
            fontSize: 12,
            color: /写入|导入成功|成功/.test(error) ? C.green : C.err,
          }}
        >
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ padding: '40px 0', textAlign: 'center', fontSize: 14, color: C.ink4 }}>…</div>
      ) : (
        <div style={{ overflow: 'auto' }}>
          <table style={{ width: '100%', minWidth: 720, borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr>
                <th style={{ ...th, width: 40 }}>#</th>
                {cols.map((f) => (
                  <th key={f.key} style={th}>
                    {f.label}
                    {f.required ? ' *' : ''}
                  </th>
                ))}
                <th style={{ ...th, width: 80 }} />
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id} style={{ background: invalidRows.has(r.id) ? 'rgba(254,242,242,0.4)' : undefined }}>
                  <td style={{ ...td, color: C.ink4 }}>{i + 1}</td>
                  {cols.map((f) => (
                    <td key={f.key} style={{ padding: '4px 4px', borderBottom: `1px solid ${C.lineSoft}` }}>
                      <input
                        value={r.data?.[f.key] ?? ''}
                        maxLength={f.maxLen ?? 100}
                        disabled={!canWrite}
                        onChange={(e) => patchCell(r.id, f.key, e.target.value)}
                        onBlur={() => {
                          if (r.id.startsWith('tmp_') && canCommit(r, cols)) void commitTempRow(r);
                        }}
                        style={{
                          width: '100%',
                          borderRadius: 4,
                          border: '1px solid transparent',
                          padding: '4px 8px',
                          outline: 'none',
                          fontSize: 14,
                          background: 'transparent',
                        }}
                        onFocus={(e) => {
                          e.currentTarget.style.border = `1px solid ${C.blue}`;
                        }}
                      />
                    </td>
                  ))}
                  <td style={{ padding: '4px 8px', borderBottom: `1px solid ${C.lineSoft}` }}>
                    <button
                      onClick={() => void removeRow(r.id)}
                      disabled={!canWrite}
                      style={{ border: 'none', background: 'none', padding: 0, fontSize: 14, color: canWrite ? C.ink3 : '#d1d5db', cursor: canWrite ? 'pointer' : 'not-allowed' }}
                    >
                      删除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={addRow}
              disabled={!canWrite}
              style={{ borderRadius: 4, border: `1px solid #d1d5db`, background: '#fff', padding: '6px 14px', fontSize: 14, cursor: canWrite ? 'pointer' : 'not-allowed' }}
            >
              新增一行
            </button>
            <textarea
              placeholder="从 Excel 复制多行后粘贴到此处，自动批量写入"
              disabled={!canWrite}
              onPaste={(e) => {
                const text = e.clipboardData.getData('text');
                if (text.includes('\t') || text.includes('\n')) {
                  e.preventDefault();
                  void pasteRows(text);
                }
              }}
              style={{
                minHeight: 38,
                flex: 1,
                borderRadius: 4,
                border: `1px solid #d1d5db`,
                padding: '6px 10px',
                fontSize: 14,
                outline: 'none',
                resize: 'vertical',
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

const th: React.CSSProperties = { background: C.head, textAlign: 'left', color: C.ink3, fontWeight: 500, padding: '8px 8px' };
const td: React.CSSProperties = { padding: '4px 8px', borderBottom: `1px solid ${C.lineSoft}` };
