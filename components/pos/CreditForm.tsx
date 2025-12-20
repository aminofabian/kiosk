'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';

interface CreditFormProps {
  customerName: string;
  customerPhone: string;
  onCustomerNameChange: (value: string) => void;
  onCustomerPhoneChange: (value: string) => void;
}

export function CreditForm({
  customerName,
  customerPhone,
  onCustomerNameChange,
  onCustomerPhoneChange,
}: CreditFormProps) {
  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="customerName">Customer Name *</Label>
          <Input
            id="customerName"
            value={customerName}
            onChange={(e) => onCustomerNameChange(e.target.value)}
            placeholder="Enter customer name"
            required
            className="h-12 touch-target"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="customerPhone">Customer Phone (Optional)</Label>
          <Input
            id="customerPhone"
            type="tel"
            value={customerPhone}
            onChange={(e) => onCustomerPhoneChange(e.target.value)}
            placeholder="e.g., 0712345678"
            className="h-12 touch-target"
          />
          <p className="text-xs text-muted-foreground">
            Phone number helps identify existing customers
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

