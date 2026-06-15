'use client';

import { useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import type { UnitType } from '@/lib/constants';

interface QuantityInputProps {
  unitType: UnitType;
  value: number;
  onChange: (value: number) => void;
  max?: number;
  min?: number;
  compact?: boolean;
}

export function QuantityInput({
  unitType,
  value,
  onChange,
  max,
  min = 0,
  compact = false,
}: QuantityInputProps) {
  const supportsFractions = ['kg', 'g', 'litre', 'ml', 'piece', 'bunch'].includes(unitType);
  const [useDecimalStep, setUseDecimalStep] = useState(false);
  const step = supportsFractions && useDecimalStep ? 0.1 : 1;
  const precision = supportsFractions && useDecimalStep ? 1 : 0;

  const handleIncrement = () => {
    const newValue = value + step;
    if (max === undefined || newValue <= max) {
      onChange(Number(newValue.toFixed(precision)));
    }
  };

  const handleDecrement = () => {
    const newValue = value - step;
    if (newValue >= min) {
      onChange(Number(newValue.toFixed(precision)));
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    if (inputValue === '') {
      onChange(0);
      return;
    }
    const numValue = parseFloat(inputValue);
    if (!isNaN(numValue) && numValue >= min && (max === undefined || numValue <= max)) {
      onChange(numValue);
    }
  };

  if (supportsFractions) {
    const fractionQuickPicks = [
      { label: '1/2', value: 0.5 },
      { label: '1/4', value: 0.25 },
      { label: '1/8', value: 0.125 },
      { label: '1/10', value: 0.1 },
      { label: '1', value: 1 },
      { label: '3/2', value: 1.5 },
      { label: '2', value: 2 },
      { label: '1/16', value: 0.0625 },
      { label: '1/20', value: 0.05 },
    ];

    const btnClass = compact
      ? 'h-6 w-6 rounded border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 transition-colors shrink-0'
      : 'h-8 w-8 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 transition-colors shrink-0';
    const inputClass = compact
      ? 'h-6 w-10 text-center text-xs font-bold rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#1c6a1e]/30 focus:border-[#1c6a1e]/40 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none'
      : 'h-8 w-14 text-center text-sm font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1c6a1e]/30 focus:border-[#1c6a1e]/40 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none';
    const iconClass = compact ? 'h-3 w-3' : 'h-3.5 w-3.5';

    return (
      <div className={compact ? 'space-y-1' : 'space-y-2'}>
        {!compact && (
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setUseDecimalStep(false)}
            className={`h-6 px-2 rounded-md text-[10px] font-semibold transition-colors ${
              !useDecimalStep
                ? 'bg-[#1c6a1e] text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            Step 1
          </button>
          <button
            type="button"
            onClick={() => setUseDecimalStep(true)}
            className={`h-6 px-2 rounded-md text-[10px] font-semibold transition-colors ${
              useDecimalStep
                ? 'bg-[#1c6a1e] text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            Step 0.1
          </button>
        </div>
        )}

        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={handleDecrement}
            disabled={value <= min}
            className={`${btnClass} flex items-center justify-center`}
          >
            <Minus className={iconClass} />
          </button>
          <input
            type="number"
            value={value || ''}
            onChange={handleInputChange}
            step={step}
            min={min}
            max={max}
            placeholder="0"
            style={{ WebkitAppearance: 'none', MozAppearance: 'textfield' }}
            className={inputClass}
          />
          <button
            type="button"
            onClick={handleIncrement}
            disabled={max !== undefined && value >= max}
            className={`${btnClass} flex items-center justify-center`}
          >
            <Plus className={iconClass} />
          </button>
        </div>

        {!compact && (
        <div className="flex flex-wrap gap-1.5">
          {fractionQuickPicks.map((qv) => {
            const isSelected = Math.abs(value - qv.value) < 0.0001;
            return (
            <button
              key={qv.label}
              type="button"
              onClick={() => {
                if ((max === undefined || qv.value <= max) && qv.value >= min) onChange(qv.value);
              }}
              className={`h-8 px-2.5 rounded-lg text-xs font-semibold transition-all leading-none ${
                isSelected
                  ? 'bg-[#1c6a1e] text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              <span>{qv.label}</span>
              <span className={`ml-1 text-[10px] ${isSelected ? 'text-white/80' : 'text-slate-400 dark:text-slate-500'}`}>
                {unitType}
              </span>
            </button>
            );
          })}
        </div>
        )}
      </div>
    );
  }

  const btnClass = compact
    ? 'h-6 w-6 flex items-center justify-center rounded border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 transition-colors shrink-0'
    : 'h-8 w-8 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 transition-colors shrink-0';
  const inputClass = compact
    ? 'h-6 w-10 text-center text-xs font-bold rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#1c6a1e]/30 focus:border-[#1c6a1e]/40 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none'
    : 'h-8 w-14 text-center text-sm font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1c6a1e]/30 focus:border-[#1c6a1e]/40 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none';
  const iconClass = compact ? 'h-3 w-3' : 'h-3.5 w-3.5';

  return (
    <div className={`flex items-center ${compact ? 'gap-0.5' : 'gap-1'}`}>
      <button
        type="button"
        onClick={handleDecrement}
        disabled={value <= min}
        className={btnClass}
      >
        <Minus className={iconClass} />
      </button>
      <input
        type="number"
        value={value || ''}
        onChange={handleInputChange}
        step={step}
        min={min}
        max={max}
        style={{ WebkitAppearance: 'none', MozAppearance: 'textfield' }}
        className={inputClass}
      />
      <button
        type="button"
        onClick={handleIncrement}
        disabled={max !== undefined && value >= max}
        className={btnClass}
      >
        <Plus className={iconClass} />
      </button>
    </div>
  );
}
