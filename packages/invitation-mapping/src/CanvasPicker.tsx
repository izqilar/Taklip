import { useTranslation } from 'react-i18next';
import { SchemaRenderer } from '@h5design/render';
import type { ProjectElement, HealthCandidate, ElementBindings } from './types';
import { PickOverlay } from './PickOverlay';

/** D 模式画布点选：左预览（SchemaRenderer）/ 右可点元素列表；选中元素浮出字段选择 */
export function CanvasPicker({
  elements,
  candidates,
  bindings,
  previewSchema,
  selectedId,
  onSelect,
  onSetField,
  i18nPrefix = 'invitationMapping',
}: {
  elements: ProjectElement[];
  candidates: HealthCandidate[];
  bindings: ElementBindings;
  previewSchema?: unknown;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onSetField: (el: ProjectElement, field: HealthCandidate | null) => void;
  i18nPrefix?: string;
}) {
  const { t } = useTranslation(['common']);
  const tk = (k: string) => t(`common:${i18nPrefix}.${k}`);
  return (
    <div className="flex gap-3">
      <div className="w-1/2 overflow-hidden rounded border border-gray-200 bg-gray-50" style={{ maxHeight: 360 }}>
        {previewSchema ? (
          <div style={{ width: 320, transform: 'scale(0.55)', transformOrigin: 'top left' }}>
            <SchemaRenderer project={previewSchema as never} scale={0.55} animated={false} />
          </div>
        ) : (
          <div className="p-4 text-center text-xs text-gray-400">{tk('noPreview')}</div>
        )}
      </div>
      <div className="w-1/2 space-y-1 overflow-y-auto" style={{ maxHeight: 360 }}>
        {elements.length === 0 ? (
          <div className="p-4 text-center text-xs text-gray-400">{tk('noElements')}</div>
        ) : (
          elements.map((el) => {
            const bound = bindings[el.id];
            const isSel = selectedId === el.id;
            return (
              <div key={el.id}>
                <div
                  onClick={() => onSelect(el.id)}
                  className={`flex cursor-pointer items-center justify-between rounded border px-2 py-1 text-xs ${
                    isSel ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <span className="truncate">
                    {el.text || el.type}
                    {el.bindingKey ? <span className="ml-1 text-gray-400">· {el.bindingKey}</span> : null}
                  </span>
                  <span className={bound ? 'text-green-600' : 'text-gray-400'}>{bound ? `→ ${bound.name}` : tk('unmapped')}</span>
                </div>
                {isSel ? (
                  <PickOverlay
                    element={el}
                    candidates={candidates}
                    bindings={bindings}
                    onSetField={onSetField}
                    onClear={() => onSetField(el, null)}
                    i18nPrefix={i18nPrefix}
                  />
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
