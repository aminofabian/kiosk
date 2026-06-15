'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  Banknote,
  BarChart3,
  Clock,
  Loader2,
  Receipt,
  Wallet,
} from 'lucide-react';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { ShiftOpenForm } from '@/components/pos/ShiftOpenForm';
import { PosShiftCloseContent } from '@/components/pos/PosShiftCloseContent';
import { PosExpenseForm } from '@/components/pos/PosExpenseForm';
import { PosShiftSummaryPanel } from '@/components/pos/PosShiftSummaryPanel';
import { useCurrentShift } from '@/lib/hooks/use-current-shift';

export type CashierDrawer = 'open' | 'close' | 'expense' | 'summary' | null;

interface PosCashierOpsContextValue {
  shift: ReturnType<typeof useCurrentShift>['shift'];
  pendingOpening: ReturnType<typeof useCurrentShift>['pendingOpening'];
  loading: boolean;
  hasOpenShift: boolean;
  refreshShift: () => Promise<void>;
  activeDrawer: CashierDrawer;
  openDrawer: (drawer: Exclude<CashierDrawer, null>) => void;
  closeDrawer: () => void;
}

const PosCashierOpsContext = createContext<PosCashierOpsContextValue | null>(null);

export function usePosCashierOps() {
  const ctx = useContext(PosCashierOpsContext);
  if (!ctx) {
    throw new Error('usePosCashierOps must be used within PosCashierOperationsProvider');
  }
  return ctx;
}

export function PosCashierOperationsProvider({ children }: { children: ReactNode }) {
  const { shift, pendingOpening, loading, hasOpenShift, refresh } = useCurrentShift();
  const [activeDrawer, setActiveDrawer] = useState<CashierDrawer>(null);

  const openDrawer = useCallback((drawer: Exclude<CashierDrawer, null>) => {
    setActiveDrawer(drawer);
  }, []);

  const closeDrawer = useCallback(() => {
    setActiveDrawer(null);
  }, []);

  const handleShiftMutationSuccess = useCallback(async () => {
    await refresh();
    closeDrawer();
  }, [refresh, closeDrawer]);

  const value = useMemo(
    () => ({
      shift,
      pendingOpening,
      loading,
      hasOpenShift,
      refreshShift: refresh,
      activeDrawer,
      openDrawer,
      closeDrawer,
    }),
    [shift, pendingOpening, loading, hasOpenShift, refresh, activeDrawer, openDrawer, closeDrawer]
  );

  return (
    <PosCashierOpsContext.Provider value={value}>
      {children}
      <PosCashierDrawers onShiftSuccess={handleShiftMutationSuccess} />
    </PosCashierOpsContext.Provider>
  );
}

function PosCashierDrawers({ onShiftSuccess }: { onShiftSuccess: () => void }) {
  const { activeDrawer, closeDrawer, shift, openDrawer } = usePosCashierOps();

  return (
    <>
      <Drawer open={activeDrawer === 'open'} onOpenChange={(o) => !o && closeDrawer()} direction="right">
        <DrawerContent className="!w-full sm:!w-[480px] md:!w-[520px] !max-w-none h-full max-h-screen bg-white dark:bg-slate-900">
          <DrawerHeader className="border-b border-slate-200/80 dark:border-slate-800/80 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#1c6a1e]/10 flex items-center justify-center shrink-0">
                <Banknote className="w-5 h-5 text-[#1c6a1e]" />
              </div>
              <div>
                <DrawerTitle className="text-lg font-bold">Open Shift</DrawerTitle>
                <DrawerDescription>Count opening cash in the register</DrawerDescription>
              </div>
            </div>
          </DrawerHeader>
          <div className="overflow-y-auto flex-1 px-4 sm:px-5 py-4 bg-slate-50/50 dark:bg-slate-950/30">
            <ShiftOpenForm
              embedded
              onSuccess={onShiftSuccess}
              onRequestCloseShift={() => {
                closeDrawer();
                openDrawer('close');
              }}
            />
          </div>
        </DrawerContent>
      </Drawer>

      <Drawer open={activeDrawer === 'close'} onOpenChange={(o) => !o && closeDrawer()} direction="right">
        <DrawerContent className="!w-full sm:!w-[520px] md:!w-[600px] !max-w-none h-full max-h-screen bg-white dark:bg-slate-900">
          <DrawerHeader className="border-b border-slate-200/80 dark:border-slate-800/80 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                <Receipt className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <DrawerTitle className="text-lg font-bold">Close Shift</DrawerTitle>
                <DrawerDescription>Count closing cash and reconcile</DrawerDescription>
              </div>
            </div>
          </DrawerHeader>
          <div className="overflow-y-auto flex-1 px-4 sm:px-5 py-4 bg-slate-50/50 dark:bg-slate-950/30">
            <PosShiftCloseContent embedded onSuccess={onShiftSuccess} />
          </div>
        </DrawerContent>
      </Drawer>

      <Drawer open={activeDrawer === 'expense'} onOpenChange={(o) => !o && closeDrawer()} direction="right">
        <DrawerContent className="!w-full sm:!w-[420px] !max-w-none h-full max-h-screen bg-white dark:bg-slate-900">
          <DrawerHeader className="border-b border-slate-200/80 dark:border-slate-800/80 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-900/30 flex items-center justify-center shrink-0">
                <Wallet className="w-5 h-5 text-rose-500" />
              </div>
              <div>
                <DrawerTitle className="text-lg font-bold">Record Expense</DrawerTitle>
                <DrawerDescription>Cash taken from the drawer</DrawerDescription>
              </div>
            </div>
          </DrawerHeader>
          <div className="overflow-y-auto flex-1 px-4 sm:px-5 py-4">
            <PosExpenseForm compact onSuccess={closeDrawer} />
          </div>
        </DrawerContent>
      </Drawer>

      <Drawer open={activeDrawer === 'summary'} onOpenChange={(o) => !o && closeDrawer()} direction="right">
        <DrawerContent className="!w-full sm:!w-[440px] !max-w-none h-full max-h-screen bg-white dark:bg-slate-900">
          <DrawerHeader className="border-b border-slate-200/80 dark:border-slate-800/80 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-violet-50 dark:bg-violet-900/30 flex items-center justify-center shrink-0">
                <BarChart3 className="w-5 h-5 text-violet-600" />
              </div>
              <div>
                <DrawerTitle className="text-lg font-bold">Shift Summary</DrawerTitle>
                <DrawerDescription>Today&apos;s activity on this register</DrawerDescription>
              </div>
            </div>
          </DrawerHeader>
          <div className="overflow-y-auto flex-1 px-4 sm:px-5 py-4">
            {shift ? (
              <PosShiftSummaryPanel shift={shift} />
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                Open a shift to view summary.
              </p>
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}

interface PosShiftStatusBarProps {
  variant?: 'desktop' | 'mobile';
  /** bar = full-width row; inline = compact chip beside search */
  layout?: 'bar' | 'inline';
  className?: string;
}

export function PosShiftStatusBar({
  variant = 'desktop',
  layout = 'bar',
  className = '',
}: PosShiftStatusBarProps) {
  const { shift, pendingOpening, loading, hasOpenShift, openDrawer } = usePosCashierOps();
  const inline = layout === 'inline';
  const compact = variant === 'mobile';

  if (loading) {
    if (inline) {
      return (
        <div
          className={`flex items-center justify-center shrink-0 h-11 w-11 rounded-xl border border-slate-200/80 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-900/40 ${className}`}
        >
          <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
        </div>
      );
    }
    return (
      <div
        className={`flex items-center justify-center gap-2 border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/40 ${
          variant === 'mobile' ? 'px-3 py-2' : 'px-4 py-2'
        } ${className}`}
      >
        <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
        <span className="text-xs text-slate-500">Checking shift...</span>
      </div>
    );
  }

  const pendingCount = pendingOpening.length;

  if (!hasOpenShift) {
    if (inline) {
      return (
        <div
          className={`flex items-center gap-1.5 shrink-0 h-11 md:h-12 rounded-xl border px-2 ${
            pendingCount > 0
              ? 'border-amber-300/80 bg-amber-50/95 dark:bg-amber-950/40 dark:border-amber-800/50'
              : 'border-amber-200/80 bg-amber-50/90 dark:bg-amber-950/30 dark:border-amber-900/50'
          } ${className}`}
        >
          <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
          <span className="text-[11px] font-medium text-amber-900 dark:text-amber-100 truncate max-w-[4.5rem] lg:max-w-[8rem] hidden sm:inline">
            {pendingCount > 0 ? `Pending (${pendingCount})` : 'No shift'}
          </span>
          <Button
            size="sm"
            className="h-8 px-2.5 bg-[#1c6a1e] hover:bg-[#155a17] text-white text-xs font-semibold shrink-0"
            onClick={() => openDrawer('open')}
          >
            <Banknote className="w-3.5 h-3.5 sm:mr-1" />
            <span className="hidden md:inline">Open</span>
          </Button>
        </div>
      );
    }
    return (
      <div
        className={`flex items-center gap-2 border-b ${
          pendingCount > 0
            ? 'border-amber-200/80 bg-amber-50/90 dark:bg-amber-950/30 dark:border-amber-900/50'
            : 'border-amber-200/80 bg-amber-50/80 dark:bg-amber-950/20 dark:border-amber-900/40'
        } ${variant === 'mobile' ? 'px-3 py-2.5' : 'px-4 py-2.5'} ${className}`}
      >
        <Clock className="w-4 h-4 text-amber-600 shrink-0" />
        <p className={`flex-1 min-w-0 font-medium text-amber-900 dark:text-amber-100 ${compact ? 'text-xs' : 'text-sm'}`}>
          {pendingCount > 0
            ? `Opening pending approval (${pendingCount})`
            : 'No active shift — open before selling'}
        </p>
        <Button
          size="sm"
          className="h-9 bg-[#1c6a1e] hover:bg-[#155a17] text-white font-semibold shrink-0"
          onClick={() => openDrawer('open')}
        >
          <Banknote className="w-4 h-4 mr-1.5" />
          {compact ? 'Open' : 'Open Shift'}
        </Button>
      </div>
    );
  }

  const startedLabel = new Date(shift!.started_at * 1000).toLocaleTimeString('en-KE', {
    hour: '2-digit',
    minute: '2-digit',
  });

  if (inline) {
    return (
      <div
        className={`flex items-center gap-1 shrink-0 h-11 md:h-12 rounded-xl border border-[#1c6a1e]/20 bg-[#1c6a1e]/5 dark:bg-[#1c6a1e]/10 px-1.5 ${className}`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
        <span className="text-[11px] font-semibold text-[#1c6a1e] tabular-nums hidden sm:inline whitespace-nowrap">
          {startedLabel}
        </span>
        <Button
          variant="outline"
          size="sm"
          className="h-8 w-8 p-0 border-[#1c6a1e]/25"
          onClick={() => openDrawer('summary')}
          title="Shift summary"
        >
          <BarChart3 className="w-3.5 h-3.5" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-8 w-8 p-0 border-[#1c6a1e]/25"
          onClick={() => openDrawer('expense')}
          title="Record expense"
        >
          <Wallet className="w-3.5 h-3.5" />
        </Button>
        <Button
          size="sm"
          className="h-8 w-8 p-0 bg-amber-600 hover:bg-amber-700 text-white"
          onClick={() => openDrawer('close')}
          title="Close shift"
        >
          <Receipt className="w-3.5 h-3.5" />
        </Button>
      </div>
    );
  }

  return (
    <div
      className={`flex items-center gap-2 border-b border-[#1c6a1e]/15 bg-[#1c6a1e]/5 dark:bg-[#1c6a1e]/10 ${
        variant === 'mobile' ? 'px-3 py-2 flex-wrap' : 'px-4 py-2'
      } ${className}`}
    >
      <div className={`flex items-center gap-2 min-w-0 ${compact ? 'w-full sm:w-auto flex-1' : 'flex-1'}`}>
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
        <p className={`font-semibold text-[#1c6a1e] truncate ${compact ? 'text-xs' : 'text-sm'}`}>
          Shift open · {startedLabel}
        </p>
        {!compact && (
          <span className="text-xs text-slate-500 tabular-nums hidden md:inline">
            Float {`KES ${shift!.opening_cash.toLocaleString()}`}
          </span>
        )}
      </div>
      <div className={`flex items-center gap-1.5 shrink-0 ${compact ? 'w-full justify-end' : ''}`}>
        <Button
          variant="outline"
          size="sm"
          className="h-9"
          onClick={() => openDrawer('summary')}
        >
          <BarChart3 className="w-4 h-4 sm:mr-1.5" />
          <span className="hidden sm:inline">{compact ? 'Summary' : 'Shift Summary'}</span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-9"
          onClick={() => openDrawer('expense')}
        >
          <Wallet className="w-4 h-4 sm:mr-1.5" />
          <span className="hidden sm:inline">Expense</span>
        </Button>
        <Button
          size="sm"
          className="h-9 bg-amber-600 hover:bg-amber-700 text-white font-semibold"
          onClick={() => openDrawer('close')}
        >
          <Receipt className="w-4 h-4 sm:mr-1.5" />
          <span className="hidden sm:inline">{compact ? 'Close' : 'Close Shift'}</span>
        </Button>
      </div>
    </div>
  );
}
