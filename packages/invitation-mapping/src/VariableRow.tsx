import { useTranslation } from 'react-i18next';
import type { HealthVar, HealthCandidate } from './types';

/** C 模式：单行「变量 → 名单列」映射（显示人类可读名，而非 slug） */
export function VariableRow({
  v,
  candidates,
  value,
  onChange,
  i18nPrefix = 'invitationMapping',
}: {
  v: HealthVar;
  candidates: HealthCandidate[];
  value: string | undefined;
  onChange: (fieldKey: string) => void;
  i18nPrefix?: string;
}) {
  const { t } = useTranslation(['common']);
  const tk = (k: string) => t(`common:${i18nPrefix}.${k}`);
  const display = v.name || v.label || v.key;
  const isCritical = v.key === 'guest_name';
  return (
    <div
      className={`rounded border px-2 py-2 ${
        isCritical && !value ? 'border-red-300 bg-red-50' : value ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50'
      }`}
    >
      <div className="mb-1 text-xs">
        <span className={`font-semibold ${isCritical && !value ? 'text-red-700' : 'text-gray-700'}`}>
          {display}
        </span>
        {v.key !== display ? <span className="ml-1 text-gray-400">({v.key})</span> : null}
        {v.elementIds?.length ? (
          <span className="ml-1 text-gray-400">· {v.elementIds.length} 元素</span>
        ) : null}
      </div>
      <div className="flex items-center gap-2 text-xs text-gray-600">
        <span>{tk('mapToList')}</span>
        <select
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          className="rounded border border-gray-300 px-2 py-1 text-xs"
        >
          <option value="">{tk('unmapped')}</option>
          {candidates.map((c) => (
            <option key={c.key} value={c.key}>
              {c.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
