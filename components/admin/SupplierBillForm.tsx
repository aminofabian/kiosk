'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Receipt, AlertCircle } from 'lucide-react';
import { apiGet, apiPost } from '@/lib/utils/api-client';

interface Supplier {
  id: string;
  name: string;
  contact_phone: string | null;
  contact_email: string | null;
}

interface SupplierBillFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function SupplierBillForm({ onSuccess, onCancel }: SupplierBillFormProps) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loadingSuppliers, setLoadingSuppliers] = useState(true);
  const [supplierId, setSupplierId] = useState<string>('');
  const [supplierName, setSupplierName] = useState('');
  const [supplierPhone, setSupplierPhone] = useState('');
  const [billDescription, setBillDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSuppliers() {
      try {
        setLoadingSuppliers(true);
        const result = await apiGet<Supplier[]>('/api/suppliers');
        if (result.success) {
          setSuppliers(result.data || []);
        }
      } catch (err) {
        console.error('Error fetching suppliers:', err);
      } finally {
        setLoadingSuppliers(false);
      }
    }
    fetchSuppliers();
  }, []);

  const handleSupplierChange = (value: string) => {
    if (value === 'new') {
      setSupplierId('');
      setSupplierName('');
      setSupplierPhone('');
    } else {
      const supplier = suppliers.find((s) => s.id === value);
      if (supplier) {
        setSupplierId(supplier.id);
        setSupplierName(supplier.name);
        setSupplierPhone(supplier.contact_phone || '');
      }
    }
  };

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

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setError('Please enter a valid amount greater than 0');
      return;
    }

    if (!dueDate) {
      setError('Due date is required');
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await apiPost('/api/supplier-bills', {
        supplierId: supplierId || null,
        supplierName: supplierName.trim(),
        supplierPhone: supplierPhone.trim() || null,
        billDescription: billDescription.trim(),
        amount: amountNum,
        dueDate,
        notes: notes.trim() || null,
      });

      if (result.success) {
        if (onSuccess) {
          onSuccess();
        }
      } else {
        setError(result.message || 'Failed to create supplier bill');
      }
    } catch (err) {
      console.error('Error creating supplier bill:', err);
      setError('An error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Set default due date to 7 days from now
  useEffect(() => {
    if (!dueDate) {
      const defaultDate = new Date();
      defaultDate.setDate(defaultDate.getDate() + 7);
      setDueDate(defaultDate.toISOString().split('T')[0]);
    }
  }, [dueDate]);

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2 text-red-600 dark:text-red-400">
          <AlertCircle className="w-4 h-4" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      <div className="space-y-2">
        <Label className="text-slate-700 dark:text-slate-300 font-bold">
          Supplier *
        </Label>
        {loadingSuppliers ? (
          <div className="flex items-center gap-2 text-slate-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Loading suppliers...</span>
          </div>
        ) : (
          <Select
            value={supplierId || 'new'}
            onValueChange={handleSupplierChange}
          >
            <SelectTrigger className="h-12 border-2 border-slate-200 dark:border-slate-700">
              <SelectValue placeholder="Select or enter new supplier" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="new">+ Enter New Supplier</SelectItem>
              {suppliers.map((supplier) => (
                <SelectItem key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {(!supplierId || supplierId === '') && (
          <>
            <Input
              value={supplierName}
              onChange={(e) => setSupplierName(e.target.value)}
              placeholder="Enter supplier name"
              required
              className="h-12 border-2 border-slate-200 dark:border-slate-700"
            />
            <Input
              type="tel"
              value={supplierPhone}
              onChange={(e) => setSupplierPhone(e.target.value)}
              placeholder="Enter supplier phone number (optional)"
              className="h-12 border-2 border-slate-200 dark:border-slate-700"
            />
          </>
        )}
      </div>

      <div className="space-y-2">
        <Label className="text-slate-700 dark:text-slate-300 font-bold">
          Bill Description *
        </Label>
        <Input
          value={billDescription}
          onChange={(e) => setBillDescription(e.target.value)}
          placeholder="e.g., Stock delivery, Equipment purchase, Services"
          required
          className="h-12 border-2 border-slate-200 dark:border-slate-700"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-slate-700 dark:text-slate-300 font-bold">
            Amount (KES) *
          </Label>
          <Input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            required
            min="0"
            step="0.01"
            className="h-12 text-lg border-2 border-slate-200 dark:border-slate-700"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-slate-700 dark:text-slate-300 font-bold">
            Due Date *
          </Label>
          <Input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            required
            className="h-12 border-2 border-slate-200 dark:border-slate-700"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-slate-700 dark:text-slate-300 font-bold">
          Notes (Optional)
        </Label>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Additional notes about this bill..."
          rows={3}
          className="border-2 border-slate-200 dark:border-slate-700"
        />
      </div>

      <div className="flex gap-3 pt-2">
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isSubmitting}
            className="flex-1"
          >
            Cancel
          </Button>
        )}
        <Button
          type="submit"
          disabled={isSubmitting}
          className="flex-1 bg-[#259783] hover:bg-[#45d827] text-white"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Creating...
            </>
          ) : (
            <>
              <Receipt className="w-4 h-4 mr-2" />
              Create Bill
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
