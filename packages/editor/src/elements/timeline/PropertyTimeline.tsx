import { useTranslation } from 'react-i18next';
import type { TimelineElement, TimelineNode } from '@h5design/core';
import ColorField from '../../components/UI/ColorField';

interface PropertyTimelineProps {
  el: TimelineElement;
  update: (patch: Partial<TimelineElement>) => void;
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

const inputCls =
  'min-w-0 flex-1 rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 outline-none focus:border-blue-400';

export default function PropertyTimeline({ el, update, commit }: PropertyTimelineProps) {
  const { t } = useTranslation('editor');

  const setNode = (idx: number, patch: Partial<TimelineNode>) => {
    const next = el.nodes.map((n, i) => (i === idx ? { ...n, ...patch } : n));
    update({ nodes: next });
  };

  const removeNode = (idx: number) => {
    update({ nodes: el.nodes.filter((_, i) => i !== idx) });
    commit();
  };

  const addNode = () => {
    const next: TimelineNode = { time: '00:00', title: '新环节', desc: '环节描述' };
    update({ nodes: [...el.nodes, next] });
    commit();
  };

  return (
    <div className="flex flex-col gap-4">
      <ColorField
        label={t('editor:property.themeColor')}
        value={el.themeColor}
        onChange={(v) => {
          update({ themeColor: v });
          commit();
        }}
      />
      <ColorField
        label={t('editor:property.textColor')}
        value={el.textColor}
        onChange={(v) => {
          update({ textColor: v });
          commit();
        }}
      />

      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">{t('editor:property.nodes')}</span>
        <button
          type="button"
          onClick={addNode}
          className="rounded bg-blue-500 px-2 py-1 text-xs text-white transition hover:bg-blue-600"
        >
          {t('editor:property.addNode')}
        </button>
      </div>

      <div className="flex flex-col gap-3">
        {el.nodes.length === 0 && <div className="text-xs text-gray-400">{t('editor:components.emptyBoard')}</div>}
        {el.nodes.map((n, i) => (
          <div key={i} className="rounded border border-gray-200 p-2">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-xs font-medium text-gray-500">#{i + 1}</span>
              <button
                type="button"
                onClick={() => removeNode(i)}
                className="ml-auto rounded px-2 py-0.5 text-xs text-red-500 transition hover:bg-red-50"
              >
                {t('editor:action.remove')}
              </button>
            </div>
            <div className="flex flex-col gap-2">
              <input
                type="text"
                value={n.time}
                onChange={(e) => setNode(i, { time: e.target.value })}
                onBlur={commit}
                placeholder={t('editor:property.eventTime')}
                className={inputCls}
              />
              <input
                type="text"
                value={n.title}
                onChange={(e) => setNode(i, { title: e.target.value })}
                onBlur={commit}
                placeholder={t('editor:property.eventTitle')}
                className={inputCls}
              />
              <input
                type="text"
                value={n.desc}
                onChange={(e) => setNode(i, { desc: e.target.value })}
                onBlur={commit}
                placeholder={t('editor:property.eventDesc')}
                className={inputCls}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
