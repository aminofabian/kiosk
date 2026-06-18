"use client";

import { Bell, BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { NotificationPermissionState } from "@/lib/hooks/use-expiry-notifications";

interface NotificationPromptProps {
  isAdminOrOwner: boolean;
  permission: NotificationPermissionState;
  onRequestPermission: () => void;
}

export function NotificationPrompt({
  isAdminOrOwner,
  permission,
  onRequestPermission,
}: NotificationPromptProps) {
  if (!isAdminOrOwner || permission !== "default") {
    return null;
  }

  return (
    <div className="w-full rounded-xl border border-slate-200 dark:border-slate-700/60 bg-white dark:bg-[#1c2e18] p-3 sm:p-4">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
          <Bell className="w-4 h-4 text-amber-500 dark:text-amber-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
            Get notified when stock is about to expire
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            Browser notifications for expiring batches
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={onRequestPermission}
          className="shrink-0 text-xs h-8 px-3 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/30"
        >
          <BellRing className="w-3.5 h-3.5 mr-1.5" />
          Enable
        </Button>
      </div>
    </div>
  );
}
