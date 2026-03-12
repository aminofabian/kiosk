'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, Building2, History, TrendingDown } from 'lucide-react';
import { apiGet } from '@/lib/utils/api-client';
import Link from 'next/link';

interface SupplierCost {
  supplierId: string;
  supplierName: string;
  defaultCostPrice: number | null;
  lastBuyPrice: number | null;
}

interface CostHistoryEntry {
  id: string;
  itemId: string;
  supplierId: string | null;
  supplierName: string | null;
  price: number;
  effectiveFrom: number;
  setBy: string | null;
  setByName: string | null;
  notes: string | null;
  createdAt: number;
}

const formatPrice = (price: number) =>
  `KES ${price.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatDate = (ts: number) =>
  new Date(ts * 1000).toLocaleDateString('en-KE', {
    dateStyle: 'short',
    timeStyle: 'short',
  });

interface ItemSupplierCostsProps {
  itemId: string;
  itemName?: string;
}

export function ItemSupplierCosts({ itemId, itemName }: ItemSupplierCostsProps) {
  const [supplierCosts, setSupplierCosts] = useState<SupplierCost[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [costHistory, setCostHistory] = useState<CostHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const fetchSupplierCosts = useCallback(async () => {
    setLoading(true);
    try {
      const result = await apiGet<SupplierCost[]>(
        `/api/items/${itemId}/supplier-costs`
      );
      if (result.success && result.data) {
        setSupplierCosts(result.data);
      }
    } catch (err) {
      console.error('Error fetching supplier costs:', err);
    } finally {
      setLoading(false);
    }
  }, [itemId]);

  const fetchCostHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const result = await apiGet<CostHistoryEntry[]>(
        `/api/items/${itemId}/cost-history`
      );
      if (result.success && result.data) {
        setCostHistory(result.data);
      }
    } catch (err) {
      console.error('Error fetching cost history:', err);
    } finally {
      setHistoryLoading(false);
    }
  }, [itemId]);

  useEffect(() => {
    if (itemId) fetchSupplierCosts();
  }, [itemId, fetchSupplierCosts]);

  useEffect(() => {
    if (historyOpen && itemId) fetchCostHistory();
  }, [historyOpen, itemId, fetchCostHistory]);

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              Cost by supplier
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setHistoryOpen(true)}
              className="text-xs"
            >
              <History className="w-3.5 h-3.5 mr-1.5" />
              View history
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : supplierCosts.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">
              No suppliers linked. Link this product to suppliers from the{' '}
              <Link
                href="/admin/suppliers"
                className="text-[#1c6a1e] hover:underline font-medium"
              >
                Suppliers
              </Link>{' '}
              page to track cost per supplier.
            </p>
          ) : (
            <div className="space-y-2">
              {supplierCosts.map((sc) => (
                <div
                  key={sc.supplierId}
                  className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-700 p-3"
                >
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-slate-400" />
                    <span className="font-medium text-sm">{sc.supplierName}</span>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    {sc.defaultCostPrice != null && (
                      <span className="text-amber-600 dark:text-amber-400 font-medium">
                        {formatPrice(sc.defaultCostPrice)}
                        <span className="text-xs text-muted-foreground ml-1">
                          default
                        </span>
                      </span>
                    )}
                    {sc.lastBuyPrice != null && (
                      <span className="text-slate-600 dark:text-slate-400">
                        Last: {formatPrice(sc.lastBuyPrice)}
                      </span>
                    )}
                    {sc.defaultCostPrice == null && sc.lastBuyPrice == null && (
                      <span className="text-muted-foreground text-xs">
                        No cost set
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>
              Cost history
              {itemName && (
                <span className="font-normal text-muted-foreground ml-2">
                  — {itemName}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto -mx-6 px-6">
            {historyLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : costHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                No cost history recorded yet.
              </p>
            ) : (
              <div className="space-y-2 pb-4">
                {costHistory.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-700 p-3 text-sm"
                  >
                    <div>
                      <span className="font-medium">
                        {formatPrice(entry.price)}
                      </span>
                      <span className="text-muted-foreground ml-2">
                        {entry.supplierName ?? 'Default'}
                      </span>
                    </div>
                    <div className="text-right text-xs text-muted-foreground">
                      <div>{formatDate(entry.effectiveFrom)}</div>
                      {entry.setByName && (
                        <div>by {entry.setByName}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
