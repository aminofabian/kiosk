'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Loader2 } from 'lucide-react';
import type { Item } from '@/lib/db/types';

interface PriceEditFormProps {
  item: Item;
}

export function PriceEditForm({ item }: PriceEditFormProps) {
  const router = useRouter();
  const [newPrice, setNewPrice] = useState<string>(item.current_sell_price.toString());
  const [effectiveFrom, setEffectiveFrom] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    const price = parseFloat(newPrice);
    if (isNaN(price) || price <= 0) {
      setError('Price must be a positive number');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/items/${item.id}/price`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          price,
          effectiveFrom: Math.floor(new Date(effectiveFrom).getTime() / 1000),
        }),
      });

      const result = await response.json();

      if (result.success) {
        setSuccess(true);
        setTimeout(() => {
          router.push('/admin/items');
        }, 1500);
      } else {
        setError(result.message || 'Failed to update price');
        setIsSubmitting(false);
      }
    } catch (err) {
      console.error('Price update error:', err);
      setError('An error occurred. Please try again.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Current Price</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-primary">
            KES {item.current_sell_price.toFixed(0)}
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            Per {item.unit_type}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Update Selling Price</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="price">New Price (KES) *</Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
                placeholder="0.00"
                required
                className="text-lg h-12"
              />
              <p className="text-xs text-muted-foreground">
                Per {item.unit_type}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="date">Effective From *</Label>
              <Input
                id="date"
                type="date"
                value={effectiveFrom}
                onChange={(e) => setEffectiveFrom(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                This price will be used for all future sales
              </p>
            </div>

            <Separator />

            <div className="p-4 bg-muted rounded-lg">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Price Change:</span>
                <span
                  className={`font-bold ${
                    parseFloat(newPrice) > item.current_sell_price
                      ? 'text-emerald-600'
                      : parseFloat(newPrice) < item.current_sell_price
                      ? 'text-destructive'
                      : ''
                  }`}
                >
                  {parseFloat(newPrice) > item.current_sell_price ? '+' : ''}
                  {(
                    parseFloat(newPrice) - item.current_sell_price
                  ).toFixed(0)}{' '}
                  KES
                </span>
              </div>
            </div>

            {error && (
              <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm">
                {error}
              </div>
            )}

            {success && (
              <div className="p-3 bg-emerald-500/10 text-emerald-600 rounded-md text-sm">
                Price updated successfully! Redirecting...
              </div>
            )}

            <Button
              type="submit"
              size="touch"
              disabled={isSubmitting || success}
              className="w-full bg-gradient-to-r from-emerald-600 to-teal-600"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Updating...
                </>
              ) : (
                'Update Price'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

