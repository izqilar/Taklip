/**
 * 「填充」分组的六种填充类型编辑器：单色 / 渐变 / 图案 / 图片 / 视频 / 混合模式。
 *
 * 设计约束（对应需求）：
 *  1. 单色完全复用既有 ColorField（取色器 / 透明度 / 清除流程零改动）；
 *  2. **填充类型用图标栏**（不是文字按钮）表达六种填充：单色 / 渐变 / 图案 / 图片 / 视频 / 混合模式，
 *     一行等分排满，选中项高亮 —— 对应设计稿顶部的图标行；
 *  3. 渐变编辑器对齐设计稿的行序与控件形态：
 *     渐变类型（下拉 + 切换方向 ↔ + 旋转 90°）→ 旋转角度（滑块 0~360 步长 0.1）→
 *     渐变条（单击新增、拖离即删）→ 停靠点颜色（色块 + 色号 + 透明度%）→
 *     停靠点位置（滑块 + 数字）→ 颜色层级列表（位置/色号/透明度/删除，选中行高亮）；
 *  4. 键盘无障碍：填充类型用原生 `<input type="radio">`；渐变把手用 `role="slider"` +
 *     `tabIndex=0`，支持 ←/→ 微调、Home/End 归位、Delete 删除；
 *  5. 六种类型的数据分槽存放（`fill` / `gradientFill` / `patternFill` / `imageFill` /
 *     `videoFill` / `blendMode`），切换类型只改 `fillType`，互不覆盖。
 *
 * 视觉口径：控件类一律走项目标准调色板（bg-white / border-gray-300 / text-gray-700 /
 * 选中态 border-blue-500 + bg-blue-50），因此亮色下与属性面板一致，
 * 深色下由 `editor-dark-theme.css` 的集中式 `.dark` 覆盖层统一转深，无需在本文件写 `dark:` 变体。
 */
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import ColorField, { CheckerBackground } from '../UI/ColorField';
import SliderField from '../UI/SliderField';
import Popover from '../UI/Popover';
import ColorPicker, { parseCssColor, rgbaToCssKeepRgb, type RgbaColor } from '../UI/ColorPicker';
import { services } from '../../services';
import { validateImageFile } from '../../utils/image';
import {
  PATTERN_KINDS,
  PATTERN_BASE_TILE,
  BLEND_MODES,
  GRADIENT_KINDS,
  buildPatternTile,
  patternTileDataUrl,
  patternTileSize,
  normalizeGradient,
  normalizePattern,
  normalizeVideo,
  normalizeBlendMode,
  sampleGradientColor,
  gradientToCss,
  gradientFromSolid,
  patternFromSolid,
  renderGradientKind,
  getVideoFrame,
  getVideoFrameEpoch,
  subscribeVideoFrame,
  videoFrameUrl,
  type BlendMode,
  type FillType,
  type GradientFill,
  type GradientKind,
  type GradientStop,
  type PatternFill,
  type PatternKind,
  type ImageFill,
  type VideoFill,
} from '@h5design/core';

/* ───────────────────────── 通用小部件 ───────────────────────── */

/** 与属性面板一致的「分段按钮」样式（选中 / 未选中 / 键盘聚焦环） */
function segClass(active: boolean): string {
  return `flex min-w-0 flex-1 cursor-pointer items-center justify-center rounded border px-2 py-1.5 text-xs transition focus-within:ring-2 focus-within:ring-blue-400 ${
    active
      ? 'border-blue-500 bg-blue-50 text-blue-600'
      : 'border-gray-200 bg-white text-gray-600 hover:border-blue-300 hover:text-blue-500'
  }`;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

let stopSeq = 0;
/** 生成停靠点 id：只需在同一次编辑会话内稳定，用于选中态与拖拽目标识别 */
function nextStopId(): string {
  stopSeq += 1;
  return `gs${Date.now().toString(36)}${stopSeq.toString(36)}`;
}

/** 为旧数据（无 id）补齐 id，保证 React key 与选中态稳定 */
function withIds(stops: GradientStop[]): (GradientStop & { id: string })[] {
  return stops.map((s, i) => ({
    ...s,
    id: (s as GradientStop & { id?: string }).id || `gs-idx-${i}`,
  }));
}

/** 停靠点位置（0~1）→ 百分比整数 */
function pctOf(position: number): number {
  return Math.round(clamp01(position) * 100);
}

/** 颜色串 → RGBA（容错：非法串按白色不透明处理） */
function rgbaOf(color: string): RgbaColor {
  return parseCssColor(color || '#ffffff');
}

/** 透明度后缀符号（列表行与停靠点行共用，暂不参与多语言） */
const PERCENT = '%';

/* ───────────────────────── 填充类型图标栏 ───────────────────────── */

interface FillTypeOption {
  v: FillType;
  /** i18n 键（editor 命名空间，fill 段） */
  labelKey: string;
  /** 兜底文案（语言包缺键时使用） */
  label: string;
  path: React.ReactNode;
}

const FILL_TYPE_OPTIONS: FillTypeOption[] = [
  {
    v: 'solid',
    labelKey: 'editor:fill.typeSolid',
    label: '单色',
    // 实心圆角方块
    path: <rect x="4" y="4" width="16" height="16" rx="2.5" fill="currentColor" stroke="none" />,
  },
  {
    v: 'gradient',
    labelKey: 'editor:fill.typeGradient',
    label: '渐变',
    // 由疏到密的点阵（渐变语义）
    path: (
      <>
        <circle cx="7" cy="7" r="1.1" fill="currentColor" stroke="none" />
        <circle cx="12" cy="7" r="1.1" fill="currentColor" stroke="none" />
        <circle cx="17" cy="7" r="1.1" fill="currentColor" stroke="none" />
        <circle cx="7" cy="12" r="1.1" fill="currentColor" stroke="none" />
        <circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none" />
        <circle cx="17" cy="12" r="1.1" fill="currentColor" stroke="none" />
        <circle cx="7" cy="17" r="1.1" fill="currentColor" stroke="none" />
        <circle cx="12" cy="17" r="1.1" fill="currentColor" stroke="none" />
        <circle cx="17" cy="17" r="1.1" fill="currentColor" stroke="none" />
        <rect x="3.5" y="3.5" width="17" height="17" rx="2.5" />
      </>
    ),
  },
  {
    v: 'pattern',
    labelKey: 'editor:fill.typePattern',
    label: '图案',
    // 竖线网格
    path: (
      <>
        <rect x="3.5" y="3.5" width="17" height="17" rx="2.5" />
        <path d="M9 3.5v17M15 3.5v17M3.5 9h17M3.5 15h17" />
      </>
    ),
  },
  {
    v: 'image',
    labelKey: 'editor:fill.typeImage',
    label: '图片',
    path: (
      <>
        <rect x="3.5" y="3.5" width="17" height="17" rx="2.5" />
        <circle cx="9" cy="9" r="1.6" />
        <path d="M4 17.5l4.8-4.8a1.6 1.6 0 0 1 2.3 0l4.4 4.4M14 15l1.6-1.6a1.6 1.6 0 0 1 2.3 0l2.6 2.6" />
      </>
    ),
  },
  {
    v: 'video',
    labelKey: 'editor:fill.typeVideo',
    label: '视频',
    path: (
      <>
        <rect x="3.5" y="3.5" width="17" height="17" rx="2.5" />
        <path d="M10.2 8.6l5.4 3.4-5.4 3.4z" fill="currentColor" stroke="none" />
      </>
    ),
  },
  {
    v: 'blend',
    labelKey: 'editor:fill.typeBlend',
    label: '混合模式',
    // 半黑半白的圆（混合语义）
    path: (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor" stroke="none" />
      </>
    ),
  },
];

/**
 * 填充类型图标栏（单色 / 渐变 / 图案 / 图片 / 视频 / 混合模式）。
 *
 * 用**原生 radio** 而非 div+onClick：同一 `name` 的 radio 浏览器自带
 * 「方向键切换 + 单向 tab 停靠」语义，无需手写 roving tabindex。
 * 图标只用 `title` + `aria-label` 表达名称（面板空间有限，与设计稿一致不显示文字）。
 */
export function FillTypeBar({
  value,
  onChange,
}: {
  value: FillType;
  onChange: (v: FillType) => void;
}) {
  const { t } = useTranslation(['editor']);
  const groupLabel = t('editor:fill.type', { defaultValue: '填充类型' });
  return (
    <div className="flex items-center gap-3">
      <span className="w-20 shrink-0 text-sm text-gray-700">{groupLabel}</span>
      <div role="radiogroup" aria-label={groupLabel} className="flex min-w-0 flex-1 gap-1">
        {FILL_TYPE_OPTIONS.map((o) => {
          const active = value === o.v;
          const label = t(o.labelKey, { defaultValue: o.label });
          return (
            <label
              key={o.v}
              title={label}
              aria-label={label}
              data-fill-type={o.v}
              data-active={active ? 'true' : 'false'}
              className={`flex h-8 min-w-0 flex-1 cursor-pointer items-center justify-center rounded border transition focus-within:ring-2 focus-within:ring-blue-400 ${
                active
                  ? 'border-blue-500 bg-blue-50 text-blue-600'
                  : 'border-gray-200 bg-white text-gray-500 hover:border-blue-300 hover:text-blue-500'
              }`}
            >
              <input
                type="radio"
                name="fill-type"
                value={o.v}
                checked={active}
                onChange={() => onChange(o.v)}
                className="sr-only"
              />
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4"
                aria-hidden="true"
              >
                {o.path}
              </svg>
            </label>
          );
        })}
      </div>
    </div>
  );
}

/* ───────────────────────── 颜色标本 + 取色弹层 ───────────────────────── */

/**
 * 独立的色块按钮：点击弹出 ColorPicker。
 * 与 ColorField 的区别是不带 label、不带文本输入框 —— 用于渐变颜色层级列表这种
 * 「一行里已有位置 / 色号 / 透明度」的紧凑排版。
 */
function SwatchButton({
  value,
  onChange,
  onCommit,
  className = 'h-7 w-8',
}: {
  value: string;
  onChange: (v: string) => void;
  onCommit: () => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        title={value}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((s) => !s);
        }}
        className={`relative shrink-0 overflow-hidden rounded-md border border-gray-300 ${className}`}
      >
        <CheckerBackground className="absolute inset-0" />
        <span className="absolute inset-0" style={{ backgroundColor: value }} />
      </button>
      <Popover anchor={anchorRef.current} open={open} onClose={() => setOpen(false)}>
        <ColorPicker
          value={value}
          onChange={onChange}
          onClear={() => {
            onChange('transparent');
            onCommit();
          }}
          onConfirm={() => {
            onCommit();
            setOpen(false);
          }}
          onClose={() => setOpen(false)}
        />
      </Popover>
    </>
  );
}

/* ───────────────────────── 渐变编辑器 ───────────────────────── */

/** 渐变类型下拉的文案：线性 / 径向 / 角度 / 菱形 */
const GRADIENT_KIND_LABEL: Record<GradientKind, { key: string; def: string }> = {
  linear: { key: 'editor:fill.kindLinear', def: '线性渐变' },
  radial: { key: 'editor:fill.kindRadial', def: '径向渐变' },
  conic: { key: 'editor:fill.kindConic', def: '角度渐变' },
  diamond: { key: 'editor:fill.kindDiamond', def: '菱形渐变' },
};

/** 拖离渐变条多少像素后松手即删除该停靠点 */
const DETACH_DELETE_PX = 22;

/**
 * 渐变编辑器（严格对齐设计稿的行序与控件形态）。
 *
 * 交互：
 *  · 顶部「渐变类型」下拉 + 「切换方向 ↔」「旋转 90°」两个图标按钮；
 *  · 「旋转角度」滑块（0~360，步长 0.1）；
 *  · 渐变条单击左键新增颜色（取该位置的插值色播种，避免突兀）；
 *  · 按住颜色标记拖拽：水平移动改位置；**垂直拖离渐变条即删除**；
 *  · 「停靠点颜色」行 = 当前选中颜色的色块 + 色号 + 透明度%；
 *  · 「停靠点位置」行 = 滑块 + 数字框；
 *  · 颜色层级列表按渐变条从左到右（即位置升序）排列，整行可选中，末列为删除按钮。
 */
export function GradientEditor({
  value,
  onChange,
  onCommit,
}: {
  value: GradientFill;
  onChange: (g: GradientFill) => void;
  onCommit: () => void;
}) {
  const { t } = useTranslation(['editor']);
  const trackRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef<string | null>(null);

  // 展示用的停靠点带稳定 id；对外输出时剥掉 id，保持存储结构干净
  const stops = useMemo(() => withIds(normalizeGradient(value)?.stops ?? []), [value]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  /** 拖拽是否已进入「脱离删除区」（仅用于把手视觉反馈与松手判定） */
  const [detaching, setDetaching] = useState(false);

  // 选中项跟随数据变化：删掉当前项 / 初次进入时回落到第一个
  useEffect(() => {
    if (stops.length === 0) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !stops.some((s) => s.id === selectedId)) {
      setSelectedId(stops[0].id);
    }
  }, [stops, selectedId]);

  const selected = stops.find((s) => s.id === selectedId) ?? stops[0];

  /** 渐变至少保留 2 个停靠点（CSS / Konva 都需要两端颜色） */
  const canRemove = stops.length > 2;

  const emit = useCallback(
    (next: (GradientStop & { id: string })[]) => {
      onChange({
        type: value.type,
        angle: value.angle,
        stops: next
          .slice()
          .sort((a, b) => a.position - b.position)
          .map(({ color, position, id }) => (id ? { color, position, id } : { color, position })),
      });
    },
    [onChange, value.type, value.angle],
  );

  /** 点击渐变条 → 在该位置插入一个取插值色的新停靠点 */
  const addStopAt = useCallback(
    (clientX: number) => {
      const rect = trackRef.current?.getBoundingClientRect();
      if (!rect || rect.width <= 0) return;
      const position = clamp01((clientX - rect.left) / rect.width);
      const color = sampleGradientColor(stops, position);
      const created = { id: nextStopId(), color, position };
      emit([...stops, created]);
      setSelectedId(created.id);
      onCommit();
    },
    [stops, emit, onCommit],
  );

  const setPosition = useCallback(
    (id: string, position: number) => {
      emit(stops.map((s) => (s.id === id ? { ...s, position: clamp01(position) } : s)));
    },
    [stops, emit],
  );

  const setColor = useCallback(
    (id: string, color: string) => {
      emit(stops.map((s) => (s.id === id ? { ...s, color } : s)));
    },
    [stops, emit],
  );

  const removeStop = useCallback(
    (id: string) => {
      if (stops.length <= 2) return;
      const next = stops.filter((s) => s.id !== id);
      emit(next);
      setSelectedId(next[0]?.id ?? null);
      onCommit();
    },
    [stops, emit, onCommit],
  );

  /** 切换方向：位置镜像（↔ 按钮） */
  const reverse = useCallback(() => {
    emit(stops.map((s) => ({ ...s, position: clamp01(1 - s.position) })));
    onCommit();
  }, [stops, emit, onCommit]);

  /** 旋转 90°：仅对角度类渐变有意义（径向 / 菱形无角度概念，按钮置灰） */
  const rotate90 = useCallback(() => {
    onChange({ ...value, angle: (value.angle + 90) % 360 });
    onCommit();
  }, [value, onChange, onCommit]);

  /**
   * 松手时是否删除。用 ref 而非 state：
   * `pointerup` 的闭包捕获不到最新 state，而 ref 与 pointermove 写的是同一份实时数据。
   */
  const removeOnDetachRef = useRef(false);

  /**
   * 把手拖拽：pointer 事件挂 window，指针移出组件也不丢。
   * 垂直方向超过 DETACH_DELETE_PX 即标记为「已脱离渐变条」，松手时删除该颜色。
   */
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const id = draggingRef.current;
      const rect = trackRef.current?.getBoundingClientRect();
      if (!id || !rect || rect.width <= 0) return;
      setPosition(id, (e.clientX - rect.left) / rect.width);
      const off = e.clientY - rect.bottom > DETACH_DELETE_PX;
      removeOnDetachRef.current = off;
      setDetaching(off);
    };
    const onUp = () => {
      const id = draggingRef.current;
      if (!id) return;
      draggingRef.current = null;
      const shouldRemove = removeOnDetachRef.current;
      removeOnDetachRef.current = false;
      setDetaching(false);
      if (shouldRemove) {
        removeStop(id);
        return;
      }
      onCommit();
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [setPosition, onCommit, removeStop]);

  const css = useMemo(() => {
    const g = normalizeGradient(value);
    return g ? gradientToCss(g, 1) : 'none';
  }, [value]);

  const isAngular = renderGradientKind(value.type) === 'linear';

  const handleKeyDown = (e: React.KeyboardEvent, stop: GradientStop & { id: string }) => {
    const step = e.shiftKey ? 0.1 : 0.01; // Shift 加速
    switch (e.key) {
      case 'ArrowLeft':
      case 'ArrowDown':
        e.preventDefault();
        setPosition(stop.id, stop.position - step);
        break;
      case 'ArrowRight':
      case 'ArrowUp':
        e.preventDefault();
        setPosition(stop.id, stop.position + step);
        break;
      case 'Home':
        e.preventDefault();
        setPosition(stop.id, 0);
        break;
      case 'End':
        e.preventDefault();
        setPosition(stop.id, 1);
        break;
      case 'Delete':
      case 'Backspace':
        e.preventDefault();
        removeStop(stop.id);
        break;
      default:
        break;
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {/* ① 渐变类型（下拉）+ 切换方向 / 旋转 90° */}
      <div className="flex items-center gap-1.5">
        <span className="w-20 shrink-0 text-sm text-gray-700">
          {t('editor:fill.gradientType', { defaultValue: '渐变类型' })}
        </span>
        <select
          value={value.type}
          onChange={(e) => {
            onChange({ ...value, type: e.target.value as GradientKind });
            onCommit();
          }}
          data-testid="gradient-kind-select"
          className="min-w-0 flex-1 rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-700 outline-none focus:border-blue-400"
        >
          {GRADIENT_KINDS.map((k) => (
            <option key={k} value={k}>
              {t(GRADIENT_KIND_LABEL[k].key, { defaultValue: GRADIENT_KIND_LABEL[k].def })}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={reverse}
          title={t('editor:fill.direction', { defaultValue: '切换方向' })}
          aria-label={t('editor:fill.direction', { defaultValue: '切换方向' })}
          data-testid="gradient-reverse"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-gray-300 text-gray-600 transition hover:border-blue-400 hover:text-blue-500"
        >
          {/* 双向箭头：切换渐变方向 */}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
            <path d="M4 8h13l-3-3M20 16H7l3 3" />
          </svg>
        </button>
        <button
          type="button"
          onClick={rotate90}
          disabled={!isAngular}
          title={t('editor:fill.rotate90', { defaultValue: '旋转 90°' })}
          aria-label={t('editor:fill.rotate90', { defaultValue: '旋转 90°' })}
          data-testid="gradient-rotate90"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-gray-300 text-gray-600 transition hover:border-blue-400 hover:text-blue-500 disabled:cursor-not-allowed disabled:text-gray-300 disabled:hover:border-gray-300"
        >
          {/* 菱形 + 旋转箭头：按 90° 步进旋转 */}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
            <path d="M12 6.6 17.4 12 12 17.4 6.6 12z" />
            <path d="M19.5 8.5V5h-3.5" />
            <path d="M18.6 5.6A8.4 8.4 0 1 0 20 12" />
          </svg>
        </button>
      </div>

      {/* ② 旋转角度（0~360，步长 0.1）；径向 / 菱形无角度语义时禁用 */}
      <div className={isAngular ? undefined : 'opacity-40'}>
        <SliderField
          label={t('editor:fill.angle', { defaultValue: '旋转角度' })}
          value={Math.round(value.angle * 10) / 10}
          min={0}
          max={360}
          step={0.1}
          onChange={(v) => onChange({ ...value, angle: v })}
          onCommit={onCommit}
        />
      </div>

      {/* ③ 渐变条（实时预览，单击新增颜色）+ 停靠点把手 */}
      <div className="flex flex-col">
        <div
          ref={trackRef}
          data-testid="gradient-track"
          className="relative h-9 w-full cursor-copy overflow-hidden rounded border border-gray-300"
          title={t('editor:fill.clickToAddStop', { defaultValue: '点击渐变条添加颜色；按住标记拖离渐变条可删除' })}
          onClick={(e) => addStopAt(e.clientX)}
        >
          <CheckerBackground className="absolute inset-0" />
          <div className="absolute inset-0" style={{ backgroundImage: css }} />
        </div>
        <div className="relative h-5 w-full">
          {stops.map((s) => {
            const active = selected?.id === s.id;
            return (
              <div
                key={s.id}
                role="slider"
                tabIndex={0}
                data-testid="gradient-stop-handle"
                data-stop-id={s.id}
                aria-label={`${t('editor:fill.stop', { defaultValue: '停靠点' })} ${pctOf(s.position)}${PERCENT}`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={pctOf(s.position)}
                aria-valuetext={`${pctOf(s.position)}${PERCENT}`}
                onKeyDown={(e) => handleKeyDown(e, s)}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  setSelectedId(s.id);
                  draggingRef.current = s.id;
                  removeOnDetachRef.current = false;
                }}
                onFocus={() => setSelectedId(s.id)}
                className={`absolute top-0 h-5 w-5 -translate-x-1/2 cursor-grab rotate-45 rounded-[3px] border-2 outline-none transition ${
                  active
                    ? 'border-blue-600 ring-2 ring-blue-300'
                    : 'border-white shadow'
                } ${detaching && active && canRemove ? 'opacity-40' : ''}`}
                style={{ left: `${clamp01(s.position) * 100}%`, backgroundColor: s.color }}
              />
            );
          })}
        </div>
      </div>

      {/* ④ 停靠点颜色：色块 + 色号 + 透明度% */}
      {selected && (
        <ColorField
          label={t('editor:fill.stopColor', { defaultValue: '停靠点颜色' })}
          value={selected.color}
          onChange={(v) => setColor(selected.id, v)}
          onCommit={onCommit}
          showAlphaInput
        />
      )}

      {/* ⑤ 停靠点位置：滑块 + 数字框 */}
      {selected && (
        <SliderField
          label={t('editor:fill.stopPosition', { defaultValue: '停靠点位置' })}
          value={pctOf(selected.position)}
          min={0}
          max={100}
          step={1}
          onChange={(v) => setPosition(selected.id, v / 100)}
          onCommit={onCommit}
        />
      )}

      {/* ⑥ 颜色层级列表：位置 / 色块 / 色号 / 透明度 / 删除 */}
      {selected && (
        <div className="flex flex-col gap-1" data-testid="gradient-stop-list">
          {stops.map((s) => {
            const active = selected.id === s.id;
            const rgba = rgbaOf(s.color);
            const rowCls = active
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200';
            const fieldCls = active
              ? 'border-white/25 bg-white/10 text-white focus:border-white/60'
              : 'border-gray-300 bg-white text-gray-700 focus:border-blue-400';
            return (
              <div
                key={s.id}
                data-testid="gradient-stop-row"
                data-active={active ? 'true' : 'false'}
                onClick={() => setSelectedId(s.id)}
                className={`flex cursor-pointer items-center gap-1.5 rounded px-1.5 py-1 transition ${rowCls}`}
              >
                {/* 位置 */}
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={pctOf(s.position)}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => {
                    setSelectedId(s.id);
                    setPosition(s.id, Number(e.target.value) / 100);
                  }}
                  onBlur={onCommit}
                  data-testid="gradient-stop-position"
                  className={`w-12 shrink-0 rounded border px-1 py-0.5 text-center text-xs outline-none ${fieldCls}`}
                />
                <span className={`shrink-0 text-xs ${active ? 'text-white/80' : 'text-gray-500'}`}>{PERCENT}</span>
                {/* 色块（点击弹色板） */}
                <SwatchButton
                  value={s.color}
                  onChange={(v) => {
                    setSelectedId(s.id);
                    setColor(s.id, v);
                  }}
                  onCommit={onCommit}
                />
                {/* 色号 */}
                <input
                  type="text"
                  value={s.color}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => {
                    setSelectedId(s.id);
                    setColor(s.id, e.target.value);
                  }}
                  onBlur={onCommit}
                  data-testid="gradient-stop-color"
                  className={`min-w-0 flex-1 rounded border px-1.5 py-0.5 text-xs outline-none ${fieldCls}`}
                />
                {/* 透明度 */}
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={Math.round(rgba.a * 100)}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => {
                    setSelectedId(s.id);
                    const pct = Math.max(0, Math.min(100, Number(e.target.value)));
                    setColor(s.id, rgbaToCssKeepRgb({ ...rgba, a: pct / 100 }));
                  }}
                  onBlur={onCommit}
                  data-testid="gradient-stop-alpha"
                  className={`w-11 shrink-0 rounded border px-1 py-0.5 text-right text-xs outline-none ${fieldCls}`}
                />
                <span className={`shrink-0 text-xs ${active ? 'text-white/80' : 'text-gray-500'}`}>{PERCENT}</span>
                {/* 删除 */}
                <button
                  type="button"
                  disabled={!canRemove}
                  onClick={(e) => {
                    e.stopPropagation();
                    removeStop(s.id);
                  }}
                  title={t('editor:fill.deleteStop', { defaultValue: '删除' })}
                  aria-label={t('editor:fill.deleteStop', { defaultValue: '删除' })}
                  data-testid="gradient-stop-remove"
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded transition disabled:cursor-not-allowed disabled:opacity-30 ${
                    active
                      ? 'text-white/80 hover:bg-white/15 hover:text-white'
                      : 'text-gray-400 hover:bg-gray-300 hover:text-red-500'
                  }`}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-4 w-4">
                    <path d="M5 12h14" />
                  </svg>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ───────────────────────── 图案填充 ───────────────────────── */

const PATTERN_LABEL_KEYS: Record<PatternKind, string> = {
  checker: 'editor:fill.kindChecker',
  dots: 'editor:fill.kindDots',
  grid: 'editor:fill.kindGrid',
  diagonal: 'editor:fill.kindDiagonal',
  crosshatch: 'editor:fill.kindCrosshatch',
  diamond: 'editor:fill.kindDiamondPattern',
  zigzag: 'editor:fill.kindZigzag',
  waves: 'editor:fill.kindWaves',
};

const PATTERN_LABEL_DEFAULT: Record<PatternKind, string> = {
  checker: '棋盘格',
  dots: '圆点',
  grid: '网格',
  diagonal: '斜线',
  crosshatch: '交叉线',
  diamond: '菱形',
  zigzag: '锯齿',
  waves: '波纹',
};

/**
 * 图案填充：内置无缝瓦片 + 前景/背景色 + 平铺尺寸。
 * 瓦片预览直接消费 core 生成的**同一块像素**（buildPatternTile），
 * 保证「面板里看到的」就是画布与导出里的效果。
 */
export function PatternEditor({
  value,
  onChange,
  onCommit,
}: {
  value: PatternFill;
  onChange: (p: PatternFill) => void;
  onCommit: () => void;
}) {
  const { t } = useTranslation(['editor']);
  const norm = normalizePattern(value) ?? value;
  const tile = patternTileSize(norm);

  // 预览用 dataURL：与 Konva 的 fillPatternImage 同源，避免两端不一致
  const previewUrl = useMemo(() => patternTileDataUrl(norm, 1), [norm]);
  // 让瓦片在缓存中就绪（SSR / 无 canvas 环境自动忽略）
  useEffect(() => {
    buildPatternTile(norm, 1);
  }, [norm]);

  return (
    <div className="flex flex-col gap-3">
      {/* 图案种类：瓦片即预览 */}
      <div className="flex items-start gap-3">
        <span className="w-20 shrink-0 pt-1 text-sm text-gray-700">
          {t('editor:fill.patternTitle', { defaultValue: '图案类型' })}
        </span>
        <div
          role="radiogroup"
          aria-label={t('editor:fill.patternTitle', { defaultValue: '图案类型' })}
          className="grid min-w-0 flex-1 grid-cols-4 gap-1"
        >
          {PATTERN_KINDS.map((kind) => {
            const active = norm.kind === kind;
            const url = patternTileDataUrl({ ...norm, kind }, 1);
            const size = patternTileSize({ ...norm, kind });
            return (
              <label
                key={kind}
                title={t(PATTERN_LABEL_KEYS[kind], { defaultValue: PATTERN_LABEL_DEFAULT[kind] })}
                className={`relative flex h-9 cursor-pointer items-center justify-center rounded border transition focus-within:ring-2 focus-within:ring-blue-400 ${
                  active
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 bg-white hover:border-blue-300'
                }`}
              >
                <input
                  type="radio"
                  name="pattern-kind"
                  checked={active}
                  onChange={() => {
                    onChange({ ...norm, kind });
                    onCommit();
                  }}
                  className="sr-only"
                />
                {url ? (
                  <span
                    className="h-7 w-full rounded-sm"
                    style={{
                      backgroundImage: `url("${url}")`,
                      backgroundSize: `${size}px ${size}px`,
                      backgroundRepeat: 'repeat',
                    }}
                  />
                ) : (
                  <span className="h-7 w-full rounded-sm bg-gray-100" />
                )}
              </label>
            );
          })}
        </div>
      </div>

      {/* 前景 / 背景 */}
      <ColorField
        label={t('editor:fill.foreground', { defaultValue: '前景色' })}
        value={norm.foreground}
        onChange={(v) => onChange({ ...norm, foreground: v })}
        onCommit={onCommit}
      />
      <ColorField
        label={t('editor:fill.background2', { defaultValue: '背景色' })}
        value={norm.background}
        onChange={(v) => onChange({ ...norm, background: v })}
        onCommit={onCommit}
      />

      {/* 平铺尺寸：以百分比呈现，内部按 PATTERN_BASE_TILE 折算实际瓦片边长 */}
      <SliderField
        label={t('editor:fill.tileScale', { defaultValue: '平铺尺寸' })}
        value={Math.round(norm.scale * 100)}
        min={20}
        max={500}
        step={10}
        onChange={(v) => onChange({ ...norm, scale: v / 100 })}
        onCommit={onCommit}
      />

      {/* 实时平铺预览 */}
      <div className="flex items-center gap-3">
        <span className="w-20 shrink-0 text-sm text-gray-700">
          {t('editor:fill.preview', { defaultValue: '预览' })}
        </span>
        <div className="relative h-16 min-w-0 flex-1 overflow-hidden rounded border border-gray-300">
          <CheckerBackground className="absolute inset-0" />
          {previewUrl ? (
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: `url("${previewUrl}")`,
                backgroundSize: `${tile}px ${tile}px`,
                backgroundRepeat: 'repeat',
              }}
            />
          ) : null}
        </div>
      </div>
      <p className="text-xs text-gray-400">
        {t('editor:fill.tileHint', {
          defaultValue: '瓦片 {{tile}}px（基准 {{base}}px × {{scale}}）',
          tile,
          base: PATTERN_BASE_TILE,
          scale: (Math.round(norm.scale * 100) / 100).toString(),
        })}
      </p>
    </div>
  );
}

/* ───────────────────────── 图片填充 ───────────────────────── */

const IMAGE_FIT_LABELS: Record<NonNullable<ImageFill['fit']>, string> = {
  cover: 'editor:fill.fitCover',
  contain: 'editor:fill.fitContain',
  repeat: 'editor:fill.fitRepeat',
};
const IMAGE_FIT_DEFAULT: Record<NonNullable<ImageFill['fit']>, string> = {
  cover: '铺满裁剪',
  contain: '完整显示',
  repeat: '平铺',
};

/** 「适配方式」分段控件（图片 / 视频填充共用） */
function FitSegmented({
  value,
  onChange,
}: {
  value: NonNullable<ImageFill['fit']>;
  onChange: (v: NonNullable<ImageFill['fit']>) => void;
}) {
  const { t } = useTranslation(['editor']);
  return (
    <div className="flex items-center gap-3">
      <span className="w-20 shrink-0 text-sm text-gray-700">
        {t('editor:fill.fit', { defaultValue: '适配方式' })}
      </span>
      <div className="flex min-w-0 flex-1 gap-1">
        {(['cover', 'contain', 'repeat'] as const).map((f) => (
          <label key={f} className={segClass(value === f)}>
            <input
              type="radio"
              name="fill-fit"
              checked={value === f}
              onChange={() => onChange(f)}
              className="sr-only"
            />
            {t(IMAGE_FIT_LABELS[f], { defaultValue: IMAGE_FIT_DEFAULT[f] })}
          </label>
        ))}
      </div>
    </div>
  );
}

/**
 * 图片填充编辑器：上传图片 → 取得地址；预览；适配方式（cover/contain/repeat）；不透明度。
 * 与单色/渐变/图案同一套面板控件规范（标签 w-20 + 控件 h-8 + 边框/选中态）。
 */
export function ImageFillEditor({
  value,
  onChange,
  onCommit,
}: {
  value?: ImageFill | null;
  onChange: (p: ImageFill) => void;
  onCommit: () => void;
}) {
  const { t } = useTranslation(['editor']);
  const fileRef = useRef<HTMLInputElement>(null);
  const imgF: ImageFill = value && value.href ? value : { href: '', fit: 'cover' };
  const fit = imgF.fit ?? 'cover';

  const set = useCallback(
    (patch: Partial<ImageFill>) => {
      onChange({ ...imgF, ...patch });
      onCommit();
    },
    [imgF, onChange, onCommit],
  );

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const errKey = validateImageFile(file);
    if (errKey) {
      alert(t(errKey));
      return;
    }
    try {
      const asset = await services.uploadAsset(file);
      set({ href: asset.url });
    } catch (err) {
      console.error(err);
      alert(t('errors:error.uploadFailed'));
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />

      {/* 预览 + 上传 */}
      <div className="flex items-center gap-3">
        <span className="w-20 shrink-0 text-sm text-gray-700">
          {t('editor:fill.image', { defaultValue: '图片填充' })}
        </span>
        <div className="relative h-16 min-w-0 flex-1 overflow-hidden rounded border border-gray-300 bg-gray-50">
          {imgF.href ? (
            <img src={imgF.href} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs text-gray-400">
              {t('editor:fill.noImage', { defaultValue: '尚未选择图片' })}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="shrink-0 rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 transition hover:border-blue-300 hover:text-blue-500"
        >
          {t('editor:fill.uploadImage', { defaultValue: '上传图片' })}
        </button>
      </div>

      <FitSegmented value={fit} onChange={(f) => set({ fit: f })} />

      {/* 不透明度 */}
      <SliderField
        label={t('editor:fill.opacity', { defaultValue: '不透明度' })}
        value={Math.round((typeof imgF.opacity === 'number' ? imgF.opacity : 1) * 100)}
        min={0}
        max={100}
        step={1}
        onChange={(v) => onChange({ ...imgF, opacity: v / 100 })}
        onCommit={onCommit}
      />
    </div>
  );
}

/* ───────────────────────── 视频填充 ───────────────────────── */

/** 允许的视频 MIME / 扩展名（与服务端上传白名单保持一致） */
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime', 'video/x-m4v'];
/** 视频上传上限（30MB，与服务端 multer limits 对齐） */
const MAX_VIDEO_SIZE = 30 * 1024 * 1024;

function validateVideoFile(file: File): string | null {
  const typeOk = file.type
    ? ALLOWED_VIDEO_TYPES.includes(file.type) || /^video\//.test(file.type)
    : /\.(mp4|webm|ogv|mov|m4v)$/i.test(file.name);
  if (!typeOk) return 'errors:error.fileType';
  if (file.size > MAX_VIDEO_SIZE) return 'errors:error.fileTooLarge';
  return null;
}

/**
 * 视频填充编辑器。
 *
 * 渲染口径（重要）：填充消费的是视频**某一时刻的帧**（`time` 秒），
 * 抓帧由 core 的 `ensureVideoFrameLoaded` 完成并缓存，三端（Konva / DOM / SVG）
 * 消费同一块像素 —— 因此导出的就是面板里预览到的那一帧，不存在「导出与预览不一致」。
 * 预览框直接复用同一份帧数据（dataURL），所见即所得。
 */
export function VideoFillEditor({
  value,
  onChange,
  onCommit,
}: {
  value?: VideoFill | null;
  onChange: (p: VideoFill) => void;
  onCommit: () => void;
}) {
  const { t } = useTranslation(['editor']);
  const fileRef = useRef<HTMLInputElement>(null);
  const vF = normalizeVideo(value) ?? { ...value, href: value?.href ?? '' } as VideoFill;
  const time = vF.time ?? 0;
  // 帧就绪后重渲染（useSyncExternalStore：抓帧成功 / 失败都会推进 epoch）
  useSyncExternalStore(subscribeVideoFrame, getVideoFrameEpoch);

  const href = vF.href ?? '';
  const previewUrl = href ? videoFrameUrl(href, time, 1) : undefined;
  // 未就绪时主动触发一次抓帧（幂等）
  useEffect(() => {
    if (href) getVideoFrame(href, time) ?? undefined;
  }, [href, time]);

  const set = useCallback(
    (patch: Partial<VideoFill>) => {
      onChange({ ...vF, ...patch });
      onCommit();
    },
    [vF, onChange, onCommit],
  );

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const errKey = validateVideoFile(file);
    if (errKey) {
      alert(t(errKey));
      return;
    }
    try {
      const asset = await services.uploadAsset(file);
      set({ href: asset.url, time: 0 });
    } catch (err) {
      console.error(err);
      alert(t('errors:error.uploadFailed'));
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <input ref={fileRef} type="file" accept="video/*" className="hidden" onChange={onFile} />

      {/* 帧预览 + 上传 */}
      <div className="flex items-center gap-3">
        <span className="w-20 shrink-0 text-sm text-gray-700">
          {t('editor:fill.video', { defaultValue: '视频填充' })}
        </span>
        <div className="relative h-16 min-w-0 flex-1 overflow-hidden rounded border border-gray-300 bg-gray-50">
          {previewUrl ? (
            <div
              className="absolute inset-0"
              style={{ backgroundImage: `url("${previewUrl}")`, backgroundSize: 'cover', backgroundPosition: 'center' }}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center px-2 text-center text-xs text-gray-400">
              {href
                ? t('editor:fill.videoFramePending', { defaultValue: '正在解码视频帧…' })
                : t('editor:fill.noVideo', { defaultValue: '尚未选择视频' })}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          data-testid="video-upload"
          className="shrink-0 rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 transition hover:border-blue-300 hover:text-blue-500"
        >
          {t('editor:fill.uploadVideo', { defaultValue: '上传视频' })}
        </button>
      </div>

      {/* 视频链接（便于直接粘贴 URL） */}
      <div className="flex items-center gap-3">
        <span className="w-20 shrink-0 text-sm text-gray-700">
          {t('editor:fill.videoUrl', { defaultValue: '视频链接' })}
        </span>
        <input
          type="text"
          value={href}
          placeholder="https://…/clip.mp4"
          onChange={(e) => onChange({ ...vF, href: e.target.value })}
          onBlur={onCommit}
          data-testid="video-url"
          className="min-w-0 flex-1 rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 outline-none focus:border-blue-400"
        />
      </div>

      {/* 取帧时间（秒） */}
      <SliderField
        label={t('editor:fill.frameTime', { defaultValue: '取帧时间' })}
        value={Math.round(time * 10) / 10}
        min={0}
        max={30}
        step={0.1}
        onChange={(v) => onChange({ ...vF, time: v })}
        onCommit={onCommit}
      />

      <FitSegmented value={vF.fit ?? 'cover'} onChange={(f) => set({ fit: f })} />

      {/* 不透明度 */}
      <SliderField
        label={t('editor:fill.opacity', { defaultValue: '不透明度' })}
        value={Math.round((typeof vF.opacity === 'number' ? vF.opacity : 1) * 100)}
        min={0}
        max={100}
        step={1}
        onChange={(v) => onChange({ ...vF, opacity: v / 100 })}
        onCommit={onCommit}
      />

      <p className="text-xs text-gray-400">
        {t('editor:fill.videoHint', {
          defaultValue: '填充使用该时刻的视频帧（静态），预览 / 导出 / 发布三端同源。',
        })}
      </p>
    </div>
  );
}

/* ───────────────────────── 混合模式填充 ───────────────────────── */

const BLEND_MODE_DEFAULT: Record<BlendMode, string> = {
  normal: '正常',
  multiply: '正片叠底',
  screen: '滤色',
  overlay: '叠加',
  darken: '变暗',
  lighten: '变亮',
  'color-dodge': '颜色减淡',
  'color-burn': '颜色加深',
  'hard-light': '强光',
  'soft-light': '柔光',
  difference: '差值',
  exclusion: '排除',
  hue: '色相',
  saturation: '饱和度',
  color: '颜色',
  luminosity: '明度',
};

/**
 * 混合模式填充：以单色为基底色，与下层内容按所选模式混合。
 * 三端映射：Konva `globalCompositeOperation` / DOM `mix-blend-mode` / SVG 内联样式。
 */
export function BlendFillEditor({
  color,
  mode,
  onChangeColor,
  onChangeMode,
  onCommit,
}: {
  color: string;
  mode: BlendMode;
  onChangeColor: (v: string) => void;
  onChangeMode: (v: BlendMode) => void;
  onCommit: () => void;
}) {
  const { t } = useTranslation(['editor']);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <span className="w-20 shrink-0 text-sm text-gray-700">
          {t('editor:fill.blendMode', { defaultValue: '混合模式' })}
        </span>
        <select
          value={mode}
          onChange={(e) => {
            onChangeMode(normalizeBlendMode(e.target.value));
            onCommit();
          }}
          data-testid="blend-mode-select"
          className="min-w-0 flex-1 rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-700 outline-none focus:border-blue-400"
        >
          {BLEND_MODES.map((m) => (
            <option key={m} value={m}>
              {t(`editor:fill.blend.${m.replace(/-([a-z])/g, (_, c) => c.toUpperCase())}`, {
                defaultValue: BLEND_MODE_DEFAULT[m],
              })}
            </option>
          ))}
        </select>
      </div>

      {/* 基底色：混合模式下的「填充色」 */}
      <ColorField
        label={t('editor:fill.baseColor', { defaultValue: '基底色' })}
        value={color}
        onChange={(v) => {
          onChangeColor(v);
          onCommit();
        }}
      />

      <p className="text-xs text-gray-400">
        {t('editor:fill.blendHint', {
          defaultValue: '基底色与下层内容按所选模式混合；不透明度见下方「填充透明度」。',
        })}
      </p>
    </div>
  );
}

/* ───────────────────────── 数据兜底助手 ───────────────────────── */

/**
 * 切换到某类型时取该类型的配置；没有就用当前单色派生一份。
 * 这样「来回切换」永远有值可回填，且不会抹掉任何一种已存配置。
 */
export function ensureFillConfig(
  type: FillType,
  el: {
    fill?: string;
    gradientFill?: GradientFill | null;
    patternFill?: PatternFill | null;
    imageFill?: ImageFill | null;
    videoFill?: VideoFill | null;
    blendMode?: BlendMode | string | null;
  },
): {
  gradientFill?: GradientFill;
  patternFill?: PatternFill;
  imageFill?: ImageFill;
  videoFill?: VideoFill;
  blendMode?: BlendMode;
} {
  if (type === 'gradient') {
    return { gradientFill: normalizeGradient(el.gradientFill) ?? gradientFromSolid(el.fill) };
  }
  if (type === 'pattern') {
    return { patternFill: normalizePattern(el.patternFill) ?? patternFromSolid(el.fill) };
  }
  if (type === 'image') {
    return { imageFill: el.imageFill && el.imageFill.href ? el.imageFill : { href: '', fit: 'cover' } };
  }
  if (type === 'video') {
    return { videoFill: normalizeVideo(el.videoFill) ?? { href: '', time: 0, fit: 'cover', opacity: 1 } };
  }
  if (type === 'blend') {
    // 混合模式必须有基底色：缺省沿用当前单色，模式缺省 normal
    return { blendMode: normalizeBlendMode(el.blendMode) };
  }
  return {};
}
