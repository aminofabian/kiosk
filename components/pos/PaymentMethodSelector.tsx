'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { PaymentMethod } from '@/lib/constants';
import { CreditCard, Wallet, Smartphone, Split } from 'lucide-react';

interface PaymentMethodSelectorProps {
  selectedMethod: PaymentMethod | null;
  onSelectMethod: (method: PaymentMethod) => void;
}

export function PaymentMethodSelector({
  selectedMethod,
  onSelectMethod,
}: PaymentMethodSelectorProps) {
  const methods: Array<{
    value: PaymentMethod;
    label: string;
    icon: React.ReactNode;
    color: string;
    description?: string;
  }> = [
    {
      value: 'cash',
      label: 'Cash',
      icon: <Wallet className="h-6 w-6" />,
      color: 'bg-[#1c6a1e]',
    },
    {
      value: 'mpesa',
      label: 'M-Pesa',
      icon: <Smartphone className="h-6 w-6" />,
      color: 'from-orange-600 to-yellow-600',
    },
    {
      value: 'credit',
      label: 'Credit',
      icon: <CreditCard className="h-6 w-6" />,
      color: 'from-blue-600 to-indigo-600',
    },
    {
      value: 'split',
      label: 'Split',
      icon: <Split className="h-6 w-6" />,
      color: 'from-purple-600 to-pink-600',
      description: 'Multiple methods',
    },
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {methods.map((method) => {
          const isSelected = selectedMethod === method.value;
          return (
            <Button
              key={method.value}
              type="button"
              variant={isSelected ? 'default' : 'outline'}
              size="touch"
              onClick={() => onSelectMethod(method.value)}
              className={`flex flex-col items-center justify-center h-24 gap-1 ${
                isSelected
                  ? method.value === 'cash'
                    ? `${method.color} text-white border-0 shadow-lg`
                    : `bg-gradient-to-br ${method.color} text-white border-0 shadow-lg`
                  : 'hover:shadow-md'
              }`}
            >
              {method.icon}
              <span className="text-sm font-semibold">{method.label}</span>
              {method.description && (
                <span className={`text-xs ${isSelected ? 'text-white/80' : 'text-muted-foreground'}`}>
                  {method.description}
                </span>
              )}
            </Button>
          );
        })}
      </div>
    </div>
  );
}

