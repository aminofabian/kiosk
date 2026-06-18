"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  ACTION_BUTTONS,
  SECTION_ORDER,
  SECTION_LABELS,
  type ActionButton,
  type ActionSection,
} from "@/components/admin/dashboard/constants";

interface SectionGroup {
  section: ActionSection;
  label: string;
  buttons: ActionButton[];
}

export function useDashboardActions(
  role: string | undefined,
  isMobile: boolean,
  setCategoryDrawerOpen: (open: boolean) => void,
  setItemDrawerOpen: (open: boolean) => void,
  setStockAdjustDrawerOpen: (open: boolean) => void,
  setStockTakeDrawerOpen: (open: boolean) => void,
  setOpenShiftDrawerOpen: (open: boolean) => void,
  setCloseShiftDrawerOpen: (open: boolean) => void,
  setBalanceApprovalsDrawerOpen: (open: boolean) => void,
  setWithdrawalDrawerOpen: (open: boolean) => void,
  setItemsDrawerOpen: (open: boolean) => void,
): SectionGroup[] {
  const router = useRouter();

  return useMemo(() => {
    const visibleButtons = ACTION_BUTTONS.filter((button) => {
      if (button.roles) {
        return role && button.roles.includes(role);
      }

      if (role === "cashier") {
        const allowedCashierButtons = [
          "Open Shift",
          "Close Shift",
          "Create Category",
          "Add Item",
          "Add Stock",
          "View Items",
          "View Categories",
          "View Credits",
          "Record Expenses",
          "Record Supplier Bill",
        ];
        return allowedCashierButtons.includes(button.label);
      }

      return true;
    }).map((button) => {
      const base = { ...button };

      switch (button.label) {
        case "Create Category":
          base.onClick = () => {
            if (isMobile) {
              router.push("/admin/categories?new=true");
            } else {
              setCategoryDrawerOpen(true);
            }
          };
          break;
        case "Add Item":
          base.onClick = () => {
            if (isMobile) {
              router.push("/admin/items/new");
            } else {
              setItemDrawerOpen(true);
            }
          };
          break;
        case "Add Stock":
          base.onClick = () => {
            if (isMobile) {
              router.push("/admin/stock/adjust");
            } else {
              setStockAdjustDrawerOpen(true);
            }
          };
          break;
        case "Stock Take":
          base.onClick = () => {
            if (isMobile) {
              router.push("/admin/stock/take");
            } else {
              setStockTakeDrawerOpen(true);
            }
          };
          break;
        case "Open Shift":
          base.onClick = () => {
            if (isMobile) {
              router.push("/pos/shift/open");
            } else {
              setOpenShiftDrawerOpen(true);
            }
          };
          break;
        case "Close Shift":
          base.onClick = () => {
            if (isMobile) {
              router.push("/pos/shift/close");
            } else {
              setCloseShiftDrawerOpen(true);
            }
          };
          break;
        case "Balance Approvals":
          base.onClick = () => {
            if (isMobile) {
              router.push("/admin/balance/approvals");
            } else {
              setBalanceApprovalsDrawerOpen(true);
            }
          };
          break;
        case "View Items":
          base.href = isMobile ? "/admin/items" : undefined;
          base.onClick = () => {
            if (isMobile) {
              router.push("/admin/items");
            } else {
              setItemsDrawerOpen(true);
            }
          };
          break;
        case "Record Supplier Bill":
          base.onClick = () => {
            if (isMobile) {
              router.push("/admin/supplier-bills/new");
            } else {
              router.push("/admin/supplier-bills?new=true");
            }
          };
          break;
        case "Record Withdrawal":
          base.onClick = () => {
            if (isMobile) {
              router.push("/admin/expenses");
            } else {
              setWithdrawalDrawerOpen(true);
            }
          };
          break;
        default:
          break;
      }

      return base;
    });

    const buttonsExcludingOpenPos = visibleButtons.filter(
      (b) => b.label !== "Open POS",
    );

    return SECTION_ORDER.map((section) => ({
      section,
      label: SECTION_LABELS[section],
      buttons: buttonsExcludingOpenPos.filter((b) => b.section === section),
    })).filter((s) => s.buttons.length > 0);
  }, [
    role,
    isMobile,
    router,
    setCategoryDrawerOpen,
    setItemDrawerOpen,
    setStockAdjustDrawerOpen,
    setStockTakeDrawerOpen,
    setOpenShiftDrawerOpen,
    setCloseShiftDrawerOpen,
    setBalanceApprovalsDrawerOpen,
    setWithdrawalDrawerOpen,
    setItemsDrawerOpen,
  ]);
}
