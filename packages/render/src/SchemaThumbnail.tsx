/**
 * SchemaThumbnail — 把任意 H5 schema 渲染为「第一页」缩略图。
 * 供「我的作品」与「模板库 / 首页模板墙」复用。
 * 内置：isProjectLike 守卫 + 缩略图错误边界 + 按卡片宽度等比缩放 + 视口懒渲染。
 * 任一卡片数据畸形导致渲染抛错时，仅该卡片回退占位，绝不整页白屏。
 *
 * 注意：本组件属于共享渲染器，需在三端（web/admin/小程序）保持一致。
 * 因此不使用 Tailwind 类名，全部使用内联 style，避免消费端没有 Tailwind 时样式失效。
 */
import { useEffect, useRef, useState, useSyncExternalStore, Component, type ReactNode } from 'react';
import type { Project } from '@h5design/core';
import {
  collectFontFamilies,
  ensureFontsByFamilies,
  getFontCatalog,
  getFontCatalogFetcher,
  setFontCatalog,
  subscribeFontCatalog,
} from '@h5design/core';
import SchemaRenderer from './SchemaRenderer';

/**
 * 惰性确保字体目录已填充（通过宿主注入的 fetcher），并去重：
 * 多次调用 / 多个卡片并发渲染时只发一次网络请求；目录已存在则直接复用。
 */
let catalogPromise: Promise<void> | null = null;
function ensureFontCatalog(): Promise<void> {
  if (getFontCatalog().length > 0) return Promise.resolve();
  if (catalogPromise) return catalogPromise;
  const fetcher = getFontCatalogFetcher();
  if (!fetcher) return Promise.resolve();
  catalogPromise = (async () => {
    try {
      setFontCatalog(await fetcher());
    } catch {
      /* 目录不可用时静默降级为系统字体 */
    }
  })();
  return catalogPromise;
}

/** 粗略校验后端返回的 schema 是否可当作 Project 渲染 */
export function isProjectLike(schema: unknown): schema is Project {
  if (!schema || typeof schema !== 'object') return false;
  const s = schema as Record<string, unknown>;
  return (
    Array.isArray(s.pages) &&
    s.pages.length > 0 &&
    typeof s.width === 'number' &&
    typeof s.height === 'number'
  );
}

const placeholderStyle = {
  width: '100%',
  height: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: '#f3f4f6',
} as const;

const placeholderTextStyle = {
  fontSize: '1.875rem',
  lineHeight: '2.25rem',
  color: '#d1d5db',
} as const;

/** 缩略图错误边界：单卡片渲染若抛错，仅在该卡片内显示占位 */
export class ThumbnailBoundary extends Component<
  { title?: string; children: ReactNode },
  { hasError: boolean }
> {
  constructor(props: { title?: string; children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={placeholderStyle}>
          <span style={placeholderTextStyle}>H5</span>
        </div>
      );
    }
    return this.props.children;
  }
}

/** 骨架屏占位（未进入视口时显示） */
function SkeletonPlaceholder() {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: 'linear-gradient(135deg, #f3f4f6, #e5e7eb)',
        animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      }}
    />
  );
}

/**
 * 渲染 schema 的首页缩略图（带错误边界 + 等比缩放 + 懒渲染）。
 * 父容器需为 position: relative 且确定尺寸（absolute inset-0 填充）。
 */
export function SchemaThumbnail({ schema }: { schema: unknown }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [inView, setInView] = useState(false);

  const project = isProjectLike(schema) ? schema : null;

  // 订阅字体目录版本：目录由宿主 app 的 fetcher 异步填充（或编辑器已预置），
  // 目录到达后需要重新注册「本 schema 用到的字体」，否则缩略图会静默回退系统字体。
  const catalogVersion = useSyncExternalStore(
    subscribeFontCatalog,
    () => getFontCatalog().length,
    () => 0,
  );

  // 确保本 schema 用到的自定义字体已注册：先惰性拉取目录（若为空），再按 schema
  // 收集到的 fontFamily 注册。注册完成后由 SchemaRenderer 的 `loadingdone` 监听自动重排版。
  // 这样缩略图与编辑器 / 发布页 / 导出页使用同一套字体，排版宽度一致、不再截断或错排。
  useEffect(() => {
    if (!project) return;
    let cancelled = false;
    void (async () => {
      await ensureFontCatalog();
      if (cancelled) return;
      await ensureFontsByFamilies(collectFontFamilies(project));
    })();
    return () => {
      cancelled = true;
    };
  }, [project, catalogVersion]);

  // 等比缩放：基于容器实际宽度计算 H5 画布缩放比
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !project) return;
    const update = () => {
      const width = el.clientWidth;
      if (width && project.width) setScale(width / project.width);
    };
    update();
    const ro =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, [project]);

  // 懒渲染：仅当卡片进入视口（含提前 200px 预加载）才渲染完整 H5 页面，
  // 避免首屏一次性同步渲染几十张缩略图阻塞主线程、造成「加载缓慢」的卡顿感。
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !project) return;
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true); // 老浏览器降级为直接渲染
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          io.disconnect();
        }
      },
      { rootMargin: '200px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [project]);

  if (!project) {
    return (
      <div style={placeholderStyle}>
        <span style={placeholderTextStyle}>H5</span>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        width: '100%',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      {inView ? (
        <ThumbnailBoundary>
          <SchemaRenderer project={project} scale={scale} animated={false} />
        </ThumbnailBoundary>
      ) : (
        // 未进入视口：骨架占位，等滚动到附近再渲染真实缩略图
        <SkeletonPlaceholder />
      )}
    </div>
  );
}
