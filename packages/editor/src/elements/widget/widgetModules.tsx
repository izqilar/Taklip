import { useEffect, useRef, useState } from 'react';
import type { WidgetKind, WidgetElement } from '@h5design/core';
import type { WidgetDef, WidgetDOMProps, WidgetFieldDef } from './types';

/* ───────── 工具函数 ───────── */

const FORM_COUNT_KEY = 'h5design_formcount';

/** 读取全站表单登记总数（由 quickForm/inputBox 等提交时累加） */
export function getFormCount(): number {
  try {
    return parseInt(localStorage.getItem(FORM_COUNT_KEY) || '0', 10) || 0;
  } catch {
    return 0;
  }
}

/** 表单提交时累加登记数 */
export function incFormCount(): void {
  try {
    localStorage.setItem(FORM_COUNT_KEY, String(getFormCount() + 1));
  } catch {
    /* ignore */
  }
}

/** 是否处于已发布的公开访问页（用于真正计数，避免编辑器预览误累加） */
function isPublishedPage(): boolean {
  try {
    return typeof window !== 'undefined' && window.location.pathname.startsWith('/p/');
  } catch {
    return false;
  }
}

/** 安全读取 data 字段 */
function d<T = any>(el: WidgetElement, key: string, fallback: T): T {
  const v = el.data?.[key];
  return v === undefined || v === null ? fallback : (v as T);
}

/** 把 options 文本框（每行一项）解析为字符串数组 */
function parseLines(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String);
  return String(v ?? '')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
}

/* 省市区级联数据（精简演示用） */
const REGION_DATA: Record<string, Record<string, string[]>> = {
  北京市: { 北京市: ['东城区', '西城区', '朝阳区', '海淀区', '丰台区'] },
  上海市: { 上海市: ['浦东新区', '黄浦区', '徐汇区', '静安区', '长宁区'] },
  广东省: {
    广州市: ['天河区', '越秀区', '海珠区', '番禺区'],
    深圳市: ['福田区', '南山区', '罗湖区', '宝安区'],
  },
  新疆: {
    乌鲁木齐市: ['天山区', '沙依巴克区', '新市区', '水磨沟区'],
    克拉玛依市: ['克拉玛依区', '独山子区'],
  },
};

/* ───────── 1. 浏览量 ───────── */
function ViewCountDOM({ el, style, dataAttrs }: WidgetDOMProps) {
  const initial = d(el, 'count', 0);
  const suffix = d(el, 'suffix', '次浏览');
  const [count, setCount] = useState(initial);

  useEffect(() => {
    if (!isPublishedPage()) return;
    try {
      const key = `h5design_view_${el.id}`;
      const cur = parseInt(localStorage.getItem(key) || String(initial), 10) || initial;
      const next = cur + 1;
      localStorage.setItem(key, String(next));
      setCount(next);
    } catch {
      /* ignore */
    }
  }, [el.id, initial]);

  const s: React.CSSProperties = {
    ...style,
    boxSizing: 'border-box',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: '10px 14px',
    fontFamily: 'Microsoft YaHei, PingFang SC, sans-serif',
    color: el.textColor || '#333333',
    background: el.bgColor || '#ffffff',
    overflow: 'hidden',
  };
  return (
    <div {...dataAttrs} style={s}>
      <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke={el.themeColor || '#ef4444'} strokeWidth={1.8}>
        <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
      <span style={{ fontSize: 18, fontWeight: 700 }}>{count}</span>
      <span style={{ fontSize: 13, opacity: 0.8 }}>{suffix}</span>
    </div>
  );
}

/* ───────── 2. 动态数字 ───────── */
function DynamicNumberDOM({ el, style, dataAttrs }: WidgetDOMProps) {
  const value = d(el, 'value', 0);
  const label = d(el, 'label', '');
  const prefix = d(el, 'prefix', '');
  const suffix = d(el, 'suffix', '');
  const duration = d(el, 'duration', 1.5);
  const [disp, setDisp] = useState(0);

  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / (duration * 1000));
      setDisp(Math.round(value * p));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  const s: React.CSSProperties = {
    ...style,
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    padding: 10,
    fontFamily: 'Microsoft YaHei, PingFang SC, sans-serif',
    color: el.textColor || '#333333',
    background: el.bgColor || '#ffffff',
    overflow: 'hidden',
  };
  return (
    <div {...dataAttrs} style={s}>
      {label && <div style={{ fontSize: 13, opacity: 0.8 }}>{label}</div>}
      <div style={{ fontSize: 30, fontWeight: 800, color: el.themeColor || '#ef4444', lineHeight: 1.1 }}>
        {prefix}
        {disp}
        {suffix}
      </div>
    </div>
  );
}

/* ───────── 3. 截图 ───────── */
function ScreenshotDOM({ el, style, dataAttrs }: WidgetDOMProps) {
  const src = d(el, 'src', '');
  const caption = d(el, 'caption', '');
  const s: React.CSSProperties = {
    ...style,
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 8,
    background: el.bgColor || '#ffffff',
    overflow: 'hidden',
  };
  return (
    <div {...dataAttrs} style={s}>
      {src ? (
        <img src={src} alt={caption} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 6 }} />
      ) : (
        <div style={{ flex: 1, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9', borderRadius: 6, color: '#94a3b8' }}>
          <svg viewBox="0 0 24 24" width={32} height={32} fill="none" stroke="currentColor" strokeWidth={1.6}>
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <path d="M21 15l-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
          </svg>
        </div>
      )}
      {caption && <div style={{ fontSize: 12, color: '#64748b' }}>{caption}</div>}
    </div>
  );
}

/* ───────── 4. 表格 ───────── */
function TableDOM({ el, style, dataAttrs }: WidgetDOMProps) {
  const csv = d(el, 'csv', '');
  const headerBg = el.themeColor || '#ef4444';
  const rows = parseLines(csv).map((r) => r.split(','));
  const s: React.CSSProperties = {
    ...style,
    boxSizing: 'border-box',
    padding: 6,
    background: el.bgColor || '#ffffff',
    overflow: 'auto',
    fontFamily: 'Microsoft YaHei, PingFang SC, sans-serif',
    color: el.textColor || '#333333',
  };
  if (rows.length === 0) {
    return (
      <div {...dataAttrs} style={{ ...s, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 12 }}>
        请在属性面板填写表格内容
      </div>
    );
  }
  return (
    <div {...dataAttrs} style={s}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr>
            {rows[0].map((c, i) => (
              <th key={i} style={{ border: '1px solid #e5e7eb', padding: '4px 6px', background: headerBg, color: '#fff', fontWeight: 600 }}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(1).map((r, ri) => (
            <tr key={ri} style={{ background: ri % 2 ? '#fafafa' : '#fff' }}>
              {r.map((c, ci) => (
                <td key={ci} style={{ border: '1px solid #e5e7eb', padding: '4px 6px', textAlign: 'center' }}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ───────── 5. 投票 ───────── */
function VoteDOM({ el, style, dataAttrs }: WidgetDOMProps) {
  const question = d(el, 'question', '投票');
  const options = parseLines(d(el, 'options', []));
  const key = `h5design_vote_${el.id}`;
  const [votes, setVotes] = useState<number[]>(() => options.map(() => 0));
  const [chosen, setChosen] = useState<number | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const obj = JSON.parse(raw);
        if (Array.isArray(obj.counts)) setVotes(obj.counts);
        if (typeof obj.chosen === 'number') setChosen(obj.chosen);
      }
    } catch {
      /* ignore */
    }
  }, [key]);

  const choose = (i: number) => {
    if (chosen !== null) return;
    const next = [...votes];
    next[i] = (next[i] || 0) + 1;
    setVotes(next);
    setChosen(i);
    try {
      localStorage.setItem(key, JSON.stringify({ counts: next, chosen: i }));
    } catch {
      /* ignore */
    }
  };

  const total = votes.reduce((a, b) => a + b, 0) || 1;
  const s: React.CSSProperties = {
    ...style,
    boxSizing: 'border-box',
    padding: 12,
    background: el.bgColor || '#ffffff',
    overflow: 'hidden',
    fontFamily: 'Microsoft YaHei, PingFang SC, sans-serif',
    color: el.textColor || '#333333',
  };
  return (
    <div {...dataAttrs} style={s}>
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>{question}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {options.map((opt, i) => {
          const pct = Math.round(((votes[i] || 0) / total) * 100);
          const isChosen = chosen === i;
          return (
            <button
              key={i}
              onClick={() => choose(i)}
              style={{
                position: 'relative',
                border: `1px solid ${el.themeColor || '#ef4444'}`,
                borderRadius: 6,
                padding: '6px 10px',
                background: isChosen ? el.themeColor || '#ef4444' : '#fff',
                color: isChosen ? '#fff' : el.textColor || '#333',
                cursor: chosen === null ? 'pointer' : 'default',
                overflow: 'hidden',
                fontSize: 13,
                textAlign: 'left',
              }}
            >
              <span style={{ position: 'absolute', inset: 0, width: `${pct}%`, background: isChosen ? 'rgba(255,255,255,0.25)' : 'rgba(239,68,68,0.12)', transition: 'width 0.3s' }} />
              <span style={{ position: 'relative', display: 'flex', justifyContent: 'space-between' }}>
                <span>{opt}</span>
                {chosen !== null && <span>{pct}%</span>}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ───────── 6. 接力 ───────── */
function RelayDOM({ el, style, dataAttrs }: WidgetDOMProps) {
  const title = el.title || '爱心接力';
  const buttonText = d(el, 'buttonText', '我要接力');
  const initial = d(el, 'count', 0);
  const key = `h5design_relay_${el.id}`;
  const [count, setCount] = useState(initial);
  const [joined, setJoined] = useState(false);

  useEffect(() => {
    try {
      const v = localStorage.getItem(key);
      if (v) {
        setJoined(true);
        setCount(initial + 1);
      }
    } catch {
      /* ignore */
    }
  }, [key, initial]);

  const join = () => {
    if (joined) return;
    setJoined(true);
    setCount((c) => c + 1);
    try {
      localStorage.setItem(key, '1');
    } catch {
      /* ignore */
    }
  };

  const s: React.CSSProperties = {
    ...style,
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 12,
    background: el.bgColor || '#ffffff',
    overflow: 'hidden',
    fontFamily: 'Microsoft YaHei, PingFang SC, sans-serif',
    color: el.textColor || '#333333',
  };
  return (
    <div {...dataAttrs} style={s}>
      <div style={{ fontSize: 15, fontWeight: 600 }}>{title}</div>
      <div style={{ fontSize: 13, opacity: 0.8 }}>已有 {count} 人参与接力</div>
      <button
        onClick={join}
        disabled={joined}
        style={{
          border: 'none',
          borderRadius: 20,
          padding: '6px 18px',
          background: joined ? '#cbd5e1' : el.themeColor || '#ef4444',
          color: '#fff',
          fontSize: 13,
          cursor: joined ? 'default' : 'pointer',
        }}
      >
        {joined ? '已接力' : buttonText}
      </button>
    </div>
  );
}

/* ───────── 7. 数据图表 ───────── */
function DataChartDOM({ el, style, dataAttrs }: WidgetDOMProps) {
  const title = d(el, 'title', '');
  const items = parseLines(d(el, 'items', [])).map((l) => {
    const [label, val] = l.split(':');
    return { label: (label || '').trim(), value: parseFloat((val || '0').trim()) || 0 };
  });
  const max = Math.max(1, ...items.map((i) => i.value));
  const s: React.CSSProperties = {
    ...style,
    boxSizing: 'border-box',
    padding: 12,
    background: el.bgColor || '#ffffff',
    overflow: 'hidden',
    fontFamily: 'Microsoft YaHei, PingFang SC, sans-serif',
    color: el.textColor || '#333333',
  };
  return (
    <div {...dataAttrs} style={s}>
      {title && <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>{title}</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map((it, i) => (
          <div key={i}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 2 }}>
              <span>{it.label}</span>
              <span style={{ color: el.themeColor || '#ef4444', fontWeight: 600 }}>{it.value}</span>
            </div>
            <div style={{ height: 10, background: '#f1f5f9', borderRadius: 5, overflow: 'hidden' }}>
              <div style={{ width: `${(it.value / max) * 100}%`, height: '100%', background: el.themeColor || '#ef4444', borderRadius: 5, transition: 'width 0.4s' }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ───────── 8. 答题 ───────── */
function QuizDOM({ el, style, dataAttrs }: WidgetDOMProps) {
  const question = d(el, 'question', '答题');
  const options = parseLines(d(el, 'options', []));
  const answer = d(el, 'answer', 0);
  const key = `h5design_quiz_${el.id}`;
  const [picked, setPicked] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);

  useEffect(() => {
    try {
      const v = localStorage.getItem(key);
      if (v) {
        setPicked(parseInt(v, 10));
        setAnswered(true);
      }
    } catch {
      /* ignore */
    }
  }, [key]);

  const pick = (i: number) => {
    if (answered) return;
    setPicked(i);
    setAnswered(true);
    try {
      localStorage.setItem(key, String(i));
    } catch {
      /* ignore */
    }
  };

  const s: React.CSSProperties = {
    ...style,
    boxSizing: 'border-box',
    padding: 12,
    background: el.bgColor || '#ffffff',
    overflow: 'hidden',
    fontFamily: 'Microsoft YaHei, PingFang SC, sans-serif',
    color: el.textColor || '#333333',
  };
  return (
    <div {...dataAttrs} style={s}>
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>{question}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {options.map((opt, i) => {
          let bg = '#fff';
          let color = el.textColor || '#333';
          let border = el.themeColor || '#ef4444';
          if (answered) {
            if (i === answer) {
              bg = '#dcfce7';
              border = '#22c55e';
              color = '#166534';
            } else if (i === picked) {
              bg = '#fee2e2';
              border = '#ef4444';
              color = '#991b1b';
            }
          }
          return (
            <button
              key={i}
              onClick={() => pick(i)}
              style={{ border: `1px solid ${border}`, borderRadius: 6, padding: '6px 10px', background: bg, color, cursor: answered ? 'default' : 'pointer', fontSize: 13, textAlign: 'left' }}
            >
              {opt}
            </button>
          );
        })}
      </div>
      {answered && (
        <div style={{ marginTop: 8, fontSize: 13, fontWeight: 600, color: picked === answer ? '#16a34a' : '#dc2626' }}>
          {picked === answer ? '回答正确 🎉' : `正确答案：${options[answer] || ''}`}
        </div>
      )}
    </div>
  );
}

/* ───────── 9. 抽奖 ───────── */
function LotteryDOM({ el, style, dataAttrs }: WidgetDOMProps) {
  const prizes = parseLines(d(el, 'prizes', []));
  const buttonText = d(el, 'buttonText', '开始抽奖');
  const [result, setResult] = useState<string | null>(null);
  const [spinning, setSpinning] = useState(false);

  const draw = () => {
    if (spinning || prizes.length === 0) return;
    setSpinning(true);
    let ticks = 0;
    const timer = setInterval(() => {
      ticks++;
      setResult(prizes[Math.floor(Math.random() * prizes.length)]);
      if (ticks > 12) {
        clearInterval(timer);
        setSpinning(false);
      }
    }, 70);
  };

  const s: React.CSSProperties = {
    ...style,
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 12,
    background: el.bgColor || '#ffffff',
    overflow: 'hidden',
    fontFamily: 'Microsoft YaHei, PingFang SC, sans-serif',
    color: el.textColor || '#333333',
  };
  return (
    <div {...dataAttrs} style={s}>
      <div style={{ minHeight: 24, fontSize: 18, fontWeight: 800, color: el.themeColor || '#ef4444', textAlign: 'center' }}>
        {result ? `🎁 ${result}` : '试试手气'}
      </div>
      <button
        onClick={draw}
        disabled={spinning}
        style={{ border: 'none', borderRadius: 20, padding: '6px 20px', background: el.themeColor || '#ef4444', color: '#fff', fontSize: 14, cursor: spinning ? 'default' : 'pointer' }}
      >
        {buttonText}
      </button>
    </div>
  );
}

/* ───────── 10. 快捷表单 ───────── */
function QuickFormDOM({ el, style, dataAttrs }: WidgetDOMProps) {
  const title = el.title || '快捷表单';
  const buttonText = d(el, 'buttonText', '提交');
  const fields = d<{ label: string; type: string }[]>(el, 'fields', [
    { label: '姓名', type: 'text' },
    { label: '手机', type: 'tel' },
    { label: '留言', type: 'textarea' },
  ]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);

  const submit = () => {
    const key = `h5design_form_${el.id}`;
    try {
      const arr = JSON.parse(localStorage.getItem(key) || '[]');
      arr.push({ ...values, time: new Date().toISOString() });
      localStorage.setItem(key, JSON.stringify(arr));
      incFormCount();
    } catch {
      /* ignore */
    }
    setDone(true);
  };

  const s: React.CSSProperties = {
    ...style,
    boxSizing: 'border-box',
    padding: 12,
    background: el.bgColor || '#ffffff',
    overflow: 'auto',
    fontFamily: 'Microsoft YaHei, PingFang SC, sans-serif',
    color: el.textColor || '#333333',
  };
  return (
    <div {...dataAttrs} style={s}>
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>{title}</div>
      {done ? (
        <div style={{ color: '#16a34a', fontSize: 14, textAlign: 'center', padding: '12px 0' }}>提交成功，谢谢参与！</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {fields.map((f, i) =>
            f.type === 'textarea' ? (
              <textarea
                key={i}
                placeholder={f.label}
                value={values[f.label] || ''}
                onChange={(e) => setValues((v) => ({ ...v, [f.label]: e.target.value }))}
                style={{ border: '1px solid #d1d5db', borderRadius: 6, padding: 6, fontSize: 13, fontFamily: 'inherit', resize: 'vertical', minHeight: 48 }}
              />
            ) : (
              <input
                key={i}
                type={f.type === 'tel' ? 'tel' : 'text'}
                placeholder={f.label}
                value={values[f.label] || ''}
                onChange={(e) => setValues((v) => ({ ...v, [f.label]: e.target.value }))}
                style={{ border: '1px solid #d1d5db', borderRadius: 6, padding: '6px 8px', fontSize: 13, fontFamily: 'inherit' }}
              />
            ),
          )}
          <button onClick={submit} style={{ border: 'none', borderRadius: 6, padding: '8px 0', background: el.themeColor || '#ef4444', color: '#fff', fontSize: 14, cursor: 'pointer' }}>
            {buttonText}
          </button>
        </div>
      )}
    </div>
  );
}

/* ───────── 11. 输入框 ───────── */
function InputBoxDOM({ el, style, dataAttrs }: WidgetDOMProps) {
  const label = d(el, 'label', '');
  const placeholder = d(el, 'placeholder', '请输入');
  const buttonText = d(el, 'buttonText', '提交');
  const [value, setValue] = useState('');
  const [done, setDone] = useState(false);

  const submit = () => {
    const key = `h5design_input_${el.id}`;
    try {
      const arr = JSON.parse(localStorage.getItem(key) || '[]');
      arr.push({ value, time: new Date().toISOString() });
      localStorage.setItem(key, JSON.stringify(arr));
      incFormCount();
    } catch {
      /* ignore */
    }
    setDone(true);
  };

  const s: React.CSSProperties = {
    ...style,
    boxSizing: 'border-box',
    padding: 12,
    background: el.bgColor || '#ffffff',
    overflow: 'hidden',
    fontFamily: 'Microsoft YaHei, PingFang SC, sans-serif',
    color: el.textColor || '#333333',
  };
  return (
    <div {...dataAttrs} style={s}>
      {label && <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{label}</div>}
      {done ? (
        <div style={{ color: '#16a34a', fontSize: 13, textAlign: 'center' }}>提交成功，谢谢！</div>
      ) : (
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            value={value}
            placeholder={placeholder}
            onChange={(e) => setValue(e.target.value)}
            style={{ flex: 1, border: '1px solid #d1d5db', borderRadius: 6, padding: '6px 8px', fontSize: 13, fontFamily: 'inherit', minWidth: 0 }}
          />
          <button onClick={submit} style={{ border: 'none', borderRadius: 6, padding: '0 14px', background: el.themeColor || '#ef4444', color: '#fff', fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            {buttonText}
          </button>
        </div>
      )}
    </div>
  );
}

/* ───────── 12. 身份证 ───────── */
function IdCardDOM({ el, style, dataAttrs }: WidgetDOMProps) {
  const label = d(el, 'label', '实名认证');
  const placeholder = d(el, 'placeholder', '请输入身份证号');
  const [value, setValue] = useState('');
  const [status, setStatus] = useState<'' | 'ok' | 'err'>('');

  const validate = (v: string) => {
    const re = /^\d{17}[\dXx]$/;
    if (!re.test(v)) return false;
    const weights = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
    const codes = ['1', '0', 'X', '9', '8', '7', '6', '5', '4', '3', '2'];
    let sum = 0;
    for (let i = 0; i < 17; i++) sum += parseInt(v[i], 10) * weights[i];
    return codes[sum % 11] === v[17].toUpperCase();
  };

  const check = () => setStatus(validate(value) ? 'ok' : 'err');

  const s: React.CSSProperties = {
    ...style,
    boxSizing: 'border-box',
    padding: 12,
    background: el.bgColor || '#ffffff',
    overflow: 'hidden',
    fontFamily: 'Microsoft YaHei, PingFang SC, sans-serif',
    color: el.textColor || '#333333',
  };
  return (
    <div {...dataAttrs} style={s}>
      {label && <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{label}</div>}
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          value={value}
          placeholder={placeholder}
          maxLength={18}
          onChange={(e) => setValue(e.target.value)}
          onBlur={check}
          style={{ flex: 1, border: `1px solid ${status === 'err' ? '#ef4444' : '#d1d5db'}`, borderRadius: 6, padding: '6px 8px', fontSize: 13, fontFamily: 'inherit', minWidth: 0 }}
        />
      </div>
      {status === 'ok' && <div style={{ color: '#16a34a', fontSize: 12, marginTop: 4 }}>✓ 格式正确</div>}
      {status === 'err' && <div style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>✗ 身份证号格式有误</div>}
    </div>
  );
}

/* ───────── 13. 下拉列表 ───────── */
function DropdownDOM({ el, style, dataAttrs }: WidgetDOMProps) {
  const label = d(el, 'label', '');
  const options = parseLines(d(el, 'options', []));
  const [value, setValue] = useState(options[0] || '');
  const s: React.CSSProperties = {
    ...style,
    boxSizing: 'border-box',
    padding: 12,
    background: el.bgColor || '#ffffff',
    overflow: 'hidden',
    fontFamily: 'Microsoft YaHei, PingFang SC, sans-serif',
    color: el.textColor || '#333333',
  };
  return (
    <div {...dataAttrs} style={s}>
      {label && <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{label}</div>}
      <select
        value={value}
        onChange={(e) => setValue(e.target.value)}
        style={{ width: '100%', border: `1px solid ${el.themeColor || '#ef4444'}`, borderRadius: 6, padding: '6px 8px', fontSize: 13, fontFamily: 'inherit', background: '#fff' }}
      >
        {options.map((o, i) => (
          <option key={i} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}

/* ───────── 14. 单选 ───────── */
function SingleSelectDOM({ el, style, dataAttrs }: WidgetDOMProps) {
  const label = d(el, 'label', '');
  const options = parseLines(d(el, 'options', []));
  const [value, setValue] = useState('');
  const s: React.CSSProperties = {
    ...style,
    boxSizing: 'border-box',
    padding: 12,
    background: el.bgColor || '#ffffff',
    overflow: 'hidden',
    fontFamily: 'Microsoft YaHei, PingFang SC, sans-serif',
    color: el.textColor || '#333333',
  };
  return (
    <div {...dataAttrs} style={s}>
      {label && <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{label}</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {options.map((o, i) => (
          <label key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
            <input type="radio" name={`ss_${el.id}`} checked={value === o} onChange={() => setValue(o)} style={{ accentColor: el.themeColor || '#ef4444' }} />
            {o}
          </label>
        ))}
      </div>
    </div>
  );
}

/* ───────── 15. 多选 ───────── */
function MultiSelectDOM({ el, style, dataAttrs }: WidgetDOMProps) {
  const label = d(el, 'label', '');
  const options = parseLines(d(el, 'options', []));
  const [values, setValues] = useState<string[]>([]);
  const toggle = (o: string) => setValues((v) => (v.includes(o) ? v.filter((x) => x !== o) : [...v, o]));
  const s: React.CSSProperties = {
    ...style,
    boxSizing: 'border-box',
    padding: 12,
    background: el.bgColor || '#ffffff',
    overflow: 'hidden',
    fontFamily: 'Microsoft YaHei, PingFang SC, sans-serif',
    color: el.textColor || '#333333',
  };
  return (
    <div {...dataAttrs} style={s}>
      {label && <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{label}</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {options.map((o, i) => (
          <label key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
            <input type="checkbox" checked={values.includes(o)} onChange={() => toggle(o)} style={{ accentColor: el.themeColor || '#ef4444' }} />
            {o}
          </label>
        ))}
      </div>
    </div>
  );
}

/* ───────── 16. 评分 ───────── */
function RatingDOM({ el, style, dataAttrs }: WidgetDOMProps) {
  const title = el.title || '评分';
  const max = d(el, 'max', 5);
  const key = `h5design_rating_${el.id}`;
  const [value, setValue] = useState(0);
  const [hover, setHover] = useState(0);

  useEffect(() => {
    try {
      const v = localStorage.getItem(key);
      if (v) setValue(parseInt(v, 10));
    } catch {
      /* ignore */
    }
  }, [key]);

  const rate = (i: number) => {
    setValue(i);
    try {
      localStorage.setItem(key, String(i));
    } catch {
      /* ignore */
    }
  };

  const s: React.CSSProperties = {
    ...style,
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 12,
    background: el.bgColor || '#ffffff',
    overflow: 'hidden',
    fontFamily: 'Microsoft YaHei, PingFang SC, sans-serif',
    color: el.textColor || '#333333',
  };
  return (
    <div {...dataAttrs} style={s}>
      <div style={{ fontSize: 14, fontWeight: 600 }}>{title}</div>
      <div style={{ display: 'flex', gap: 4 }}>
        {Array.from({ length: max }).map((_, i) => {
          const idx = i + 1;
          const active = (hover || value) >= idx;
          return (
            <span
              key={i}
              onClick={() => rate(idx)}
              onMouseEnter={() => setHover(idx)}
              onMouseLeave={() => setHover(0)}
              style={{ cursor: 'pointer', fontSize: 28, lineHeight: 1, color: active ? el.themeColor || '#f59e0b' : '#d1d5db', transition: 'color 0.15s' }}
            >
              ★
            </span>
          );
        })}
      </div>
      <div style={{ fontSize: 12, opacity: 0.8 }}>{value > 0 ? `已评 ${value} 分` : '点击星星评分'}</div>
    </div>
  );
}

/* ───────── 17. 上传图片 ───────── */
function UploadImageDOM({ el, style, dataAttrs }: WidgetDOMProps) {
  const label = d(el, 'label', '上传图片');
  const maxCount = d(el, 'maxCount', 3);
  const key = `h5design_upload_${el.id}`;
  const [imgs, setImgs] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const v = localStorage.getItem(key);
      if (v) setImgs(JSON.parse(v));
    } catch {
      /* ignore */
    }
  }, [key]);

  const onFiles = (files: FileList | null) => {
    if (!files) return;
    const readers: Promise<string>[] = [];
    for (let i = 0; i < Math.min(files.length, maxCount - imgs.length); i++) {
      readers.push(
        new Promise((res) => {
          const fr = new FileReader();
          fr.onload = () => res(fr.result as string);
          fr.readAsDataURL(files[i]);
        }),
      );
    }
    Promise.all(readers).then((b64) => {
      const next = [...imgs, ...b64];
      setImgs(next);
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {
        /* ignore */
      }
    });
  };

  const s: React.CSSProperties = {
    ...style,
    boxSizing: 'border-box',
    padding: 12,
    background: el.bgColor || '#ffffff',
    overflow: 'hidden',
    fontFamily: 'Microsoft YaHei, PingFang SC, sans-serif',
    color: el.textColor || '#333333',
  };
  return (
    <div {...dataAttrs} style={s}>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{label}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {imgs.map((src, i) => (
          <img key={i} src={src} alt="" style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 6, border: '1px solid #e5e7eb' }} />
        ))}
        {imgs.length < maxCount && (
          <button onClick={() => fileRef.current?.click()} style={{ width: 48, height: 48, borderRadius: 6, border: `1px dashed ${el.themeColor || '#ef4444'}`, background: '#fff', color: el.themeColor || '#ef4444', fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>
            +
          </button>
        )}
      </div>
      <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => onFiles(e.target.files)} />
    </div>
  );
}

/* ───────── 18. 表单登记数 ───────── */
function FormCountDOM({ el, style, dataAttrs }: WidgetDOMProps) {
  const label = d(el, 'label', '已有');
  const suffix = d(el, 'suffix', '人报名');
  const [count, setCount] = useState(0);
  useEffect(() => setCount(getFormCount()), []);
  const s: React.CSSProperties = {
    ...style,
    boxSizing: 'border-box',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 12,
    background: el.bgColor || '#ffffff',
    overflow: 'hidden',
    fontFamily: 'Microsoft YaHei, PingFang SC, sans-serif',
    color: el.textColor || '#333333',
  };
  return (
    <div {...dataAttrs} style={s}>
      <span style={{ fontSize: 14 }}>{label}</span>
      <span style={{ fontSize: 26, fontWeight: 800, color: el.themeColor || '#ef4444' }}>{count}</span>
      <span style={{ fontSize: 14 }}>{suffix}</span>
    </div>
  );
}

/* ───────── 19. 省市区 ───────── */
function RegionDOM({ el, style, dataAttrs }: WidgetDOMProps) {
  const label = d(el, 'label', '所在地区');
  const provinces = Object.keys(REGION_DATA);
  const [prov, setProv] = useState(provinces[0]);
  const [city, setCity] = useState(Object.keys(REGION_DATA[provinces[0]])[0]);
  const [dist, setDist] = useState(REGION_DATA[provinces[0]][Object.keys(REGION_DATA[provinces[0]])[0]][0]);

  const selStyle: React.CSSProperties = {
    flex: 1,
    minWidth: 0,
    border: `1px solid ${el.themeColor || '#ef4444'}`,
    borderRadius: 6,
    padding: '6px 4px',
    fontSize: 12,
    fontFamily: 'inherit',
    background: '#fff',
  };
  const s: React.CSSProperties = {
    ...style,
    boxSizing: 'border-box',
    padding: 12,
    background: el.bgColor || '#ffffff',
    overflow: 'hidden',
    fontFamily: 'Microsoft YaHei, PingFang SC, sans-serif',
    color: el.textColor || '#333333',
  };
  return (
    <div {...dataAttrs} style={s}>
      {label && <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{label}</div>}
      <div style={{ display: 'flex', gap: 4 }}>
        <select value={prov} onChange={(e) => { const p = e.target.value; setProv(p); const c = Object.keys(REGION_DATA[p])[0]; setCity(c); setDist(REGION_DATA[p][c][0]); }} style={selStyle}>
          {provinces.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
        <select value={city} onChange={(e) => { const c = e.target.value; setCity(c); setDist(REGION_DATA[prov][c][0]); }} style={selStyle}>
          {Object.keys(REGION_DATA[prov]).map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <select value={dist} onChange={(e) => setDist(e.target.value)} style={selStyle}>
          {REGION_DATA[prov][city].map((dt) => (
            <option key={dt}>{dt}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

/* ───────── 20. 微信昵称 ───────── */
function WechatNicknameDOM({ el, style, dataAttrs }: WidgetDOMProps) {
  const prefix = d(el, 'prefix', '');
  const suffix = d(el, 'suffix', '');
  const s: React.CSSProperties = {
    ...style,
    boxSizing: 'border-box',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    padding: '10px 12px',
    background: el.bgColor || '#ffffff',
    overflow: 'hidden',
    fontFamily: 'Microsoft YaHei, PingFang SC, sans-serif',
    color: el.textColor || '#333333',
    fontSize: 15,
  };
  return (
    <div {...dataAttrs} style={s}>
      {prefix && <span>{prefix}</span>}
      <span style={{ color: '#07c160', fontWeight: 600 }}>微信用户</span>
      {suffix && <span>{suffix}</span>}
    </div>
  );
}

/* ───────── 21. 微信头像 ───────── */
function WechatAvatarDOM({ el, style, dataAttrs }: WidgetDOMProps) {
  const size = d(el, 'size', 64);
  const s: React.CSSProperties = {
    ...style,
    boxSizing: 'border-box',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: el.bgColor || '#ffffff',
    overflow: 'hidden',
  };
  return (
    <div {...dataAttrs} style={s}>
      <div style={{ width: size, height: size, borderRadius: '50%', background: '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>
        <svg viewBox="0 0 24 24" width={size * 0.6} height={size * 0.6} fill="currentColor">
          <path d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0 2c-4 0-8 2-8 5v1h16v-1c0-3-4-5-8-5Z" />
        </svg>
      </div>
    </div>
  );
}

/* ───────── 22. 微信头像墙 ───────── */
function WechatAvatarWallDOM({ el, style, dataAttrs }: WidgetDOMProps) {
  const count = d(el, 'count', 6);
  const s: React.CSSProperties = {
    ...style,
    boxSizing: 'border-box',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 8,
    padding: 12,
    background: el.bgColor || '#ffffff',
    overflow: 'hidden',
  };
  return (
    <div {...dataAttrs} style={s}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{ width: 40, height: 40, borderRadius: '50%', background: '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>
          <svg viewBox="0 0 24 24" width={22} height={22} fill="currentColor">
            <path d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0 2c-4 0-8 2-8 5v1h16v-1c0-3-4-5-8-5Z" />
          </svg>
        </div>
      ))}
    </div>
  );
}

/* ───────── 23. 作品封面 ───────── */
function WorkCoverDOM({ el, style, dataAttrs }: WidgetDOMProps) {
  const src = d(el, 'src', '');
  const s: React.CSSProperties = {
    ...style,
    boxSizing: 'border-box',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: el.bgColor || '#ffffff',
    overflow: 'hidden',
  };
  return (
    <div {...dataAttrs} style={s}>
      {src ? (
        <img src={src} alt="封面" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        <div style={{ color: '#94a3b8', fontSize: 13 }}>作品封面</div>
      )}
    </div>
  );
}

/* ───────── 24. 作品标题 ───────── */
function WorkTitleDOM({ el, style, dataAttrs }: WidgetDOMProps) {
  const text = el.text || '作品标题';
  const s: React.CSSProperties = {
    ...style,
    boxSizing: 'border-box',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    background: el.bgColor || '#ffffff',
    overflow: 'hidden',
    fontFamily: 'Microsoft YaHei, PingFang SC, sans-serif',
    color: el.textColor || '#333333',
    fontSize: 22,
    fontWeight: 800,
    textAlign: 'center',
  };
  return (
    <div {...dataAttrs} style={s}>
      {text}
    </div>
  );
}

/* ───────── 注册表 ───────── */

const f = (key: string, labelKey: string, type: WidgetFieldDef['type'], extra: Partial<WidgetFieldDef> = {}): WidgetFieldDef => ({
  key,
  labelKey,
  type,
  ...extra,
});

export const WIDGET_REGISTRY: Record<WidgetKind, WidgetDef> = {
  viewCount: {
    kind: 'viewCount',
    labelKey: 'editor:componentMenu.items.viewCount',
    icon: '👁',
    category: 'view',
    defaultSize: { width: 200, height: 64 },
    createDefault: () => ({ title: '浏览量', themeColor: '#ef4444', textColor: '#333333', bgColor: '#fff7f7', data: { count: 1280, suffix: '次浏览' } }),
    commonFields: ['title', 'themeColor', 'textColor', 'bgColor'],
    fields: [f('count', 'editor:widget.fields.initialCount', 'number'), f('suffix', 'editor:widget.fields.suffix', 'text')],
    DOM: ViewCountDOM,
  },
  dynamicNumber: {
    kind: 'dynamicNumber',
    labelKey: 'editor:componentMenu.items.dynamicNumber',
    icon: '🔢',
    category: 'view',
    defaultSize: { width: 200, height: 90 },
    createDefault: () => ({ themeColor: '#ef4444', textColor: '#333333', bgColor: '#ffffff', data: { value: 365, label: '我们在一起', prefix: '', suffix: '天', duration: 1.5 } }),
    commonFields: ['themeColor', 'textColor', 'bgColor'],
    fields: [
      f('value', 'editor:widget.fields.value', 'number'),
      f('label', 'editor:widget.fields.label', 'text'),
      f('prefix', 'editor:widget.fields.prefix', 'text'),
      f('suffix', 'editor:widget.fields.suffix', 'text'),
      f('duration', 'editor:widget.fields.duration', 'number', { min: 0.2, max: 5, step: 0.1 }),
    ],
    DOM: DynamicNumberDOM,
  },
  screenshot: {
    kind: 'screenshot',
    labelKey: 'editor:componentMenu.items.screenshot',
    icon: '🖼',
    category: 'view',
    defaultSize: { width: 240, height: 160 },
    createDefault: () => ({ bgColor: '#ffffff', data: { src: '', caption: '精彩瞬间' } }),
    commonFields: ['bgColor'],
    fields: [f('src', 'editor:widget.fields.src', 'image'), f('caption', 'editor:widget.fields.caption', 'text')],
    DOM: ScreenshotDOM,
  },
  table: {
    kind: 'table',
    labelKey: 'editor:componentMenu.items.table',
    icon: '▦',
    category: 'view',
    defaultSize: { width: 260, height: 160 },
    createDefault: () => ({ themeColor: '#ef4444', textColor: '#333333', bgColor: '#ffffff', data: { csv: '姓名,祝福\n小明,新婚快乐\n小红,百年好合', headerBg: '#ef4444' } }),
    commonFields: ['themeColor', 'textColor', 'bgColor'],
    fields: [f('csv', 'editor:widget.fields.csv', 'textarea'), f('headerBg', 'editor:widget.fields.headerBg', 'color')],
    DOM: TableDOM,
  },
  vote: {
    kind: 'vote',
    labelKey: 'editor:componentMenu.items.vote',
    icon: '🗳',
    category: 'interactive',
    defaultSize: { width: 260, height: 200 },
    createDefault: () => ({ themeColor: '#ef4444', textColor: '#333333', bgColor: '#ffffff', data: { question: '你最喜欢哪个环节？', options: ['仪式', '晚宴', '游戏'] } }),
    commonFields: ['themeColor', 'textColor', 'bgColor'],
    fields: [f('question', 'editor:widget.fields.question', 'text'), f('options', 'editor:widget.fields.options', 'options')],
    DOM: VoteDOM,
  },
  relay: {
    kind: 'relay',
    labelKey: 'editor:componentMenu.items.relay',
    icon: '🔗',
    category: 'interactive',
    defaultSize: { width: 240, height: 110 },
    createDefault: () => ({ title: '爱心接力', themeColor: '#ef4444', textColor: '#333333', bgColor: '#ffffff', data: { count: 88, buttonText: '我要接力' } }),
    commonFields: ['title', 'themeColor', 'textColor', 'bgColor'],
    fields: [f('buttonText', 'editor:widget.fields.buttonText', 'text')],
    DOM: RelayDOM,
  },
  dataChart: {
    kind: 'dataChart',
    labelKey: 'editor:componentMenu.items.dataChart',
    icon: '📊',
    category: 'view',
    defaultSize: { width: 260, height: 180 },
    createDefault: () => ({ themeColor: '#ef4444', textColor: '#333333', bgColor: '#ffffff', data: { title: '到场人数统计', items: '去年:120\n今年:188\n预计:220' } }),
    commonFields: ['themeColor', 'textColor', 'bgColor'],
    fields: [f('title', 'editor:widget.fields.title', 'text'), f('items', 'editor:widget.fields.items', 'textarea')],
    DOM: DataChartDOM,
  },
  quiz: {
    kind: 'quiz',
    labelKey: 'editor:componentMenu.items.quiz',
    icon: '❓',
    category: 'interactive',
    defaultSize: { width: 260, height: 200 },
    createDefault: () => ({ themeColor: '#ef4444', textColor: '#333333', bgColor: '#ffffff', data: { question: '新郎新娘认识多久了？', options: ['1年', '3年', '5年'], answer: 1 } }),
    commonFields: ['themeColor', 'textColor', 'bgColor'],
    fields: [f('question', 'editor:widget.fields.question', 'text'), f('options', 'editor:widget.fields.options', 'options'), f('answer', 'editor:widget.fields.answer', 'number', { min: 0 })],
    DOM: QuizDOM,
  },
  lottery: {
    kind: 'lottery',
    labelKey: 'editor:componentMenu.items.lottery',
    icon: '🎁',
    category: 'interactive',
    defaultSize: { width: 240, height: 120 },
    createDefault: () => ({ themeColor: '#ef4444', textColor: '#333333', bgColor: '#ffffff', data: { prizes: '一等奖\n二等奖\n三等奖\n幸运奖', buttonText: '开始抽奖' } }),
    commonFields: ['themeColor', 'textColor', 'bgColor'],
    fields: [f('prizes', 'editor:widget.fields.prizes', 'options'), f('buttonText', 'editor:widget.fields.buttonText', 'text')],
    DOM: LotteryDOM,
  },
  quickForm: {
    kind: 'quickForm',
    labelKey: 'editor:componentMenu.items.quickForm',
    icon: '📝',
    category: 'form',
    defaultSize: { width: 280, height: 240 },
    createDefault: () => ({ title: '报名信息', themeColor: '#ef4444', textColor: '#333333', bgColor: '#ffffff', data: { buttonText: '提交', fields: [{ label: '姓名', type: 'text' }, { label: '手机', type: 'tel' }, { label: '留言', type: 'textarea' }] } }),
    commonFields: ['title', 'themeColor', 'textColor', 'bgColor'],
    fields: [f('buttonText', 'editor:widget.fields.buttonText', 'text')],
    DOM: QuickFormDOM,
  },
  inputBox: {
    kind: 'inputBox',
    labelKey: 'editor:componentMenu.items.inputBox',
    icon: '⌨',
    category: 'form',
    defaultSize: { width: 260, height: 90 },
    createDefault: () => ({ themeColor: '#ef4444', textColor: '#333333', bgColor: '#ffffff', data: { label: '留下你的手机号', placeholder: '请输入', buttonText: '提交' } }),
    commonFields: ['themeColor', 'textColor', 'bgColor'],
    fields: [f('label', 'editor:widget.fields.label', 'text'), f('placeholder', 'editor:widget.fields.placeholder', 'text'), f('buttonText', 'editor:widget.fields.buttonText', 'text')],
    DOM: InputBoxDOM,
  },
  idCard: {
    kind: 'idCard',
    labelKey: 'editor:componentMenu.items.idCard',
    icon: '🪪',
    category: 'form',
    defaultSize: { width: 260, height: 90 },
    createDefault: () => ({ themeColor: '#ef4444', textColor: '#333333', bgColor: '#ffffff', data: { label: '实名认证', placeholder: '请输入身份证号' } }),
    commonFields: ['themeColor', 'textColor', 'bgColor'],
    fields: [f('label', 'editor:widget.fields.label', 'text'), f('placeholder', 'editor:widget.fields.placeholder', 'text')],
    DOM: IdCardDOM,
  },
  dropdown: {
    kind: 'dropdown',
    labelKey: 'editor:componentMenu.items.dropdown',
    icon: '🔽',
    category: 'form',
    defaultSize: { width: 240, height: 70 },
    createDefault: () => ({ themeColor: '#ef4444', textColor: '#333333', bgColor: '#ffffff', data: { label: '选择城市', options: ['北京', '上海', '广州', '深圳'] } }),
    commonFields: ['themeColor', 'textColor', 'bgColor'],
    fields: [f('label', 'editor:widget.fields.label', 'text'), f('options', 'editor:widget.fields.options', 'options')],
    DOM: DropdownDOM,
  },
  multiSelect: {
    kind: 'multiSelect',
    labelKey: 'editor:componentMenu.items.multiSelect',
    icon: '☑',
    category: 'form',
    defaultSize: { width: 240, height: 140 },
    createDefault: () => ({ themeColor: '#ef4444', textColor: '#333333', bgColor: '#ffffff', data: { label: '喜欢的环节', options: ['仪式', '晚宴', '游戏'] } }),
    commonFields: ['themeColor', 'textColor', 'bgColor'],
    fields: [f('label', 'editor:widget.fields.label', 'text'), f('options', 'editor:widget.fields.options', 'options')],
    DOM: MultiSelectDOM,
  },
  singleSelect: {
    kind: 'singleSelect',
    labelKey: 'editor:componentMenu.items.singleSelect',
    icon: '🔘',
    category: 'form',
    defaultSize: { width: 240, height: 140 },
    createDefault: () => ({ themeColor: '#ef4444', textColor: '#333333', bgColor: '#ffffff', data: { label: '您的性别', options: ['男', '女'] } }),
    commonFields: ['themeColor', 'textColor', 'bgColor'],
    fields: [f('label', 'editor:widget.fields.label', 'text'), f('options', 'editor:widget.fields.options', 'options')],
    DOM: SingleSelectDOM,
  },
  rating: {
    kind: 'rating',
    labelKey: 'editor:componentMenu.items.rating',
    icon: '⭐',
    category: 'interactive',
    defaultSize: { width: 240, height: 90 },
    createDefault: () => ({ title: '为本次婚礼评分', themeColor: '#f59e0b', textColor: '#333333', bgColor: '#ffffff', data: { max: 5 } }),
    commonFields: ['title', 'themeColor', 'textColor', 'bgColor'],
    fields: [f('max', 'editor:widget.fields.max', 'number', { min: 1, max: 10, step: 1 })],
    DOM: RatingDOM,
  },
  uploadImage: {
    kind: 'uploadImage',
    labelKey: 'editor:componentMenu.items.uploadImage',
    icon: '📤',
    category: 'form',
    defaultSize: { width: 240, height: 140 },
    createDefault: () => ({ themeColor: '#ef4444', textColor: '#333333', bgColor: '#ffffff', data: { label: '上传美照', maxCount: 3 } }),
    commonFields: ['themeColor', 'textColor', 'bgColor'],
    fields: [f('label', 'editor:widget.fields.label', 'text'), f('maxCount', 'editor:widget.fields.maxCount', 'number', { min: 1, max: 9, step: 1 })],
    DOM: UploadImageDOM,
  },
  formCount: {
    kind: 'formCount',
    labelKey: 'editor:componentMenu.items.formCount',
    icon: '📋',
    category: 'form',
    defaultSize: { width: 220, height: 80 },
    createDefault: () => ({ themeColor: '#ef4444', textColor: '#333333', bgColor: '#ffffff', data: { label: '已有', suffix: '人报名' } }),
    commonFields: ['themeColor', 'textColor', 'bgColor'],
    fields: [f('label', 'editor:widget.fields.label', 'text'), f('suffix', 'editor:widget.fields.suffix', 'text')],
    DOM: FormCountDOM,
  },
  region: {
    kind: 'region',
    labelKey: 'editor:componentMenu.items.region',
    icon: '🗺',
    category: 'form',
    defaultSize: { width: 260, height: 90 },
    createDefault: () => ({ themeColor: '#ef4444', textColor: '#333333', bgColor: '#ffffff', data: { label: '所在地区' } }),
    commonFields: ['themeColor', 'textColor', 'bgColor'],
    fields: [f('label', 'editor:widget.fields.label', 'text')],
    DOM: RegionDOM,
  },
  wechatNickname: {
    kind: 'wechatNickname',
    labelKey: 'editor:componentMenu.items.wechatNickname',
    icon: '💬',
    category: 'feature',
    defaultSize: { width: 220, height: 56 },
    createDefault: () => ({ textColor: '#333333', bgColor: '#ffffff', data: { prefix: '', suffix: ' 邀请你' } }),
    commonFields: ['textColor', 'bgColor'],
    fields: [f('prefix', 'editor:widget.fields.prefix', 'text'), f('suffix', 'editor:widget.fields.suffix', 'text')],
    DOM: WechatNicknameDOM,
  },
  wechatAvatar: {
    kind: 'wechatAvatar',
    labelKey: 'editor:componentMenu.items.wechatAvatar',
    icon: '👤',
    category: 'feature',
    defaultSize: { width: 100, height: 100 },
    createDefault: () => ({ bgColor: '#ffffff', data: { size: 64 } }),
    commonFields: ['bgColor'],
    fields: [f('size', 'editor:widget.fields.size', 'number', { min: 24, max: 96, step: 1 })],
    DOM: WechatAvatarDOM,
  },
  wechatAvatarWall: {
    kind: 'wechatAvatarWall',
    labelKey: 'editor:componentMenu.items.wechatAvatarWall',
    icon: '👥',
    category: 'feature',
    defaultSize: { width: 240, height: 120 },
    createDefault: () => ({ bgColor: '#ffffff', data: { count: 6 } }),
    commonFields: ['bgColor'],
    fields: [f('count', 'editor:widget.fields.count', 'number', { min: 1, max: 20, step: 1 })],
    DOM: WechatAvatarWallDOM,
  },
  workCover: {
    kind: 'workCover',
    labelKey: 'editor:componentMenu.items.workCover',
    icon: '🖼',
    category: 'feature',
    defaultSize: { width: 240, height: 160 },
    createDefault: () => ({ bgColor: '#ffffff', data: { src: '' } }),
    commonFields: ['bgColor'],
    fields: [f('src', 'editor:widget.fields.src', 'image')],
    DOM: WorkCoverDOM,
  },
  workTitle: {
    kind: 'workTitle',
    labelKey: 'editor:componentMenu.items.workTitle',
    icon: '🅣',
    category: 'feature',
    defaultSize: { width: 240, height: 60 },
    createDefault: () => ({ text: '我们的婚礼邀请函', textColor: '#333333', bgColor: '#ffffff', data: {} }),
    commonFields: ['text', 'textColor', 'bgColor'],
    fields: [f('text', 'editor:widget.fields.text', 'text')],
    DOM: WorkTitleDOM,
  },
};

/** 取某 widget 的默认属性（供组件菜单 preset 使用） */
export function getWidgetDefault(kind: WidgetKind): Partial<WidgetElement> {
  const def = WIDGET_REGISTRY[kind];
  const d = def.createDefault();
  return {
    width: def.defaultSize.width,
    height: def.defaultSize.height,
    title: d.title,
    text: d.text,
    themeColor: d.themeColor,
    textColor: d.textColor,
    bgColor: d.bgColor,
    data: d.data,
  };
}
