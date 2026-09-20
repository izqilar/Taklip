import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import type { MessageBoardElement, MessageItem } from '@h5design/core';

interface DOMMessageBoardProps {
  el: MessageBoardElement;
  style: CSSProperties;
  dataAttrs?: Record<string, string>;
}

const FONT = 'Microsoft YaHei, PingFang SC, sans-serif';
const STORAGE_PREFIX = 'h5design_msgs_';

function genId(): string {
  return `m_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * 留言板（发布态 DOM，可交互）。
 * 设计师预置的留言来自 el.messages；访客发布的留言存入 localStorage（按元素 id 隔离），
 * 二者合并展示。allowPost=false 时隐藏输入区。
 */
export default function DOMMessageBoard({ el, style, dataAttrs }: DOMMessageBoardProps) {
  const { title, themeColor, textColor, messages, allowPost, placeholder } = el;
  const barColor = themeColor || '#ef4444';
  const txtColor = textColor || '#333333';

  const [name, setName] = useState('');
  const [text, setText] = useState('');
  const [local, setLocal] = useState<MessageItem[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_PREFIX + el.id);
      if (raw) setLocal(JSON.parse(raw) as MessageItem[]);
    } catch {
      /* 解析失败时忽略，视为无本地留言 */
    }
  }, [el.id]);

  const all = [...messages, ...local];

  const send = () => {
    if (!allowPost || !text.trim()) return;
    const item: MessageItem = {
      id: genId(),
      name: name.trim() || '匿名',
      text: text.trim(),
      time: new Date().toISOString(),
    };
    const next = [...local, item];
    setLocal(next);
    try {
      localStorage.setItem(STORAGE_PREFIX + el.id, JSON.stringify(next));
    } catch {
      /* 写入失败时忽略 */
    }
    setName('');
    setText('');
  };

  const containerStyle: CSSProperties = {
    ...style,
    display: 'flex',
    flexDirection: 'column',
    padding: 12,
    boxSizing: 'border-box',
    fontFamily: FONT,
    background: '#ffffff',
    overflow: 'hidden',
  };

  return (
    <div {...dataAttrs} style={containerStyle}>
      <div style={{ fontSize: 16, fontWeight: 700, color: barColor, marginBottom: 8 }}>{title}</div>

      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {all.length === 0 && (
          <div style={{ fontSize: 12, color: '#9ca3af' }}>暂无留言，快来送上祝福～</div>
        )}
        {all.map((m) => (
          <div key={m.id} style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: barColor }}>{m.name}</div>
            <div style={{ fontSize: 13, color: txtColor, marginTop: 2, wordBreak: 'break-word' }}>{m.text}</div>
          </div>
        ))}
      </div>

      {allowPost && (
        <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="署名"
            style={{ width: 70, fontSize: 12, padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: 6, outline: 'none' }}
          />
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') send();
            }}
            placeholder={placeholder}
            style={{ flex: 1, minWidth: 0, fontSize: 12, padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: 6, outline: 'none' }}
          />
          <button
            type="button"
            onClick={send}
            style={{ background: barColor, color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, padding: '0 12px', cursor: 'pointer' }}
          >
            发送
          </button>
        </div>
      )}
    </div>
  );
}
