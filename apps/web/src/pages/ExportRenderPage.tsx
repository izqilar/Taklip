/**
 * 服务端导出渲染页 — /export-render?et=...&mode=current|all&page=N
 *
 * 这个页面**不是给用户看的**，它是服务端导出模块（apps/server/src/export）用无头浏览器
 * 加载的专用渲染目标：
 *  1. 凭一次性 token 从服务端换取 payload（schema + 是否加水印 + 需要注册的字体）；
 *  2. 用共享渲染器 SchemaRenderer 渲染指定页 / 全部页长图；
 *  3. 字体注册、图片解码、布局稳定后打上 `data-export-ready` 标记，
 *     无头浏览器等这个标记出现才截图，保证不会截到半成品。
 *
 * 关键点：**是否加水印由服务端 payload 决定**，页面/客户端无权关闭 —— 这就是导出硬门槛。
 */
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { SchemaRenderer } from '@h5design/render';
import { ensureFontsByFamilies, setFontCatalog, type FontMeta } from '@h5design/core';
import type { Project } from '@h5design/core';

interface ExportPayload {
  project: Project;
  watermark: boolean;
  fonts: { family: string; files: Record<string, string> }[];
}

/** 斜向重复文字水印：纯 CSS 背景，不拦截交互，也不需要额外 DOM */
function WatermarkLayer({ height }: { height: number }) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="220" height="140">
<text x="10" y="70" transform="rotate(-24 10 70)" fill="rgba(0,0,0,0.16)"
 font-family="sans-serif" font-size="16">试用预览 · 付费字体未授权</text>
</svg>`;
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        height,
        pointerEvents: 'none',
        backgroundImage: `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`,
        backgroundRepeat: 'repeat',
      }}
    />
  );
}

export default function ExportRenderPage() {
  const [params] = useSearchParams();
  const [payload, setPayload] = useState<ExportPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ⚠️ 参数名必须是 `et`：web 端 bootstrap.ts 在启动时会把地址栏上的 `token` 参数删掉
  // （免登令牌不残留在 URL），所以导出凭证改用非敏感名 `et`，且不再回退读 `token`
  // （回退分支永远拿不到值，属死代码，已移除）。
  const token = params.get('et') ?? '';
  const mode = params.get('mode') === 'all' ? 'all' : 'current';
  const pageIdx = Math.max(0, Number(params.get('page') ?? '0') || 0);

  // 1) 取 payload
  useEffect(() => {
    if (!token) {
      setError('missing token');
      return;
    }
    fetch(`/api/export/payload?token=${encodeURIComponent(token)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data: ExportPayload) => setPayload(data))
      .catch((e: Error) => setError(e.message));
  }, [token]);

  const project = payload?.project;
  const width = project?.width ?? 375;
  const height = project?.height ?? 667;
  const pages = Array.isArray(project?.pages) ? project!.pages : [];
  const safePage = Math.min(pageIdx, Math.max(0, pages.length - 1));
  const renderPages = mode === 'all' ? pages : pages.slice(safePage, safePage + 1);
  const totalHeight = height * Math.max(1, renderPages.length);

  // 2) 字体注册
  useEffect(() => {
    if (!payload?.fonts?.length) return;
    const catalog: FontMeta[] = payload.fonts.map((f) => ({
      id: f.family,
      family: f.family,
      displayName: f.family,
      isPaid: false,
      files: f.files,
    }));
    setFontCatalog(catalog);
  }, [payload?.fonts]);

  // 3) 注册字体 + 等图片解码 + 等布局稳定后，标记导出就绪
  useEffect(() => {
    if (!payload || !project) return;
    let cancelled = false;
    (async () => {
      try {
        const families = (payload.fonts ?? []).map((f) => f.family);
        if (families.length) {
          await ensureFontsByFamilies(families);
          await document.fonts?.ready;
        }
        await new Promise((r) => setTimeout(r, 120));
        if (cancelled) return;
        const imgs = Array.from(document.querySelectorAll<HTMLImageElement>('#export-stage img'));
        await Promise.all(imgs.map((img) => img.decode().catch(() => undefined)));
        // 再等两帧，确保 transform / scale 布局稳定后才截图
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        await new Promise((r) => setTimeout(r, 120));
        if (cancelled) return;
        document.body.setAttribute('data-export-ready', '1');
      } catch {
        // 即便字体失败也要标记就绪，否则无头浏览器会一直等超时
        document.body.setAttribute('data-export-ready', '1');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [payload, project]);

  return (
    <div style={{ margin: 0, padding: 0, background: '#ffffff' }}>
      {error ? (
        <pre data-export-ready="1">ERROR: {error}</pre>
      ) : !project ? (
        <div>loading…</div>
      ) : (
        <div
          id="export-stage"
          style={{
            position: 'relative',
            width,
            height: totalHeight,
            overflow: 'hidden',
            background: '#ffffff',
          }}
        >
          {renderPages.map((_, i) => {
            const p = mode === 'all' ? pages[i] : pages[safePage];
            if (!p) return null;
            return (
              <div
                key={p.id ?? i}
                style={{
                  position: 'absolute',
                  top: i * height,
                  left: 0,
                  width,
                  height,
                  overflow: 'hidden',
                }}
              >
                <SchemaRenderer
                  project={{ ...project, pages: [p] } as Project}
                  currentPage={0}
                  scale={1}
                  animated={false}
                />
              </div>
            );
          })}
          {payload?.watermark ? <WatermarkLayer height={totalHeight} /> : null}
        </div>
      )}
    </div>
  );
}
