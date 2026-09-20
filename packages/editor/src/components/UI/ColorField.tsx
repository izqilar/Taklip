import { useState, useRef, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import ColorPicker, { parseCssColor, rgbaToCss, isValidCssColor } from './ColorPicker';
import Popover from './Popover';

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
 * 通用颜色选择字段：色块 + 文本输入 + 弹出 ColorPicker（支持透明度调节与清除）。
 * 与形状填充色使用的颜色对话框保持一致。
 */
export default function ColorField({
  label,
  value,
  onChange,
  onCommit,
  labelWidth = 'w-20',
  showTextInput = true,
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  onCommit?: () => void;
  /** label 容器的宽度 class，如 'w-20' / 'w-16' */
  labelWidth?: string;
  /** 是否显示文本输入框 */
  showTextInput?: boolean;
}) {
  const { t } = useTranslation(['editor', 'common']);
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const [input, setInput] = useState(value || 'transparent');

  const safeValue = value || 'transparent';
  const parsed = useMemo(() => parseCssColor(safeValue), [safeValue]);
  const css = useMemo(() => rgbaToCss(parsed), [parsed]);

  const commitInput = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || !isValidCssColor(trimmed)) {
      setInput(css);
      return;
    }
    const next = parseCssColor(trimmed);
    onChange(rgbaToCss(next));
    setInput(rgbaToCss(next));
    onCommit?.();
  }, [input, css, onChange, onCommit]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        {label != null && <label className={`${labelWidth} shrink-0 text-sm text-gray-700`}>{label}</label>}
        <button
          ref={anchorRef}
          type="button"
          onClick={() => setOpen(!open)}
          className="relative h-8 w-8 shrink-0 overflow-hidden rounded border border-gray-300"
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
      </div>
      <Popover anchor={anchorRef.current} open={open} onClose={() => setOpen(false)}>
        <ColorPicker
          value={safeValue}
          onChange={(v) => {
            onChange(v);
            setInput(v);
          }}
          onClear={() => {
            onChange('transparent');
            setInput('transparent');
          }}
          onConfirm={() => setOpen(false)}
          clearLabel={t('common:button.clear')}
          confirmLabel={t('common:button.confirm')}
        />
      </Popover>
    </div>
  );
}
