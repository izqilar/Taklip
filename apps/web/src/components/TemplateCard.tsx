/**
 * TemplateCard — 浅色模板卡片（对标八图 H5）
 * 封面 + 标题 + 使用次数 + 官方标签；hover 显示「预览 / 立即制作」遮罩；
 * 「预览」打开手机框弹窗展示封面。供首页模板墙与模板库复用。
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TemplateListItem } from '@/api/client';
import { SchemaThumbnail } from '@/components/SchemaThumbnail';
import TemplatePreviewModal from '@/components/TemplatePreviewModal';
import { useFavoritesStore, type FavoriteTemplate } from '@/store/favoritesStore';
import { formatCents } from '@h5design/core';

interface TemplateCardProps {
  template: TemplateListItem;
  onUse: (templateId: string) => void;
}

export default function TemplateCard({ template, onUse }: TemplateCardProps) {
  const { t } = useTranslation();
  const [preview, setPreview] = useState(false);
  const favorited = useFavoritesStore((s) => s.has(template.id));
  const toggleFavorite = useFavoritesStore((s) => s.toggle);

  const toFavorite = (): FavoriteTemplate => ({
    id: template.id,
    name: template.name,
    cover: template.cover,
    price: template.price,
    currency: template.currency,
    category: template.category,
  });

  return (
    <>
      <div
        className="group relative cursor-pointer overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-lg"
        onClick={() => onUse(template.id)}
      >
        {/* 收藏切换 */}
        <button
          type="button"
          aria-label={t('common:favorites.toggle')}
          onClick={(e) => {
            e.stopPropagation();
            toggleFavorite(toFavorite());
          }}
          className="absolute end-2 top-2 z-10 rounded-full bg-white/80 p-1.5 text-lg shadow-sm backdrop-blur transition hover:bg-white"
        >
          {favorited ? '❤️' : '🤍'}
        </button>

        {/* 封面：优先显示上传封面，否则渲染模板第一页内容作为实时缩略图 */}
        <div className="relative flex aspect-[375/667] items-center justify-center overflow-hidden bg-gray-50">
          {template.cover ? (
            <img src={template.cover} alt={template.name} className="h-full w-full object-cover" />
          ) : (
            <SchemaThumbnail schema={template.schema} />
          )}
        </div>

        {/* 信息 */}
        <div className="flex items-center justify-between gap-2 p-3">
          <h3 className="truncate text-sm font-medium text-gray-800">{template.name}</h3>
          {template.isOfficial && (
            <span className="shrink-0 rounded bg-brand-50 px-1.5 py-0.5 text-xs font-medium text-brand-600">
              {t('common:badge.official')}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between px-3 pb-3 text-xs text-gray-600">
          <span>{template.useCount} {t('common:home.uses')}</span>
          {template.price > 0 ? (
            <span className="font-semibold text-[#c81e42]">{formatCents(template.price)}</span>
          ) : (
            <span className="text-green-600">{t('templates:free')}</span>
          )}
        </div>

        {/* hover / 键盘聚焦 遮罩：group-hover 与 group-focus-within 均显示，
            保证键盘 Tab 进入遮罩按钮时遮罩可见（否则 opacity-0 按钮不可见却可聚焦） */}
        <div className="absolute inset-0 flex items-center justify-center gap-3 bg-black/40 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setPreview(true);
            }}
            className="rounded-lg border border-white/70 bg-white/10 px-4 py-2 text-sm font-medium text-white backdrop-blur transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
          >
            {t('common:button.preview')}
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onUse(template.id);
            }}
            className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
          >
            {t('common:button.create')}
          </button>
        </div>
      </div>

      {/* 预览弹窗（标准化：多页切换 + 动画预览 + 属性栏） */}
      {preview && (
        <TemplatePreviewModal
          template={template}
          onUse={onUse}
          onClose={() => setPreview(false)}
        />
      )}
    </>
  );
}
