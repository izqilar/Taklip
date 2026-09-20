/**
 * TemplatePreviewModal — 模板库「预览」标准化弹窗（对标大型 APP 模板市场）。
 *
 * 解决旧版预览弹窗的痛点：
 *  1. 仅能看作品首页（封面缩略图）→ 现用共享渲染器 SchemaRenderer 渲染「多页」模板，
 *     支持上一页/下一页/页码圆点切换；
 *  2. 无法观察动画效果 → 注入 GSAP playElementAnimation（懒加载，不拖主包），
 *     提供「重播动画」按钮与「播放动画」开关；
 *  3. 缺少模板属性信息 → 右侧标准化属性栏展示：模板编号 / 分类 / 标签 / 官方认证 / 价格 / 使用次数。
 *
 * 复用 @h5design/render 的 SchemaRenderer（与发布页、编辑器三端一致），保证所见即所得。
 */
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TemplateListItem } from '@/api/client';
import { SchemaRenderer } from '@h5design/render';
import type { AnimationPlayer } from '@h5design/render';
import { normalizeSchema } from '@h5design/core';
import { categoryI18nKey } from '@/categories';

interface TemplatePreviewModalProps {
  template: TemplateListItem;
  onUse: (templateId: string) => void;
  onClose: () => void;
}

/** 设计稿基准尺寸（与 schema 默认一致） */
const DESIGN_W = 375;
const DESIGN_H = 667;
/** 手机框内可视宽（不含边框）；按比例缩放设计稿以铺满框内 */
const FRAME_W = 300;
const BEZEL = 10;
const SCALE = FRAME_W / DESIGN_W;

export default function TemplatePreviewModal({ template, onUse, onClose }: TemplatePreviewModalProps) {
  const { t } = useTranslation(['templates', 'common']);

  // schema → 归一化为完整的 Project（缺字段补默认，保证多页/动画可渲染）
  const project = useMemo(() => normalizeSchema((template.schema as any) ?? null), [template.schema]);
  const pages = project.pages ?? [];
  const hasSchema = pages.length > 0;

  const [page, setPage] = useState(0);
  const [replayKey, setReplayKey] = useState(0);
  const [playAnim, setPlayAnim] = useState(true);
  // 默认 no-op；挂载后懒加载 GSAP 播放器，避免把 gsap 拖进模板库首屏
  const [player, setPlayer] = useState<AnimationPlayer>(() => () => undefined);

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
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const goPage = (i: number) => {
    if (pages.length === 0) return;
    const next = (i + pages.length) % pages.length;
    setPage(next);
    setReplayKey((k) => k + 1); // 切页重播该页入场动画
  };

  const catLabel = (() => {
    const key = `common:${categoryI18nKey(template.category)}`;
    const lbl = t(key);
    return lbl.startsWith('common:') ? template.category : lbl;
  })();

  const priceNode =
    template.price > 0 ? (
      <span className="font-semibold text-[#c81e42]">¥{(template.price / 100).toFixed(2)}</span>
    ) : (
      <span className="text-green-600">{t('templates:free')}</span>
    );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl md:flex-row"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 左：手机预览舞台 */}
        <div className="flex flex-1 flex-col items-center justify-center bg-gray-50 p-6">
          <div
            className="relative rounded-[32px] bg-gray-900 p-[10px] shadow-lg"
            style={{ width: FRAME_W + BEZEL * 2, height: DESIGN_H * SCALE + BEZEL * 2 }}
          >
            <div className="relative h-full w-full overflow-hidden rounded-[22px] bg-white">
              {hasSchema ? (
                <SchemaRenderer
                  key={replayKey}
                  project={project}
                  currentPage={page}
                  scale={SCALE}
                  animated={playAnim}
                  animationPlayer={player}
                />
              ) : template.cover ? (
                <img src={template.cover} alt={template.name} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-sm text-gray-400">
                  {t('templates:preview.noPages')}
                </div>
              )}
            </div>
          </div>

          {/* 翻页控制条 */}
          <div className="mt-4 flex items-center gap-2 text-sm">
            <button
              type="button"
              onClick={() => goPage(page - 1)}
              disabled={pages.length <= 1}
              className="rounded-md border border-gray-200 px-3 py-1.5 text-gray-600 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              {t('templates:preview.prev')}
            </button>
            <span className="min-w-[88px] text-center tabular-nums text-gray-500">
              {hasSchema ? t('templates:preview.pageIndicator', { current: page + 1, total: pages.length }) : '—'}
            </span>
            <button
              type="button"
              onClick={() => goPage(page + 1)}
              disabled={pages.length <= 1}
              className="rounded-md border border-gray-200 px-3 py-1.5 text-gray-600 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              {t('templates:preview.next')}
            </button>
            <button
              type="button"
              onClick={() => setReplayKey((k) => k + 1)}
              disabled={!hasSchema}
              className="rounded-md border border-gray-200 px-3 py-1.5 text-gray-600 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              {t('templates:preview.replay')}
            </button>
            <label className="flex cursor-pointer select-none items-center gap-1 text-gray-600">
              <input
                type="checkbox"
                checked={playAnim}
                onChange={(e) => {
                  setPlayAnim(e.target.checked);
                  if (e.target.checked) setReplayKey((k) => k + 1);
                }}
                className="accent-brand-500"
              />
              {t('templates:preview.playAnim')}
            </label>
          </div>

          {/* 页码圆点 */}
          {hasSchema && pages.length > 1 && (
            <div className="mt-3 flex gap-1.5">
              {pages.map((p, i) => (
                <button
                  key={p.id}
                  type="button"
                  aria-label={`${t('templates:preview.pageIndicator', { current: i + 1, total: pages.length })}`}
                  onClick={() => goPage(i)}
                  className={`h-2 rounded-full transition-all ${
                    i === page ? 'w-6 bg-brand-500' : 'w-2 bg-gray-300 hover:bg-gray-400'
                  }`}
                />
              ))}
            </div>
          )}
        </div>

        {/* 右：标准化属性栏 */}
        <div className="flex w-full flex-col border-t border-gray-100 md:w-80 md:border-l md:border-t-0">
          <div className="flex items-start justify-between gap-2 p-4">
            <h3 className="text-lg font-semibold leading-snug text-gray-900">{template.name}</h3>
            <button
              type="button"
              onClick={onClose}
              aria-label={t('common:button.close')}
              className="shrink-0 rounded-full p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
            >
              ✕
            </button>
          </div>

          {template.isOfficial && (
            <div className="px-4">
              <span className="inline-flex items-center rounded bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-600">
                ✓ {t('templates:preview.official')}
              </span>
            </div>
          )}

          <dl className="flex-1 space-y-4 overflow-y-auto p-4 text-sm">
            <div>
              <dt className="mb-1 text-xs text-gray-400">{t('templates:preview.code')}</dt>
              <dd className="break-all font-mono text-xs text-gray-500">{template.id}</dd>
            </div>
            <div>
              <dt className="mb-1 text-xs text-gray-400">{t('templates:preview.category')}</dt>
              <dd className="text-gray-800">{catLabel}</dd>
            </div>
            <div>
              <dt className="mb-1 text-xs text-gray-400">{t('templates:preview.tags')}</dt>
              <dd className="flex flex-wrap gap-1.5">
                {template.tags.length > 0 ? (
                  template.tags.map((tag) => (
                    <span key={tag} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                      {tag}
                    </span>
                  ))
                ) : (
                  <span className="text-gray-300">—</span>
                )}
              </dd>
            </div>
            <div>
              <dt className="mb-1 text-xs text-gray-400">{t('templates:preview.price')}</dt>
              <dd>{priceNode}</dd>
            </div>
            <div>
              <dt className="mb-1 text-xs text-gray-400">{t('templates:preview.uses')}</dt>
              <dd className="text-gray-800">{t('templates:useCount', { count: template.useCount })}</dd>
            </div>
          </dl>

          <div className="p-4">
            <button
              type="button"
              onClick={() => {
                onClose();
                onUse(template.id);
              }}
              className="w-full rounded-lg bg-brand-500 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-brand-600"
            >
              {t('common:button.useTemplate')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
