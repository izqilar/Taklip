import { useTranslation } from 'react-i18next';
import type { MapNavElement } from '@h5design/core';
import ColorField from '@/components/UI/ColorField';

interface PropertyMapNavProps {
  el: MapNavElement;
  update: (patch: Partial<MapNavElement>) => void;
  commit: () => void;
}

export default function PropertyMapNav({ el, update, commit }: PropertyMapNavProps) {
  const { t } = useTranslation('editor');
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <label className="w-20 shrink-0 text-sm text-gray-700">{t('editor:property.venue')}</label>
        <input
          type="text"
          value={el.venue}
          onChange={(e) => update({ venue: e.target.value })}
          onBlur={commit}
          className="min-w-0 flex-1 rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 outline-none focus:border-blue-400"
        />
      </div>
      <div className="flex items-center gap-3">
        <label className="w-20 shrink-0 text-sm text-gray-700">{t('editor:property.address')}</label>
        <input
          type="text"
          value={el.address}
          onChange={(e) => update({ address: e.target.value })}
          onBlur={commit}
          className="min-w-0 flex-1 rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 outline-none focus:border-blue-400"
        />
      </div>
      <div className="flex items-center gap-3">
        <label className="w-20 shrink-0 text-sm text-gray-700">{t('editor:property.buttonText')}</label>
        <input
          type="text"
          value={el.buttonText}
          onChange={(e) => update({ buttonText: e.target.value })}
          onBlur={commit}
          className="min-w-0 flex-1 rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 outline-none focus:border-blue-400"
        />
      </div>
      <ColorField label={t('editor:property.themeColor')} value={el.themeColor} onChange={(v) => { update({ themeColor: v }); commit(); }} />
      <ColorField label={t('editor:property.textColor')} value={el.textColor} onChange={(v) => { update({ textColor: v }); commit(); }} />
    </div>
  );
}
