import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import type { LikeElement } from '@h5design/core';

interface DOMLikeProps {
  el: LikeElement;
  style: CSSProperties;
  dataAttrs?: Record<string, string>;
}

const STORAGE_PREFIX = 'h5design_like_';

export default function DOMLike({ el, style, dataAttrs }: DOMLikeProps) {
  const { width, height, text, themeColor, textColor, count, iconSize } = el;
  const storageKey = `${STORAGE_PREFIX}${el.id}`;
  const [liked, setLiked] = useState(false);

  useEffect(() => {
    try {
      setLiked(localStorage.getItem(storageKey) === '1');
    } catch {
      setLiked(false);
    }
  }, [storageKey]);

  const toggle = () => {
    const next = !liked;
    setLiked(next);
    try {
      localStorage.setItem(storageKey, next ? '1' : '0');
    } catch {
      /* ignore */
    }
  };

  const displayCount = count + (liked ? 1 : 0);
  const heartColor = liked ? themeColor || '#ef4444' : '#d1d5db';
  const fontSize = Math.min(16, iconSize * 0.7);

  const containerStyle: CSSProperties = {
    ...style,
    background: '#ffffff',
    overflow: 'hidden',
    boxSizing: 'border-box',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    cursor: 'pointer',
    padding: 12,
    userSelect: 'none',
  };

  return (
    <div {...dataAttrs} style={containerStyle} onClick={toggle} role="button" aria-pressed={liked}>
      <svg viewBox="0 0 24 24" fill={heartColor} style={{ width: iconSize, height: iconSize, flexShrink: 0, transition: 'transform 0.15s ease' }}>
        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
      </svg>
      <span style={{ fontSize, color: textColor || '#333333', fontFamily: 'Microsoft YaHei, PingFang SC, sans-serif', whiteSpace: 'nowrap' }}>
        {text}  {displayCount}
      </span>
    </div>
  );
}
