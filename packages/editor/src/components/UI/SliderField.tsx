/**
 * 滑块 + 数字输入框（数字框使用原生 number 类型，浏览器自带上下调整按钮）。
 * 从 ComponentSettingsPanel 抽取为共享组件，供各属性面板复用。
 */
export default function SliderField({
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
