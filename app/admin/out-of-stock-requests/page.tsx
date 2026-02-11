'use client';

import { useState, useEffect, useCallback } from 'react';
import { AdminLayout } from '@/components/layouts/admin-layout';
import { PackageX, Loader2, RefreshCw } from 'lucide-react';
import { apiGet } from '@/lib/utils/api-client';

interface OutOfStockRequest {
  id: string;
  business_id: string;
  item_name: string;
  notes: string | null;
  recorded_by: string;
  created_at: number;
  user_name: string | null;
}

const formatDateTime = (ts: number) => {
  const d = new Date(ts * 1000);
  return d.toLocaleString('en-KE', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
};

export default function OutOfStockRequestsPage() {
  const [requests, setRequests] = useState<OutOfStockRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRequests = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await apiGet<OutOfStockRequest[]>('/api/out-of-stock-requests');
      if (result.success && result.data) {
        setRequests(result.data);
      } else {
        setError(result.message || 'Failed to load');
      }
    } catch {
      setError('Failed to load requests');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  return (
    <AdminLayout>
      <div className="min-h-screen bg-white dark:bg-[#0f1a0d]">
        <header className="sticky top-0 z-10 bg-white dark:bg-[#0f1a0d] border-b border-slate-200 dark:border-slate-800">
          <div className="px-4 md:px-8 py-5">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
              Requested but Not Sold
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Items customers asked for that we didn&apos;t have in stock
            </p>
          </div>
        </header>

        <div className="px-4 md:px-8 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Cashiers log items here when a customer asks for something we don&apos;t have. Use this list to plan restocking.
          </p>
          <button
            onClick={fetchRequests}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-[#259783]" />
            <p className="text-slate-500 dark:text-slate-400">Loading requests...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <PackageX className="w-12 h-12 text-slate-300 dark:text-slate-600" />
            <p className="text-slate-600 dark:text-slate-400">{error}</p>
          </div>
        ) : requests.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700">
            <PackageX className="w-12 h-12 text-slate-300 dark:text-slate-600" />
            <p className="text-slate-600 dark:text-slate-400">No requests yet</p>
            <p className="text-sm text-slate-500 dark:text-slate-500">
              When cashiers log items customers asked for, they&apos;ll appear here.
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden bg-white dark:bg-slate-900">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Item
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Notes
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Recorded by
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Date & time
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((req) => (
                    <tr
                      key={req.id}
                      className="border-b border-slate-100 dark:border-slate-800 last:border-0 hover:bg-slate-50/50 dark:hover:bg-slate-800/30"
                    >
                      <td className="py-3 px-4">
                        <span className="font-medium text-slate-900 dark:text-white">
                          {req.item_name}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                        {req.notes || '—'}
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                        {req.user_name || 'Unknown'}
                      </td>
                      <td className="py-3 px-4 text-slate-500 dark:text-slate-500 text-sm">
                        {formatDateTime(req.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        </div>
      </div>
    </AdminLayout>
  );
}
