'use client';

import { Delete } from 'lucide-react';

interface PosNumericKeypadProps {
  value: string;
  onChange: (value: string) => void;
  onDone?: () => void;
  allowDecimal?: boolean;
  className?: string;
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'back'] as const;

export function PosNumericKeypad({
  value,
  onChange,
  onDone,
  allowDecimal = true,
  className = '',
}: PosNumericKeypadProps) {
  const handleKey = (key: (typeof KEYS)[number]) => {
    if (key === 'back') {
      onChange(value.slice(0, -1));
      return;
    }
    if (key === '.' && !allowDecimal) return;
    if (key === '.' && value.includes('.')) return;
    if (value === '0' && key !== '.') {
      onChange(key);
      return;
    }
    onChange(value + key);
  };

  return (
    <div className={`grid grid-cols-3 gap-1.5 ${className}`}>
      {KEYS.map((key) => {
        if (key === '.' && !allowDecimal) {
          return (
            <button
              key={key}
              type="button"
              disabled
              className="h-11 rounded-xl bg-transparent opacity-0 pointer-events-none"
              aria-hidden
            />
          );
        }
        return (
          <button
            key={key}
            type="button"
            onClick={() => handleKey(key)}
            className="h-11 min-h-[44px] rounded-xl bg-slate-100 dark:bg-slate-800 text-lg font-bold text-slate-900 dark:text-white active:scale-95 transition-transform touch-target"
          >
            {key === 'back' ? <Delete className="w-5 h-5 mx-auto" /> : key}
          </button>
        );
      })}
      {onDone && (
        <button
          type="button"
          onClick={onDone}
          className="col-span-3 h-11 min-h-[44px] rounded-xl bg-[#1c6a1e] text-white font-semibold text-sm active:scale-[0.98] touch-target"
        >
          Done
        </button>
      )}
    </div>
  );
}
