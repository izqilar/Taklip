import { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import ColorPicker, { parseCssColor, rgbaToCss, rgbaToCssKeepRgb, isValidCssColor } from './ColorPicker';
import Popover from './Popover';
import { startEyedropper } from '../../utils/eyedropper';

const CHECKER =
  'linear-gradient(45deg, #e0e0e0 25%, transparent 25%, transparent 75%, #e0e0e0 75%, #e0e0e0), linear-gradient(45deg, #e0e0e0 25%, transparent 25%, transparent 75%, #e0e0e0 75%, #e0e0e0)';

export function CheckerBackground({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={className}
      style={{
        backgroundImage: CHECKER,
        backgroundSize: '10px 10px, 10px 10px',
        backgroundPosition: '0 0, 5px 5px',
        ...style,
      }}
    />
  );
}

/**
 * 通用颜色选择字段：色块 + 文本输入 + 弹出 ColorPicker（支持透明度调节、取色器与清除）。
 * 与形状填充色使用的颜色对话框保持一致。
 *
 * 取色器流程（「先看颜色、确认后才生效」）：
 *   1. 用户在对话框里点取色器 → 关闭对话框，画布进入取色模式；
 *   2. 在画布任意位置点击取色 → 颜色先**暂存**在对话框的活动颜色标本里（不写回元素）；
 *   3. 点「确定」→ 才把暂存色写入元素的对应颜色属性（填充色 / 轮廓色…）。
 *   暂存的颜色一旦元素原值发生变化（例如切换了选中对象）会自动失效，避免串色。
 */
export default function ColorField({
  label,
  value,
  onChange,
  onCommit,
  labelWidth = 'w-20',
  showTextInput = true,
  showAlphaInput = false,
  alphaLabel = '%',
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  onCommit?: () => void;
  /** label 容器的宽度 class，如 'w-20' / 'w-16' */
  labelWidth?: string;
  /** 是否显示文本输入框 */
  showTextInput?: boolean;
  /**
   * 是否在色号右侧显示「透明度（0~100）」数字输入 + 百分号。
   * 用于渐变停靠点这类「色块 + 色号 + 透明度」并排的排版（见设计稿「停靠点颜色」行）。
   * 透明度读写的是颜色自身的 alpha；序列化时保留 RGB 分量，
   * 因此「拉到 0 再拉回来」不会把颜色变成白色。
   */
  showAlphaInput?: boolean;
  /** 透明度后缀符号，默认 '%' */
  alphaLabel?: string;
}) {
  const { t } = useTranslation(['editor', 'common']);
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const baseValue = value || 'transparent';
  const [input, setInput] = useState(baseValue);
  /**
   * 取色器吸到、但尚未点「确定」的暂存色。
   * 记录 base（吸取时元素的原始色值），元素色值一变即作废 —— 切换选中对象时不会显示上一次的暂存色。
   */
  const [staged, setStaged] = useState<{ base: string; css: string } | null>(null);
  const stagedCss = staged && staged.base === baseValue ? staged.css : null;

  /** 对话框 / 标本展示的颜色：优先显示暂存色 */
  const effective = stagedCss ?? baseValue;
  const parsed = useMemo(() => parseCssColor(effective), [effective]);
  const css = useMemo(() => rgbaToCss(parsed), [parsed]);

  // 外部（选中对象变更、撤销重做等）改写色值时同步输入框
  useEffect(() => {
    if (staged) return;
    setInput(baseValue);
  }, [baseValue, staged]);

  const commitInput = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || !isValidCssColor(trimmed)) {
      setInput(css);
      return;
    }
    const next = rgbaToCss(parseCssColor(trimmed));
    setInput(next);
    if (stagedCss != null) {
      // 取色器流程中：仍然只暂存，点「确定」才写回元素
      setStaged({ base: baseValue, css: next });
      return;
    }
    onChange(next);
    onCommit?.();
  }, [input, css, onChange, onCommit, stagedCss, baseValue]);

  /** 透明度（0~100）→ 写回颜色自身的 alpha；保留 RGB 分量，归一零后再调回来不会丢色相 */
  const setAlphaPct = useCallback(
    (pct: number) => {
      const clamped = Math.max(0, Math.min(100, Number.isFinite(pct) ? pct : 100));
      const next = rgbaToCssKeepRgb({ ...parsed, a: clamped / 100 });
      setInput(next);
      if (stagedCss != null) {
        setStaged({ base: baseValue, css: next });
        return;
      }
      onChange(next);
      onCommit?.();
    },
    [parsed, stagedCss, baseValue, onChange, onCommit],
  );

  const alphaPct = Math.round(parsed.a * 100);

  /** 关闭弹层：未确认就关闭 = 放弃取色暂存结果 */
  const closePicker = useCallback(() => {
    setStaged(null);
    setOpen(false);
  }, []);

  /** 打开画布取色器 */
  const handleEyedropper = useCallback(() => {
    setOpen(false); // 先让出画布，对话框收起后画布完全可见
    startEyedropper({
      hintLabel: t('editor:colorPicker.pickingHint', { defaultValue: '点击画布取色 · Esc 取消' }),
      onPick: (picked) => {
        setStaged({ base: baseValue, css: picked });
        setInput(picked);
        setOpen(true); // 取完色重新打开对话框，颜色显示在活动颜色标本里
      },
      onCancel: () => setOpen(true),
    });
  }, [baseValue, t]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        {label != null && <label className={`${labelWidth} shrink-0 text-sm text-gray-700`}>{label}</label>}
        <button
          ref={anchorRef}
          type="button"
          onClick={() => setOpen(!open)}
          title={css}
          data-testid="colorfield-swatch"
          className="relative h-8 w-8 shrink-0 overflow-hidden rounded-md border border-gray-300"
        >
          <CheckerBackground className="absolute inset-0" />
          <span className="absolute inset-0" style={{ backgroundColor: css }} />
        </button>
        {showTextInput && (
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onBlur={commitInput}
            onKeyDown={(e) => e.key === 'Enter' && commitInput()}
            placeholder="#333333"
            className="min-w-0 flex-1 rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 outline-none focus:border-blue-400"
          />
        )}
        {showAlphaInput && (
          <>
            <input
              type="number"
              min={0}
              max={100}
              step={1}
              value={alphaPct}
              onChange={(e) => setAlphaPct(Number(e.target.value))}
              data-testid="colorfield-alpha"
              className="w-14 shrink-0 rounded border border-gray-300 px-2 py-1.5 text-right text-sm text-gray-700 outline-none focus:border-blue-400"
            />
            <span className="shrink-0 text-sm text-gray-500">{alphaLabel}</span>
          </>
        )}
      </div>
      <Popover
        anchor={anchorRef.current}
        open={open}
        onClose={closePicker}
      >
        <ColorPicker
          value={effective}
          onChange={(v) => {
            if (stagedCss != null) {
              setStaged({ base: baseValue, css: v });
              setInput(v);
              return;
            }
            onChange(v);
            setInput(v);
          }}
          onClear={() => {
            setStaged(null);
            onChange('transparent');
            setInput('transparent');
          }}
          onConfirm={() => {
            if (stagedCss != null) {
              setStaged(null);
              onChange(stagedCss);
              onCommit?.();
            }
            setOpen(false);
          }}
          onClose={closePicker}
          onEyedropper={handleEyedropper}
          eyedropperLabel={t('editor:colorPicker.eyedropper', { defaultValue: '取色器' })}
        />
      </Popover>
    </div>
  );
}
