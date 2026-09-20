import type { CSSProperties } from 'react';
import type { TimelineElement } from '@h5design/core';

interface DOMTimelineProps {
  el: TimelineElement;
  style: CSSProperties;
  dataAttrs?: Record<string, string>;
}

const FONT = 'Microsoft YaHei, PingFang SC, sans-serif';

/**
 * 婚礼当天流程时间轴（发布态 DOM 渲染）。
 * 与编辑态共享布局：左侧竖线 + 绝对定位的节点（圆点/时间/标题/描述）。
 */
export default function DOMTimeline({ el, style, dataAttrs }: DOMTimelineProps) {
  const { nodes, themeColor, textColor } = el;
  const containerStyle: CSSProperties = {
    ...style,
    padding: '14px',
    boxSizing: 'border-box',
    fontFamily: FONT,
    overflow: 'hidden',
  };
  const dotX = 6;
  const count = nodes.length || 1;
  const barColor = themeColor || '#ef4444';
  const txtColor = textColor || '#333333';

  return (
    <div {...dataAttrs} style={containerStyle}>
      <div style={{ position: 'relative', height: '100%' }}>
        <div
          style={{ position: 'absolute', left: dotX, top: 8, bottom: 8, width: 2, background: barColor }}
        />
        {nodes.map((n, i) => {
          const topPct = ((i + 0.5) / count) * 100;
          return (
            <div
              key={`${n.time}-${i}`}
              style={{ position: 'absolute', left: 0, right: 0, top: `${topPct}%`, transform: 'translateY(-50%)' }}
            >
              <span
                style={{
                  position: 'absolute',
                  left: dotX - 5,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  background: barColor,
                  border: '2px solid #fff',
                  boxSizing: 'border-box',
                }}
              />
              <div style={{ marginLeft: dotX + 18, display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: barColor }}>{n.time}</span>
                <span style={{ fontSize: 13, color: txtColor, marginTop: 2 }}>{n.title}</span>
                <span style={{ fontSize: 11, color: txtColor, opacity: 0.7, marginTop: 2 }}>{n.desc}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
