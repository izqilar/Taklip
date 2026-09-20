import { useTranslation } from 'react-i18next';
import type { WidgetElement } from '@h5design/core';
import ColorField from '../../components/UI/ColorField';
import { WIDGET_REGISTRY } from './widgetModules';
import type { WidgetCommonField, WidgetFieldDef } from './types';

interface PropertyWidgetProps {
  el: WidgetElement;
  update: (patch: Partial<WidgetElement>) => void;
  commit: () => void;
}

const COMMON_LABEL: Record<WidgetCommonField, string> = {
  title: 'editor:widget.fields.title',
  text: 'editor:widget.fields.text',
  themeColor: 'editor:widget.fields.themeColor',
  textColor: 'editor:widget.fields.textColor',
  bgColor: 'editor:widget.fields.bgColor',
};

const inputCls =
  'min-w-0 flex-1 rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 outline-none focus:border-blue-400';

export default function PropertyWidget({ el, update, commit }: PropertyWidgetProps) {
  const { t } = useTranslation('editor');
  const def = WIDGET_REGISTRY[el.widget];
  if (!def) return null;

  const updateCommon = (key: WidgetCommonField, value: any) =>
    update({ [key]: value } as Partial<WidgetElement>);
  const updateData = (key: string, value: any) =>
    update({ data: { ...(el.data ?? {}), [key]: value } } as Partial<WidgetElement>);

  const renderCommon = (key: WidgetCommonField) => {
    if (key === 'themeColor' || key === 'textColor' || key === 'bgColor') {
      return (
        <ColorField
          key={key}
          label={t(COMMON_LABEL[key])}
          value={(el as any)[key] || '#ffffff'}
          onChange={(v) => {
            updateCommon(key, v);
            commit();
          }}
        />
      );
    }
    const isText = key === 'text';
    const value = (el as any)[key] ?? '';
    return (
      <div key={key} className="flex items-center gap-3">
        <label className="w-20 shrink-0 text-sm text-gray-700">{t(COMMON_LABEL[key])}</label>
        {isText ? (
          <input
            type="text"
            value={value}
            onChange={(e) => updateCommon(key, e.target.value)}
            onBlur={commit}
            className={inputCls}
          />
        ) : (
          <textarea
            value={value}
            onChange={(e) => updateCommon(key, e.target.value)}
            onBlur={commit}
            className={`${inputCls} resize-none`}
            rows={2}
          />
        )}
      </div>
    );
  };

  const renderField = (field: WidgetFieldDef) => {
    const raw = (el.data ?? {})[field.key];
    switch (field.type) {
      case 'color':
        return (
          <ColorField
            key={field.key}
            label={t(field.labelKey)}
            value={raw || '#ffffff'}
            onChange={(v) => {
              updateData(field.key, v);
              commit();
            }}
          />
        );
      case 'number':
        return (
          <div key={field.key} className="flex items-center gap-3">
            <label className="w-20 shrink-0 text-sm text-gray-700">{t(field.labelKey)}</label>
            <input
              type="number"
              value={raw ?? 0}
              min={field.min}
              max={field.max}
              step={field.step}
              onChange={(e) => updateData(field.key, Number(e.target.value))}
              onBlur={commit}
              className={inputCls}
            />
          </div>
        );
      case 'switch':
        return (
          <div key={field.key} className="flex items-center gap-3">
            <label className="w-20 shrink-0 text-sm text-gray-700">{t(field.labelKey)}</label>
            <input
              type="checkbox"
              checked={!!raw}
              onChange={(e) => {
                updateData(field.key, e.target.checked);
                commit();
              }}
              className="h-4 w-4"
            />
          </div>
        );
      case 'select':
        return (
          <div key={field.key} className="flex items-center gap-3">
            <label className="w-20 shrink-0 text-sm text-gray-700">{t(field.labelKey)}</label>
            <select
              value={raw ?? ''}
              onChange={(e) => {
                updateData(field.key, e.target.value);
                commit();
              }}
              className={inputCls}
            >
              {(field.options ?? []).map((o) => (
                <option key={o.value} value={o.value}>
                  {t(o.labelKey)}
                </option>
              ))}
            </select>
          </div>
        );
      case 'options':
        return (
          <div key={field.key} className="flex items-start gap-3">
            <label className="w-20 shrink-0 pt-1.5 text-sm text-gray-700">{t(field.labelKey)}</label>
            <textarea
              value={Array.isArray(raw) ? raw.join('\n') : String(raw ?? '')}
              onChange={(e) => updateData(field.key, e.target.value.split('\n').map((s) => s.trim()).filter(Boolean))}
              onBlur={commit}
              rows={4}
              className={`${inputCls} resize-y font-mono text-xs`}
              placeholder={'一行一个'}
            />
          </div>
        );
      case 'image':
        return (
          <div key={field.key} className="flex items-center gap-3">
            <label className="w-20 shrink-0 text-sm text-gray-700">{t(field.labelKey)}</label>
            <input
              type="text"
              value={raw ?? ''}
              placeholder="https://..."
              onChange={(e) => updateData(field.key, e.target.value)}
              onBlur={commit}
              className={inputCls}
            />
          </div>
        );
      case 'textarea':
        return (
          <div key={field.key} className="flex items-start gap-3">
            <label className="w-20 shrink-0 pt-1.5 text-sm text-gray-700">{t(field.labelKey)}</label>
            <textarea
              value={raw ?? ''}
              onChange={(e) => updateData(field.key, e.target.value)}
              onBlur={commit}
              rows={3}
              className={`${inputCls} resize-y`}
            />
          </div>
        );
      case 'text':
      default:
        return (
          <div key={field.key} className="flex items-center gap-3">
            <label className="w-20 shrink-0 text-sm text-gray-700">{t(field.labelKey)}</label>
            <input
              type="text"
              value={raw ?? ''}
              onChange={(e) => updateData(field.key, e.target.value)}
              onBlur={commit}
              className={inputCls}
            />
          </div>
        );
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700">
        {t(def.labelKey)}
      </div>
      {(def.commonFields ?? []).map(renderCommon)}
      {def.fields.map(renderField)}
    </div>
  );
}
