import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import gsap from 'gsap';
import Konva from 'konva';
import type {
  Element,
  TextElement,
  ImageElement,
  ImageClip,
  RectElement,
  CircleElement,
  StarElement,
  TriangleElement,
  LineElement,
  ArrowElement,
  EllipseElement,
  PolygonElement,
  VideoElement,
  ButtonElement,
  CalendarElement,
  GalleryElement,
  PuzzleElement,
  CountdownElement,
  MapNavElement,
  MessageBoardElement,
  TimelineElement,
  LikeElement,
  WidgetElement,
  AnimationConfig,
  SingleAnimationConfig,
  CornerRadius,
  AnimationCategory,
} from '@h5design/core';
import { normalizeCornerRadius } from '@h5design/core';
import { useEditorStore, useSelectedElement } from '@/store/editorStore';
import { api } from '@/api/client';
import { validateImageFile, readImageDimensions } from '@/utils/image';
import ImageCropDialog from '@/components/Panel/ImageCropDialog';
import { getElementRegistration } from '@/elements/registry';
import ColorField, { CheckerBackground } from '@/components/UI/ColorField';
import CollapsibleSection from '@/components/UI/CollapsibleSection';
import AnimationPickerDialog from '@/components/Panel/AnimationPickerDialog';
import { findAnimationDef } from '@/animations/registry';
import { playSingleAnimation } from '@/animations/presets';
import { playAnimationsOnNode } from '@/animations/konvaPlayer';
import PropertyCalendar from '@/elements/calendar/PropertyCalendar';
import PropertyGallery from '@/elements/gallery/PropertyGallery';
import PropertyPuzzle from '@/elements/puzzle/PropertyPuzzle';
import PropertyCountdown from '@/elements/countdown/PropertyCountdown';
import PropertyMapNav from '@/elements/mapNav/PropertyMapNav';
import PropertyMessageBoard from '@/elements/messageBoard/PropertyMessageBoard';
import PropertyTimeline from '@/elements/timeline/PropertyTimeline';
import PropertyLike from '@/elements/like/PropertyLike';
import PropertyWidget from '@/elements/widget/PropertyWidget';

function getNestedValue(obj: unknown, path: string): unknown {
  const keys = path.split('.');
  let current: unknown = obj;
  for (const key of keys) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

const DEFAULT_ANIMATION: AnimationConfig = {
  enter: 'none',
  enterDuration: 0.6,
  enterDelay: 0,
  enterEasing: 'ease',
  loop: 'none',
  loopDuration: 2,
  loopEasing: 'ease',
};

/** 把可能是单个对象的 animation 字段统一归一化为数组 */
function normalizeAnimations(config?: AnimationConfig): SingleAnimationConfig[] {
  if (!config || !config.animation) return [];
  const anim = config.animation;
  return Array.isArray(anim) ? anim : [anim];
}

/* ───────── 通用小控件 ───────── */

function ToggleButton({ active, onClick, title, children }: { active: boolean; onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`flex h-8 flex-1 items-center justify-center rounded border text-sm transition ${
        active
          ? 'border-blue-500 bg-blue-50 text-blue-600'
          : 'border-gray-200 bg-white text-gray-600 hover:border-blue-300 hover:text-blue-500'
      }`}
    >
      {children}
    </button>
  );
}

function SliderField({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  onCommit,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  onCommit?: () => void;
}) {
  const num = Number.isFinite(value) ? value : 0;
  return (
    <div className="flex min-w-0 items-center gap-3">
      <label className="w-20 shrink-0 text-sm text-gray-700">{label}</label>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={num}
        onChange={(e) => onChange(Number(e.target.value))}
        onMouseUp={onCommit}
        onBlur={onCommit}
        className="h-1 min-w-0 flex-1 cursor-pointer appearance-none rounded bg-gray-200 accent-blue-500"
      />
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={num}
        onChange={(e) => onChange(Number(e.target.value))}
        onBlur={onCommit}
        className="w-16 shrink-0 rounded border border-gray-300 px-2 py-1 text-right text-sm text-gray-700 outline-none focus:border-blue-400"
      />
    </div>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  onCommit,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (v: number) => void;
  onCommit?: () => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <label className="w-20 shrink-0 text-sm text-gray-700">{label}</label>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(Number(e.target.value))}
        onBlur={onCommit}
        className="min-w-0 flex-1 rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 outline-none focus:border-blue-400"
      />
    </div>
  );
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

function AlignToolbar({ align, onChange }: { align: string; onChange: (v: string) => void }) {
  const { t } = useTranslation(['editor']);
  const opts = [
    { v: 'left', title: t('editor:align.left') },
    { v: 'center', title: t('editor:align.center') },
    { v: 'right', title: t('editor:align.right') },
  ];
  return (
    <div className="flex gap-1">
      {opts.map((opt) => (
        <ToggleButton key={opt.v} active={align === opt.v} title={opt.title} onClick={() => onChange(opt.v)}>
          <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
            {opt.v === 'left' && <path d="M4 6h16v2H4zm0 5h10v2H4zm0 5h16v2H4z" />}
            {opt.v === 'center' && <path d="M4 6h16v2H4zm3 5h10v2H7zm-3 5h16v2H4z" />}
            {opt.v === 'right' && <path d="M4 6h16v2H4zm6 5h10v2H10zm-6 5h16v2H4z" />}
          </svg>
        </ToggleButton>
      ))}
    </div>
  );
}

function VerticalAlignToolbar({ align, onChange }: { align: string; onChange: (v: string) => void }) {
  const { t } = useTranslation(['editor']);
  const opts = [
    { v: 'top', title: t('editor:verticalAlign.top') },
    { v: 'middle', title: t('editor:verticalAlign.middle') },
    { v: 'bottom', title: t('editor:verticalAlign.bottom') },
  ];
  return (
    <div className="flex gap-1">
      {opts.map((opt) => (
        <ToggleButton key={opt.v} active={align === opt.v} title={opt.title} onClick={() => onChange(opt.v)}>
          <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
            {opt.v === 'top' && <path d="M4 4h16v2H4zm4 5h8v2H8zm-4 5h16v2H4z" />}
            {opt.v === 'middle' && <path d="M4 11h16v2H4zm-4-5h16v2H4zm0 10h16v2H4z" />}
            {opt.v === 'bottom' && <path d="M4 4h16v2H4zm-4 5h8v2H0zm4 5h16v2H4z" />}
          </svg>
        </ToggleButton>
      ))}
    </div>
  );
}

function LayerToolbar({
  onTop,
  onBottom,
  onUp,
  onDown,
}: {
  onTop: () => void;
  onBottom: () => void;
  onUp: () => void;
  onDown: () => void;
}) {
  const btnClass =
    'flex h-8 flex-1 items-center justify-center rounded border border-gray-200 bg-white text-gray-600 hover:border-blue-300 hover:text-blue-500';
  return (
    <div className="flex gap-1">
      <button type="button" onClick={onTop} className={btnClass} title="置顶">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
          <rect x="8" y="8" width="8" height="8" rx="2" />
          <path d="M4 10a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2" />
          <path d="M14 20a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-4a2 2 0 0 0-2-2" />
        </svg>
      </button>
      <button type="button" onClick={onUp} className={btnClass} title="上移一层">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
          <path d="M12 12V2" />
          <path d="M2 17.002a1 1 0 00.58.91l8.6 3.91a2 2 0 001.65 0l8.58-3.9a1 1 0 00.59-.92" />
          <path d="M7.674 8.774 2.58 11.09a1 1 0 000 1.822l8.6 3.91a2 2 0 001.65 0l8.58-3.9a1 1 0 00.59-.92 1 1 0 00-.59-.922l-5.078-2.308" />
          <path d="m9 5 3-3 3 3" />
        </svg>
      </button>
      <button type="button" onClick={onDown} className={btnClass} title="下移一层">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
          <path d="M12 7v15" />
          <path d="M2 12a1 1 0 00.58.91l5.093 2.316" />
          <path d="M22 12a1 1 0 01-.59.92l-5.077 2.308" />
          <path d="M8 10.37 2.6 7.91a1 1 0 010-1.831l8.57-3.9a2 2 0 011.66.001l8.59 3.91a1 1 0 010 1.831l-5.392 2.45" />
          <path d="m9 19 3 3 3-3" />
        </svg>
      </button>
      <button type="button" onClick={onBottom} className={btnClass} title="置底">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
          <rect x="14" y="14" width="8" height="8" rx="2" />
          <rect x="2" y="2" width="8" height="8" rx="2" />
          <path d="M7 14v1a2 2 0 0 0 2 2h1" />
          <path d="M14 7h1a2 2 0 0 1 2 2v1" />
        </svg>
      </button>
    </div>
  );
}

function AlignDistributeToolbar() {
  const { t } = useTranslation(['editor']);
  const [mode, setMode] = useState<'selection' | 'pageEdge'>('selection');
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const selectedId = useEditorStore((s) => s.selectedId);
  const selectedCount = selectedIds.length > 0 ? selectedIds.length : selectedId ? 1 : 0;
  const hasSelection = selectedCount > 0;
  const canDistribute = selectedCount >= 3;

  const store = useEditorStore.getState();
  const toPage = mode === 'pageEdge';

  const btnClass =
    'flex h-8 w-8 items-center justify-center rounded border border-gray-200 bg-white text-gray-600 hover:border-blue-300 hover:text-blue-500 disabled:cursor-not-allowed disabled:text-gray-300 disabled:hover:border-gray-200';

  const modeBtnClass = (active: boolean) =>
    `flex h-7 w-7 items-center justify-center rounded border text-xs transition ${
      active ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-gray-200 bg-white text-gray-600 hover:border-blue-300 hover:text-blue-500'
    }`;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500">{t('editor:alignDistribute.modeLabel')}</span>
        <div className="flex gap-1">
          <button type="button" onClick={() => setMode('selection')} className={modeBtnClass(mode === 'selection')} title={t('editor:alignDistribute.selectionMode')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
              <rect x="6" y="6" width="12" height="12" rx="2" />
              <rect x="2" y="2" width="12" height="12" rx="2" />
            </svg>
          </button>
          <button type="button" onClick={() => setMode('pageEdge')} className={modeBtnClass(mode === 'pageEdge')} title={t('editor:alignDistribute.pageEdgeMode')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
              <path d="M12 4v4m0-4-3 3m3-3 3 3" />
              <path d="M4 12h4m-4 0 3-3m-3 3 3 3" />
              <path d="M16 12h4m-4 0 3-3m-3 3 3 3" />
              <path d="M12 16v4m0-4-3 3m3-3 3 3" />
            </svg>
          </button>
        </div>
      </div>

      <div className="flex gap-1">
        <button type="button" disabled={!hasSelection} onClick={() => { store.alignLeft(toPage); }} className={btnClass} title={t('editor:alignDistribute.left')}>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="9" height="6" x="6" y="14" rx="2" />
            <rect width="16" height="6" x="6" y="4" rx="2" />
            <path d="M2 2v20" />
          </svg>
        </button>
        <button type="button" disabled={!hasSelection} onClick={() => { store.alignCenterX(toPage); }} className={btnClass} title={t('editor:alignDistribute.horizontalCenter')}>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2v20" />
            <path d="M8 10H4a2 2 0 0 1-2-2V6c0-1.1.9-2 2-2h4" />
            <path d="M16 10h4a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-4" />
            <path d="M8 20H7a2 2 0 0 1-2-2v-2c0-1.1.9-2 2-2h1" />
            <path d="M16 14h1a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-1" />
          </svg>
        </button>
        <button type="button" disabled={!hasSelection} onClick={() => { store.alignRight(toPage); }} className={btnClass} title={t('editor:alignDistribute.right')}>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="16" height="6" x="2" y="4" rx="2" />
            <rect width="9" height="6" x="9" y="14" rx="2" />
            <path d="M22 22V2" />
          </svg>
        </button>
        <button type="button" disabled={!hasSelection} onClick={() => { store.mirrorHorizontal(toPage); }} className={btnClass} title={t('editor:alignDistribute.horizontalMirror')}>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m3 7 5 5-5 5V7" />
            <path d="m21 7-5 5 5 5V7" />
            <path d="M12 20v2" />
            <path d="M12 14v2" />
            <path d="M12 8v2" />
            <path d="M12 2v2" />
          </svg>
        </button>
        <button type="button" disabled={!canDistribute} onClick={() => { store.distributeHorizontal(); }} className={btnClass} title={t('editor:alignDistribute.horizontalDistribute')}>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="6" height="10" x="9" y="7" rx="2" />
            <path d="M4 22V2" />
            <path d="M20 22V2" />
          </svg>
        </button>
      </div>

      <div className="flex gap-1">
        <button type="button" disabled={!hasSelection} onClick={() => { store.alignTop(toPage); }} className={btnClass} title={t('editor:alignDistribute.top')}>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="6" height="16" x="4" y="6" rx="2" />
            <rect width="6" height="9" x="14" y="6" rx="2" />
            <path d="M22 2H2" />
          </svg>
        </button>
        <button type="button" disabled={!hasSelection} onClick={() => { store.alignCenterY(toPage); }} className={btnClass} title={t('editor:alignDistribute.verticalCenter')}>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 12h20" />
            <path d="M10 16v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-4" />
            <path d="M10 8V4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v4" />
            <path d="M20 16v1a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2v-1" />
            <path d="M14 8V7c0-1.1.9-2 2-2h2a2 2 0 0 1 2 2v1" />
          </svg>
        </button>
        <button type="button" disabled={!hasSelection} onClick={() => { store.alignBottom(toPage); }} className={btnClass} title={t('editor:alignDistribute.bottom')}>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="6" height="16" x="4" y="2" rx="2" />
            <rect width="6" height="9" x="14" y="9" rx="2" />
            <path d="M22 22H2" />
          </svg>
        </button>
        <button type="button" disabled={!hasSelection} onClick={() => { store.mirrorVertical(toPage); }} className={btnClass} title={t('editor:alignDistribute.verticalMirror')}>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m17 3-5 5-5-5h10" />
            <path d="m17 21-5-5-5 5h10" />
            <path d="M4 12H2" />
            <path d="M10 12H8" />
            <path d="M16 12h-2" />
            <path d="M22 12h-2" />
          </svg>
        </button>
        <button type="button" disabled={!canDistribute} onClick={() => { store.distributeVertical(); }} className={btnClass} title={t('editor:alignDistribute.verticalDistribute')}>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="10" height="6" x="7" y="9" rx="2" />
            <path d="M22 20H2" />
            <path d="M22 4H2" />
          </svg>
        </button>
      </div>
    </div>
  );
}

/* ───────── Section 图标 ───────── */

function SectionTitle({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 text-gray-500">
        {children}
      </svg>
      {title}
    </>
  );
}

const ICON_TRANSFORM = <path d="M5 9 2 12l3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20" />;
const ICON_FILL = <path d="M19 11 9 1 8 2 2 8l10 10a6 6 0 0 0 8.5-8.5zM5 9 9 5" />;
const ICON_STROKE = <path d="M4 20 20 4M4 20l-1 3 3-1" />;
const ICON_TEXT = <path d="M4 6h16M12 6v12M9 18h6" />;
const ICON_SPECIFIC = <path d="M4 6h10M18 6h2M4 12h2M10 12h10M4 18h12M18 18h2" />;
const ICON_BORDER = <path d="M4 4h16v16H4zM8 8h8v8H8z" />;
const ICON_EFFECTS = <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" />;

function SectionBody({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-3">{children}</div>;
}

/* ───────── 变换 Transform ───────── */

function TransformSection({ el, update, commit }: { el: Element; update: (patch: Partial<Element>) => void; commit: () => void }) {
  const { t } = useTranslation(['editor']);
  return (
    <CollapsibleSection
      title={<SectionTitle title={t('editor:section.transform')}>{ICON_TRANSFORM}</SectionTitle>}
      defaultOpen
    >
      <SectionBody>
        <div className="flex items-center gap-3">
          <label className="w-20 shrink-0 text-sm text-gray-700">{t('editor:property.name')}</label>
          <input
            type="text"
            value={el.name || ''}
            onChange={(e) => update({ name: e.target.value })}
            placeholder={t('editor:property.name')}
            className="min-w-0 flex-1 rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 outline-none focus:border-blue-400"
          />
        </div>
        <NumberField label="X" value={el.x} onChange={(v) => update({ x: v })} onCommit={commit} />
        <NumberField label="Y" value={el.y} onChange={(v) => update({ y: v })} onCommit={commit} />
        <NumberField label={t('editor:property.width')} value={el.width} min={1} onChange={(v) => update({ width: v })} onCommit={commit} />
        <NumberField label={t('editor:property.height')} value={el.height} min={1} onChange={(v) => update({ height: v })} onCommit={commit} />
        <SliderField label={t('editor:property.rotation')} value={el.rotation} min={0} max={360} step={1} onChange={(v) => update({ rotation: v })} onCommit={commit} />
        <SliderField label={t('editor:property.opacity')} value={Math.round((typeof el.opacity === 'number' ? el.opacity : 1) * 100)} min={0} max={100} step={1} onChange={(v) => update({ opacity: v / 100 })} onCommit={commit} />
      </SectionBody>
    </CollapsibleSection>
  );
}

/* ───────── 矩形圆角（四角独立调节） ───────── */
function RectCornerSection({ el, update, commit }: { el: RectElement; update: (patch: Partial<Element>) => void; commit: () => void }) {
  const { t } = useTranslation(['editor']);
  const [showPerCorner, setShowPerCorner] = useState(false);
  const cr = normalizeCornerRadius(el.cornerRadius ?? el.borderRadius);
  const setUniform = (v: number) => update({ cornerRadius: v, borderRadius: v });
  const setCorner = (key: keyof CornerRadius, v: number) => {
    const next: CornerRadius = { ...cr, [key]: v };
    update({ cornerRadius: next, borderRadius: next.topLeft });
  };
  const corners: { key: keyof CornerRadius; labelKey: string }[] = [
    { key: 'topLeft', labelKey: 'editor:property.cornerTopLeft' },
    { key: 'topRight', labelKey: 'editor:property.cornerTopRight' },
    { key: 'bottomRight', labelKey: 'editor:property.cornerBottomRight' },
    { key: 'bottomLeft', labelKey: 'editor:property.cornerBottomLeft' },
  ];
  return (
    <SectionBody>
      <SliderField
        label={t('editor:property.cornerRadius')}
        value={cr.topLeft}
        min={0}
        max={100}
        step={1}
        onChange={setUniform}
        onCommit={commit}
      />
      <button
        type="button"
        onClick={() => setShowPerCorner((s) => !s)}
        className="self-start rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 transition hover:border-blue-300 hover:text-blue-500"
      >
        {showPerCorner ? t('editor:property.cornerPerCollapse') : t('editor:property.cornerPerExpand')}
      </button>
      {showPerCorner &&
        corners.map((c) => (
          <SliderField
            key={c.key}
            label={t(c.labelKey)}
            value={cr[c.key]}
            min={0}
            max={100}
            step={1}
            onChange={(v) => setCorner(c.key, v)}
            onCommit={commit}
          />
        ))}
    </SectionBody>
  );
}

/* ───────── 填充 Fill ───────── */

function FillSection({ el, update, commit }: { el: Element; update: (patch: Partial<Element>) => void; commit: () => void }) {
  const { t } = useTranslation(['editor']);
  if (!('fill' in el)) return null;
  const label =
    el.type === 'text' ? t('editor:property.textColor') : el.type === 'button' ? t('editor:property.background') : t('editor:property.fillShape');
  return (
    <CollapsibleSection
      title={<SectionTitle title={t('editor:section.fill')}>{ICON_FILL}</SectionTitle>}
      defaultOpen
    >
      <SectionBody>
        <ColorField label={label} value={(el as { fill: string }).fill} onChange={(v) => { update({ fill: v }); commit(); }} />
      </SectionBody>
    </CollapsibleSection>
  );
}

/* ───────── 描边 Stroke ───────── */

function StrokeSection({ el, update, commit }: { el: Element; update: (patch: Partial<Element>) => void; commit: () => void }) {
  const { t } = useTranslation(['editor']);
  if (!('stroke' in el) && !('strokeWidth' in el)) return null;
  const stroke = (el as { stroke?: string }).stroke;
  const strokeWidth = (el as { strokeWidth?: number }).strokeWidth ?? 0;
  const hasLineStyle = 'lineStyle' in el;
  return (
    <CollapsibleSection
      title={<SectionTitle title={t('editor:section.stroke')}>{ICON_STROKE}</SectionTitle>}
    >
      <SectionBody>
        <ColorField
          label={t('editor:component.strokeColor')}
          value={stroke ?? 'transparent'}
          onChange={(v) => {
            const next = v === 'transparent' ? undefined : v;
            update({ stroke: next, strokeWidth: next ? Math.max(1, (el as { strokeWidth?: number }).strokeWidth ?? 1) : 0 } as Partial<Element>);
            commit();
          }}
        />
        <SliderField
          label={t('editor:component.strokeWidth')}
          value={strokeWidth}
          min={0}
          max={20}
          step={0.5}
          onChange={(v) => update({ strokeWidth: v, stroke: v > 0 ? ((el as { stroke?: string }).stroke || '#000000') : undefined } as Partial<Element>)}
          onCommit={commit}
        />
        {hasLineStyle && (
          <div className="flex items-center gap-3">
            <label className="w-20 shrink-0 text-sm text-gray-700">{t('editor:component.lineStyle')}</label>
            <select
              value={(el as { lineStyle?: string }).lineStyle || 'solid'}
              onChange={(e) => { update({ lineStyle: e.target.value as 'solid' | 'dashed' | 'dotted' }); commit(); }}
              className="min-w-0 flex-1 rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 outline-none focus:border-blue-400"
            >
              <option value="solid">{t('editor:component.lineStyleSolid')}</option>
              <option value="dashed">{t('editor:component.lineStyleDashed')}</option>
              <option value="dotted">{t('editor:component.lineStyleDotted')}</option>
            </select>
          </div>
        )}
      </SectionBody>
    </CollapsibleSection>
  );
}

/* ───────── 文本 Text（仅 text） ───────── */

function TextSection({ el, update, commit }: { el: Element; update: (patch: Partial<Element>) => void; commit: () => void }) {
  const { t } = useTranslation(['editor']);
  if (el.type !== 'text') return null;
  const textEl = el as TextElement;
  const currentStyle = textEl.fontStyle || 'normal';
  const isBold = currentStyle.includes('bold');
  const isItalic = currentStyle.includes('italic');

  const toggleBold = () => {
    let next = currentStyle;
    if (isBold && isItalic) next = 'italic';
    else if (isBold) next = 'normal';
    else if (isItalic) next = 'italic bold';
    else next = 'bold';
    update({ fontStyle: next as TextElement['fontStyle'] });
    commit();
  };
  const toggleItalic = () => {
    let next = currentStyle;
    if (isBold && isItalic) next = 'bold';
    else if (isItalic) next = 'normal';
    else if (isBold) next = 'italic bold';
    else next = 'italic';
    update({ fontStyle: next as TextElement['fontStyle'] });
    commit();
  };

  return (
    <CollapsibleSection
      title={<SectionTitle title={t('editor:section.text')}>{ICON_TEXT}</SectionTitle>}
      defaultOpen
    >
      <SectionBody>
        {/* 文本内容 */}
        <div className="flex flex-col gap-1">
          <label className="text-sm text-gray-700">{t('editor:property.content')}</label>
          <textarea
            value={textEl.text}
            onChange={(e) => update({ text: e.target.value })}
            onBlur={commit}
            rows={2}
            className="min-w-0 flex-1 resize-none rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 outline-none focus:border-blue-400"
          />
        </div>

        {/* 字体 */}
        <div className="flex items-center gap-3">
          <label className="w-20 shrink-0 text-sm text-gray-700">{t('editor:property.fontFamily')}</label>
          <select
            value={textEl.fontFamily || 'sans-serif'}
            onChange={(e) => { update({ fontFamily: e.target.value }); commit(); }}
            className="min-w-0 flex-1 rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 outline-none focus:border-blue-400"
          >
            <option value="sans-serif">{t('editor:font.default')}</option>
            <option value="serif">{t('editor:font.serif')}</option>
            <option value="monospace">{t('editor:font.monospace')}</option>
            <option value="Microsoft YaHei, PingFang SC, sans-serif">{t('editor:font.heiTi')}</option>
            <option value="SimSun, Songti SC, serif">{t('editor:font.songTi')}</option>
            <option value="KaiTi, STKaiti, serif">{t('editor:font.kaiTi')}</option>
          </select>
        </div>

        {/* 字号 */}
        <SliderField label={t('editor:property.fontSize')} value={textEl.fontSize} min={8} max={200} step={1} onChange={(v) => update({ fontSize: v })} onCommit={commit} />

        {/* 样式 B/I/U/S */}
        <div className="flex gap-1">
          <ToggleButton active={isBold} title={t('editor:fontWeight.bold')} onClick={toggleBold}>
            <span className="font-bold">B</span>
          </ToggleButton>
          <ToggleButton active={isItalic} title={t('editor:fontStyle.italic')} onClick={toggleItalic}>
            <span className="italic">I</span>
          </ToggleButton>
          <ToggleButton
            active={textEl.textDecoration === 'underline'}
            title={t('editor:textDecoration.underline')}
            onClick={() => { update({ textDecoration: textEl.textDecoration === 'underline' ? 'none' : 'underline' }); commit(); }}
          >
            <span className="underline">U</span>
          </ToggleButton>
          <ToggleButton
            active={textEl.textDecoration === 'line-through'}
            title={t('editor:textDecoration.lineThrough')}
            onClick={() => { update({ textDecoration: textEl.textDecoration === 'line-through' ? 'none' : 'line-through' }); commit(); }}
          >
            <span className="line-through">S</span>
          </ToggleButton>
        </div>

        {/* 对齐 */}
        <div className="flex items-center gap-3">
          <label className="w-20 shrink-0 text-sm text-gray-700">{t('editor:property.align')}</label>
          <div className="min-w-0 flex-1">
            <AlignToolbar align={textEl.align} onChange={(v) => { update({ align: v as TextElement['align'] }); commit(); }} />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <label className="w-20 shrink-0 text-sm text-gray-700">{t('editor:property.verticalAlign')}</label>
          <div className="min-w-0 flex-1">
            <VerticalAlignToolbar align={textEl.verticalAlign} onChange={(v) => { update({ verticalAlign: v as TextElement['verticalAlign'] }); commit(); }} />
          </div>
        </div>

        {/* 行高 / 字距 */}
        <SliderField label={t('editor:property.lineHeight')} value={textEl.lineHeight} min={0.5} max={3} step={0.1} onChange={(v) => update({ lineHeight: v })} onCommit={commit} />
        <SliderField label={t('editor:property.letterSpacing')} value={textEl.letterSpacing} min={-10} max={50} step={0.5} onChange={(v) => update({ letterSpacing: v })} onCommit={commit} />

        {/* 文本背景（仅 text） */}
        <ColorField
          label={t('editor:property.backgroundColor')}
          value={textEl.backgroundColor}
          onChange={(v) => { update({ backgroundColor: v }); commit(); }}
        />

        {/* 换行方式 */}
        <div className="flex items-center gap-3">
          <label className="w-20 shrink-0 text-sm text-gray-700">{t('editor:property.wordBreak')}</label>
          <select
            value={textEl.wordBreak || 'break-word'}
            onChange={(e) => { update({ wordBreak: e.target.value as TextElement['wordBreak'] }); commit(); }}
            className="min-w-0 flex-1 rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 outline-none focus:border-blue-400"
          >
            <option value="normal">{t('editor:wordBreak.normal')}</option>
            <option value="break-all">{t('editor:wordBreak.breakAll')}</option>
            <option value="keep-all">{t('editor:wordBreak.keepAll')}</option>
            <option value="break-word">{t('editor:wordBreak.breakWord')}</option>
          </select>
        </div>
      </SectionBody>
    </CollapsibleSection>
  );
}

/* ───────── 专属 Specific ───────── */

function ImageSpecific({
  el,
  update,
  commit,
  onDelete,
}: {
  el: ImageElement;
  update: (patch: Partial<Element>) => void;
  commit: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation(['editor', 'common', 'errors']);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [cropOpen, setCropOpen] = useState(false);
  const [showPerCorner, setShowPerCorner] = useState(false);

  const cr = normalizeCornerRadius(el.cornerRadius ?? el.borderRadius);
  const setUniform = (v: number) => update({ cornerRadius: v, borderRadius: v });
  const setCorner = (key: keyof CornerRadius, v: number) => {
    const next: CornerRadius = { ...cr, [key]: v };
    update({ cornerRadius: next, borderRadius: next.topLeft });
  };
  const corners: { key: keyof CornerRadius; labelKey: string }[] = [
    { key: 'topLeft', labelKey: 'editor:property.cornerTopLeft' },
    { key: 'topRight', labelKey: 'editor:property.cornerTopRight' },
    { key: 'bottomRight', labelKey: 'editor:property.cornerBottomRight' },
    { key: 'bottomLeft', labelKey: 'editor:property.cornerBottomLeft' },
  ];

  const handleUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      // 上传前先做类型/体积校验，给出具体错误而非笼统的「上传失败」
      const errKey = validateImageFile(file);
      if (errKey) {
        alert(t(errKey));
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
      setUploading(true);
      try {
        // 前端读取真实像素尺寸，随上传提交，使素材记录尺寸准确
        let dims: { width: number; height: number } | null = null;
        try {
          dims = await readImageDimensions(file);
        } catch {
          dims = null;
        }
        const asset = await api.uploadAsset(file, dims ?? undefined);
        update({
          src: asset.url,
          naturalWidth: dims?.width ?? el.naturalWidth,
          naturalHeight: dims?.height ?? el.naturalHeight,
        });
        commit();
      } catch (err) {
        if (import.meta.env.DEV) console.error('[image] upload failed:', err);
        alert(t('errors:error.uploadFailed'));
      } finally {
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    },
    [update, commit, el.naturalWidth, el.naturalHeight, t],
  );

  const handleCropApply = (clip: ImageClip, size?: { width: number; height: number }) => {
    const patch: Partial<Element> = { clip };
    if (size && el.width && el.height) {
      patch.width = size.width;
      patch.height = size.height;
    }
    update(patch);
    commit();
    setCropOpen(false);
  };

  return (
    <SectionBody>
      {/* 预览 */}
      <div className="relative h-24 overflow-hidden rounded border border-gray-200">
        <CheckerBackground className="absolute inset-0" />
        {el.src ? (
          <img src={el.src} alt="" className="relative mx-auto block h-full w-auto object-contain" />
        ) : (
          <div className="relative flex h-full items-center justify-center text-gray-400">{t('editor:element.image')}</div>
        )}
      </div>

      {/* 更换 / 裁切 操作按钮（位于预览下方） */}
      <div className="flex items-center gap-2">
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleUpload} className="hidden" />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex-1 rounded bg-blue-500 px-2 py-1.5 text-xs text-white transition hover:bg-blue-600 disabled:opacity-50"
        >
          {uploading ? t('common:status.loading') : t('editor:property.replace')}
        </button>
        <button
          type="button"
          onClick={() => setCropOpen(true)}
          className="flex-1 rounded border border-gray-300 px-2 py-1.5 text-xs text-gray-700 transition hover:border-blue-300 hover:text-blue-500"
        >
          {t('editor:property.crop')}
        </button>
      </div>

      {/* 圆角：统一调节 + 四角独立（与形状对象一致） */}
      <SliderField
        label={t('editor:property.cornerRadius')}
        value={cr.topLeft}
        min={0}
        max={100}
        step={1}
        onChange={setUniform}
        onCommit={commit}
      />
      <button
        type="button"
        onClick={() => setShowPerCorner((s) => !s)}
        className="self-start rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 transition hover:border-blue-300 hover:text-blue-500"
      >
        {showPerCorner ? t('editor:property.cornerPerCollapse') : t('editor:property.cornerPerExpand')}
      </button>
      {showPerCorner &&
        corners.map((c) => (
          <SliderField
            key={c.key}
            label={t(c.labelKey)}
            value={cr[c.key]}
            min={0}
            max={100}
            step={1}
            onChange={(v) => setCorner(c.key, v)}
            onCommit={commit}
          />
        ))}

      {/* 适配方式 */}
      <div className="flex items-center gap-3">
        <label className="w-20 shrink-0 text-sm text-gray-700">{t('editor:property.objectFit')}</label>
        <select
          value={el.objectFit ?? 'cover'}
          onChange={(e) => { update({ objectFit: e.target.value as 'cover' | 'contain' | 'repeat-x' | 'repeat-y' }); commit(); }}
          className="min-w-0 flex-1 rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 outline-none focus:border-blue-400"
        >
          <option value="cover">{t('editor:property.objectFitCover')}</option>
          <option value="contain">{t('editor:property.objectFitContain')}</option>
          <option value="repeat-x">{t('editor:property.objectFitRepeatX')}</option>
          <option value="repeat-y">{t('editor:property.objectFitRepeatY')}</option>
        </select>
      </div>

      {/* 滤镜 */}
      <SliderField label={t('editor:property.filterBrightness')} value={el.filterBrightness ?? 100} min={0} max={200} step={1} onChange={(v) => update({ filterBrightness: v })} onCommit={commit} />
      <SliderField label={t('editor:property.filterContrast')} value={el.filterContrast ?? 100} min={0} max={200} step={1} onChange={(v) => update({ filterContrast: v })} onCommit={commit} />
      <SliderField label={t('editor:property.filterBlur')} value={el.filterBlur ?? 0} min={0} max={20} step={1} onChange={(v) => update({ filterBlur: v })} onCommit={commit} />

      <ImageCropDialog open={cropOpen} el={el} onApply={handleCropApply} onClose={() => setCropOpen(false)} />
    </SectionBody>
  );
}

function VideoSpecific({ el, update, commit }: { el: VideoElement; update: (patch: Partial<Element>) => void; commit: () => void }) {
  const { t } = useTranslation(['editor']);
  return (
    <SectionBody>
      <div className="flex flex-col gap-1">
        <label className="text-sm text-gray-700">{t('editor:property.videoSrc')}</label>
        <textarea
          value={el.src}
          onChange={(e) => update({ src: e.target.value })}
          onBlur={commit}
          rows={3}
          placeholder="视频地址（.mp4 直链）或 <iframe> 嵌入代码"
          className="min-w-0 flex-1 resize-y rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 outline-none focus:border-blue-400"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm text-gray-700">{t('editor:property.poster')}</label>
        <input
          type="text"
          value={el.poster || ''}
          onChange={(e) => update({ poster: e.target.value })}
          onBlur={commit}
          placeholder="https://..."
          className="min-w-0 flex-1 rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 outline-none focus:border-blue-400"
        />
      </div>
      <SliderField label={t('editor:property.cornerRadius')} value={el.radius ?? 0} min={0} max={100} step={1} onChange={(v) => update({ radius: v })} onCommit={commit} />
      <SwitchField label={t('editor:property.autoplay')} checked={!!el.autoplay} onChange={(v) => { update({ autoplay: v }); commit(); }} />
      <SwitchField label={t('editor:property.muted')} checked={!!el.muted} onChange={(v) => { update({ muted: v }); commit(); }} />
      <SwitchField label={t('editor:property.loop')} checked={!!el.loop} onChange={(v) => { update({ loop: v }); commit(); }} />
    </SectionBody>
  );
}

function ButtonSpecific({ el, update, commit }: { el: ButtonElement; update: (patch: Partial<Element>) => void; commit: () => void }) {
  const { t } = useTranslation(['editor']);
  return (
    <SectionBody>
      <div className="flex flex-col gap-1">
        <label className="text-sm text-gray-700">{t('editor:property.content')}</label>
        <textarea
          value={el.text}
          onChange={(e) => update({ text: e.target.value })}
          onBlur={commit}
          rows={2}
          className="min-w-0 flex-1 resize-none rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 outline-none focus:border-blue-400"
        />
      </div>
      <SliderField label={t('editor:property.fontSize')} value={el.fontSize} min={8} max={200} step={1} onChange={(v) => update({ fontSize: v })} onCommit={commit} />
      <ColorField label={t('editor:property.textColor')} value={el.color} onChange={(v) => { update({ color: v }); commit(); }} />
      <SliderField label={t('editor:property.cornerRadius')} value={el.radius} min={0} max={100} step={1} onChange={(v) => update({ radius: v })} onCommit={commit} />
      <div className="flex flex-col gap-1">
        <label className="text-sm text-gray-700">{t('editor:property.link')}</label>
        <input
          type="text"
          value={el.link || ''}
          onChange={(e) => update({ link: e.target.value })}
          onBlur={commit}
          placeholder="https://..."
          className="min-w-0 flex-1 rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 outline-none focus:border-blue-400"
        />
      </div>
    </SectionBody>
  );
}

function SpecificSection({ el, update, commit, onDelete }: { el: Element; update: (patch: Partial<Element>) => void; commit: () => void; onDelete: () => void }) {
  const { t } = useTranslation(['editor']);

  let body: React.ReactNode = null;
  switch (el.type) {
    case 'rect':
      body = (
        <RectCornerSection
          el={el as RectElement}
          update={update}
          commit={commit}
        />
      );
      break;
    case 'arrow':
      body = (
        <SectionBody>
          <div className="flex items-center gap-3">
            <label className="w-20 shrink-0 text-sm text-gray-700">{t('editor:component.arrowType')}</label>
            <select
              value={(el as ArrowElement).arrowType || 'end'}
              onChange={(e) => { update({ arrowType: e.target.value as ArrowElement['arrowType'] }); commit(); }}
              className="min-w-0 flex-1 rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 outline-none focus:border-blue-400"
            >
              <option value="start">{t('editor:component.arrowStart')}</option>
              <option value="end">{t('editor:component.arrowEnd')}</option>
              <option value="both">{t('editor:component.arrowBoth')}</option>
              <option value="none">{t('editor:component.arrowNone')}</option>
            </select>
          </div>
          <SliderField
            label={t('editor:component.arrowSize')}
            value={(el as ArrowElement).arrowSize ?? 16}
            min={4}
            max={40}
            step={1}
            onChange={(v) => update({ arrowSize: v } as Partial<Element>)}
            onCommit={commit}
          />
        </SectionBody>
      );
      break;
    case 'star':
      body = (
        <SectionBody>
          <SliderField
            label={t('editor:property.points')}
            value={(el as StarElement).points ?? 5}
            min={3}
            max={12}
            step={1}
            onChange={(v) => update({ points: v } as Partial<Element>)}
            onCommit={commit}
          />
        </SectionBody>
      );
      break;
    case 'polygon':
      body = (
        <SectionBody>
          <SliderField
            label={t('editor:property.sides')}
            value={(el as PolygonElement).sides ?? 5}
            min={3}
            max={12}
            step={1}
            onChange={(v) => update({ sides: v } as Partial<Element>)}
            onCommit={commit}
          />
        </SectionBody>
      );
      break;
    case 'image':
      body = <ImageSpecific el={el as ImageElement} update={update} commit={commit} onDelete={onDelete} />;
      break;
    case 'video':
      body = <VideoSpecific el={el as VideoElement} update={update} commit={commit} />;
      break;
    case 'button':
      body = <ButtonSpecific el={el as ButtonElement} update={update} commit={commit} />;
      break;
    case 'calendar':
      body = <PropertyCalendar el={el as CalendarElement} update={update as (patch: Partial<Element>) => void} commit={commit} />;
      break;
    case 'gallery':
      body = <PropertyGallery el={el as GalleryElement} update={update as (patch: Partial<Element>) => void} commit={commit} />;
      break;
    case 'puzzle':
      body = <PropertyPuzzle el={el as PuzzleElement} update={update as (patch: Partial<Element>) => void} commit={commit} />;
      break;
    case 'countdown':
      body = <PropertyCountdown el={el as CountdownElement} update={update as (patch: Partial<CountdownElement>) => void} commit={commit} />;
      break;
    case 'mapNav':
      body = <PropertyMapNav el={el as MapNavElement} update={update as (patch: Partial<MapNavElement>) => void} commit={commit} />;
      break;
    case 'messageBoard':
      body = <PropertyMessageBoard el={el as MessageBoardElement} update={update as (patch: Partial<MessageBoardElement>) => void} commit={commit} />;
      break;
    case 'timeline':
      body = <PropertyTimeline el={el as TimelineElement} update={update as (patch: Partial<TimelineElement>) => void} commit={commit} />;
      break;
    case 'like':
      body = <PropertyLike el={el as LikeElement} update={update as (patch: Partial<LikeElement>) => void} commit={commit} />;
      break;
    case 'widget':
      body = <PropertyWidget el={el as WidgetElement} update={update} commit={commit} />;
      break;
    default:
      return null;
  }

  return (
    <CollapsibleSection
      title={<SectionTitle title={t('editor:section.specific')}>{ICON_SPECIFIC}</SectionTitle>}
      defaultOpen
    >
      {body}
    </CollapsibleSection>
  );
}

/* ───────── 边框 Border（只对 text/image 显示） ───────── */

function BorderSection({ el, update, commit }: { el: Element; update: (patch: Partial<Element>) => void; commit: () => void }) {
  const { t } = useTranslation(['editor']);
  const showBorder = el.type === 'text' || el.type === 'image';
  if (!showBorder) return null;

  const isImage = el.type === 'image';
  const effectiveStyle =
    el.borderStyle || ((el.borderWidth || 0) > 0 ? 'solid' : 'none');
  const borderStyle = effectiveStyle === 'double' && (el.borderWidth || 0) <= 0 ? 'none' : effectiveStyle;
  const handleBorderStyleChange = (style: 'none' | 'solid' | 'dashed' | 'dotted' | 'double') => {
    if (style === 'none') {
      update({ borderStyle: 'none', borderWidth: 0 });
    } else {
      update({ borderStyle: style, borderWidth: Math.max(1, el.borderWidth || 1) });
    }
    commit();
  };

  return (
    <CollapsibleSection
      title={<SectionTitle title={t('editor:section.border')}>{ICON_BORDER}</SectionTitle>}
      defaultOpen
    >
      <SectionBody>
        <div className="flex items-center gap-3">
          <label className="w-20 shrink-0 text-sm text-gray-700">{t('editor:component.borderStyle')}</label>
          <select
            value={borderStyle}
            onChange={(e) => { handleBorderStyleChange(e.target.value as 'none' | 'solid' | 'dashed' | 'dotted' | 'double'); }}
            className="min-w-0 flex-1 rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 outline-none focus:border-blue-400"
          >
            <option value="none">{t('editor:component.borderNone')}</option>
            <option value="solid">{t('editor:component.borderSolid')}</option>
            <option value="dashed">{t('editor:component.borderDashed')}</option>
            <option value="dotted">{t('editor:component.borderDotted')}</option>
            <option value="double">{t('editor:component.borderDouble')}</option>
          </select>
        </div>
        <ColorField label={t('editor:component.borderColor')} value={el.borderColor || '#000000'} onChange={(v) => { update({ borderColor: v }); commit(); }} />
        <SliderField label={t('editor:component.borderSize')} value={el.borderWidth || 0} min={0} max={20} step={0.5} onChange={(v) => update({ borderWidth: v })} onCommit={commit} />
        {!isImage && (
          <SliderField label={t('editor:component.borderRadius')} value={el.borderRadius || 0} min={0} max={100} step={1} onChange={(v) => update({ borderRadius: v })} onCommit={commit} />
        )}
      </SectionBody>
    </CollapsibleSection>
  );
}

/* ───────── 效果 Effects（仅阴影） ───────── */

function EffectsSection({ el, update, commit }: { el: Element; update: (patch: Partial<Element>) => void; commit: () => void }) {
  const { t } = useTranslation(['editor']);
  return (
    <CollapsibleSection
      title={<SectionTitle title={t('editor:section.effects')}>{ICON_EFFECTS}</SectionTitle>}
      defaultOpen
    >
      <SectionBody>
        <ColorField label={t('editor:component.shadowColor')} value={el.shadowColor || 'transparent'} onChange={(v) => { update({ shadowColor: v }); commit(); }} />
        <SliderField label={t('editor:component.shadowX')} value={el.shadowOffsetX || 0} min={-50} max={50} step={1} onChange={(v) => update({ shadowOffsetX: v })} onCommit={commit} />
        <SliderField label={t('editor:component.shadowY')} value={el.shadowOffsetY || 0} min={-50} max={50} step={1} onChange={(v) => update({ shadowOffsetY: v })} onCommit={commit} />
        <SliderField label={t('editor:component.shadowBlur')} value={el.shadowBlur || 0} min={0} max={50} step={1} onChange={(v) => update({ shadowBlur: v })} onCommit={commit} />
        <SliderField label={t('editor:component.shadowOpacity')} value={Math.round((typeof el.shadowOpacity === 'number' ? el.shadowOpacity : 1) * 100)} min={0} max={100} step={1} onChange={(v) => update({ shadowOpacity: v / 100 })} onCommit={commit} />
      </SectionBody>
    </CollapsibleSection>
  );
}

/* ───────── 动画选项卡 ───────── */

function AnimationTab({ el, update, commit }: { el: Element; update: (patch: Partial<Element>) => void; commit: () => void }) {
  const { t } = useTranslation(['editor']);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const previewCleanupRef = useRef<(() => void) | null>(null);

  const stageRef = useEditorStore((s) => s.stageRef);
  const anims = useMemo(() => normalizeAnimations(el.animation), [el.animation]);

  const setAnimations = useCallback(
    (next: SingleAnimationConfig[]) => {
      update({ animation: { ...(el.animation ?? {}), animation: next } });
      commit();
    },
    [el.animation, update, commit],
  );

  const addAnimation = useCallback(
    (category: AnimationCategory, key: string) => {
      const next: SingleAnimationConfig = {
        category,
        type: key,
        duration: 0.6,
        delay: 0,
        repeat: 0,
        loop: false,
      };
      if (editingIndex !== null && editingIndex >= 0 && editingIndex < anims.length) {
        // 编辑已有动画：只替换类型与分类，保留参数
        const replaced: SingleAnimationConfig = { ...anims[editingIndex], category, type: key };
        const nextList = anims.map((a, i) => (i === editingIndex ? replaced : a));
        setAnimations(nextList);
        setEditingIndex(null);
      } else {
        // 新增动画：追加到末尾，并自动展开
        const nextList = [...anims, next];
        setAnimations(nextList);
        setExpanded((prev) => ({ ...prev, [nextList.length - 1]: true }));
      }
      setPickerOpen(false);
    },
    [anims, editingIndex, setAnimations],
  );

  const updateAnimation = useCallback(
    (index: number, patch: Partial<SingleAnimationConfig>) => {
      if (index < 0 || index >= anims.length) return;
      const next = anims.map((a, i) => (i === index ? { ...a, ...patch } : a));
      update({ animation: { ...(el.animation ?? {}), animation: next } });
    },
    [anims, el.animation, update],
  );

  const removeAnimation = useCallback(
    (index: number) => {
      const next = anims.filter((_, i) => i !== index);
      setAnimations(next);
    },
    [anims, setAnimations],
  );

  const moveAnimation = useCallback(
    (from: number, to: number) => {
      if (from === to) return;
      const next = [...anims];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      setAnimations(next);
      // 顺序变化后按 index 记忆的展开状态会错位，直接重置
      setExpanded({});
    },
    [anims, setAnimations],
  );

  const playPreview = useCallback(() => {
    // 停止上一次预览（防御式调用，避免旧 cleanup 抛错影响后续流程）
    try {
      previewCleanupRef.current?.();
    } catch {
      // ignore
    }
    previewCleanupRef.current = null;

    const stage = stageRef;
    if (!stage) return;
    const node = stage.findOne<Konva.Node>(`#${el.id}`);
    if (!node) return;

    previewCleanupRef.current = playAnimationsOnNode(node, anims);
  }, [anims, el.id, stageRef]);

  // 组件卸载时清理预览
  useEffect(() => {
    return () => {
      try {
        previewCleanupRef.current?.();
      } catch {
        // ignore
      }
      previewCleanupRef.current = null;
    };
  }, []);

  const toggleExpand = (index: number) => {
    setExpanded((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  const openAdd = () => {
    setEditingIndex(null);
    setPickerOpen(true);
  };

  const openEdit = (index: number) => {
    setEditingIndex(index);
    setPickerOpen(true);
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* 添加 / 预览 按钮 */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={openAdd}
          className="flex-1 rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-600"
        >
          {t('editor:animation.setAnimation')}
        </button>
        <button
          type="button"
          onClick={playPreview}
          disabled={anims.length === 0}
          className="flex-1 rounded-lg border border-blue-300 bg-white px-4 py-2 text-sm font-medium text-blue-500 shadow-sm transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:border-gray-200 disabled:text-gray-400"
        >
          {t('editor:animation.previewAnimation')}
        </button>
      </div>

      {anims.length > 0 ? (
        <div className="flex flex-col gap-3">
          {anims.map((anim, index) => {
            const def = findAnimationDef(anim.category, anim.type);
            const isExpanded = !!expanded[index];
            const label = def ? t(def.labelKey) : anim.type;
            const isDragging = draggedIndex === index;
            return (
              <div
                key={index}
                draggable
                className={`overflow-hidden rounded-lg border border-gray-200 bg-white transition-opacity ${isDragging ? 'opacity-50' : ''} cursor-grab active:cursor-grabbing`}
                onDragStart={(e) => {
                  setDraggedIndex(index);
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onDragEnd={() => setDraggedIndex(null)}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (draggedIndex === null || draggedIndex === index) return;
                  moveAnimation(draggedIndex, index);
                  setDraggedIndex(null);
                }}
              >
                {/* 动画卡片头部：序号 + 名称 + 编辑/折叠/删除 */}
                <div className="flex items-center gap-2 px-3 py-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-gray-500 text-xs font-bold text-white">
                    {index + 1}
                  </span>
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={() => openEdit(index)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') openEdit(index);
                    }}
                    className="min-w-0 cursor-pointer truncate text-sm font-semibold text-gray-800 hover:text-blue-600"
                    title={label}
                  >
                    {label}
                  </span>
                  <div className="ml-auto flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openEdit(index)}
                      className="rounded p-1 text-blue-500 transition hover:bg-blue-50"
                      title={t('editor:animation.editAnimation')}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                        <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleExpand(index)}
                      className="rounded p-1 text-gray-500 transition hover:bg-gray-100"
                      title={isExpanded ? t('editor:animation.collapse') : t('editor:animation.expand')}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className={`h-4 w-4 transition ${isExpanded ? 'rotate-180' : ''}`}
                      >
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => removeAnimation(index)}
                      className="rounded p-1 text-gray-400 transition hover:bg-red-50 hover:text-red-500"
                      title={t('editor:animation.removeAnimation')}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                        <path d="M18 6 6 18M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* 参数配置区（可折叠） */}
                {isExpanded && (
                  <div className="flex flex-col gap-3 border-t border-gray-100 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-700">{t('editor:animation.type')}</span>
                      <span className="rounded border border-blue-200 bg-blue-50 px-3 py-1 text-sm text-blue-600">{label}</span>
                    </div>
                    <SliderField
                      label={t('editor:animation.duration')}
                      value={anim.duration}
                      min={0.1}
                      max={5}
                      step={0.1}
                      onChange={(v) => updateAnimation(index, { duration: v })}
                      onCommit={commit}
                    />
                    <SliderField
                      label={t('editor:animation.delay')}
                      value={anim.delay}
                      min={0}
                      max={5}
                      step={0.1}
                      onChange={(v) => updateAnimation(index, { delay: v })}
                      onCommit={commit}
                    />
                    <SliderField
                      label={t('editor:animation.repeat')}
                      value={anim.repeat}
                      min={0}
                      max={10}
                      step={1}
                      onChange={(v) => updateAnimation(index, { repeat: v })}
                      onCommit={commit}
                    />
                    <SwitchField
                      label={t('editor:animation.loop')}
                      checked={anim.loop}
                      onChange={(v) => {
                        updateAnimation(index, { loop: v });
                        commit();
                      }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-gray-200 py-8 text-center text-sm text-gray-400">
          {t('editor:animation.emptyHint')}
        </div>
      )}

      <AnimationPickerDialog open={pickerOpen} onClose={() => { setPickerOpen(false); setEditingIndex(null); }} onSelect={addAnimation} />
    </div>
  );
}

/* ───────── 事件选项卡 ───────── */

function EventsTab() {
  const { t } = useTranslation(['editor']);
  return (
    <div className="flex flex-col items-center justify-center gap-3 p-8 text-center text-sm text-gray-500">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-10 w-10 text-gray-300">
        <path d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
      <p>{t('editor:component.eventsComingSoon')}</p>
    </div>
  );
}

/* ───────── 主面板 ───────── */

export default function ComponentSettingsPanel() {
  const { t } = useTranslation(['editor']);
  const [activeTab, setActiveTab] = useState<'edit' | 'animation' | 'events'>('edit');
  const el = useSelectedElement();
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const updateElement = useEditorStore((s) => s.updateElement);
  const pushHistory = useEditorStore((s) => s.pushHistory);
  const multiSelect = selectedIds.length > 1;

  if (!el) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-sm text-gray-500">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-10 w-10 text-gray-300">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M3 9h18M9 21V9" />
        </svg>
        <p>{t('editor:panel.clickToEdit')}</p>
      </div>
    );
  }

  const update = (patch: Partial<Element>) => updateElement(el.id, patch);
  const commit = () => pushHistory();

  const reg = getElementRegistration(el.type);
  const icon = reg?.icon ?? '•';
  const typeLabel = reg ? t(reg.labelKey) : el.type;

  const tabs = [
    { key: 'edit', label: t('editor:component.edit') },
    { key: 'animation', label: t('editor:component.animation') },
    { key: 'events', label: t('editor:component.events') },
  ] as const;

  return (
    <div className="flex h-full flex-col">
      {/* 子选项卡 */}
      <div className="flex border-b border-gray-200">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 py-2.5 text-sm font-medium transition ${
              activeTab === tab.key ? 'border-b-2 border-blue-500 text-blue-500' : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden">
        {activeTab === 'edit' && (
          <>
            {multiSelect ? (
              <>
                <div className="flex items-center justify-between gap-2 border-b border-gray-200 bg-blue-50 px-4 py-3">
                  <span className="text-sm font-medium text-blue-700">
                    {t('editor:multiSelect.count', { count: selectedIds.length })}
                  </span>
                  <button
                    type="button"
                    onClick={() => useEditorStore.getState().clearSelection()}
                    className="rounded border border-blue-200 px-2 py-1 text-xs text-blue-600 hover:bg-white"
                  >
                    {t('editor:multiSelect.cancel')}
                  </button>
                </div>
                <p className="px-4 pt-3 text-xs text-gray-500">{t('editor:multiSelect.hint')}</p>
                <div className="flex flex-col gap-2 border-t border-gray-100 px-4 py-3">
                  <AlignDistributeToolbar />
                </div>
              </>
            ) : (
              <>
                {/* 元素类型标题 */}
                <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
                  <div className="flex items-center gap-2 text-base font-semibold text-gray-800">
                    <span className="flex h-6 w-6 items-center justify-center rounded bg-gray-100 text-sm">{icon}</span>
                    <span>{typeLabel}{t('editor:component.settingsSuffix')}</span>
                  </div>
                </div>

                {/* 六个类型守卫 section */}
                <TransformSection el={el} update={update} commit={commit} />
                <FillSection el={el} update={update} commit={commit} />
                <StrokeSection el={el} update={update} commit={commit} />
                <TextSection el={el} update={update} commit={commit} />
                <SpecificSection
                  el={el}
                  update={update}
                  commit={commit}
                  onDelete={() => useEditorStore.getState().removeElement(el.id)}
                />
                <BorderSection el={el} update={update} commit={commit} />
                <EffectsSection el={el} update={update} commit={commit} />

                {/* 层级工具条 */}
                <div className="flex flex-col gap-2 border-t border-gray-100 px-4 py-3">
                  <LayerToolbar
                    onTop={() => { useEditorStore.getState().bringToFront(el.id); commit(); }}
                    onUp={() => { useEditorStore.getState().bringForward(el.id); commit(); }}
                    onDown={() => { useEditorStore.getState().sendBackward(el.id); commit(); }}
                    onBottom={() => { useEditorStore.getState().sendToBack(el.id); commit(); }}
                  />
                  <AlignDistributeToolbar />
                </div>
              </>
            )}
          </>
        )}
        {activeTab === 'animation' && <AnimationTab el={el} update={update} commit={commit} />}
        {activeTab === 'events' && <EventsTab />}
      </div>
    </div>
  );
}
