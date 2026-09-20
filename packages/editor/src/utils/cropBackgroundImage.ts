/**
 * 背景图裁剪：把归一化裁剪区域「烘焙」成一张新图并上传，用新图 URL 替换 page.backgroundImage。
 *
 * 为什么用「烘焙」而不是存裁剪参数：
 * 页面背景图有三处绘制实现（编辑器 Konva 画布 / render 发布页 / konvaVideoExport 导出），
 * 存参数就要三处同步改，任一处漏改都会出现「编辑器对、发布页错」的 draft/live 不一致。
 * 烘焙成新图后三处都只是拿到一张新 URL，天然保持一致。
 *
 * 跨域处理：先 fetch 成 blob 再用 objectURL 绘制（blob: 属同源），
 * 避免跨域图片直接绘制污染 canvas 导致 toBlob 抛 SecurityError。
 */
import { buildClipSvgPath } from '@h5design/core';
import type { ImageClipShape } from '@h5design/core';
import { services } from '../services';

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

function loadImage(src: string, withCors = false): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (withCors) img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image load failed'));
    img.src = src;
  });
}

/**
 * 按归一化裁剪区域裁剪图片并上传，返回新图片地址。
 * @param src 原图地址
 * @param crop 归一化裁剪区域（0~1）
 * @param shape 可选形状蒙版（none 时为矩形）
 */
export async function cropAndUploadImage(
  src: string,
  crop: CropRect,
  shape: ImageClipShape = 'none',
): Promise<string> {
  let img: HTMLImageElement;
  let objUrl: string | null = null;

  try {
    const res = await fetch(src, { mode: 'cors' });
    if (!res.ok) throw new Error('fetch failed: ' + res.status);
    const blob = await res.blob();
    objUrl = URL.createObjectURL(blob);
    img = await loadImage(objUrl);
  } catch {
    // 回退：直接用原地址加载（带 crossOrigin，尽量不污染画布）
    img = await loadImage(src, true);
  }

  try {
    const nw = img.naturalWidth || img.width || 1;
    const nh = img.naturalHeight || img.height || 1;
    const sx = Math.max(0, Math.round(crop.x * nw));
    const sy = Math.max(0, Math.round(crop.y * nh));
    const sw = Math.max(1, Math.round(crop.width * nw));
    const sh = Math.max(1, Math.round(crop.height * nh));

    const canvas = document.createElement('canvas');
    canvas.width = sw;
    canvas.height = sh;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas 2d context unavailable');

    // 形状蒙版：先用 SVG path 裁剪画布，再绘制（PNG 保留透明区域）
    if (shape && shape !== 'none') {
      ctx.clip(new Path2D(buildClipSvgPath(shape, sw, sh)));
    }
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

    const out = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!out) throw new Error('canvas toBlob failed');

    const file = new File([out], `cropped-${Date.now()}.png`, { type: 'image/png' });
    const asset = await services.uploadAsset(file);
    return asset.url;
  } finally {
    if (objUrl) URL.revokeObjectURL(objUrl);
  }
}
