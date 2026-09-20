import { useTranslation } from 'react-i18next';
import type { CountdownElement } from '@h5design/core';
import ColorField from '@/components/UI/ColorField';
import { isoToLocalInput, localInputToIso } from './countdownShared';

interface PropertyCountdownProps {
  el: CountdownElement;
  update: (patch: Partial<CountdownElement>) => void;
  commit: () => void;
}

function SwitchField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-700">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative h-5 w-9 rounded-full transition ${checked ? 'bg-blue-500' : 'bg-gray-300'}`}
      >
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition ${checked ? 'left-[18px]' : 'left-0.5'}`} />
      </button>
    </div>
  );
}

export default function PropertyCountdown({ el, update, commit }: PropertyCountdownProps) {
  const { t } = useTranslation('editor');
  const inputValue = isoToLocalInput(el.target);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <label className="w-20 shrink-0 text-sm text-gray-700">{t('editor:property.countdownTitle')}</label>
        <input
          type="text"
          value={el.title}
          onChange={(e) => update({ title: e.target.value })}
          onBlur={commit}
          className="min-w-0 flex-1 rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 outline-none focus:border-blue-400"
        />
      </div>

      <div className="flex items-center gap-3">
        <label className="w-20 shrink-0 text-sm text-gray-700">{t('editor:property.target')}</label>
        <input
          type="datetime-local"
          value={inputValue}
          onChange={(e) => {
            const iso = localInputToIso(e.target.value);
            if (iso) update({ target: iso });
          }}
          onBlur={commit}
          className="min-w-0 flex-1 rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 outline-none focus:border-blue-400"
        />
      </div>

      <SwitchField
        label={t('editor:property.showTitle')}
        checked={el.showTitle}
        onChange={(v) => { update({ showTitle: v }); commit(); }}
      />

      <ColorField label={t('editor:property.themeColor')} value={el.themeColor} onChange={(v) => { update({ themeColor: v }); commit(); }} />
      <ColorField label={t('editor:property.textColor')} value={el.textColor} onChange={(v) => { update({ textColor: v }); commit(); }} />
      <ColorField label={t('editor:property.digitBgColor')} value={el.digitBgColor} onChange={(v) => { update({ digitBgColor: v }); commit(); }} />
      <ColorField label={t('editor:property.backgroundColor')} value={el.bgColor} onChange={(v) => { update({ bgColor: v }); commit(); }} />

      <div className="flex items-center gap-3">
        <label className="w-20 shrink-0 text-sm text-gray-700">{t('editor:property.fontSize')}</label>
        <input
          type="number"
          min={12}
          max={64}
          value={el.fontSize}
          onChange={(e) => update({ fontSize: Number(e.target.value) })}
          onBlur={commit}
          className="min-w-0 flex-1 rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 outline-none focus:border-blue-400"
        />
      </div>
    </div>
  );
}
