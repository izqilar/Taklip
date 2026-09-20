/**
 * WorkPreviewModal — 运营端「我的作品」预览弹窗。
 *
 * 对标 web 端模板库的 TemplatePreviewModal（apps/web/src/components/TemplatePreviewModal.tsx），
 * 复用同一套共享渲染器与动画播放链路，保证与发布页/编辑器所见即所得：
 *  1. 手机壳内用 @h5design/render 的 SchemaRenderer 渲染「多页」作品，
 *     支持上一页/下一页/页码圆点切换；
 *  2. 注入 GSAP playElementAnimation（懒加载，不拖主包），
 *     提供「重播动画」按钮与「播放动画」开关；
 *  3. 右侧属性栏展示：作品编号 / 状态 / 访问量 / 最近更新，已发布可跳转 H5。
 *
 * 数据口径：列表行 schema 已由后端按 effectiveSchema（draftSchema ?? schema）归一，
 * 草稿内容也能直接预览，无需先发布。
 */
import { useEffect, useMemo, useState } from 'react';
import { SchemaRenderer, type AnimationPlayer } from '@h5design/render';
import { normalizeSchema } from '@h5design/core';
import { T } from '../../config/theme';
import { WEB_BASE } from '../../utility';

/** 设计稿基准尺寸（与 schema 默认一致） */
const DESIGN_W = 375;
const DESIGN_H = 667;
/** 手机框内可视宽（不含边框）；按比例缩放设计稿以铺满框内 */
const FRAME_W = 300;
const BEZEL = 10;
const SCALE = FRAME_W / DESIGN_W;

export interface WorkPreviewWork {
  id?: string;
  title?: string;
  schema?: any;
  cover?: string | null;
  status?: string;
  viewCount?: number;
  updatedAt?: string;
  publishCode?: string | null;
}

interface WorkPreviewModalProps {
  work: WorkPreviewWork | null;
  onClose: () => void;
}

const dt = (v: any) => (v ? new Date(v).toLocaleString('zh-CN', { hour12: false }) : '—');

export const WorkPreviewModal = ({ work, onClose }: WorkPreviewModalProps) => {
  // schema → 归一化为完整的 Project（缺字段补默认，保证多页/动画可渲染）
  const project = useMemo(() => normalizeSchema((work?.schema as any) ?? null), [work?.schema]);
  const pages = (project as any)?.pages ?? [];
  const hasSchema = pages.length > 0;

  const [page, setPage] = useState(0);
  const [replayKey, setReplayKey] = useState(0);
  const [playAnim, setPlayAnim] = useState(true);
  // 默认 no-op；挂载后懒加载 GSAP 播放器，避免把 gsap 拖进首屏
  const [player, setPlayer] = useState<AnimationPlayer>(() => () => undefined);

  // 切换作品时回到第一页并重播入场动画
  useEffect(() => {
    setPage(0);
    setReplayKey((k) => k + 1);
  }, [work?.id]);

  useEffect(() => {
    let alive = true;
    import('@h5design/editor/animations')
      .then((m) => {
        if (alive) setPlayer(() => m.playElementAnimation);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  // ESC 关闭
  useEffect(() => {
    if (!work) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [work, onClose]);

  if (!work) return null;

  const published = work.status === 'published';

  const goPage = (i: number) => {
    if (pages.length === 0) return;
    const next = (i + pages.length) % pages.length;
    setPage(next);
    setReplayKey((k) => k + 1); // 切页重播该页入场动画
  };

  const ctrlBtn = {
    fontSize: 12.5,
    padding: '5px 12px',
    borderRadius: 6,
    border: `1px solid ${T.border}`,
    background: '#fff',
    color: T.ink2,
    cursor: 'pointer',
  } as React.CSSProperties;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.6)',
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          flexWrap: 'wrap',
          maxHeight: '92vh',
          width: '100%',
          maxWidth: 760,
          overflow: 'hidden',
          borderRadius: 16,
          background: '#fff',
          boxShadow: '0 24px 64px rgba(0,0,0,0.28)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 左：手机预览舞台 */}
        <div
          style={{
            flex: '1 1 380px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            background: '#f9fafb',
            minHeight: 480,
          }}
        >
          <div
            style={{
              position: 'relative',
              borderRadius: 32,
              background: '#111827',
              padding: BEZEL,
              boxShadow: '0 10px 24px rgba(0,0,0,0.18)',
              width: FRAME_W + BEZEL * 2,
              height: DESIGN_H * SCALE + BEZEL * 2,
            }}
          >
            <div
              style={{
                position: 'relative',
                height: '100%',
                width: '100%',
                overflow: 'hidden',
                borderRadius: 22,
                background: '#fff',
              }}
            >
              {hasSchema ? (
                <SchemaRenderer
                  key={replayKey}
                  project={project as any}
                  currentPage={page}
                  scale={SCALE}
                  animated={playAnim}
                  animationPlayer={player}
                />
              ) : work.cover ? (
                <img
                  src={work.cover}
                  alt={work.title || ''}
                  style={{ height: '100%', width: '100%', objectFit: 'cover' }}
                />
              ) : (
                <div
                  style={{
                    display: 'flex',
                    height: '100%',
                    width: '100%',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 13,
                    color: '#9ca3af',
                  }}
                >
                  该作品暂无可预览内容
                </div>
              )}
            </div>
          </div>

          {/* 翻页控制条 */}
          <div
            style={{
              marginTop: 16,
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'wrap',
              justifyContent: 'center',
              gap: 8,
              fontSize: 12.5,
            }}
          >
            <button type="button" style={ctrlBtn} onClick={() => goPage(page - 1)} disabled={pages.length <= 1}>
              上一页
            </button>
            <span style={{ minWidth: 88, textAlign: 'center', color: T.ink3, fontVariantNumeric: 'tabular-nums' }}>
              {hasSchema ? `第 ${page + 1} / ${pages.length} 页` : '—'}
            </span>
            <button type="button" style={ctrlBtn} onClick={() => goPage(page + 1)} disabled={pages.length <= 1}>
              下一页
            </button>
            <button type="button" style={ctrlBtn} onClick={() => setReplayKey((k) => k + 1)} disabled={!hasSchema}>
              重播动画
            </button>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: T.ink2, cursor: 'pointer', userSelect: 'none' }}>
              <input
                type="checkbox"
                checked={playAnim}
                onChange={(e) => {
                  setPlayAnim(e.target.checked);
                  if (e.target.checked) setReplayKey((k) => k + 1);
                }}
              />
              播放动画
            </label>
          </div>

          {/* 页码圆点 */}
          {hasSchema && pages.length > 1 && (
            <div style={{ marginTop: 12, display: 'flex', gap: 6 }}>
              {pages.map((p: any, i: number) => (
                <button
                  key={p.id ?? i}
                  type="button"
                  aria-label={`第 ${i + 1} 页`}
                  onClick={() => goPage(i)}
                  style={{
                    height: 8,
                    width: i === page ? 24 : 8,
                    borderRadius: 999,
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    background: i === page ? T.accent : '#d1d5db',
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* 右：属性栏 */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
            flex: '0 0 280px',
            borderTop: `1px solid ${T.border}`,
            borderLeft: `1px solid ${T.border}`,
            maxHeight: '92vh',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, padding: 16 }}>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 600, lineHeight: 1.4, color: T.ink1 }}>
              {work.title || '未命名作品'}
            </h3>
            <button
              type="button"
              aria-label="关闭"
              onClick={onClose}
              style={{
                flexShrink: 0,
                border: 'none',
                background: 'transparent',
                fontSize: 15,
                lineHeight: 1,
                padding: 5,
                borderRadius: 999,
                color: '#9ca3af',
                cursor: 'pointer',
              }}
            >
              ✕
            </button>
          </div>

          <div style={{ padding: '0 16px' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                fontSize: 12,
                lineHeight: 1,
                padding: '4px 9px',
                borderRadius: 999,
                color: '#fff',
                background: published ? 'rgba(20,103,107,0.92)' : 'rgba(0,0,0,0.34)',
              }}
            >
              {published ? '已发布' : '草稿'}
            </span>
          </div>

          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
              fontSize: 13,
            }}
          >
            <div>
              <div style={{ marginBottom: 4, fontSize: 12, color: T.ink3 }}>作品编号</div>
              <div style={{ wordBreak: 'break-all', fontFamily: 'monospace', fontSize: 12, color: T.ink2 }}>
                {work.id || '—'}
              </div>
            </div>
            <div>
              <div style={{ marginBottom: 4, fontSize: 12, color: T.ink3 }}>访问量</div>
              <div style={{ color: T.ink1 }}>{work.viewCount ?? 0}</div>
            </div>
            <div>
              <div style={{ marginBottom: 4, fontSize: 12, color: T.ink3 }}>最近更新</div>
              <div style={{ color: T.ink1 }}>{dt(work.updatedAt)}</div>
            </div>
            {published && work.publishCode && (
              <div>
                <div style={{ marginBottom: 4, fontSize: 12, color: T.ink3 }}>线上访问</div>
                <a
                  href={`${WEB_BASE}/p/${work.publishCode}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{ fontSize: 13, color: T.accent }}
                >
                  访问 H5（{work.publishCode}）→
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkPreviewModal;
