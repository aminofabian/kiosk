"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, Loader2, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { ShiftCloseForm } from "@/components/pos/ShiftCloseForm";
import type { Shift } from "@/lib/db/types";

interface PendingOpeningItem {
  id: string;
  amount: number;
  user_name?: string;
  balance_type: string;
}

interface ShiftCloseDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isMobile: boolean;
}

function CloseShiftDrawerContent() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shift, setShift] = useState<Shift | null>(null);
  const [pendingOpening, setPendingOpening] = useState<PendingOpeningItem[]>([]);
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch("/api/shifts/current?scope=business");
      const result = await response.json();

      if (result.success && result.data) {
        setShift(result.data);
        setPendingOpening([]);
        return;
      }

      setShift(null);
      const approvalsRes = await fetch("/api/balance/approvals?status=pending");
      const approvalsData = await approvalsRes.json();
      if (approvalsData.success && Array.isArray(approvalsData.data)) {
        const opening = approvalsData.data.filter(
          (r: { balance_type: string }) => r.balance_type === "opening",
        );
        setPendingOpening(opening);
      } else {
        setPendingOpening([]);
      }
    } catch (err) {
      setError("Failed to load shift");
      console.error("Error fetching shift:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleWithdraw = async (requestId: string) => {
    try {
      setWithdrawingId(requestId);
      const res = await fetch(`/api/balance/approvals/${requestId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.success) {
        await fetchData();
      } else {
        setError(data.message || "Failed to withdraw");
      }
    } catch (err) {
      setError("Failed to withdraw");
      console.error("Error withdrawing:", err);
    } finally {
      setWithdrawingId(null);
    }
  };

  const handleApprove = async (requestId: string) => {
    try {
      setApprovingId(requestId);
      const res = await fetch(`/api/balance/approvals/${requestId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.success) {
        await fetchData();
      } else {
        setError(data.message || "Failed to approve");
      }
    } catch (err) {
      setError("Failed to approve");
      console.error("Error approving:", err);
    } finally {
      setApprovingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-3">
          <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Loading shift...</p>
        </div>
      </div>
    );
  }

  if (shift) {
    return <ShiftCloseForm shift={shift} />;
  }

  if (pendingOpening.length > 0) {
    const formatPrice = (n: number) => `KES ${n.toLocaleString("en-US")}`;
    return (
      <div className="p-4 space-y-4">
        <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg flex items-start gap-2">
          <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
              No open shift yet
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
              There are pending opening request(s). Approve one to open the
              shift and then close it, or withdraw to cancel.
            </p>
          </div>
        </div>
        <ul className="space-y-2">
          {pendingOpening.map((req) => (
            <li
              key={req.id}
              className="flex items-center justify-between gap-2 p-3 rounded-lg border border-slate-200 dark:border-slate-700"
            >
              <div>
                <span className="font-medium">{formatPrice(req.amount)}</span>
                {req.user_name && (
                  <span className="text-muted-foreground text-sm ml-2">
                    — {req.user_name}
                  </span>
                )}
              </div>
              <div className="flex gap-2 shrink-0">
                <Button
                  size="sm"
                  disabled={approvingId === req.id}
                  onClick={() => handleApprove(req.id)}
                  className="bg-[#1c6a1e] hover:bg-[#1a7a69]"
                >
                  {approvingId === req.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    "Approve & close"
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={withdrawingId === req.id}
                  onClick={() => handleWithdraw(req.id)}
                >
                  {withdrawingId === req.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    "Withdraw"
                  )}
                </Button>
              </div>
            </li>
          ))}
        </ul>
        {error && <p className="text-destructive text-sm">{error}</p>}
        <Button
          onClick={() => router.push("/pos")}
          size="touch"
          variant="secondary"
          className="w-full"
        >
          Go to POS
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-64 space-y-4">
      <p className="text-destructive text-sm">
        {error || "No open shift found"}
      </p>
      <Button onClick={() => router.push("/pos")} size="touch">
        Go to POS
      </Button>
    </div>
  );
}

export function ShiftCloseDrawer({
  open,
  onOpenChange,
  isMobile,
}: ShiftCloseDrawerProps) {
  return (
    <Drawer open={open && !isMobile} onOpenChange={onOpenChange} direction="right">
      <DrawerContent className="!w-full sm:!w-[520px] md:!w-[560px] !max-w-none h-full max-h-screen bg-white dark:bg-slate-900">
        <DrawerHeader className="border-b border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
              <Receipt className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <DrawerTitle className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
                Close Shift
              </DrawerTitle>
              <DrawerDescription className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                Record the closing cash balance
              </DrawerDescription>
            </div>
          </div>
        </DrawerHeader>
        <div className="overflow-y-auto px-4 sm:px-5 py-4 flex-1 bg-slate-50/50 dark:bg-slate-950/30">
          <div className="max-w-2xl mx-auto">
            <CloseShiftDrawerContent />
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
