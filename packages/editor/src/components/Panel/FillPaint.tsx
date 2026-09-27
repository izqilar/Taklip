/**
 * 「颜色填充」分组的三种填充类型编辑器：单色 / 渐变 / 图案。
 *
 * 设计约束（对应需求）：
 *  1. 单色完全复用既有 ColorField（取色器 / 透明度 / 清除流程零改动）；
 *  2. 渐变编辑器与图案填充的**交互范式参考 Photoshop**（渐变条 + 拖拽把手 + 图案瓦片预览 +
 *     平铺），但**视觉与控件规范沿用本项目属性面板**：标签 w-20 + text-sm、控件 h-8、
 *     边框 border-gray-300、聚焦 focus:border-blue-400、选中态 border-blue-500/bg-blue-50；
 *  3. 键盘无障碍：填充类型用原生 `<input type="radio">`（同 name 组自带方向键切换 + 焦点可见）；
 *     渐变把手用 `role="slider"` + `tabIndex=0`，支持 ←/→ 微调、Home/End 归位、Delete 删除；
 *  4. 三种类型的数据分别存放在 `fill` / `gradientFill` / `patternFill`，
 *     切换只改 `fillType`，互不覆盖。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ColorField, { CheckerBackground } from '../UI/ColorField';
import SliderField from '../UI/SliderField';
import {
  PATTERN_KINDS,
  PATTERN_BASE_TILE,
  buildPatternTile,
  patternTileDataUrl,
  patternTileSize,
  normalizeGradient,
  normalizePattern,
  sampleGradientColor,
  gradientToCss,
  gradientFromSolid,
  patternFromSolid,
  type FillType,
  type GradientFill,
  type GradientStop,
  type PatternFill,
  type PatternKind,
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

/* ───────────────────────── 填充类型单选 ───────────────────────── */

/**
 * 三个互斥单选按钮。
 * 用**原生 radio**而非 div+onClick：同一 `name` 的 radio 浏览器自带
 * 「方向键切换 + 单向 tab 停靠」语义，无需手写 roving tabindex。
 */
export function FillTypeRadio({
  value,
  onChange,
}: {
  value: FillType;
  onChange: (v: FillType) => void;
}) {
  const { t } = useTranslation(['editor']);
  const name = 'fill-type';
  const options: { v: FillType; label: string }[] = [
    { v: 'solid', label: t('editor:fill.solid', { defaultValue: '单色填充' }) },
    { v: 'gradient', label: t('editor:fill.gradient', { defaultValue: '渐变填充' }) },
    { v: 'pattern', label: t('editor:fill.pattern', { defaultValue: '图案填充' }) },
  ];
  return (
    <div className="flex items-center gap-3">
      <span className="w-20 shrink-0 text-sm text-gray-700">
        {t('editor:fill.type', { defaultValue: '填充类型' })}
      </span>
      <div
        role="radiogroup"
        aria-label={t('editor:fill.type', { defaultValue: '填充类型' })}
        className="flex min-w-0 flex-1 gap-1"
      >
        {options.map((o) => (
          <label key={o.v} className={segClass(value === o.v)}>
            <input
              type="radio"
              name={name}
              value={o.v}
              checked={value === o.v}
              onChange={() => onChange(o.v)}
              className="sr-only"
            />
            {o.label}
          </label>
        ))}
      </div>
    </div>
  );
}

/* ───────────────────────── 渐变编辑器 ───────────────────────── */

/**
 * Photoshop 风格渐变编辑器。
 * - 顶部渐变条即实时预览，点击空白处新增停靠点（自动取该位置插值色，不突兀）；
 * - 条下把手可拖拽改位置（拖过相邻把手即完成「拖拽排序」）；
 * - 选中把手后可改颜色与位置，最少保留 2 个停靠点。
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

  const emit = useCallback(
    (next: (GradientStop & { id: string })[]) => {
      onChange({
        type: value.type,
        angle: value.angle,
        stops: next
          .slice()
          .sort((a, b) => a.position - b.position)
          .map(({ color, position }) => ({ color, position })),
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
      if (stops.length <= 2) return; // 渐变至少 2 个停靠点
      const next = stops.filter((s) => s.id !== id);
      emit(next);
      setSelectedId(next[0]?.id ?? null);
      onCommit();
    },
    [stops, emit, onCommit],
  );

  /** 反向：位置镜像（Photoshop「反向」同款） */
  const reverse = useCallback(() => {
    emit(stops.map((s) => ({ ...s, position: clamp01(1 - s.position) })));
    onCommit();
  }, [stops, emit, onCommit]);

  // 把手拖拽：pointer 事件挂 window，指针移出组件也不丢
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const id = draggingRef.current;
      const rect = trackRef.current?.getBoundingClientRect();
      if (!id || !rect || rect.width <= 0) return;
      setPosition(id, (e.clientX - rect.left) / rect.width);
    };
    const onUp = () => {
      if (!draggingRef.current) return;
      draggingRef.current = null;
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
  }, [setPosition, onCommit]);

  const css = useMemo(() => {
    const g = normalizeGradient(value);
    return g ? gradientToCss(g, 1) : 'none';
  }, [value]);

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
      {/* 渐变类型：线性 / 径向 */}
      <div className="flex items-center gap-3">
        <span className="w-20 shrink-0 text-sm text-gray-700">
          {t('editor:fill.gradientType', { defaultValue: '渐变类型' })}
        </span>
        <div className="flex min-w-0 flex-1 gap-1">
          <label className={segClass(value.type !== 'radial')}>
            <input
              type="radio"
              name="gradient-kind"
              checked={value.type !== 'radial'}
              onChange={() => onChange({ ...value, type: 'linear' })}
              className="sr-only"
            />
            {t('editor:fill.linear', { defaultValue: '线性' })}
          </label>
          <label className={segClass(value.type === 'radial')}>
            <input
              type="radio"
              name="gradient-kind"
              checked={value.type === 'radial'}
              onChange={() => {
                onChange({ ...value, type: 'radial' });
                onCommit();
              }}
              className="sr-only"
            />
            {t('editor:fill.radial', { defaultValue: '径向' })}
          </label>
        </div>
      </div>

      {/* 角度（仅线性） */}
      {value.type !== 'radial' && (
        <SliderField
          label={t('editor:fill.angle', { defaultValue: '角度' })}
          value={Math.round(value.angle)}
          min={0}
          max={360}
          step={1}
          onChange={(v) => onChange({ ...value, angle: v })}
          onCommit={onCommit}
        />
      )}

      {/* 渐变条（实时预览）+ 停靠把手 */}
      <div className="flex flex-col gap-1">
        <div
          ref={trackRef}
          className="relative h-8 w-full cursor-copy overflow-hidden rounded border border-gray-300"
          title={t('editor:fill.clickToAddStop', { defaultValue: '点击渐变条添加停靠点' })}
          onClick={(e) => addStopAt(e.clientX)}
        >
          <CheckerBackground className="absolute inset-0" />
          <div className="absolute inset-0" style={{ backgroundImage: css }} />
        </div>
        <div className="relative h-4 w-full">
          {stops.map((s) => {
            const active = selected?.id === s.id;
            return (
              <div
                key={s.id}
                role="slider"
                tabIndex={0}
                aria-label={`${t('editor:fill.stop', { defaultValue: '停靠点' })} ${Math.round(s.position * 100)}%`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(s.position * 100)}
                aria-valuetext={`${Math.round(s.position * 100)}%`}
                onKeyDown={(e) => handleKeyDown(e, s)}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  setSelectedId(s.id);
                  draggingRef.current = s.id;
                }}
                onFocus={() => setSelectedId(s.id)}
                className={`absolute top-0 h-4 w-4 cursor-grab rounded-[2px] border outline-none ${
                  active ? 'border-blue-600 ring-2 ring-blue-300' : 'border-white shadow'
                }`}
                style={{
                  left: `${clamp01(s.position) * 100}%`,
                  transform: 'translateX(-50%) rotate(45deg)',
                  backgroundColor: s.color,
                }}
              />
            );
          })}
        </div>
      </div>

      {/* 选中停靠点：颜色 / 位置 / 删除 */}
      {selected && (
        <>
          <ColorField
            label={t('editor:fill.stopColor', { defaultValue: '停靠点颜色' })}
            value={selected.color}
            onChange={(v) => setColor(selected.id, v)}
            onCommit={onCommit}
          />
          <SliderField
            label={t('editor:fill.stopPosition', { defaultValue: '位置' })}
            value={Math.round(selected.position * 100)}
            min={0}
            max={100}
            step={1}
            onChange={(v) => setPosition(selected.id, v / 100)}
            onCommit={onCommit}
          />
          <div className="flex items-center gap-3">
            <span className="w-20 shrink-0 text-sm text-gray-700">
              {t('editor:fill.stopOps', { defaultValue: '停靠点' })}
            </span>
            <button
              type="button"
              onClick={() => addStopAt((trackRef.current?.getBoundingClientRect().left ?? 0) + (trackRef.current?.getBoundingClientRect().width ?? 0) / 2)}
              className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 transition hover:border-blue-300 hover:text-blue-500"
            >
              {t('editor:fill.addStop', { defaultValue: '添加' })}
            </button>
            <button
              type="button"
              onClick={() => removeStop(selected.id)}
              disabled={stops.length <= 2}
              className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 transition hover:border-blue-300 hover:text-blue-500 disabled:cursor-not-allowed disabled:text-gray-300 disabled:hover:border-gray-300"
            >
              {t('editor:fill.deleteStop', { defaultValue: '删除' })}
            </button>
            <button
              type="button"
              onClick={reverse}
              className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 transition hover:border-blue-300 hover:text-blue-500"
            >
              {t('editor:fill.reverse', { defaultValue: '反向' })}
            </button>
          </div>
        </>
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
  diamond: 'editor:fill.kindDiamond',
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
          {t('editor:fill.pattern', { defaultValue: '图案填充' })}
        </span>
        <div
          role="radiogroup"
          aria-label={t('editor:fill.pattern', { defaultValue: '图案填充' })}
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

/* ───────────────────────── 数据兜底助手 ───────────────────────── */

/**
 * 切换到某类型时取该类型的配置；没有就用当前单色派生一份。
 * 这样「来回切换」永远有值可回填，且不会抹掉任何一种已存配置。
 */
export function ensureFillConfig(
  type: FillType,
  el: { fill?: string; gradientFill?: GradientFill | null; patternFill?: PatternFill | null },
): { gradientFill?: GradientFill; patternFill?: PatternFill } {
  if (type === 'gradient') {
    return { gradientFill: normalizeGradient(el.gradientFill) ?? gradientFromSolid(el.fill) };
  }
  if (type === 'pattern') {
    return { patternFill: normalizePattern(el.patternFill) ?? patternFromSolid(el.fill) };
  }
  return {};
}
