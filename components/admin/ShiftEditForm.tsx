'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { apiPatch } from '@/lib/utils/api-client';
import type { Shift } from '@/lib/db/types';
import { 
  Loader2, 
  Banknote, 
  Clock, 
  Coins, 
  Calendar,
  ArrowRight,
  Wallet,
  Receipt,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

// Extend Shift with optional denomination and expense fields that come from the DB
interface ShiftWithDetails extends Shift {
  cash_expenses?: number;
  opening_denom_1?: number;
  opening_denom_5?: number;
  opening_denom_10?: number;
  opening_denom_20?: number;
  opening_denom_40?: number;
  opening_denom_50?: number;
  opening_denom_100?: number;
  opening_denom_200?: number;
  opening_denom_500?: number;
  opening_denom_1000?: number;
  closing_denom_1?: number;
  closing_denom_5?: number;
  closing_denom_10?: number;
  closing_denom_20?: number;
  closing_denom_40?: number;
  closing_denom_50?: number;
  closing_denom_100?: number;
  closing_denom_200?: number;
  closing_denom_500?: number;
  closing_denom_1000?: number;
}

interface ShiftEditFormProps {
  shift: ShiftWithDetails;
  onSuccess?: () => void;
  onCancel?: () => void;
}

function unixToDatetimeLocal(unix: number): string {
  const d = new Date(unix * 1000);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day}T${h}:${min}`;
}

function datetimeLocalToUnix(value: string): number {
  return Math.floor(new Date(value).getTime() / 1000);
}

const formatPrice = (price: number) =>
  `KES ${price.toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

// Denomination configuration with colors and styling
const DENOMINATIONS = [
  { value: 1000, label: '1000', color: 'from-emerald-500 to-teal-600', bgColor: 'bg-emerald-50 dark:bg-emerald-900/20', borderColor: 'border-emerald-200 dark:border-emerald-800', icon: Banknote },
  { value: 500, label: '500', color: 'from-blue-500 to-indigo-600', bgColor: 'bg-blue-50 dark:bg-blue-900/20', borderColor: 'border-blue-200 dark:border-blue-800', icon: Banknote },
  { value: 200, label: '200', color: 'from-purple-500 to-violet-600', bgColor: 'bg-purple-50 dark:bg-purple-900/20', borderColor: 'border-purple-200 dark:border-purple-800', icon: Banknote },
  { value: 100, label: '100', color: 'from-amber-500 to-orange-600', bgColor: 'bg-amber-50 dark:bg-amber-900/20', borderColor: 'border-amber-200 dark:border-amber-800', icon: Banknote },
  { value: 50, label: '50', color: 'from-rose-500 to-pink-600', bgColor: 'bg-rose-50 dark:bg-rose-900/20', borderColor: 'border-rose-200 dark:border-rose-800', icon: Banknote },
  { value: 40, label: '40', color: 'from-teal-500 to-emerald-600', bgColor: 'bg-teal-50 dark:bg-teal-900/20', borderColor: 'border-teal-200 dark:border-teal-800', icon: Banknote },
  { value: 20, label: '20', color: 'from-cyan-500 to-sky-600', bgColor: 'bg-cyan-50 dark:bg-cyan-900/20', borderColor: 'border-cyan-200 dark:border-cyan-800', icon: Coins },
  { value: 10, label: '10', color: 'from-slate-500 to-zinc-600', bgColor: 'bg-slate-50 dark:bg-slate-900/20', borderColor: 'border-slate-200 dark:border-slate-700', icon: Coins },
  { value: 5, label: '5', color: 'from-yellow-500 to-amber-600', bgColor: 'bg-yellow-50 dark:bg-yellow-900/20', borderColor: 'border-yellow-200 dark:border-yellow-800', icon: Coins },
  { value: 1, label: '1', color: 'from-stone-400 to-stone-500', bgColor: 'bg-stone-50 dark:bg-stone-900/20', borderColor: 'border-stone-200 dark:border-stone-700', icon: Coins },
];

type DenomsState = Record<number, number>;

export function ShiftEditForm({ shift, onSuccess, onCancel }: ShiftEditFormProps) {
  const [openingCash, setOpeningCash] = useState(String(shift.opening_cash));
  const [startedAt, setStartedAt] = useState(unixToDatetimeLocal(shift.started_at));
  const [actualClosingCash, setActualClosingCash] = useState(
    shift.actual_closing_cash !== null ? String(shift.actual_closing_cash) : ''
  );
  const [endedAt, setEndedAt] = useState(
    shift.ended_at !== null ? unixToDatetimeLocal(shift.ended_at) : ''
  );
  const [cashExpenses, setCashExpenses] = useState(
    shift.cash_expenses !== undefined ? String(shift.cash_expenses) : ''
  );
  const [openingDenoms, setOpeningDenoms] = useState<DenomsState>(() => ({
    1: shift.opening_denom_1 ?? 0,
    5: shift.opening_denom_5 ?? 0,
    10: shift.opening_denom_10 ?? 0,
    20: shift.opening_denom_20 ?? 0,
    40: shift.opening_denom_40 ?? 0,
    50: shift.opening_denom_50 ?? 0,
    100: shift.opening_denom_100 ?? 0,
    200: shift.opening_denom_200 ?? 0,
    500: shift.opening_denom_500 ?? 0,
    1000: shift.opening_denom_1000 ?? 0,
  }));
  const [closingDenoms, setClosingDenoms] = useState<DenomsState>(() => ({
    1: shift.closing_denom_1 ?? 0,
    5: shift.closing_denom_5 ?? 0,
    10: shift.closing_denom_10 ?? 0,
    20: shift.closing_denom_20 ?? 0,
    40: shift.closing_denom_40 ?? 0,
    50: shift.closing_denom_50 ?? 0,
    100: shift.closing_denom_100 ?? 0,
    200: shift.closing_denom_200 ?? 0,
    500: shift.closing_denom_500 ?? 0,
    1000: shift.closing_denom_1000 ?? 0,
  }));
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showOpeningDenoms, setShowOpeningDenoms] = useState(false);
  const [showClosingDenoms, setShowClosingDenoms] = useState(false);

  const isClosed = shift.status === 'closed';

  const openingTotal = DENOMINATIONS.reduce(
    (sum, d) => sum + d.value * (openingDenoms[d.value] || 0),
    0
  );
  const closingTotal = DENOMINATIONS.reduce(
    (sum, d) => sum + d.value * (closingDenoms[d.value] || 0),
    0
  );

  const updateOpeningDenom = (value: number, count: number) => {
    setOpeningDenoms((prev) => {
      const next = { ...prev, [value]: Math.max(0, count) };
      const total = DENOMINATIONS.reduce(
        (sum, d) => sum + d.value * (next[d.value] || 0),
        0
      );
      setOpeningCash(String(total));
      return next;
    });
  };

  const updateClosingDenom = (value: number, count: number) => {
    setClosingDenoms((prev) => {
      const next = { ...prev, [value]: Math.max(0, count) };
      const total = DENOMINATIONS.reduce(
        (sum, d) => sum + d.value * (next[d.value] || 0),
        0
      );
      setActualClosingCash(String(total));
      return next;
    });
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const openingCashNum = parseFloat(openingCash);
    if (isNaN(openingCashNum) || openingCashNum < 0) {
      setError('Opening cash must be a valid non-negative number.');
      setIsSubmitting(false);
      return;
    }

    const startedAtUnix = datetimeLocalToUnix(startedAt);
    if (isNaN(startedAtUnix) || startedAtUnix <= 0) {
      setError('Started at must be a valid date and time.');
      setIsSubmitting(false);
      return;
    }

    if (isClosed) {
      if (actualClosingCash !== '') {
        const actualNum = parseFloat(actualClosingCash);
        if (isNaN(actualNum) || actualNum < 0) {
          setError('Actual closing cash must be a valid non-negative number.');
          setIsSubmitting(false);
          return;
        }
      }
      if (endedAt !== '') {
        const endedAtUnix = datetimeLocalToUnix(endedAt);
        if (isNaN(endedAtUnix) || endedAtUnix <= 0) {
          setError('Ended at must be a valid date and time.');
          setIsSubmitting(false);
          return;
        }
      }

      if (cashExpenses !== '') {
        const cashExpNum = parseFloat(cashExpenses);
        if (isNaN(cashExpNum) || cashExpNum < 0) {
          setError('Cash expenses must be a valid non-negative number.');
          setIsSubmitting(false);
          return;
        }
      }
    }

    try {
      const body: {
        openingCash: number;
        startedAt: number;
        actualClosingCash?: number;
        endedAt?: number;
        cashExpenses?: number;
        openingDenominations?: Record<string, number>;
        closingDenominations?: Record<string, number>;
      } = {
        openingCash: openingCashNum,
        startedAt: startedAtUnix,
      };

      // Opening denominations (all shifts)
      body.openingDenominations = {
        denom_1: openingDenoms[1] || 0,
        denom_5: openingDenoms[5] || 0,
        denom_10: openingDenoms[10] || 0,
        denom_20: openingDenoms[20] || 0,
        denom_40: openingDenoms[40] || 0,
        denom_50: openingDenoms[50] || 0,
        denom_100: openingDenoms[100] || 0,
        denom_200: openingDenoms[200] || 0,
        denom_500: openingDenoms[500] || 0,
        denom_1000: openingDenoms[1000] || 0,
      };

      if (isClosed) {
        if (actualClosingCash !== '') body.actualClosingCash = parseFloat(actualClosingCash);
        if (endedAt !== '') body.endedAt = datetimeLocalToUnix(endedAt);
        if (cashExpenses !== '') body.cashExpenses = parseFloat(cashExpenses);
        body.closingDenominations = {
          denom_1: closingDenoms[1] || 0,
          denom_5: closingDenoms[5] || 0,
          denom_10: closingDenoms[10] || 0,
          denom_20: closingDenoms[20] || 0,
          denom_40: closingDenoms[40] || 0,
          denom_50: closingDenoms[50] || 0,
          denom_100: closingDenoms[100] || 0,
          denom_200: closingDenoms[200] || 0,
          denom_500: closingDenoms[500] || 0,
          denom_1000: closingDenoms[1000] || 0,
        };
      }

      const result = await apiPatch(`/api/shifts/${shift.id}`, body);

      if (result.success) {
        onSuccess?.();
      } else {
        setError(result.message || 'Failed to update shift');
      }
    } catch (err) {
      console.error('Shift edit error:', err);
      setError('Failed to update shift');
    } finally {
      setIsSubmitting(false);
    }
  }

  // Denomination input component
  const DenominationInput = ({ 
    denom, 
    value, 
    onChange 
  }: { 
    denom: typeof DENOMINATIONS[0]; 
    value: number; 
    onChange: (count: number) => void;
  }) => {
    const Icon = denom.icon;
    const subtotal = value * denom.value;
    
    return (
      <div className={`group relative overflow-hidden rounded-xl border-2 ${denom.borderColor} ${denom.bgColor} p-3 transition-all hover:shadow-md hover:scale-[1.02]`}>
        {/* Gradient accent line */}
        <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${denom.color}`} />
        
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${denom.color} flex items-center justify-center shadow-sm`}>
              <Icon className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">
              KES {denom.label}
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onChange(Math.max(0, value - 1))}
              className="w-7 h-7 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors font-bold text-sm"
            >
              −
            </button>
            <Input
              type="number"
              min="0"
              value={value || ''}
              onChange={(e) => onChange(parseInt(e.target.value || '0', 10) || 0)}
              className="w-14 h-8 text-center font-bold text-sm border-slate-200 dark:border-slate-700"
              placeholder="0"
            />
            <button
              type="button"
              onClick={() => onChange(value + 1)}
              className="w-7 h-7 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors font-bold text-sm"
            >
              +
            </button>
          </div>
        </div>
        
        {subtotal > 0 && (
          <div className="mt-2 pt-2 border-t border-slate-200/50 dark:border-slate-700/50 flex items-center justify-between">
            <span className="text-xs text-slate-500 dark:text-slate-400">Subtotal</span>
            <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
              {formatPrice(subtotal)}
            </span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6 max-h-[80vh] overflow-y-auto pr-2">
      {/* Header Card */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-6 text-white shadow-xl">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2" />
        
        <div className="relative">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Edit Shift</h2>
              <p className="text-white/80 text-sm">
                {isClosed ? 'Closed shift' : 'Active shift'} details
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 text-white/90 text-sm">
            <Sparkles className="w-4 h-4" />
            <span>Update cash amounts, denominations & timestamps</span>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Opening Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-sm">
              <Wallet className="w-4 h-4 text-white" />
            </div>
            <h3 className="font-bold text-slate-900 dark:text-white">Opening Balance</h3>
          </div>
          
          {/* Opening Cash Display */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border-2 border-emerald-200 dark:border-emerald-800 p-5">
            <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-500/10 rounded-full -translate-y-1/2 translate-x-1/2" />
            
            <Label htmlFor="opening_cash" className="text-sm text-emerald-700 dark:text-emerald-300 font-medium flex items-center gap-2 mb-2">
              <Banknote className="w-4 h-4" />
              Total Opening Cash
            </Label>
            <div className="flex items-baseline gap-2">
              <span className="text-sm text-emerald-600 dark:text-emerald-400">KES</span>
              <Input
                id="opening_cash"
                type="number"
                min="0"
                step="1"
                value={openingCash}
                onChange={(e) => setOpeningCash(e.target.value)}
                className="text-3xl font-black text-emerald-700 dark:text-emerald-300 bg-transparent border-none shadow-none p-0 h-auto focus-visible:ring-0 w-full"
                placeholder="0"
              />
            </div>
          </div>

          {/* Opening Denominations Toggle */}
          <button
            type="button"
            onClick={() => setShowOpeningDenoms(!showOpeningDenoms)}
            className="w-full flex items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Coins className="w-5 h-5 text-slate-600 dark:text-slate-300" />
              </div>
              <div className="text-left">
                <span className="font-semibold text-slate-800 dark:text-slate-200 block">
                  Opening Denominations
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Total: {formatPrice(openingTotal)}
                </span>
              </div>
            </div>
            {showOpeningDenoms ? (
              <ChevronUp className="w-5 h-5 text-slate-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-slate-400" />
            )}
          </button>

          {/* Opening Denominations Grid */}
          {showOpeningDenoms && (
            <div className="grid grid-cols-1 gap-2 animate-in slide-in-from-top-2 duration-200">
              {DENOMINATIONS.map((denom) => (
                <DenominationInput
                  key={`opening-${denom.value}`}
                  denom={denom}
                  value={openingDenoms[denom.value] || 0}
                  onChange={(count) => updateOpeningDenom(denom.value, count)}
                />
              ))}
            </div>
          )}

          {/* Started At */}
          <div className="space-y-2">
            <Label htmlFor="started_at" className="text-sm font-medium flex items-center gap-2 text-slate-700 dark:text-slate-300">
              <Calendar className="w-4 h-4" />
              Started at
            </Label>
            <Input
              id="started_at"
              type="datetime-local"
              value={startedAt}
              onChange={(e) => setStartedAt(e.target.value)}
              className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
            />
          </div>
        </div>

        {/* Closing Section (only for closed shifts) */}
        {isClosed && (
          <>
            <Separator className="my-6" />
            
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center shadow-sm">
                  <Receipt className="w-4 h-4 text-white" />
                </div>
                <h3 className="font-bold text-slate-900 dark:text-white">Closing Balance</h3>
              </div>
              
              {/* Closing Cash Display */}
              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-rose-50 to-pink-50 dark:from-rose-900/20 dark:to-pink-900/20 border-2 border-rose-200 dark:border-rose-800 p-5">
                <div className="absolute top-0 right-0 w-20 h-20 bg-rose-500/10 rounded-full -translate-y-1/2 translate-x-1/2" />
                
                <Label htmlFor="actual_closing_cash" className="text-sm text-rose-700 dark:text-rose-300 font-medium flex items-center gap-2 mb-2">
                  <Banknote className="w-4 h-4" />
                  Actual Closing Cash
                </Label>
                <div className="flex items-baseline gap-2">
                  <span className="text-sm text-rose-600 dark:text-rose-400">KES</span>
                  <Input
                    id="actual_closing_cash"
                    type="number"
                    min="0"
                    step="1"
                    value={actualClosingCash}
                    onChange={(e) => setActualClosingCash(e.target.value)}
                    className="text-3xl font-black text-rose-700 dark:text-rose-300 bg-transparent border-none shadow-none p-0 h-auto focus-visible:ring-0 w-full"
                    placeholder="0"
                  />
                </div>
              </div>

              {/* Cash Expenses */}
              <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border border-amber-200 dark:border-amber-800 p-4">
                <Label htmlFor="cash_expenses" className="text-sm text-amber-700 dark:text-amber-300 font-medium flex items-center gap-2 mb-2">
                  <ArrowRight className="w-4 h-4" />
                  Cash Expenses During Shift
                </Label>
                <Input
                  id="cash_expenses"
                  type="number"
                  min="0"
                  step="1"
                  value={cashExpenses}
                  onChange={(e) => setCashExpenses(e.target.value)}
                  className="bg-white/50 dark:bg-slate-800/50 border-amber-200 dark:border-amber-700"
                  placeholder="0"
                />
              </div>

              {/* Closing Denominations Toggle */}
              <button
                type="button"
                onClick={() => setShowClosingDenoms(!showClosingDenoms)}
                className="w-full flex items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-200 to-pink-300 dark:from-rose-700 dark:to-pink-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Coins className="w-5 h-5 text-rose-600 dark:text-rose-200" />
                  </div>
                  <div className="text-left">
                    <span className="font-semibold text-slate-800 dark:text-slate-200 block">
                      Closing Denominations
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      Total: {formatPrice(closingTotal)}
                    </span>
                  </div>
                </div>
                {showClosingDenoms ? (
                  <ChevronUp className="w-5 h-5 text-slate-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-slate-400" />
                )}
              </button>

              {/* Closing Denominations Grid */}
              {showClosingDenoms && (
                <div className="grid grid-cols-1 gap-2 animate-in slide-in-from-top-2 duration-200">
                  {DENOMINATIONS.map((denom) => (
                    <DenominationInput
                      key={`closing-${denom.value}`}
                      denom={denom}
                      value={closingDenoms[denom.value] || 0}
                      onChange={(count) => updateClosingDenom(denom.value, count)}
                    />
                  ))}
                </div>
              )}

              {/* Ended At */}
              <div className="space-y-2">
                <Label htmlFor="ended_at" className="text-sm font-medium flex items-center gap-2 text-slate-700 dark:text-slate-300">
                  <Calendar className="w-4 h-4" />
                  Ended at
                </Label>
                <Input
                  id="ended_at"
                  type="datetime-local"
                  value={endedAt}
                  onChange={(e) => setEndedAt(e.target.value)}
                  className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                />
              </div>
            </div>
          </>
        )}

        {/* Error Message */}
        {error && (
          <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4 sticky bottom-0 bg-white dark:bg-slate-900 py-4 -mx-2 px-2">
          {onCancel && (
            <Button 
              type="button" 
              variant="outline" 
              onClick={onCancel} 
              disabled={isSubmitting}
              className="flex-1 h-12 border-2"
            >
              Cancel
            </Button>
          )}
          <Button 
            type="submit" 
            disabled={isSubmitting}
            className="flex-1 h-12 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-semibold shadow-lg shadow-indigo-500/25"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <CheckCircle2 className="mr-2 h-5 w-5" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
