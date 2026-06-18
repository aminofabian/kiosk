"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { AdminLayout } from "@/components/layouts/admin-layout";
import { useCurrentUser } from "@/lib/hooks/use-current-user";
import { useExpiryNotifications } from "@/lib/hooks/use-expiry-notifications";
import { useItemTypes } from "@/lib/hooks/use-item-types";
import { useMobile } from "@/lib/hooks/use-mobile";
import { useDashboardStats } from "@/lib/hooks/use-dashboard-stats";
import { useExpiringBatches } from "@/lib/hooks/use-expiring-batches";
import { useDashboardActions } from "@/lib/hooks/use-dashboard-actions";
import { getShopType } from "@/lib/utils/shop-type";

import { DashboardHeader } from "@/components/admin/dashboard/DashboardHeader";
import { ExpiryWarnings } from "@/components/admin/dashboard/ExpiryWarnings";
import { NotificationPrompt } from "@/components/admin/dashboard/NotificationPrompt";
import { OpenPosCard } from "@/components/admin/dashboard/OpenPosCard";
import { AtAGlanceStats } from "@/components/admin/dashboard/AtAGlanceStats";
import { SalesByType } from "@/components/admin/dashboard/SalesByType";
import { QuickActionsPanel } from "@/components/admin/dashboard/QuickActionsPanel";
import { ShiftActionsBar } from "@/components/admin/dashboard/ShiftActionsBar";
import { ShiftApprovalsCard } from "@/components/admin/dashboard/ShiftApprovalsCard";
import { HelpFooter } from "@/components/admin/dashboard/HelpFooter";
import { MobileActionFAB } from "@/components/admin/dashboard/MobileActionFAB";
import { GuideDrawer } from "@/components/admin/dashboard/GuideDrawer";

import { CategoryDrawer } from "@/components/admin/dashboard/drawers/CategoryDrawer";
import { ItemDrawer } from "@/components/admin/dashboard/drawers/ItemDrawer";
import { StockAdjustDrawer } from "@/components/admin/dashboard/drawers/StockAdjustDrawer";
import { StockTakeDrawer } from "@/components/admin/dashboard/drawers/StockTakeDrawer";
import { ShiftOpenDrawer } from "@/components/admin/dashboard/drawers/ShiftOpenDrawer";
import { ShiftCloseDrawer } from "@/components/admin/dashboard/drawers/ShiftCloseDrawer";
import { BalanceApprovalsDrawer } from "@/components/admin/dashboard/drawers/BalanceApprovalsDrawer";
import { WithdrawalDrawer } from "@/components/admin/dashboard/drawers/WithdrawalDrawer";
import { ItemsDrawer } from "@/components/admin/dashboard/drawers/ItemsDrawer";

export default function AdminDashboardPage() {
  const router = useRouter();
  const { user } = useCurrentUser();
  const isAdminOrOwner = user?.role === "admin" || user?.role === "owner";
  const { permission: notifPermission, requestPermission } =
    useExpiryNotifications(!!isAdminOrOwner);

  const isMobile = useMobile();
  const { itemTypeKeys } = useItemTypes();
  const shopType = useMemo(() => {
    return itemTypeKeys.length > 0 ? getShopType(itemTypeKeys) : getShopType();
  }, [itemTypeKeys]);

  const handleShopTypeChange: (_newShopType: string) => void = () => {
    window.location.reload();
  };

  const [categoryDrawerOpen, setCategoryDrawerOpen] = useState(false);
  const [itemDrawerOpen, setItemDrawerOpen] = useState(false);
  const [stockAdjustDrawerOpen, setStockAdjustDrawerOpen] = useState(false);
  const [stockTakeDrawerOpen, setStockTakeDrawerOpen] = useState(false);
  const [openShiftDrawerOpen, setOpenShiftDrawerOpen] = useState(false);
  const [closeShiftDrawerOpen, setCloseShiftDrawerOpen] = useState(false);
  const [balanceApprovalsDrawerOpen, setBalanceApprovalsDrawerOpen] =
    useState(false);
  const [withdrawalDrawerOpen, setWithdrawalDrawerOpen] = useState(false);
  const [itemsDrawerOpen, setItemsDrawerOpen] = useState(false);
  const [guideDrawerOpen, setGuideDrawerOpen] = useState(false);

  const { stats, salesByItemType, loading: statsLoading, refetch } =
    useDashboardStats(user?.role);
  const expiringBatches = useExpiringBatches(isAdminOrOwner);

  const buttonsBySection = useDashboardActions(
    user?.role,
    isMobile,
    setCategoryDrawerOpen,
    setItemDrawerOpen,
    setStockAdjustDrawerOpen,
    setStockTakeDrawerOpen,
    setOpenShiftDrawerOpen,
    setCloseShiftDrawerOpen,
    setBalanceApprovalsDrawerOpen,
    setWithdrawalDrawerOpen,
    setItemsDrawerOpen,
  );

  return (
    <AdminLayout>
      <div className="min-h-screen bg-slate-50 dark:bg-[#0f1a0d] flex flex-col items-center p-2 sm:p-4 pt-2 sm:pt-4 pb-20 sm:pb-4">
        <div className="w-full max-w-5xl space-y-5 sm:space-y-6">
          <DashboardHeader
            shopType={shopType}
            onShopTypeChange={handleShopTypeChange}
          />

          <OpenPosCard />

          {isAdminOrOwner && (
            <ShiftApprovalsCard
              isAdminOrOwner={isAdminOrOwner}
              onOpen={() => {
                if (isMobile) {
                  router.push("/admin/balance/approvals");
                } else {
                  setBalanceApprovalsDrawerOpen(true);
                }
              }}
            />
          )}

          <ShiftActionsBar
            buttons={
              buttonsBySection.find((g) => g.section === "pos")?.buttons ?? []
            }
          />

          <AtAGlanceStats stats={stats} loading={statsLoading} />

          <SalesByType salesByItemType={salesByItemType} />

          <ExpiryWarnings expiringBatches={expiringBatches} />

          <NotificationPrompt
            isAdminOrOwner={isAdminOrOwner}
            permission={notifPermission}
            onRequestPermission={requestPermission}
          />

          <QuickActionsPanel groups={buttonsBySection} />

          <HelpFooter
            isCashier={user?.role === "cashier"}
            onOpenGuide={() => setGuideDrawerOpen(true)}
          />
        </div>
      </div>

      <CategoryDrawer
        open={categoryDrawerOpen}
        onOpenChange={setCategoryDrawerOpen}
        isMobile={isMobile}
      />
      <ItemDrawer
        open={itemDrawerOpen}
        onOpenChange={setItemDrawerOpen}
        isMobile={isMobile}
      />
      <StockAdjustDrawer
        open={stockAdjustDrawerOpen}
        onOpenChange={setStockAdjustDrawerOpen}
        isMobile={isMobile}
        onSuccess={refetch}
      />
      <StockTakeDrawer
        open={stockTakeDrawerOpen}
        onOpenChange={setStockTakeDrawerOpen}
        isMobile={isMobile}
      />
      <ShiftOpenDrawer
        open={openShiftDrawerOpen}
        onOpenChange={setOpenShiftDrawerOpen}
        isMobile={isMobile}
      />
      <ShiftCloseDrawer
        open={closeShiftDrawerOpen}
        onOpenChange={setCloseShiftDrawerOpen}
        isMobile={isMobile}
      />
      <BalanceApprovalsDrawer
        open={balanceApprovalsDrawerOpen}
        onOpenChange={setBalanceApprovalsDrawerOpen}
        isMobile={isMobile}
      />
      <WithdrawalDrawer
        open={withdrawalDrawerOpen}
        onOpenChange={setWithdrawalDrawerOpen}
        isMobile={isMobile}
      />
      <ItemsDrawer
        open={itemsDrawerOpen}
        onOpenChange={setItemsDrawerOpen}
        isMobile={isMobile}
      />
      <GuideDrawer open={guideDrawerOpen} onOpenChange={setGuideDrawerOpen} />

      <MobileActionFAB
        isMobile={isMobile}
        setStockAdjustDrawerOpen={setStockAdjustDrawerOpen}
      />
    </AdminLayout>
  );
}
