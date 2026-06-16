'use client';

import { useEffect, useRef } from 'react';
import { Loader2, Check, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { isDiscreteUnitType } from '@/lib/constants';
import type { UnitType } from '@/lib/constants';

interface InlineEditableCellProps {
  displayValue: string;
  isEditing: boolean;
  value: string;
  isSaving: boolean;
  onStartEdit: () => void;
  onChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
  unitType?: UnitType;
  valueKind?: 'quantity' | 'price';
  allowEmpty?: boolean;
  align?: 'left' | 'right';
  className?: string;
  inline?: boolean;
}

function InlineEditActions({ onSave, onCancel }: { onSave: () => void; onCancel: () => void }) {
  return (
    <div className="flex justify-end gap-0.5 shrink-0">
      <button
        type="button"
        onClick={onSave}
        className="inline-flex h-6 w-6 items-center justify-center rounded bg-[#1c6a1e] text-white hover:bg-[#165a19]"
        aria-label="Save"
      >
        <Check className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="inline-flex h-6 w-6 items-center justify-center rounded text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
        aria-label="Cancel"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export function InlineEditableCell({
  displayValue,
  isEditing,
  value,
  isSaving,
  onStartEdit,
  onChange,
  onSave,
  onCancel,
  unitType = 'piece',
  valueKind = 'quantity',
  allowEmpty = false,
  align = 'right',
  className = '',
  inline = false,
}: InlineEditableCellProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  if (isSaving) {
    return (
      <span className={`inline-flex w-full ${align === 'right' ? 'justify-end' : 'justify-start'}`}>
        <Loader2 className="w-4 h-4 animate-spin text-[#1c6a1e]" />
      </span>
    );
  }

  if (isEditing) {
    return (
      <div className="flex flex-col gap-1 min-w-0 w-full max-w-[140px] ml-auto" onClick={(e) => e.stopPropagation()}>
        <Input
          ref={inputRef}
          type="number"
          step={valueKind === 'price' ? '1' : isDiscreteUnitType(unitType) ? '1' : '0.01'}
          min={valueKind === 'price' ? '0' : '0'}
          value={value}
          onChange={(e) => {
            const next = e.target.value;
            if (valueKind === 'price') {
              if (next === '' || /^\d*\.?\d*$/.test(next)) onChange(next);
              return;
            }
            if (allowEmpty && next === '') {
              onChange('');
              return;
            }
            if (isDiscreteUnitType(unitType)) {
              const intValue = parseInt(next, 10);
              if (next === '' || (!isNaN(intValue) && intValue >= 0)) {
                onChange(next === '' ? '' : intValue.toString());
              }
            } else {
              onChange(next);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              onSave();
            }
            if (e.key === 'Escape') {
              e.preventDefault();
              onCancel();
            }
          }}
          className="h-7 w-full min-w-0 text-right text-xs font-semibold tabular-nums px-1.5"
        />
        <InlineEditActions onSave={onSave} onCancel={onCancel} />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onStartEdit();
      }}
      className={`${inline ? 'w-auto inline' : 'w-full'} min-w-0 tabular-nums hover:text-[#1c6a1e] hover:underline underline-offset-2 ${align === 'right' ? 'text-right' : 'text-left'} ${className}`}
      title="Click to edit"
    >
      {displayValue}
    </button>
  );
}
