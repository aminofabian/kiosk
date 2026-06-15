'use client';

import type { PaymentMethod } from '@/lib/constants';
import { CreditCard, Wallet, Smartphone, Split } from 'lucide-react';

interface PaymentMethodSelectorProps {
  selectedMethod: PaymentMethod | null;
  onSelectMethod: (method: PaymentMethod) => void;
  disabledWhenOffline?: boolean;
  /** Hide or disable credit when cashier lacks permission */
  creditDisabled?: boolean;
  creditDisabledReason?: string;
}

const methods: Array<{
  value: PaymentMethod;
  label: string;
  icon: typeof Wallet;
  selectedClass: string;
  requiresOnline?: boolean;
}> = [
  {
    value: 'cash',
    label: 'Cash',
    icon: Wallet,
    selectedClass:
      'bg-white dark:bg-slate-700 shadow-sm ring-1 ring-emerald-300 dark:ring-emerald-700 text-emerald-700 dark:text-emerald-400',
  },
  {
    value: 'mpesa',
    label: 'M-Pesa',
    icon: Smartphone,
    selectedClass:
      'bg-white dark:bg-slate-700 shadow-sm ring-1 ring-orange-300 dark:ring-orange-700 text-orange-700 dark:text-orange-400',
  },
  {
    value: 'credit',
    label: 'Credit',
    icon: CreditCard,
    selectedClass:
      'bg-white dark:bg-slate-700 shadow-sm ring-1 ring-blue-300 dark:ring-blue-700 text-blue-700 dark:text-blue-400',
    requiresOnline: true,
  },
  {
    value: 'split',
    label: 'Split',
    icon: Split,
    selectedClass:
      'bg-white dark:bg-slate-700 shadow-sm ring-1 ring-purple-300 dark:ring-purple-700 text-purple-700 dark:text-purple-400',
    requiresOnline: true,
  },
];

export function PaymentMethodSelector({
  selectedMethod,
  onSelectMethod,
  disabledWhenOffline = false,
  creditDisabled = false,
  creditDisabledReason = 'Credit not enabled for your account',
}: PaymentMethodSelectorProps) {
  return (
    <div className="grid grid-cols-4 gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl">
      {methods.map((method) => {
        const isSelected = selectedMethod === method.value;
        const isOfflineDisabled = disabledWhenOffline && method.requiresOnline;
        const isCreditBlocked = method.value === 'credit' && creditDisabled;
        const isDisabled = isOfflineDisabled || isCreditBlocked;
        const Icon = method.icon;
        return (
          <button
            key={method.value}
            type="button"
            disabled={isDisabled}
            onClick={() => onSelectMethod(method.value)}
            title={
              isCreditBlocked
                ? creditDisabledReason
                : isOfflineDisabled
                  ? 'Requires connection'
                  : undefined
            }
            className={`flex flex-col items-center gap-1 py-2.5 rounded-lg text-xs font-semibold transition-all ${
              isSelected
                ? method.selectedClass
                : isDisabled
                  ? 'text-slate-300 dark:text-slate-600 cursor-not-allowed'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-white/50 dark:hover:bg-slate-700/50'
            }`}
          >
            <Icon className="h-4 w-4" />
            <span>{method.label}</span>
          </button>
        );
      })}
    </div>
  );
}
