import type { CSSProperties } from 'react';
import type { MapNavElement } from '@h5design/core';

interface DOMMapNavProps {
  el: MapNavElement;
  style: CSSProperties;
  dataAttrs?: Record<string, string>;
}

export default function DOMMapNav({ el, style, dataAttrs }: DOMMapNavProps) {
  const { width, height, venue, address, buttonText, themeColor, textColor } = el;
  const keyword = encodeURIComponent(`${venue} ${address}`.trim());
  const mapUrl = `https://uri.amap.com/search?keyword=${keyword}`;

  const containerStyle: CSSProperties = {
    ...style,
    background: '#ffffff',
    overflow: 'hidden',
    boxSizing: 'border-box',
    padding: 12,
    display: 'flex',
    flexDirection: 'column',
  };

  return (
    <div {...dataAttrs} style={containerStyle}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flex: 1 }}>
        <svg viewBox="0 0 24 24" fill={themeColor || '#ef4444'} style={{ width: 28, height: 28, flexShrink: 0, marginTop: 2 }}>
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 0 1 0-5 2.5 2.5 0 0 1 0 5z" />
        </svg>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: textColor || '#333333', fontFamily: 'Microsoft YaHei, PingFang SC, sans-serif', wordBreak: 'break-word' }}>{venue}</div>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4, fontFamily: 'Microsoft YaHei, PingFang SC, sans-serif', wordBreak: 'break-word' }}>{address}</div>
        </div>
      </div>
      <a
        href={mapUrl}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: 'block',
          marginTop: 10,
          height: 32,
          lineHeight: '32px',
          textAlign: 'center',
          borderRadius: 16,
          background: themeColor || '#ef4444',
          color: '#ffffff',
          fontSize: 14,
          fontWeight: 700,
          fontFamily: 'Microsoft YaHei, PingFang SC, sans-serif',
          textDecoration: 'none',
        }}
      >
        {buttonText}
      </a>
    </div>
  );
}
