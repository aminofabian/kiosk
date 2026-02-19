'use client';

import { AdminLayout } from '@/components/layouts/admin-layout';
import { BalanceApprovals } from '@/components/admin/BalanceApprovals';
import { Banknote } from 'lucide-react';

export default function BalanceApprovalsPage() {
  return (
    <AdminLayout>
      <div className="min-h-screen p-4 md:p-6">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#1c6a1e] to-[#2a8a30] flex items-center justify-center shadow-md shadow-[#1c6a1e]/30">
              <Banknote className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                Balance Approvals
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Review and approve opening/closing balance requests from cashiers
              </p>
            </div>
          </div>

          <BalanceApprovals />
        </div>
      </div>
    </AdminLayout>
  );
}
