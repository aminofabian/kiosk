'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Receipt, AlertCircle } from 'lucide-react';
import { apiPatch } from '@/lib/utils/api-client';

interface SupplierBillEditFormProps {
  billId: string;
  initialSupplierName: string;
  initialSupplierPhone: string;
  initialBillDescription: string;
  initialAmount: number;
  initialDueDate: number; // Unix seconds
  initialNotes: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

function toDateTimeLocal(unixSeconds: number): string {
  const d = new Date(unixSeconds * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function SupplierBillEditForm({
  billId,
  initialSupplierName,
  initialSupplierPhone,
  initialBillDescription,
  initialAmount,
  initialDueDate,
  initialNotes,
  onSuccess,
  onCancel,
}: SupplierBillEditFormProps) {
  const [supplierName, setSupplierName] = useState(initialSupplierName);
  const [supplierPhone, setSupplierPhone] = useState(initialSupplierPhone ?? '');
  const [billDescription, setBillDescription] = useState(initialBillDescription);
  const [amount, setAmount] = useState(String(initialAmount));
  const [dueDateTime, setDueDateTime] = useState(toDateTimeLocal(initialDueDate));
  const [notes, setNotes] = useState(initialNotes ?? '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSupplierName(initialSupplierName);
    setSupplierPhone(initialSupplierPhone ?? '');
    setBillDescription(initialBillDescription);
    setAmount(String(initialAmount));
    setDueDateTime(toDateTimeLocal(initialDueDate));
    setNotes(initialNotes ?? '');
  }, [
    billId,
    initialSupplierName,
    initialSupplierPhone,
    initialBillDescription,
    initialAmount,
    initialDueDate,
    initialNotes,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!supplierName.trim()) {
      setError('Supplier name is required');
      return;
    }
    if (!billDescription.trim()) {
      setError('Bill description is required');
      return;
    }
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Please enter a valid amount greater than 0');
      return;
    }
    if (!dueDateTime) {
      setError('Due date and time are required');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await apiPatch(`/api/supplier-bills/${billId}`, {
        supplierName: supplierName.trim(),
        supplierPhone: supplierPhone.trim() || null,
        billDescription: billDescription.trim(),
        amount: numAmount,
        dueDate: dueDateTime,
        notes: notes.trim() || null,
      });

      if (result.success) {
        onSuccess?.();
      } else {
        setError(result.message || 'Failed to update bill');
      }
    } catch (err) {
      console.error('Error updating supplier bill:', err);
      setError('An error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2 text-red-600 dark:text-red-400">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      <div className="space-y-2">
        <Label className="text-slate-700 dark:text-slate-300 font-bold">Supplier *</Label>
        <Input
          value={supplierName}
          onChange={(e) => setSupplierName(e.target.value)}
          placeholder="Supplier name"
          required
          className="h-12 border-2 border-slate-200 dark:border-slate-700"
        />
        <Input
          type="tel"
          value={supplierPhone}
          onChange={(e) => setSupplierPhone(e.target.value)}
          placeholder="Phone (optional)"
          className="h-12 border-2 border-slate-200 dark:border-slate-700"
        />
      </div>

      <div className="space-y-2">
        <Label className="text-slate-700 dark:text-slate-300 font-bold">Description *</Label>
        <Textarea
          value={billDescription}
          onChange={(e) => setBillDescription(e.target.value)}
          placeholder="Bill description"
          required
          rows={3}
          className="border-2 border-slate-200 dark:border-slate-700"
        />
      </div>

      <div className="space-y-2">
        <Label className="text-slate-700 dark:text-slate-300 font-bold">Amount (KES) *</Label>
        <Input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
          min="0"
          step="0.01"
          className="h-12 border-2 border-slate-200 dark:border-slate-700"
        />
      </div>

      <div className="space-y-2">
        <Label className="text-slate-700 dark:text-slate-300 font-bold">Due Date & Time *</Label>
        <Input
          type="datetime-local"
          value={dueDateTime}
          onChange={(e) => setDueDateTime(e.target.value)}
          required
          className="h-12 border-2 border-slate-200 dark:border-slate-700"
        />
      </div>

      <div className="space-y-2">
        <Label className="text-slate-700 dark:text-slate-300 font-bold">Notes (optional)</Label>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Additional notes"
          rows={2}
          className="border-2 border-slate-200 dark:border-slate-700"
        />
      </div>

      <div className="flex gap-3 pt-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting} className="flex-1">
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={isSubmitting} className="flex-1 bg-[#1c6a1e] hover:bg-[#2a8a30] text-white">
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Receipt className="w-4 h-4 mr-2" />
              Save changes
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
