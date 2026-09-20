import { useState, useRef, useEffect } from 'react';

interface Option {
  value: string;
  label: string;
  subLabel?: string;
}

interface BilingualSelectProps {
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  placeholder?: string;
}

export default function BilingualSelect({ value, options, onChange, placeholder = '' }: BilingualSelectProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between rounded border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 outline-none transition hover:border-blue-400"
      >
        <span>{selected ? selected.label : placeholder}</span>
        <svg
          className={`h-4 w-4 text-gray-400 transition ${open ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded border border-gray-200 bg-white py-1 shadow-lg">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm transition hover:bg-blue-50 ${
                opt.value === value ? 'bg-blue-50' : ''
              }`}
            >
              <span className={opt.value === value ? 'font-semibold text-blue-500' : 'text-gray-700'}>
                {opt.label}
              </span>
              {opt.subLabel ? <span className="text-xs text-gray-400">{opt.subLabel}</span> : null}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
