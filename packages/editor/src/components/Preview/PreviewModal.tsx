/**
 * 预览模态框 — 与「作品预览」完全统一的外观与交互。
 *
 * 单一真值：本组件在布局、尺寸、控件与动效控制上与 web 端 WorkPreviewModal 保持一致：
 *   · 居中白色卡片（最大宽 760），左侧手机壳舞台 + 右侧属性栏；
 *   · 手机壳尺寸 FRAME_W=300 / BEZEL=10，缩放 = 300 / 设计稿宽；
 *   · 下方控件组：上一页 / 第 n/总 页 / 下一页 / 重播动画 / 播放动画开关；
 *   · 多页时显示页码圆点（当前页加长 + 品牌色）；
 *   · Esc 关闭、点遮罩关闭。
 *
 * 渲染层统一走本包的 DOMRenderer（内部即 @h5design/render 的 SchemaRenderer +
 * GSAP 动画播放器），与发布页 / 导出同一实现，保证「三端一致」。
 *
 * 与 WorkPreviewModal 的差异仅在右侧属性栏内容：编辑器里没有作品状态/访问量这类运营数据，
 * 因此展示工程自身的元信息（编号 / 画布尺寸 / 页数 / 最近更新 / 背景音乐），
 * 并保持同样的「标签在上、值在下」排版。
 */
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Project } from '@h5design/core';
import DOMRenderer from './DOMRenderer';
import { MusicPlayer } from '@h5design/render';
import WatermarkOverlay from '../Watermark';

const FRAME_W = 300;
const BEZEL = 10;

const INK1 = '#1f2329';
const INK2 = '#4e5969';
const INK3 = '#86909c';
const BORDER = '#e5e6eb';
const BRAND = '#D24830';

interface PreviewModalProps {
  open: boolean;
  onClose: () => void;
  project: Project;
  /** 未授权试用：预览叠加水印（见 docs/font-licensing-dev-doc.md） */
  watermark?: boolean;
  /** 已发布作品显示「已发布」徽章并给出线上访问入口 */
  published?: boolean;
  /** 线上访问码（publishCode） */
  publishCode?: string | null;
}

const dt = (v?: string) => (v ? new Date(v).toLocaleString('zh-CN', { hour12: false }) : '—');

export default function PreviewModal({
  open,
  onClose,
  project,
  watermark,
  published,
  publishCode,
}: PreviewModalProps) {
  const { t } = useTranslation(['common']);
  const pages = useMemo(() => project?.pages ?? [], [project?.pages]);
  const hasSchema = pages.length > 0;

  const [page, setPage] = useState(0);
  const [replayKey, setReplayKey] = useState(0);
  const [playAnim, setPlayAnim] = useState(true);

  // 设计稿尺寸：沿用工程自身宽高（默认 375×667），缩放与作品预览口径一致
  const designW = project?.width || 375;
  const designH = project?.height || 667;
  const scale = FRAME_W / designW;

  useEffect(() => {
    setPage(0);
    setReplayKey((k) => k + 1);
  }, [open, project?.id]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const settings = project?.settings ?? ({} as Project['settings']);
  const musicSrc = typeof settings.backgroundMusic === 'string' ? settings.backgroundMusic : settings.backgroundMusic?.url;

  const goPage = (i: number) => {
    if (pages.length === 0) return;
    setPage((i + pages.length) % pages.length);
    setReplayKey((k) => k + 1);
  };

  const ctrlBtn: React.CSSProperties = {
    fontSize: 12.5,
    padding: '5px 12px',
    borderRadius: 6,
    border: `1px solid ${BORDER}`,
    background: '#fff',
    color: INK2,
    cursor: 'pointer',
  };

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
      data-testid="editor-preview-modal"
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
              height: designH * scale + BEZEL * 2,
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
                <DOMRenderer
                  key={replayKey}
                  project={project}
                  currentPage={page}
                  scale={scale}
                  animated={playAnim}
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
                  {t('common:placeholder.noPreview', { defaultValue: '该作品暂无可预览内容' })}
                </div>
              )}
              {watermark && <WatermarkOverlay />}
              <MusicPlayer
                music={settings.backgroundMusic}
                autoPlay={!settings.closeBackgroundMusic}
                hidden={settings.hideMusicIcon}
              />
            </div>
          </div>

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
              {t('common:button.prevPage', { defaultValue: '上一页' })}
            </button>
            <span style={{ minWidth: 88, textAlign: 'center', color: INK3, fontVariantNumeric: 'tabular-nums' }}>
              {hasSchema
                ? `${t('common:button.page', { defaultValue: '第' })} ${page + 1} / ${pages.length} ${t('common:button.pageUnit', { defaultValue: '页' })}`
                : '—'}
            </span>
            <button type="button" style={ctrlBtn} onClick={() => goPage(page + 1)} disabled={pages.length <= 1}>
              {t('common:button.nextPage', { defaultValue: '下一页' })}
            </button>
            <button type="button" style={ctrlBtn} onClick={() => setReplayKey((k) => k + 1)} disabled={!hasSchema}>
              {t('common:button.replayAnim', { defaultValue: '重播动画' })}
            </button>
            <label
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                color: INK2,
                cursor: 'pointer',
                userSelect: 'none',
              }}
            >
              <input
                type="checkbox"
                checked={playAnim}
                onChange={(e) => {
                  setPlayAnim(e.target.checked);
                  if (e.target.checked) setReplayKey((k) => k + 1);
                }}
              />
              {t('common:button.playAnim', { defaultValue: '播放动画' })}
            </label>
          </div>

          {hasSchema && pages.length > 1 && (
            <div data-testid="preview-page-dots" style={{ marginTop: 12, display: 'flex', gap: 6 }}>
              {pages.map((p, i) => (
                <button
                  key={p.id ?? i}
                  type="button"
                  aria-label={`${t('common:button.page', { defaultValue: '第' })} ${i + 1} ${t('common:button.pageUnit', { defaultValue: '页' })}`}
                  onClick={() => goPage(i)}
                  style={{
                    height: 8,
                    width: i === page ? 24 : 8,
                    borderRadius: 999,
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    background: i === page ? BRAND : '#d1d5db',
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
            borderTop: `1px solid ${BORDER}`,
            borderLeft: `1px solid ${BORDER}`,
            maxHeight: '92vh',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, padding: 16 }}>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 600, lineHeight: 1.4, color: INK1 }}>
              {project?.title || t('common:status.untitled', { defaultValue: '未命名作品' })}
            </h3>
            <button
              type="button"
              aria-label={t('common:button.close', { defaultValue: '关闭' })}
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
              {published
                ? t('common:status.publishedBadge', { defaultValue: '已发布' })
                : t('common:status.draft', { defaultValue: '草稿' })}
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
              <div style={{ marginBottom: 4, fontSize: 12, color: INK3 }}>
                {t('common:detail.id', { defaultValue: '作品编号' })}
              </div>
              <div style={{ wordBreak: 'break-all', fontFamily: 'monospace', fontSize: 12, color: INK2 }}>
                {project?.id || '—'}
              </div>
            </div>
            <div>
              <div style={{ marginBottom: 4, fontSize: 12, color: INK3 }}>
                {t('common:detail.canvas', { defaultValue: '画布尺寸' })}
              </div>
              <div style={{ color: INK1, fontVariantNumeric: 'tabular-nums' }}>
                {designW} × {designH}
              </div>
            </div>
            <div>
              <div style={{ marginBottom: 4, fontSize: 12, color: INK3 }}>
                {t('common:detail.pages', { defaultValue: '页数' })}
              </div>
              <div style={{ color: INK1 }}>{pages.length}</div>
            </div>
            <div>
              <div style={{ marginBottom: 4, fontSize: 12, color: INK3 }}>
                {t('common:detail.music', { defaultValue: '背景音乐' })}
              </div>
              <div style={{ color: INK1 }}>
                {musicSrc
                  ? t('common:detail.musicSet', { defaultValue: '已设置' })
                  : t('common:detail.musicNone', { defaultValue: '未设置' })}
              </div>
            </div>
            <div>
              <div style={{ marginBottom: 4, fontSize: 12, color: INK3 }}>
                {t('common:detail.updatedAt', { defaultValue: '最近更新' })}
              </div>
              <div style={{ color: INK1 }}>{dt(project?.updatedAt)}</div>
            </div>
            {published && publishCode && (
              <div>
                <div style={{ marginBottom: 4, fontSize: 12, color: INK3 }}>
                  {t('common:detail.online', { defaultValue: '线上访问' })}
                </div>
                <a
                  href={`${window.location.origin}/p/${publishCode}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{ fontSize: 13, color: BRAND }}
                >
                  {t('common:detail.visitH5', { defaultValue: '访问 H5' })}（{publishCode}）→
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
