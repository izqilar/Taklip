import { useCallback, useEffect, useMemo, useState } from 'react';
import { toColumnDefs, deriveColumnsFromRecords, type GuestFieldDef } from '@h5design/core';
import {
  apiGet,
  apiPost,
  useSubjectScope,
  type BatchProjectView,
  type GuestListRow,
  type GuestRow,
  type GuestSelectionView,
} from './invitationShared';

/**
 * 「选择批量生成人员」弹窗（用户视角）
 *
 * 唯一基准 = web 端 `apps/web/src/user/PersonPickerDialog.tsx`（§18.3）：
 *  - 顶部：人员名单下拉（名称（人数））+ 搜索姓名/单位/桌号 + 全选 / 反选 + 「已选 N 人」；
 *  - 锁定名单时下拉禁用并显示琥珀色提示「已锁定名单，修改不影响已生成请柬」；
 *  - 人员表：勾选列 + 前 5 个标准字段（姓名/称谓/性别/单位/桌号），点行即选，选中行淡蓝底；
 *  - 底栏：左「免费赠样 3 人；剩余可生成 N」，右「取消 / 确认选择」。
 *
 * 数据链路：listGuestLists → listGuestRecords → createBatchProject(拿 projectId/locked/remaining)
 *          → getGuestSelection 继承勾选 → 确认时 setGuestSelection 落库并回传 {projectId,listId,selectedRecordIds}。
 *
 * 作用域：用户视角 = ADMIN 监督窗口，`subject` 透传（服务端 subjectId 口径）。
 */

export interface PickedPersons {
  projectId: string;
  listId: string;
  selectedRecordIds: string[];
}

interface Props {
  open: boolean;
  templateId: string;
  onClose: () => void;
  onConfirm: (picked: PickedPersons) => void;
}

const C = {
  brand: '#c81e42',
  red: '#ef4444',
  blue: '#2563eb',
  ink1: '#1f2937',
  ink2: '#4b5563',
  ink3: '#6b7280',
  ink4: '#9ca3af',
  line: '#e5e7eb',
  lineSoft: '#f3f4f6',
  head: '#f9fafb',
  warnBg: '#fffbeb',
  warnInk: '#b45309',
  err: '#dc2626',
};

const inputStyle: React.CSSProperties = {
  borderRadius: 4,
  border: '1px solid #d1d5db',
  padding: '6px 10px',
  fontSize: 14,
  outline: 'none',
  background: '#fff',
};
const ghostBtn: React.CSSProperties = {
  borderRadius: 4,
  border: '1px solid #d1d5db',
  background: '#fff',
  padding: '6px 14px',
  fontSize: 14,
  cursor: 'pointer',
};

export function UserPersonPickerDialog({ open, templateId, onClose, onConfirm }: Props) {
  const { q, subjBody } = useSubjectScope();

  const [lists, setLists] = useState<GuestListRow[]>([]);
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
        const ls = await apiGet<GuestListRow[]>(q('/guest-lists'));
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, q]);

  /* ── 加载名单人员 + 复用/创建批量项目 + 继承勾选 ── */
  useEffect(() => {
    if (!open || !listId || !templateId) return;
    let alive = true;
    setLoading(true);
    (async () => {
      try {
        const res = await apiGet<{ records?: GuestRow[]; columnDefs?: GuestFieldDef[] }>(q(`/guest-lists/${listId}/records?page=1&size=200`));
        if (!alive) return;
        setRows(res?.records ?? []);
        setColumns(res?.columnDefs ?? []);

        const p = await apiPost<BatchProjectView>(q('/invitations/projects'), {
          templateId,
          listId,
          ...subjBody,
        });
        if (!alive) return;
        setBatchProjectId(p.id);
        setLocked(!!p.locked);
        setRemaining(p.remaining ?? 0);

        const sel = await apiGet<GuestSelectionView>(q(`/invitations/projects/${p.id}/selection`));
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
    return rows.filter((r) =>
      cols.some((d) => ((r.data?.[d.key] ?? '') as string).toLowerCase().includes(k)),
    );
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
      setError('请至少勾选 1 人');
      return;
    }
    setSubmitting(true);
    try {
      // 持久化勾选（锁定后跳过，与 web 端一致）
      if (!locked) {
        await apiPost(q(`/invitations/projects/${batchProjectId}/selection`), {
          listId,
          selectedRecordIds: selected,
          ...subjBody,
        });
      }
      onConfirm({ projectId: batchProjectId, listId, selectedRecordIds: selected });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchProjectId, selected, listId, locked, onConfirm, onClose, q]);

  if (!open) return null;

  const cellStyle: React.CSSProperties = { padding: '8px 8px', color: '#374151' };
  const thStyle: React.CSSProperties = {
    background: C.head,
    textAlign: 'left',
    color: C.ink3,
    fontWeight: 500,
    padding: '8px 8px',
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.4)',
        padding: 16,
      }}
    >
      <div
        style={{
          display: 'flex',
          maxHeight: '80vh',
          width: '100%',
          maxWidth: 768,
          flexDirection: 'column',
          overflow: 'hidden',
          borderRadius: 8,
          background: '#fff',
          boxShadow: '0 20px 48px rgba(0,0,0,0.2)',
        }}
      >
        {/* 标题 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: `1px solid ${C.line}`,
            padding: '12px 20px',
          }}
        >
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: C.ink1 }}>选择批量生成人员</h3>
          <button
            onClick={onClose}
            style={{ border: 'none', background: 'none', padding: 4, color: C.ink3, cursor: 'pointer', fontSize: 14 }}
          >
            ✕
          </button>
        </div>

        {/* 工具条 */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 12,
            borderBottom: `1px solid ${C.lineSoft}`,
            padding: '12px 20px',
          }}
        >
          <label style={{ fontSize: 14, color: C.ink2 }}>人员名单</label>
          <select
            value={listId}
            disabled={locked || !lists.length}
            onChange={(e) => setListId(e.target.value)}
            style={{ ...inputStyle, minWidth: 180, background: locked ? '#f3f4f6' : '#fff' }}
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
            placeholder="搜索姓名/单位/桌号"
            style={{ ...inputStyle, flex: '1 1 160px', minWidth: 160 }}
          />
          <button onClick={selectAll} disabled={locked} style={{ ...ghostBtn, opacity: locked ? 0.5 : 1 }}>
            全选
          </button>
          <button onClick={invert} disabled={locked} style={{ ...ghostBtn, opacity: locked ? 0.5 : 1 }}>
            反选
          </button>
          <span style={{ fontSize: 14, color: C.ink3 }}>已选 {selected.length} 人</span>
        </div>

        {locked && (
          <div style={{ background: C.warnBg, padding: '8px 20px', fontSize: 12, color: C.warnInk }}>
            已锁定名单，修改不影响已生成请柬
          </div>
        )}

        {/* 人员表 */}
        <div style={{ minHeight: 0, flex: 1, overflow: 'auto', padding: '12px 20px' }}>
          {loading ? (
            <div style={{ padding: '32px 0', textAlign: 'center', fontSize: 14, color: C.ink4 }}>…</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, width: 40 }} />
                  {cols.map((d) => (
                    <th key={d.key} style={thStyle}>
                      {d.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const on = selectedSet.has(r.id);
                  return (
                    <tr
                      key={r.id}
                      onClick={() => toggle(r.id)}
                      style={{
                        cursor: locked ? 'default' : 'pointer',
                        borderBottom: `1px solid ${C.lineSoft}`,
                        background: on ? 'rgba(219,234,254,0.6)' : undefined,
                      }}
                    >
                      <td style={{ padding: '8px 8px' }}>
                        <input
                          type="checkbox"
                          checked={on}
                          disabled={locked}
                          onClick={(e) => e.stopPropagation()}
                          onChange={() => toggle(r.id)}
                          style={{ width: 16, height: 16, accentColor: C.blue }}
                        />
                      </td>
                      {cols.map((d) => (
                        <td key={d.key} style={cellStyle}>
                          {r.data?.[d.key] ?? ''}
                        </td>
                      ))}
                    </tr>
                  );
                })}
                {!filtered.length && (
                  <tr>
                    <td colSpan={cols.length + 1} style={{ padding: '32px 0', textAlign: 'center', color: C.ink4 }}>
                      暂无人员，请先导入或在线添加
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {error && <div style={{ padding: '0 20px 8px', fontSize: 12, color: C.err }}>{error}</div>}

        {/* 底栏 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderTop: `1px solid ${C.line}`,
            padding: '12px 20px',
          }}
        >
          <span style={{ fontSize: 12, color: C.ink3 }}>免费赠样 3 人；剩余可生成 {remaining}</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} style={ghostBtn}>
              取消
            </button>
            <button
              onClick={confirm}
              disabled={submitting || !selected.length || !batchProjectId}
              style={{
                borderRadius: 4,
                border: 'none',
                background: C.red,
                color: '#fff',
                padding: '6px 16px',
                fontSize: 14,
                cursor: submitting || !selected.length || !batchProjectId ? 'not-allowed' : 'pointer',
                opacity: submitting || !selected.length || !batchProjectId ? 0.5 : 1,
              }}
            >
              {submitting ? '处理中…' : '确认选择'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default UserPersonPickerDialog;
