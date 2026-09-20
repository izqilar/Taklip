/**
 * 编辑器画布与离屏视频导出共用的 Konva 渲染辅助。
 * 从 EditorCanvas 提取，避免「编辑器交互态」与「离屏导出态」重复实现同一套
 * 图片布局 / 滤镜 / 边框 dash 逻辑（这部分是最易出错的渲染细节）。
 *
 * 仅含纯函数与展示型组件，不依赖编辑器交互状态。
 */
import { useEffect, useRef } from 'react';
import type { ComponentProps } from 'react';
import { Image as KonvaImage } from 'react-konva';
import Konva from 'konva';
import type { ImageElement } from '@h5design/core';

export type KonvaFilter = (typeof Konva.Filters)[keyof typeof Konva.Filters];

/** 把 CSS 风格的 word-break 映射到 Konva Text 的 wrap 语义 */
export function mapWordBreakToKonvaWrap(wordBreak: string | undefined): 'word' | 'char' | 'none' {
  switch (wordBreak) {
    case 'break-all':
      return 'char';
    case 'normal':
    case 'keep-all':
    case 'break-word':
    default:
      return 'word';
  }
}

/** 把 CSS 风格的 border-style 转成 Konva stroke dash 数组 */
export function borderDashFromStyle(style?: string, _width = 1): number[] | undefined {
  switch (style) {
    case 'dashed':
      return [6, 4];
    case 'dotted':
      return [2, 3];
    case 'double':
      // 双线通过绘制内外两条描边实现，这里不需要 dash
      return undefined;
    default:
      return undefined;
  }
}

/** 把 CSS lineStyle 转成 Konva dash 数组（line / shape 描边用） */
export function dashFromLineStyle(lineStyle?: string): number[] | undefined {
  switch (lineStyle) {
    case 'dashed':
      return [6, 4];
    case 'dotted':
      return [2, 4];
    default:
      return undefined;
  }
}

/** 根据 object-fit 计算 Konva.Image 的显示位置、尺寸与裁剪区域 */
export function computeImageLayout(
  img: HTMLImageElement,
  el: ImageElement,
): {
  x: number;
  y: number;
  width: number;
  height: number;
  crop: { x: number; y: number; width: number; height: number } | undefined;
} {
  const objectFit = el.objectFit ?? 'cover';
  const imgW = img.width || img.naturalWidth || 1;
  const imgH = img.height || img.naturalHeight || 1;

  // 用户自定义裁剪区域（归一化 → 源图像素）
  const userCrop = el.clip?.crop;
  const srcX = userCrop ? imgW * userCrop.x : 0;
  const srcY = userCrop ? imgH * userCrop.y : 0;
  const srcW = userCrop ? imgW * userCrop.width : imgW;
  const srcH = userCrop ? imgH * userCrop.height : imgH;

  if (objectFit === 'contain') {
    const scale = Math.min(el.width / srcW, el.height / srcH);
    const w = srcW * scale;
    const h = srcH * scale;
    return {
      x: (el.width - w) / 2,
      y: (el.height - h) / 2,
      width: w,
      height: h,
      crop: { x: srcX, y: srcY, width: srcW, height: srcH },
    };
  }

  // cover（默认）：按元素宽高比裁剪裁剪区中心区域，再拉伸填满元素
  const elRatio = el.width / el.height;
  const cropRatio = srcW / srcH;
  let crop: { x: number; y: number; width: number; height: number };
  if (cropRatio > elRatio) {
    const cropW = srcH * elRatio;
    crop = { x: srcX + (srcW - cropW) / 2, y: srcY, width: cropW, height: srcH };
  } else {
    const cropH = srcW / elRatio;
    crop = { x: srcX, y: srcY + (srcH - cropH) / 2, width: srcW, height: cropH };
  }
  return { x: 0, y: 0, width: el.width, height: el.height, crop };
}

/** 自定义对比度滤镜（Konva 无内置 Contrast 滤镜）。contrast=100 无变化，<100 降低，>100 增强。 */
function ContrastFilter(this: Konva.Image, imageData: ImageData) {
  // 调用方传入的 contrast 已是倍率（filterContrast/100，100% => 1.0），切勿再除以 100。
  const contrast = (this as unknown as { contrast(): number }).contrast() ?? 1;
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    data[i] = Math.min(255, Math.max(0, (r - 128) * contrast + 128));
    data[i + 1] = Math.min(255, Math.max(0, (g - 128) * contrast + 128));
    data[i + 2] = Math.min(255, Math.max(0, (b - 128) * contrast + 128));
  }
}

/** 包装 Konva.Image，在图片加载完成 / 滤镜参数变化后强制 cache()，确保亮度、对比度、模糊滤镜生效 */
export function FilteredImage({
  image,
  filters,
  brightness,
  blurRadius,
  contrast,
  cornerRadius,
  width,
  height,
  crop,
  ...props
}: Omit<ComponentProps<typeof KonvaImage>, 'image' | 'filters' | 'brightness' | 'blurRadius'> & {
  image: HTMLImageElement;
  filters?: KonvaFilter[];
  brightness?: number;
  blurRadius?: number;
  contrast?: number;
  cornerRadius?: number | number[];
  width?: number;
  height?: number;
  crop?: { x: number; y: number; width: number; height: number };
}) {
  const ref = useRef<Konva.Image>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    // 仅当有滤镜时才需要缓存（Konva 的滤镜依赖 cache）。
    // 无滤镜时清除缓存，让圆角 / 裁剪 / 尺寸等属性走原生渲染，可实时更新。
    if (!filters || filters.length === 0) {
      try {
        node.clearCache();
      } catch {
        // 尚未缓存时 clearCache 可能抛错，忽略
      }
      node.getLayer()?.batchDraw();
      return;
    }

    // 延迟到下一帧，确保图片已解码到 canvas 后再 cache；
    // 圆角 / 尺寸 / 裁剪变化也要重新生成缓存，否则仍显示旧位图。
    const id = requestAnimationFrame(() => {
      try {
        node.cache();
        node.getLayer()?.batchDraw();
      } catch {
        // 跨域/未解码完成等导致 cache 失败时静默回退，不影响正常显示
      }
    });
    return () => cancelAnimationFrame(id);
  }, [image, filters, brightness, blurRadius, contrast, cornerRadius, width, height, crop]);

  return (
    <KonvaImage
      ref={ref}
      image={image}
      filters={filters}
      brightness={brightness}
      blurRadius={blurRadius}
      contrast={contrast}
      cornerRadius={cornerRadius}
      width={width}
      height={height}
      crop={crop}
      {...props}
    />
  );
}

/** 对比度滤镜（供调用方以 `ContrastFilter as unknown as KonvaFilter` 注入 filters 数组） */
export { ContrastFilter };
