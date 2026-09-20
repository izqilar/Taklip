import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import type { CountdownElement } from '@h5design/core';
import {getRemaining, getUnitLabels, padDigits} from '@h5design/render';

interface DOMCountdownProps {
  el: CountdownElement;
  style: CSSProperties;
  dataAttrs?: Record<string, string>;
}

export default function DOMCountdown({ el, style, dataAttrs }: DOMCountdownProps) {
  const { width, height, title, target, showTitle, bgColor, textColor, themeColor, digitBgColor, fontSize } = el;
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const { i18n } = useTranslation();
  const remaining = getRemaining(target);
  const values = [remaining.days, remaining.hours, remaining.minutes, remaining.seconds];
  const labels = getUnitLabels(i18n.language?.startsWith('zh') ? 'zh' : 'en');

  const containerStyle: CSSProperties = {
    ...style,
    background: bgColor || '#fff5f5',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    boxSizing: 'border-box',
    color: textColor || '#7f1d1d',
  };

  return (
    <div {...dataAttrs} style={containerStyle}>
      {showTitle && (
        <div style={{ fontSize: fontSize * 0.7, fontWeight: 700, marginBottom: 6, fontFamily: 'Microsoft YaHei, PingFang SC, sans-serif' }}>{title}</div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {values.map((v, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div
                style={{
                  minWidth: fontSize * 1.4,
                  padding: '2px 6px',
                  background: digitBgColor || '#ef4444',
                  color: '#ffffff',
                  borderRadius: 6,
                  fontSize,
                  fontWeight: 700,
                  fontFamily: 'Microsoft YaHei, PingFang SC, sans-serif',
                  textAlign: 'center',
                  lineHeight: 1.2,
                }}
              >
                {padDigits(v, 2)}
              </div>
              <div style={{ fontSize: fontSize * 0.35, color: themeColor || '#ef4444', marginTop: 2 }}>{labels[i]}</div>
            </div>
            {i < 3 && <span style={{ fontSize: fontSize * 0.9, fontWeight: 700, color: themeColor || '#ef4444' }}>:</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
