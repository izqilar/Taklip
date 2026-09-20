import { useTranslation } from 'react-i18next';
import type { MessageBoardElement, MessageItem } from '@h5design/core';
import ColorField from '../../components/UI/ColorField';

interface PropertyMessageBoardProps {
  el: MessageBoardElement;
  update: (patch: Partial<MessageBoardElement>) => void;
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

function genId(): string {
  return `m_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export default function PropertyMessageBoard({ el, update, commit }: PropertyMessageBoardProps) {
  const { t } = useTranslation('editor');

  const setTitle = (v: string) => update({ title: v });
  const setPlaceholder = (v: string) => update({ placeholder: v });
  const setAllowPost = (v: boolean) => {
    update({ allowPost: v });
    commit();
  };

  const setMessage = (idx: number, patch: Partial<MessageItem>) => {
    const next = el.messages.map((m, i) => (i === idx ? { ...m, ...patch } : m));
    update({ messages: next });
  };

  const removeMessage = (idx: number) => {
    update({ messages: el.messages.filter((_, i) => i !== idx) });
    commit();
  };

  const addMessage = () => {
    const item: MessageItem = { id: genId(), name: '宾客', text: '新婚快乐，百年好合！', time: new Date().toISOString() };
    update({ messages: [...el.messages, item] });
    commit();
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <label className="w-20 shrink-0 text-sm text-gray-700">{t('editor:property.boardTitle')}</label>
        <input
          type="text"
          value={el.title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={commit}
          className={inputCls}
        />
      </div>

      <div className="flex items-center gap-3">
        <label className="w-20 shrink-0 text-sm text-gray-700">{t('editor:property.placeholder')}</label>
        <input
          type="text"
          value={el.placeholder}
          onChange={(e) => setPlaceholder(e.target.value)}
          onBlur={commit}
          className={inputCls}
        />
      </div>

      <SwitchField label={t('editor:property.allowPost')} checked={el.allowPost} onChange={setAllowPost} />

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
        <span className="text-sm font-medium text-gray-700">{t('editor:property.messages')}</span>
        <button
          type="button"
          onClick={addMessage}
          className="rounded bg-blue-500 px-2 py-1 text-xs text-white transition hover:bg-blue-600"
        >
          {t('editor:property.addMessage')}
        </button>
      </div>

      <div className="flex flex-col gap-3">
        {el.messages.length === 0 && <div className="text-xs text-gray-400">{t('editor:components.emptyBoard')}</div>}
        {el.messages.map((m, i) => (
          <div key={m.id} className="rounded border border-gray-200 p-2">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-xs font-medium text-gray-500">#{i + 1}</span>
              <button
                type="button"
                onClick={() => removeMessage(i)}
                className="ml-auto rounded px-2 py-0.5 text-xs text-red-500 transition hover:bg-red-50"
              >
                {t('editor:action.remove')}
              </button>
            </div>
            <div className="flex flex-col gap-2">
              <input
                type="text"
                value={m.name}
                onChange={(e) => setMessage(i, { name: e.target.value })}
                onBlur={commit}
                placeholder={t('editor:property.messageName')}
                className={inputCls}
              />
              <input
                type="text"
                value={m.text}
                onChange={(e) => setMessage(i, { text: e.target.value })}
                onBlur={commit}
                placeholder={t('editor:property.messageText')}
                className={inputCls}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
