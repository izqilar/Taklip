import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/** 行模型：id 与字段内容无关，专用于 React key（保证焦点稳定，见下方 ★焦点稳定铁律） */
interface Row {
  id: string;
  f: GuestFieldDef;
}

/**
 * 模板字段设计组件（@h5design/ui，web 与 admin 两端共用，保证完全一致）。
 *
 * 职责：对「下载模板」中将要出现的可填写字段进行 新增 / 删除 / 修改 / 排序，并保存配置。
 * 数据真值在后端（GET/PUT /api/guest-lists/field-design）；本组件只负责 UI 与本地校验，
 * 通过 loadFields / saveFields 两个回调与 host 解耦（host 各自处理 /api 路径与鉴权头）。
 *
 * 样式：纯内联样式、零 UI 框架依赖，确保 web(Tailwind) 与 admin(antd) 渲染像素一致。
 */

export interface GuestFieldDef {
  key: string;
  label: string;
  type: 'string' | 'enum';
  required: boolean;
  maxLen?: number;
  values?: string[];
  enum?: string[];
  pattern?: string;
  example: string;
}

export interface TemplateFieldDesignProps {
  /** 加载当前作用域字段设计（host 负责 /api 路径 + 鉴权头） */
  loadFields: () => Promise<GuestFieldDef[]>;
  /** 保存字段设计，返回保存后的字段数组 */
  saveFields: (defs: GuestFieldDef[]) => Promise<GuestFieldDef[]>;
  /** 用于「恢复默认」的标准字段集（可选） */
  defaultFields?: GuestFieldDef[];
  /** 不可删除 / 不可改 key 的字段（默认锁定 guest_name） */
  lockedKeys?: string[];
  /** i18n 文案覆盖（缺省为中文） */
  labels?: Partial<Record<string, string>>;
  /**
   * 是否强制「姓名(guest_name)」为首个且必填字段。
   * - 默认 true：单份字段设计（web/admin 的 field-design）保持 guest_name 锁定。
   * - 传 false：多模板场景（婚礼模板用 husband_name/wife_name），各模板字段独立，不强制 guest_name。
   */
  lockFirstField?: boolean;
  /** 保存成功后回调（host 用于返回列表 / 跳转） */
  onSaved?: (fields: GuestFieldDef[]) => void;
  /** v1.4（§18.1）：是否渲染受控「模板名称」输入框，与字段表共同构成完整创建表单 */
  showName?: boolean;
  /** 模板名称受控值（由 host 维护，保存时一并透传后端） */
  nameValue?: string;
  /** 模板名称变更回调 */
  onNameChange?: (v: string) => void;
  /** 名称输入框标签 */
  nameLabel?: string;
  /** 名称输入框占位 */
  namePlaceholder?: string;
}

const ACCENT = '#c24b2e';
const BORDER = '#e5e7eb';
const INK = '#1f2329';
const MUTED = '#8a919f';

const csv = (s?: string[]) => (s ?? []).join(',');
const arr = (s: string) =>
  s
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);

const KEY_RE = /^[a-zA-Z][a-zA-Z0-9_]*$/;

/** 本地校验，给出首条错误原因（与后端 saveFieldDesign 口径一致） */
function validateLocal(fields: GuestFieldDef[], lockFirst: boolean): string | null {
  if (!fields.length) return '至少保留一个字段';
  const seen = new Set<string>();
  for (let i = 0; i < fields.length; i++) {
    const f = fields[i];
    if (!KEY_RE.test(f.key)) return `第 ${i + 1} 行字段 key 须以字母开头、仅含字母数字下划线`;
    if (seen.has(f.key)) return `字段 key「${f.key}」重复`;
    if (!f.label.trim()) return `字段「${f.key}」中文表头必填`;
    seen.add(f.key);
    if (f.type === 'enum' && (!f.values || !f.values.length)) return `枚举字段「${f.key}」须提供可选值`;
  }
  if (lockFirst) {
    if (fields[0].key !== 'guest_name') return '「姓名(guest_name)」必须为首个字段且不可删除/改名';
    if (!fields.find((d) => d.key === 'guest_name')?.required) return '「姓名(guest_name)」必须为必填';
  }
  return null;
}

export function TemplateFieldDesign(props: TemplateFieldDesignProps) {
  const { loadFields, saveFields, defaultFields, lockedKeys = ['guest_name'], labels, lockFirstField = true, onSaved, showName, nameValue, onNameChange, nameLabel, namePlaceholder } = props;
  const L = (k: string, d: string) => labels?.[k] ?? d;
  const lockFirst = lockFirstField;
  // 名称校验：仅当 showName 且为空时报错（与后端 createTemplate name 必填口径一致，§18.1）
  const [nameInvalid, setNameInvalid] = useState(false);

  /**
   * ★焦点稳定铁律：字段行必须以「与字段内容无关的稳定 id」作为 React key。
   *
   * 历史缺陷（本文件曾用 `<tr key={f.key + i}>`）：key 依赖 f.key ⇒ 用户在「字段 key」
   * 输入框里每敲一个字符（含退格）都会改变 key ⇒ React 判定「旧行卸载 + 新行挂载」⇒
   * 该行所有 <input> 的 DOM 节点被重建 ⇒ 输入即失焦，无法连续输入 / 连续删除。
   * （「中文表头」列改值不动 key，故当时只有 key 列出问题，与本缺陷现象一致。）
   *
   * 现改为 { id, f } 行模型：id 只在「新增字段 / 载入列表」时分配，
   * 内容编辑（改 key/label/类型/必填…）绝不改动 id，也不重建 DOM 节点。
   * fields 由 rows 派生，保持对外（校验 / 保存）的数据形态不变。
   */
  const [rows, setRows] = useState<Row[]>([]);
  const fields = useMemo(() => rows.map((r) => r.f), [rows]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const seq = useRef(0);
  const rid = useRef(0);
  const makeRow = (f: GuestFieldDef): Row => ({ id: `row_${++rid.current}`, f });
  /** 用新列表替换行：按位置复用既有 id（避免整表重挂载），多出的部分分配新 id */
  const replaceRows = (list: GuestFieldDef[]) =>
    setRows((prev) => list.map((f, i) => (i < prev.length ? { id: prev[i].id, f } : makeRow(f))));

  /**
   * ★加载只跑一次铁律：host 通常会传内联箭头函数（如 `loadFields={async () => []}`），
   * 其身份每次父组件渲染都会变。若把 loadFields 放进 useEffect 依赖：
   * 父级任何一次重渲染（例如在「模板名称」输入框里打字）都会重跑 loader ⇒
   * setLoading(true) 让表格整体卸载（正在输入的行随之失焦）+ 用空列表覆盖已填字段（数据丢失）。
   * 故用 ref 持有最新 loader，让 reload 身份稳定、只在挂载时执行一次。
   */
  const loadRef = useRef(loadFields);
  useEffect(() => {
    loadRef.current = loadFields;
  }, [loadFields]);

  const reload = useCallback(() => {
    setLoading(true);
    setError('');
    loadRef
      .current()
      .then((d) => replaceRows(d))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const update = (i: number, patch: Partial<GuestFieldDef>) => {
    setNotice('');
    // 只换内容、保留行 id ⇒ React 复用同一 <input> 节点，焦点不丢
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, f: { ...r.f, ...patch } } : r)));
  };

  const addField = () => {
    setNotice('');
    seq.current += 1;
    const key = `field_${seq.current}`;
    setRows((prev) => [...prev, makeRow({ key, label: '', type: 'string', required: false, example: '' })]);
  };

  const removeField = (i: number) => {
    setNotice('');
    setRows((prev) => prev.filter((_, idx) => idx !== i));
  };

  const move = (i: number, dir: -1 | 1) => {
    setNotice('');
    setRows((prev) => {
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };

  const save = async () => {
    setError('');
    setNotice('');
    if (showName && !nameValue?.trim()) {
      setNameInvalid(true);
      setError(L('nameRequired', '请填写模板名称'));
      return;
    }
    setNameInvalid(false);
    const err = validateLocal(fields, lockFirst);
    if (err) {
      setError(err);
      return;
    }
    setSaving(true);
    try {
      const saved = await saveFields(fields);
      replaceRows(saved);
      setNotice(L('saved', '字段设计已保存，后续模板下载将使用新字段'));
      onSaved?.(saved);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const resetDefault = () => {
    if (!defaultFields?.length) return;
    setNotice('');
    setSaving(true);
    setError('');
    saveFields(defaultFields)
      .then((d) => {
        replaceRows(d);
        setNotice(L('reset', '已恢复为默认字段'));
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setSaving(false));
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    boxSizing: 'border-box',
    padding: '6px 8px',
    border: `1px solid ${BORDER}`,
    borderRadius: 6,
    fontSize: 13,
    color: INK,
    background: '#fff',
    outline: 'none',
  };
  const cellPad: React.CSSProperties = { padding: '8px 10px', borderBottom: `1px solid ${BORDER}`, verticalAlign: 'top' };
  const btn = (primary = false): React.CSSProperties => ({
    padding: '6px 12px',
    border: primary ? 'none' : `1px solid ${BORDER}`,
    borderRadius: 6,
    background: primary ? ACCENT : '#fff',
    color: primary ? '#fff' : INK,
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 500,
  });
  const iconBtn: React.CSSProperties = {
    border: 'none',
    background: 'transparent',
    color: MUTED,
    cursor: 'pointer',
    fontSize: 13,
    padding: '2px 6px',
  };

  return (
    <div style={{ maxWidth: 1080, margin: '0 auto', color: INK, fontFamily: 'inherit' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{L('title', '模板字段设计')}</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={btn(false)} onClick={addField} disabled={saving || loading}>
            ＋ {L('add', '新增字段')}
          </button>
          {defaultFields?.length ? (
            <button style={btn(false)} onClick={resetDefault} disabled={saving || loading}>
              {L('resetBtn', '恢复默认')}
            </button>
          ) : null}
          <button style={btn(true)} onClick={save} disabled={saving || loading}>
            {saving ? L('saving', '保存中…') : L('save', '保存配置')}
          </button>
        </div>
      </div>
      <p style={{ color: MUTED, fontSize: 13, margin: '0 0 14px' }}>
        {L('desc', '设计「下载模板」中出现的可填写字段。保存后，后续导出的 CSV/XLSX 模板与名单导入校验将按此字段集生效。姓名(guest_name) 为必填身份列，不可删除或改名。')}
      </p>

      {showName ? (
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: INK, marginBottom: 6 }}>
            {nameLabel ?? L('nameLabel', '模板名称')}
            <span style={{ color: '#cf1322', marginLeft: 2 }}>*</span>
          </label>
          <input
            style={{
              ...inputStyle,
              maxWidth: 420,
              border: nameInvalid ? '1px solid #f5b5ab' : `1px solid ${BORDER}`,
              background: nameInvalid ? '#fff5f5' : '#fff',
            }}
            value={nameValue ?? ''}
            placeholder={namePlaceholder ?? L('namePlaceholder', '如：2026 春季婚礼诚邀名单')}
            onChange={(e) => {
              setNameInvalid(false);
              onNameChange?.(e.target.value);
            }}
          />
          {nameInvalid ? (
            <div style={{ color: '#cf1322', fontSize: 12, marginTop: 4 }}>{L('nameRequired', '请填写模板名称')}</div>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <div style={{ background: '#fdebec', color: '#cf1322', border: '1px solid #f5b5ab', borderRadius: 6, padding: '8px 12px', fontSize: 13, marginBottom: 12 }}>
          {error}
        </div>
      ) : null}
      {notice ? (
        <div style={{ background: '#eaf7ee', color: '#1a7f37', border: '1px solid #b6e3c2', borderRadius: 6, padding: '8px 12px', fontSize: 13, marginBottom: 12 }}>
          {notice}
        </div>
      ) : null}

      {loading ? (
        <div style={{ color: MUTED, padding: 24, textAlign: 'center' }}>{L('loading', '加载中…')}</div>
      ) : (
        <div style={{ border: `1px solid ${BORDER}`, borderRadius: 8, overflow: 'hidden', background: '#fff' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#fafafa', color: MUTED, textAlign: 'left' }}>
                <th style={{ ...cellPad, width: 36 }}>#</th>
                <th style={{ ...cellPad, width: 150 }}>{L('colKey', '字段 key')}</th>
                <th style={{ ...cellPad, width: 130 }}>{L('colLabel', '中文表头')}</th>
                <th style={{ ...cellPad, width: 90 }}>{L('colType', '类型')}</th>
                <th style={{ ...cellPad, width: 64 }}>{L('colReq', '必填')}</th>
                <th style={{ ...cellPad, width: 130 }}>{L('colMax', '最大长度')}</th>
                <th style={{ ...cellPad, width: 170 }}>{L('colVals', '可选值/建议值')}</th>
                <th style={{ ...cellPad, width: 150 }}>{L('colPattern', '正则')}</th>
                <th style={{ ...cellPad, width: 120 }}>{L('colExample', '示例')}</th>
                <th style={{ ...cellPad, width: 110 }}>{L('colOp', '操作')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const f = r.f;
                const locked = lockedKeys.includes(f.key);
                const isEnum = f.type === 'enum';
                return (
  // key 用行 id（稳定）而非 f.key + i（内容一变就重挂载 → 失焦）
                  <tr key={r.id}>
                    <td style={cellPad}>{i + 1}</td>
                    <td style={cellPad}>
                      <input
                        style={{ ...inputStyle, background: locked ? '#f5f5f5' : '#fff' }}
                        value={f.key}
                        disabled={locked}
                        onChange={(e) => update(i, { key: e.target.value.trim() })}
                      />
                    </td>
                    <td style={cellPad}>
                      <input style={inputStyle} value={f.label} onChange={(e) => update(i, { label: e.target.value })} />
                    </td>
                    <td style={cellPad}>
                      <select
                        style={inputStyle}
                        value={f.type}
                        onChange={(e) => {
                          const type = e.target.value as 'string' | 'enum';
                          update(i, type === 'enum' ? { type, values: f.values ?? [], enum: undefined } : { type, enum: f.enum ?? [], values: undefined });
                        }}
                      >
                        <option value="string">{L('typeString', '文本')}</option>
                        <option value="enum">{L('typeEnum', '枚举')}</option>
                      </select>
                    </td>
                    <td style={cellPad}>
                      <input
                        type="checkbox"
                        checked={f.required}
                        disabled={locked}
                        onChange={(e) => update(i, { required: e.target.checked })}
                      />
                    </td>
                    <td style={cellPad}>
                      {!isEnum ? (
                        <input
                          style={inputStyle}
                          type="number"
                          min={1}
                          value={f.maxLen ?? ''}
                          placeholder="—"
                          onChange={(e) => update(i, { maxLen: e.target.value ? Number(e.target.value) : undefined })}
                        />
                      ) : (
                        <span style={{ color: MUTED }}>—</span>
                      )}
                    </td>
                    <td style={cellPad}>
                      <input
                        style={inputStyle}
                        value={isEnum ? csv(f.values) : csv(f.enum)}
                        placeholder={isEnum ? '逗号分隔，如 M,F,U' : '建议值，逗号分隔'}
                        onChange={(e) => {
                          const v = arr(e.target.value);
                          update(i, isEnum ? { values: v } : { enum: v });
                        }}
                      />
                    </td>
                    <td style={cellPad}>
                      {!isEnum ? (
                        <input
                          style={inputStyle}
                          value={f.pattern ?? ''}
                          placeholder="如 ^1[3-9]\d{9}$"
                          onChange={(e) => update(i, { pattern: e.target.value || undefined })}
                        />
                      ) : (
                        <span style={{ color: MUTED }}>—</span>
                      )}
                    </td>
                    <td style={cellPad}>
                      <input style={inputStyle} value={f.example ?? ''} onChange={(e) => update(i, { example: e.target.value })} />
                    </td>
                    <td style={cellPad}>
                      <button style={iconBtn} disabled={i === 0} onClick={() => move(i, -1)} title={L('up', '上移')}>
                        ↑
                      </button>
                      <button style={iconBtn} disabled={i === fields.length - 1} onClick={() => move(i, 1)} title={L('down', '下移')}>
                        ↓
                      </button>
                      <button style={{ ...iconBtn, color: locked ? MUTED : '#cf1322' }} disabled={locked} onClick={() => removeField(i)} title={L('del', '删除')}>
                        ✕
                      </button>
                    </td>
                  </tr>
                );
              })}
              {!fields.length ? (
                <tr>
                  <td colSpan={10} style={{ ...cellPad, textAlign: 'center', color: MUTED }}>
                    {L('empty', '暂无字段，点击「新增字段」开始设计')}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default TemplateFieldDesign;
