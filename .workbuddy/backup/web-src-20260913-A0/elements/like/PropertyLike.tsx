import { useTranslation } from 'react-i18next';
import type { LikeElement } from '@h5design/core';
import ColorField from '@/components/UI/ColorField';

interface PropertyLikeProps {
  el: LikeElement;
  update: (patch: Partial<LikeElement>) => void;
  commit: () => void;
}

export default function PropertyLike({ el, update, commit }: PropertyLikeProps) {
  const { t } = useTranslation('editor');
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <label className="w-20 shrink-0 text-sm text-gray-700">{t('editor:property.likeText')}</label>
        <input
          type="text"
          value={el.text}
          onChange={(e) => update({ text: e.target.value })}
          onBlur={commit}
          className="min-w-0 flex-1 rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 outline-none focus:border-blue-400"
        />
      </div>
      <div className="flex items-center gap-3">
        <label className="w-20 shrink-0 text-sm text-gray-700">{t('editor:property.likeCount')}</label>
        <input
          type="number"
          min={0}
          value={el.count}
          onChange={(e) => update({ count: Number(e.target.value) })}
          onBlur={commit}
          className="min-w-0 flex-1 rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 outline-none focus:border-blue-400"
        />
      </div>
      <div className="flex items-center gap-3">
        <label className="w-20 shrink-0 text-sm text-gray-700">{t('editor:property.iconSize')}</label>
        <input
          type="number"
          min={12}
          max={64}
          value={el.iconSize}
          onChange={(e) => update({ iconSize: Number(e.target.value) })}
          onBlur={commit}
          className="min-w-0 flex-1 rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 outline-none focus:border-blue-400"
        />
      </div>
      <ColorField label={t('editor:property.themeColor')} value={el.themeColor} onChange={(v) => { update({ themeColor: v }); commit(); }} />
      <ColorField label={t('editor:property.textColor')} value={el.textColor} onChange={(v) => { update({ textColor: v }); commit(); }} />
    </div>
  );
}
