import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { CalendarElement, CalendarMarker } from '@h5design/core';
import ColorField from '../../components/UI/ColorField';

interface PropertyCalendarProps {
  el: CalendarElement;
  update: (patch: Partial<CalendarElement>) => void;
  commit: () => void;
}

const MARKERS: CalendarMarker[] = ['heart', 'star', 'flower', 'diamond', 'circle', 'snow'];

function MarkerIcon({ marker, className = 'h-5 w-5' }: { marker: CalendarMarker; className?: string }) {
  switch (marker) {
    case 'heart':
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
        </svg>
      );
    case 'star':
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      );
    case 'flower':
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
          <path d="M12 2a5 5 0 0 1 5 5c0 1.5-.7 2.8-1.8 3.7 1.6.4 2.8 1.9 2.8 3.7a4.5 4.5 0 0 1-4.5 4.5h-.3A5 5 0 0 1 12 22a5 5 0 0 1-1.2-2.1h-.3A4.5 4.5 0 0 1 6 15.4c0-1.8 1.2-3.3 2.8-3.7A4.96 4.96 0 0 1 7 7a5 5 0 0 1 5-5zm0 8a3 3 0 1 0 0 6 3 3 0 0 0 0-6z" />
        </svg>
      );
    case 'diamond':
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
          <path d="M12 2L22 12 12 22 2 12z" />
        </svg>
      );
    case 'circle':
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
          <circle cx="12" cy="12" r="10" />
        </svg>
      );
    case 'snow':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <line x1="12" y1="2" x2="12" y2="22" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
          <line x1="19.07" y1="4.93" x2="4.93" y2="19.07" />
        </svg>
      );
    default:
      return null;
  }
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

export default function PropertyCalendar({ el, update, commit }: PropertyCalendarProps) {
  const { t } = useTranslation('editor');
  const [dateInput, setDateInput] = useState(() => {
    const d = new Date(el.year, el.month - 1, el.highlightDay);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });

  const maxDay = useMemo(() => new Date(el.year, el.month, 0).getDate(), [el.year, el.month]);

  const handleDateChange = (v: string) => {
    setDateInput(v);
    if (!v) return;
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return;
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const day = d.getDate();
    update({ year, month, highlightDay: Math.min(day, new Date(year, month, 0).getDate()) });
    commit();
  };

  const handleMonthChange = (nextMonth: number) => {
    const clamped = Math.max(1, Math.min(12, nextMonth));
    const max = new Date(el.year, clamped, 0).getDate();
    update({ month: clamped, highlightDay: Math.min(el.highlightDay, max) });
    commit();
  };

  return (
    <div className="flex flex-col gap-4">
      {/* 日期选择 */}
      <div className="flex items-center gap-3">
        <label className="w-20 shrink-0 text-sm text-gray-700">{t('editor:property.date')}</label>
        <div className="relative min-w-0 flex-1">
          <input
            type="date"
            value={dateInput}
            onChange={(e) => handleDateChange(e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 outline-none focus:border-blue-400"
          />
        </div>
      </div>

      {/* 语言选择 */}
      <div className="flex items-center gap-3">
        <label className="w-20 shrink-0 text-sm text-gray-700">{t('editor:property.locale')}</label>
        <div className="flex flex-1 gap-2">
          <button
            type="button"
            onClick={() => { update({ locale: 'zh-CN' }); commit(); }}
            className={`flex-1 rounded border py-1.5 text-sm transition ${el.locale === 'zh-CN' ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-gray-200 bg-white text-gray-600 hover:border-blue-300'}`}
          >
            {t('editor:locale.zhCN')}
          </button>
          <button
            type="button"
            onClick={() => { update({ locale: 'en' }); commit(); }}
            className={`flex-1 rounded border py-1.5 text-sm transition ${el.locale === 'en' ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-gray-200 bg-white text-gray-600 hover:border-blue-300'}`}
          >
            {t('editor:locale.en')}
          </button>
        </div>
      </div>

      {/* 日期风格 */}
      <div className="flex items-start gap-3">
        <label className="w-20 shrink-0 pt-1.5 text-sm text-gray-700">{t('editor:property.marker')}</label>
        <div className="grid flex-1 grid-cols-4 gap-2">
          {MARKERS.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => { update({ marker: m }); commit(); }}
              className={`flex h-9 items-center justify-center rounded border transition ${el.marker === m ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-gray-200 bg-white text-gray-500 hover:border-blue-300 hover:text-blue-500'}`}
              title={t(`editor:marker.${m}`)}
            >
              <MarkerIcon marker={m} className="h-5 w-5" />
            </button>
          ))}
        </div>
      </div>

      {/* 主题颜色 */}
      <ColorField
        label={t('editor:property.themeColor')}
        value={el.themeColor}
        onChange={(v) => { update({ themeColor: v }); commit(); }}
      />

      {/* 日期颜色 */}
      <ColorField
        label={t('editor:property.dayColor')}
        value={el.dayColor}
        onChange={(v) => { update({ dayColor: v }); commit(); }}
      />

      {/* 图标颜色 */}
      <ColorField
        label={t('editor:property.iconColor')}
        value={el.iconColor}
        onChange={(v) => { update({ iconColor: v }); commit(); }}
      />

      {/* 文字颜色 */}
      <ColorField
        label={t('editor:property.textColor')}
        value={el.textColor}
        onChange={(v) => { update({ textColor: v }); commit(); }}
      />

      {/* 图标动画 */}
      <SwitchField
        label={t('editor:property.iconAnimation')}
        checked={el.iconAnimation}
        onChange={(v) => { update({ iconAnimation: v }); commit(); }}
      />

      {/* 背景颜色 */}
      <ColorField
        label={t('editor:property.backgroundColor')}
        value={el.bgColor}
        onChange={(v) => { update({ bgColor: v }); commit(); }}
      />

      {/* 文字字体 */}
      <div className="flex items-center gap-3">
        <label className="w-20 shrink-0 text-sm text-gray-700">{t('editor:property.fontFamily')}</label>
        <select
          value={el.fontFamily}
          onChange={(e) => { update({ fontFamily: e.target.value }); commit(); }}
          className="min-w-0 flex-1 rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 outline-none focus:border-blue-400"
        >
          <option value="sans-serif">{t('editor:font.default')}</option>
          <option value="serif">{t('editor:font.serif')}</option>
          <option value="Microsoft YaHei, PingFang SC, sans-serif">{t('editor:font.heiTi')}</option>
          <option value="SimSun, Songti SC, serif">{t('editor:font.songTi')}</option>
          <option value="KaiTi, STKaiti, serif">{t('editor:font.kaiTi')}</option>
        </select>
      </div>

      {/* 年月快速调整 */}
      <div className="flex items-center gap-3">
        <label className="w-20 shrink-0 text-sm text-gray-700">{t('editor:property.year')}</label>
        <input
          type="number"
          min={1900}
          max={2100}
          value={el.year}
          onChange={(e) => { update({ year: Number(e.target.value) }); }}
          onBlur={commit}
          className="min-w-0 flex-1 rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 outline-none focus:border-blue-400"
        />
      </div>
      <div className="flex items-center gap-3">
        <label className="w-20 shrink-0 text-sm text-gray-700">{t('editor:property.month')}</label>
        <input
          type="number"
          min={1}
          max={12}
          value={el.month}
          onChange={(e) => handleMonthChange(Number(e.target.value))}
          className="min-w-0 flex-1 rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 outline-none focus:border-blue-400"
        />
      </div>
      <div className="flex items-center gap-3">
        <label className="w-20 shrink-0 text-sm text-gray-700">{t('editor:property.highlightDay')}</label>
        <input
          type="number"
          min={1}
          max={maxDay}
          value={el.highlightDay}
          onChange={(e) => { update({ highlightDay: Math.min(Number(e.target.value), maxDay) }); }}
          onBlur={commit}
          className="min-w-0 flex-1 rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 outline-none focus:border-blue-400"
        />
      </div>
    </div>
  );
}
