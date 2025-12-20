'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Minus, Plus } from 'lucide-react';
import type { UnitType } from '@/lib/constants';

interface QuantityInputProps {
  unitType: UnitType;
  value: number;
  onChange: (value: number) => void;
  max?: number;
  min?: number;
}

export function QuantityInput({
  unitType,
  value,
  onChange,
  max,
  min = 0,
}: QuantityInputProps) {
  const isWeight = unitType === 'kg' || unitType === 'g' || unitType === 'litre' || unitType === 'ml';
  const step = isWeight ? 0.1 : 1;

  const handleIncrement = () => {
    const newValue = value + step;
    if (max === undefined || newValue <= max) {
      onChange(Number(newValue.toFixed(isWeight ? 1 : 0)));
    }
  };

  const handleDecrement = () => {
    const newValue = value - step;
    if (newValue >= min) {
      onChange(Number(newValue.toFixed(isWeight ? 1 : 0)));
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

  if (isWeight) {
    // Decimal keypad for weight items
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon-touch"
            onClick={handleDecrement}
            disabled={value <= min}
            className="rounded-full"
          >
            <Minus className="h-5 w-5" />
          </Button>
          <Input
            type="number"
            value={value || ''}
            onChange={handleInputChange}
            step={step}
            min={min}
            max={max}
            className="text-center text-lg font-semibold h-12 touch-target"
            placeholder="0.0"
          />
          <Button
            type="button"
            variant="outline"
            size="icon-touch"
            onClick={handleIncrement}
            disabled={max !== undefined && value >= max}
            className="rounded-full"
          >
            <Plus className="h-5 w-5" />
          </Button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[0.5, 1, 1.5, 2, 2.5, 3].map((quickValue) => (
            <Button
              key={quickValue}
              type="button"
              variant="outline"
              size="touch"
              onClick={() => {
                if (max === undefined || quickValue <= max) {
                  onChange(quickValue);
                }
              }}
              className="text-sm"
            >
              {quickValue} {unitType}
            </Button>
          ))}
        </div>
      </div>
    );
  }

  // +/- buttons for count items
  return (
    <div className="flex items-center gap-3">
      <Button
        type="button"
        variant="outline"
        size="icon-touch"
        onClick={handleDecrement}
        disabled={value <= min}
        className="rounded-full"
      >
        <Minus className="h-5 w-5" />
      </Button>
      <Input
        type="number"
        value={value || ''}
        onChange={handleInputChange}
        step={step}
        min={min}
        max={max}
        className="text-center text-2xl font-bold h-16 w-24 touch-target"
      />
      <Button
        type="button"
        variant="outline"
        size="icon-touch"
        onClick={handleIncrement}
        disabled={max !== undefined && value >= max}
        className="rounded-full"
      >
        <Plus className="h-5 w-5" />
      </Button>
    </div>
  );
}

