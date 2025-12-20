'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BreakdownForm } from './BreakdownForm';
import type { Purchase, PurchaseItem } from '@/lib/db/types';
import type { PurchaseItemStatus } from '@/lib/constants';

interface BreakdownViewProps {
  purchase: Purchase;
  items: (PurchaseItem & { item_name?: string; item_unit_type?: string })[];
}

export function BreakdownView({ purchase, items }: BreakdownViewProps) {
  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString('en-KE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatPrice = (price: number) => {
    return `KES ${price.toFixed(0)}`;
  };

  const pendingItems = items.filter((item) => item.status === 'pending');
  const brokenDownItems = items.filter((item) => item.status === 'broken_down');

  return (
    <div className="space-y-6">
      {/* Purchase Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Purchase Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Supplier:</span>
            <span className="font-medium">
              {purchase.supplier_name || 'No supplier'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Date:</span>
            <span className="font-medium">{formatDate(purchase.purchase_date)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Total Amount:</span>
            <span className="font-bold text-lg">{formatPrice(purchase.total_amount)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Status:</span>
            <Badge
              variant={
                purchase.status === 'complete'
                  ? 'default'
                  : purchase.status === 'partial'
                  ? 'secondary'
                  : 'destructive'
              }
            >
              {purchase.status}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Pending Items */}
      {pendingItems.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Items to Break Down</h2>
          {pendingItems.map((item) => (
            <BreakdownForm
              key={item.id}
              purchaseItem={item}
              purchaseId={purchase.id}
            />
          ))}
        </div>
      )}

      {/* Broken Down Items */}
      {brokenDownItems.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Completed Breakdowns</h2>
          {brokenDownItems.map((item) => (
            <Card key={item.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold">{item.item_name_snapshot}</h3>
                    <p className="text-sm text-muted-foreground">
                      {item.quantity_note} - {formatPrice(item.amount)}
                    </p>
                    {item.item_name && (
                      <p className="text-sm text-muted-foreground mt-1">
                        Linked to: {item.item_name}
                      </p>
                    )}
                  </div>
                  <Badge variant="default">Broken Down</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {pendingItems.length === 0 && brokenDownItems.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          No items in this purchase
        </div>
      )}
    </div>
  );
}

