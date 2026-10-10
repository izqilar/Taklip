import { useTranslation } from 'react-i18next';
import type { ProjectElement, HealthCandidate, ElementBindings } from './types';

/** D 模式：选中元素后浮出的「选择名单字段」浮层（不渲染像素级画布，仅字段选择） */
export function PickOverlay({
  element,
  candidates,
  bindings,
  onSetField,
  onClear,
  i18nPrefix = 'invitationMapping',
}: {
  element: ProjectElement;
  candidates: HealthCandidate[];
  bindings: ElementBindings;
  onSetField: (el: ProjectElement, field: HealthCandidate | null) => void;
  onClear: () => void;
  i18nPrefix?: string;
}) {
  const { t } = useTranslation(['common']);
  const tk = (k: string) => t(`common:${i18nPrefix}.${k}`);
  const bound = bindings[element.id];
  return (
    <div className="mt-1 rounded border border-blue-300 bg-blue-50 px-2 py-2 text-xs">
      <div className="mb-1 font-medium text-blue-700">
        {tk('element')}：{element.text || element.type}（{tk('field')}）
      </div>
      <div className="flex items-center gap-2">
        <select
          value={bound?.listField ?? ''}
          onChange={(e) => {
            const f = candidates.find((c) => c.key === e.target.value) ?? null;
            onSetField(element, f);
          }}
          className="rounded border border-gray-300 px-2 py-1 text-xs"
        >
          <option value="">{tk('unmapped')}</option>
          {candidates.map((c) => (
            <option key={c.key} value={c.key}>
              {c.label}
            </option>
          ))}
        </select>
        {bound ? (
          <button onClick={onClear} className="text-gray-500 underline">
            {tk('unmapped')}
          </button>
        ) : null}
      </div>
    </div>
  );
}
