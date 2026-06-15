'use client';

import { ArrowLeft, FileText, Loader2, X, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { CheckoutForm } from '@/components/pos/CheckoutForm';
import { Receipt } from '@/components/pos/Receipt';
import type { ReceiptSettings } from '@/lib/utils/business-settings';

interface ReceiptPayload {
  sale: Parameters<typeof Receipt>[0]['sale'];
  items: Parameters<typeof Receipt>[0]['items'];
  splitPayments?: Parameters<typeof Receipt>[0]['splitPayments'];
  receiptSettings?: ReceiptSettings;
}

interface PosTransactionDrawersProps {
  checkoutDrawerOpen: boolean;
  onCheckoutDrawerOpenChange: (open: boolean) => void;
  receiptDrawerOpen: boolean;
  onReceiptDrawerOpenChange: (open: boolean) => void;
  /** Desktop: cart is a persistent column — back from checkout only closes checkout */
  cartIsColumn?: boolean;
  onOpenCartDrawer?: () => void;
  receiptLoading: boolean;
  receiptError: string | null;
  receiptData: ReceiptPayload | null;
  onSaleComplete: (saleId: string) => void;
  onDirectPrint: () => void;
  onContinueShoppingFromReceipt: () => void;
}

export function PosTransactionDrawers({
  checkoutDrawerOpen,
  onCheckoutDrawerOpenChange,
  receiptDrawerOpen,
  onReceiptDrawerOpenChange,
  cartIsColumn = false,
  onOpenCartDrawer,
  receiptLoading,
  receiptError,
  receiptData,
  onSaleComplete,
  onDirectPrint,
  onContinueShoppingFromReceipt,
}: PosTransactionDrawersProps) {
  const handleBackToCart = () => {
    onCheckoutDrawerOpenChange(false);
    if (!cartIsColumn) {
      onOpenCartDrawer?.();
    }
  };

  return (
    <>
      <Drawer open={checkoutDrawerOpen} onOpenChange={onCheckoutDrawerOpenChange} direction="right">
        <DrawerContent
          className={`!w-full sm:!w-[500px] !max-w-none !h-full max-h-[100dvh] flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-950 print:hidden ${
            cartIsColumn ? 'md:!w-[min(400px,34vw)] md:min-w-[320px] md:max-w-[440px]' : ''
          }`}
        >
          <DrawerHeader className="shrink-0 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleBackToCart}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <DrawerTitle className="text-base font-bold text-slate-900 dark:text-white">
                  Checkout
                </DrawerTitle>
                <DrawerDescription className="sr-only">Complete your purchase</DrawerDescription>
              </div>
              <DrawerClose asChild>
                <button
                  type="button"
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:text-slate-300 dark:hover:bg-slate-800 transition-colors"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </DrawerClose>
            </div>
          </DrawerHeader>
          <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
            <CheckoutForm
              onBackToCart={handleBackToCart}
              onContinueShopping={() => onCheckoutDrawerOpenChange(false)}
              onSaleComplete={onSaleComplete}
            />
          </div>
        </DrawerContent>
      </Drawer>

      <Drawer open={receiptDrawerOpen} onOpenChange={onReceiptDrawerOpenChange} direction="right">
        <DrawerContent className="!w-full sm:!w-[600px] md:!w-[800px] !max-w-none h-full max-h-screen bg-white dark:bg-slate-900">
          <DrawerHeader className="border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-[#1c6a1e]/10 to-blue-50 dark:from-[#1c6a1e]/20 dark:to-blue-950/20 px-4 sm:px-6 py-4 sm:py-5 print:hidden">
            <div className="flex items-center justify-between pr-8">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-none bg-gradient-to-br from-[#1c6a1e] to-[#2a8a30] flex items-center justify-center shadow-sm flex-shrink-0">
                  <FileText className="w-5 h-5 text-white" />
                </div>
                <div>
                  <DrawerTitle className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
                    Receipt
                  </DrawerTitle>
                  <DrawerDescription className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                    Sale completed successfully
                  </DrawerDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {receiptData && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onDirectPrint}
                    className="hidden sm:flex"
                  >
                    Print
                  </Button>
                )}
                <DrawerClose asChild>
                  <button
                    type="button"
                    className="w-10 h-10 flex items-center justify-center rounded-none bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white active:scale-95 transition-all shadow-sm"
                    aria-label="Close drawer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </DrawerClose>
              </div>
            </div>
          </DrawerHeader>
          <div className="overflow-y-auto flex-1 bg-gradient-to-b from-white via-slate-50/30 to-white dark:from-slate-900 dark:via-slate-900/50 dark:to-slate-900 px-4 sm:px-6 py-6 print:bg-white print:p-0">
            {receiptLoading ? (
              <div className="flex flex-col items-center justify-center h-64 gap-4">
                <Loader2 className="w-8 h-8 animate-spin text-[#1c6a1e]" />
                <p className="text-gray-500 dark:text-gray-400">Loading receipt...</p>
              </div>
            ) : receiptError || !receiptData ? (
              <div className="flex flex-col items-center justify-center h-64 gap-4">
                <XCircle className="w-16 h-16 text-red-300 dark:text-red-600" />
                <p className="text-gray-500 dark:text-gray-400 text-center">
                  {receiptError || 'Receipt not found'}
                </p>
                <Button
                  type="button"
                  onClick={onContinueShoppingFromReceipt}
                  size="touch"
                  className="bg-[#1c6a1e] hover:bg-[#2a8a30] text-white"
                >
                  Close
                </Button>
              </div>
            ) : (
              <div className="print:p-0">
                <Receipt
                  sale={receiptData.sale}
                  items={receiptData.items}
                  splitPayments={receiptData.splitPayments}
                  receiptSettings={receiptData.receiptSettings}
                />
                <div className="mt-6 flex gap-3 print:hidden">
                  <Button
                    type="button"
                    variant="outline"
                    size="touch"
                    onClick={onDirectPrint}
                    className="flex-1 sm:hidden"
                  >
                    Print
                  </Button>
                  <Button
                    type="button"
                    size="touch"
                    onClick={onContinueShoppingFromReceipt}
                    className="flex-1 bg-[#1c6a1e] hover:bg-[#2a8a30] text-white"
                  >
                    New Sale
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
