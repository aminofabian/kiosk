"use client";

import { ReactNode, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useCurrentUser } from "@/lib/hooks/use-current-user";
import { DepartmentAppProvider } from "@/components/department/DepartmentAppProvider";
import { DepartmentBottomNav } from "@/components/department/DepartmentBottomNav";

/** Roles allowed to open the department workspace (staff + oversight). */
function canAccessDepartmentWorkspace(role?: string | null): boolean {
  return (
    role === "department_staff" ||
    role === "department_stock_manager" ||
    role === "owner" ||
    role === "admin" ||
    role === "superadmin"
  );
}

export default function DepartmentLayout({
  children,
}: {
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoading } = useCurrentUser();

  useEffect(() => {
    if (isLoading || !user) return;
    if (!canAccessDepartmentWorkspace(user.role)) {
      router.replace(user.role === "cashier" ? "/pos" : "/admin");
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    if (isLoading || !user) return;
    if (
      user.role === "department_stock_manager" &&
      !pathname.startsWith("/department/count")
    ) {
      router.replace("/department/count");
    }
  }, [user, isLoading, pathname, router]);

  if (isLoading || !user || !canAccessDepartmentWorkspace(user.role)) {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-[#f6f8f6] dark:bg-[#0f1a0d]">
        <div className="w-8 h-8 border-4 border-[#1c6a1e]/20 border-t-[#1c6a1e] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <DepartmentAppProvider>
      <div className="h-[100dvh] w-full overflow-hidden flex flex-col bg-[#f6f8f6] dark:bg-[#0f1a0d] antialiased">
        <style jsx global>{`
          .no-scrollbar::-webkit-scrollbar {
            display: none;
          }
          .no-scrollbar {
            -ms-overflow-style: none;
            scrollbar-width: none;
          }
        `}</style>
        <div className="flex-1 min-h-0 overflow-hidden">{children}</div>
        <DepartmentBottomNav />
      </div>
    </DepartmentAppProvider>
  );
}
