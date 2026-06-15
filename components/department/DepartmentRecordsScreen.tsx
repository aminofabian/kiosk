'use client';

import { useState } from 'react';
import {
  ClipboardList,
  Receipt,
  TrendingDown,
  Wallet,
} from 'lucide-react';
import { useDepartmentApp } from '@/components/department/DepartmentAppProvider';
import { DepartmentSuppliesForm } from '@/components/department/DepartmentSuppliesForm';
import { DepartmentLossForm } from '@/components/department/DepartmentLossForm';
import { PosExpenseForm } from '@/components/pos/PosExpenseForm';

type RecordsTab = 'supplies' | 'losses' | 'expenses';

const TABS: { key: RecordsTab; label: string; icon: typeof Receipt }[] = [
  { key: 'supplies', label: 'Supplies', icon: Receipt },
  { key: 'losses', label: 'Losses', icon: TrendingDown },
  { key: 'expenses', label: 'Expenses', icon: Wallet },
];

export function DepartmentRecordsScreen() {
  const { assignedTypes } = useDepartmentApp();
  const [tab, setTab] = useState<RecordsTab>('supplies');
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="flex flex-col h-full min-h-0 w-full overflow-hidden bg-white dark:bg-[#132210]">
      <header className="shrink-0 safe-area-top border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#1a2c17] px-3 py-2">
        <div className="flex items-center gap-2 mb-2">
          <ClipboardList className="w-4 h-4 text-[#1c6a1e]" />
          <h1 className="text-sm font-bold uppercase tracking-wide">Records</h1>
        </div>
        <div className="flex gap-1 p-0.5 bg-slate-100 dark:bg-slate-900/50 rounded-lg">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-md text-[10px] sm:text-xs font-semibold ${
                  active
                    ? 'bg-white dark:bg-[#1c2e18] text-[#1c6a1e] shadow-sm'
                    : 'text-slate-500'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                {t.label}
              </button>
            );
          })}
        </div>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
        {tab === 'supplies' && (
          <DepartmentSuppliesForm
            key={refreshKey}
            assignedTypes={assignedTypes}
            onSuccess={() => setRefreshKey((k) => k + 1)}
          />
        )}
        {tab === 'losses' && (
          <DepartmentLossForm
            assignedTypes={assignedTypes}
            onSuccess={() => setRefreshKey((k) => k + 1)}
          />
        )}
        {tab === 'expenses' && (
          <div className="p-3 pb-6">
            <p className="text-xs text-slate-500 mb-3">
              Record petty cash, transport, or other department costs.
            </p>
            <PosExpenseForm compact />
          </div>
        )}
      </div>
    </div>
  );
}
