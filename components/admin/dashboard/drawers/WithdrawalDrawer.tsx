"use client";

import { useState } from "react";
import { Loader2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";

interface WithdrawalDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isMobile: boolean;
}

function WithdrawalForm({ onSuccess }: { onSuccess: () => void }) {
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      setError("Please enter a valid amount");
      return;
    }

    setSubmitting(true);
    try {
      const today = new Date().toISOString().split("T")[0];
      const response = await fetch("/api/expenses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: reason || "Cash Withdrawal",
          category: "variable",
          amount: numericAmount,
          frequency: "one-time",
          startDate: today,
          notes: reason || "Cash taken from drawer",
        }),
      });

      const result = await response.json();
      if (result.success) {
        setAmount("");
        setReason("");
        onSuccess();
      } else {
        setError(result.message || "Failed to record withdrawal");
      }
    } catch (err) {
      console.error("Error recording withdrawal:", err);
      setError("An error occurred. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label className="text-sm font-medium text-slate-700 dark:text-slate-200">
          Amount to Withdraw (KES)
        </Label>
        <Input
          type="number"
          min="0"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="e.g., 5000"
          className="h-11"
          required
        />
      </div>
      <div className="space-y-2">
        <Label className="text-sm font-medium text-slate-700 dark:text-slate-200">
          Reason / Notes (optional)
        </Label>
        <Input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g., Owner withdrawal, petty cash, etc."
          className="h-11"
        />
        <p className="text-xs text-slate-500 dark:text-slate-400">
          This will be recorded as a one-time variable expense and deducted from
          the expected cash in drawer.
        </p>
      </div>
      {error && (
        <div className="p-3 text-sm rounded-md bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </div>
      )}
      <Button
        type="submit"
        className="w-full bg-[#1c6a1e] hover:bg-[#1a7a69] text-white font-semibold"
        disabled={submitting}
      >
        {submitting ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Recording...
          </>
        ) : (
          <>Record Withdrawal</>
        )}
      </Button>
    </form>
  );
}

export function WithdrawalDrawer({
  open,
  onOpenChange,
  isMobile,
}: WithdrawalDrawerProps) {
  return (
    <Drawer open={open && !isMobile} onOpenChange={onOpenChange} direction="right">
      <DrawerContent className="!w-full sm:!w-[420px] md:!w-[460px] !max-w-none h-full max-h-screen bg-white dark:bg-slate-900">
        <DrawerHeader className="border-b border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-900/30 flex items-center justify-center flex-shrink-0">
              <Wallet className="w-5 h-5 text-rose-500 dark:text-rose-400" />
            </div>
            <div>
              <DrawerTitle className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
                Record Withdrawal
              </DrawerTitle>
              <DrawerDescription className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                Log cash taken from the drawer
              </DrawerDescription>
            </div>
          </div>
        </DrawerHeader>
        <div className="overflow-y-auto flex-1 bg-slate-50/50 dark:bg-slate-950/30 px-4 sm:px-5 py-4">
          <div className="max-w-md mx-auto">
            <WithdrawalForm onSuccess={() => onOpenChange(false)} />
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
