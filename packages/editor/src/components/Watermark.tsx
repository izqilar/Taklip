import type { CSSProperties } from 'react';

interface WatermarkOverlayProps {
  text?: string;
}

/**
 * 预览 / 发布页试用水印叠加层。
 * pointer-events:none 不阻挡交互；斜向平铺半透明文字，提示「未授权试用」。
 */
export default function WatermarkOverlay({ text = '试用预览 · 付费字体' }: WatermarkOverlayProps) {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='220' height='130'>
    <text x='20' y='70' transform='rotate(-25 110 65)' font-size='16' fill='rgba(0,0,0,0.13)'>${text}</text>
  </svg>`;
  const url = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
  const style: CSSProperties = {
    position: 'absolute',
    inset: 0,
    pointerEvents: 'none',
    backgroundImage: url,
    backgroundRepeat: 'repeat',
    zIndex: 30,
  };
  return <div style={style} aria-hidden />;
}
