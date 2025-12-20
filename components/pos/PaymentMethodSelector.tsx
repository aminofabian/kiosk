'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { PaymentMethod } from '@/lib/constants';
import { CreditCard, Wallet, Smartphone } from 'lucide-react';

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
  }> = [
    {
      value: 'cash',
      label: 'Cash',
      icon: <Wallet className="h-6 w-6" />,
      color: 'bg-[#4bee2b]',
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
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        {methods.map((method) => {
          const isSelected = selectedMethod === method.value;
          return (
            <Button
              key={method.value}
              type="button"
              variant={isSelected ? 'default' : 'outline'}
              size="touch"
              onClick={() => onSelectMethod(method.value)}
              className={`flex flex-col items-center justify-center h-24 gap-2 ${
                isSelected
                  ? method.value === 'cash'
                    ? `${method.color} text-[#101b0d] border-0 shadow-lg`
                    : `bg-gradient-to-br ${method.color} text-white border-0 shadow-lg`
                  : 'hover:shadow-md'
              }`}
            >
              {method.icon}
              <span className="text-sm font-semibold">{method.label}</span>
            </Button>
          );
        })}
      </div>
    </div>
  );
}

