'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Receipt, AlertCircle, Plus, Trash2, Check, Building2 } from 'lucide-react';
import { apiGet, apiPost } from '@/lib/utils/api-client';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface Supplier {
  id: string;
  name: string;
  contact_phone: string | null;
  contact_email: string | null;
}

interface BillLineItem {
  id: string;
  description: string;
  quantity: string;
  amount: string; // unit price
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
  const [lineItems, setLineItems] = useState<BillLineItem[]>([
    { id: '1', description: '', quantity: '1', amount: '' },
  ]);
  const [dueDateTime, setDueDateTime] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newSupplierDialogOpen, setNewSupplierDialogOpen] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState('');
  const [newSupplierPhone, setNewSupplierPhone] = useState('');
  const [newSupplierEmail, setNewSupplierEmail] = useState('');
  const [newSupplierLocation, setNewSupplierLocation] = useState('');
  const [newSupplierNotes, setNewSupplierNotes] = useState('');
  const [isCreatingSupplier, setIsCreatingSupplier] = useState(false);
  const [supplierError, setSupplierError] = useState<string | null>(null);

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

  const handleCreateSupplier = async () => {
    setSupplierError(null);

    if (!newSupplierName.trim()) {
      setSupplierError('Supplier name is required');
      return;
    }

    setIsCreatingSupplier(true);

    try {
      const result = await apiPost('/api/suppliers', {
        name: newSupplierName.trim(),
        contactPhone: newSupplierPhone.trim() || null,
        contactEmail: newSupplierEmail.trim() || null,
        location: newSupplierLocation.trim() || null,
        notes: newSupplierNotes.trim() || null,
      });

      if (result.success) {
        // Refresh suppliers list
        const suppliersResult = await apiGet<Supplier[]>('/api/suppliers');
        if (suppliersResult.success) {
          setSuppliers(suppliersResult.data || []);
          
          // Find and select the newly created supplier
          const newSupplier = suppliersResult.data?.find(
            (s) => s.name.trim().toLowerCase() === newSupplierName.trim().toLowerCase()
          );
          
          if (newSupplier) {
            setSupplierId(newSupplier.id);
            setSupplierName(newSupplier.name);
            setSupplierPhone(newSupplier.contact_phone || '');
          }
        }

        // Reset form and close dialog
        setNewSupplierName('');
        setNewSupplierPhone('');
        setNewSupplierEmail('');
        setNewSupplierLocation('');
        setNewSupplierNotes('');
        setNewSupplierDialogOpen(false);
      } else {
        setSupplierError(result.message || 'Failed to create supplier');
      }
    } catch (err) {
      console.error('Error creating supplier:', err);
      setSupplierError('An error occurred. Please try again.');
    } finally {
      setIsCreatingSupplier(false);
    }
  };

  // Calculate total from line items (quantity × unit price)
  const totalAmount = lineItems.reduce((sum, item) => {
    const quantity = parseFloat(item.quantity || '0');
    const unitPrice = parseFloat(item.amount || '0');
    const itemTotal = quantity * unitPrice;
    return sum + (isNaN(itemTotal) ? 0 : itemTotal);
  }, 0);

  // Format bill description from line items
  const formatBillDescription = () => {
    const validItems = lineItems.filter(
      (item) => item.description.trim() && item.quantity && item.amount
    );
    if (validItems.length === 0) return '';
    
    if (validItems.length === 1) {
      const item = validItems[0];
      const qty = parseFloat(item.quantity || '1');
      const unitPrice = parseFloat(item.amount || '0');
      const total = qty * unitPrice;
      return `${item.description.trim()} (${qty} × KES ${unitPrice.toFixed(2)} = KES ${total.toFixed(2)})`;
    }
    
    // Format as a list
    return validItems
      .map((item, index) => {
        const qty = parseFloat(item.quantity || '1');
        const unitPrice = parseFloat(item.amount || '0');
        const total = qty * unitPrice;
        return `${index + 1}. ${item.description.trim()} - ${qty} × KES ${unitPrice.toFixed(2)} = KES ${total.toFixed(2)}`;
      })
      .join('\n');
  };

  const addLineItem = () => {
    setLineItems([
      ...lineItems,
      { id: Date.now().toString(), description: '', quantity: '1', amount: '' },
    ]);
  };

  const removeLineItem = (id: string) => {
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter((item) => item.id !== id));
    }
  };

  const updateLineItem = (id: string, field: 'description' | 'quantity' | 'amount', value: string) => {
    setLineItems(
      lineItems.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      )
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!supplierName.trim()) {
      setError('Supplier name is required');
      return;
    }

    // Validate line items
    const validItems = lineItems.filter(
      (item) => item.description.trim() && item.quantity && item.amount
    );
    
    if (validItems.length === 0) {
      setError('Please add at least one bill item with description, quantity, and amount');
      return;
    }

    // Validate quantities and amounts
    for (const item of validItems) {
      const quantity = parseFloat(item.quantity);
      const unitPrice = parseFloat(item.amount);
      
      if (isNaN(quantity) || quantity <= 0) {
        setError(`Please enter a valid quantity for "${item.description.trim()}"`);
        return;
      }
      
      if (isNaN(unitPrice) || unitPrice <= 0) {
        setError(`Please enter a valid unit price for "${item.description.trim()}"`);
        return;
      }
    }

    if (totalAmount <= 0) {
      setError('Total amount must be greater than 0');
      return;
    }

    if (!dueDateTime) {
      setError('Due date and time are required');
      return;
    }

    setIsSubmitting(true);

    try {
      const billDescription = formatBillDescription();
      
      const result = await apiPost('/api/supplier-bills', {
        supplierId: supplierId || null,
        supplierName: supplierName.trim(),
        supplierPhone: supplierPhone.trim() || null,
        billDescription: billDescription,
        amount: totalAmount,
        dueDate: dueDateTime,
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

  // Default due to today at end of day (23:59)
  useEffect(() => {
    if (!dueDateTime) {
      const d = new Date();
      d.setHours(23, 59, 0, 0);
      const pad = (n: number) => String(n).padStart(2, '0');
      setDueDateTime(
        `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
      );
    }
  }, [dueDateTime]);

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2 text-red-600 dark:text-red-400">
          <AlertCircle className="w-4 h-4" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-slate-700 dark:text-slate-300 font-bold">
            Supplier *
          </Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setNewSupplierDialogOpen(true)}
            className="h-8 text-xs"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Add Supplier
          </Button>
        </div>
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

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-slate-700 dark:text-slate-300 font-bold">
            Bill Items *
          </Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addLineItem}
            className="h-8 text-xs"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Add Item
          </Button>
        </div>

        <div className="space-y-2">
          {lineItems.map((item, index) => (
            <Card
              key={item.id}
              className="border-l-2 border-l-[#259783] bg-white dark:bg-slate-800/50"
            >
              <CardContent className="p-3">
                <div className="flex items-start gap-2">
                  <div className="flex-shrink-0 mt-1">
                    <div className="w-5 h-5 rounded-full border-2 border-[#259783] bg-[#259783]/10 flex items-center justify-center">
                      <Check className="w-3 h-3 text-[#259783]" />
                    </div>
                  </div>
                  <div className="flex-1 space-y-2 min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className="text-xs bg-[#259783]/10 text-[#259783] border-[#259783]/30"
                      >
                        #{index + 1}
                      </Badge>
                      {lineItems.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeLineItem(item.id)}
                          className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                    <Input
                      value={item.description}
                      onChange={(e) =>
                        updateLineItem(item.id, 'description', e.target.value)
                      }
                      placeholder="e.g., Stock delivery, Equipment purchase, Services"
                      required
                      className="h-10 border-2 border-slate-200 dark:border-slate-700"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs text-slate-600 dark:text-slate-400">
                          Quantity
                        </Label>
                        <Input
                          type="number"
                          value={item.quantity}
                          onChange={(e) =>
                            updateLineItem(item.id, 'quantity', e.target.value)
                          }
                          placeholder="1"
                          required
                          min="0.01"
                          step="0.01"
                          className="h-10 border-2 border-slate-200 dark:border-slate-700"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-slate-600 dark:text-slate-400">
                          Unit Price (KES)
                        </Label>
                        <Input
                          type="number"
                          value={item.amount}
                          onChange={(e) =>
                            updateLineItem(item.id, 'amount', e.target.value)
                          }
                          placeholder="0.00"
                          required
                          min="0"
                          step="0.01"
                          className="h-10 border-2 border-slate-200 dark:border-slate-700"
                        />
                      </div>
                    </div>
                    {/* Item Total */}
                    {item.quantity && item.amount && (
                      <div className="p-2 bg-slate-50 dark:bg-slate-800/50 rounded border border-slate-200 dark:border-slate-700">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-600 dark:text-slate-400 font-medium">
                            Item Total:
                          </span>
                          <span className="font-bold text-[#259783]">
                            {(() => {
                              const qty = parseFloat(item.quantity || '0');
                              const unitPrice = parseFloat(item.amount || '0');
                              const total = qty * unitPrice;
                              return isNaN(total) ? 'KES 0.00' : `KES ${total.toFixed(2)}`;
                            })()}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Total Amount Display */}
        <div className="p-3 bg-[#259783]/10 dark:bg-[#259783]/20 border-2 border-[#259783]/30 rounded-lg">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
              Total Amount:
            </span>
            <span className="text-lg font-black text-[#259783]">
              KES {totalAmount.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-slate-700 dark:text-slate-300 font-bold">
          Due Date & Time *
        </Label>
        <div className="space-y-2">
            {/* Quick date selection: sets date, keeps time (end of day for new dates) */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs text-slate-500 dark:text-slate-400 mr-1">Quick:</span>
              {[
                { label: 'Today', days: 0 },
                { label: '2 Days', days: 2 },
                { label: '3 Days', days: 3 },
                { label: '1 Week', days: 7 },
                { label: '2 Weeks', days: 14 },
                { label: '1 Month', days: 30 },
                { label: 'Indefinite', days: null },
              ].map(({ label, days }) => {
                const isSelected = (() => {
                  if (days === null) {
                    if (!dueDateTime) return false;
                    const selectedDate = new Date(dueDateTime);
                    const farFuture = new Date();
                    farFuture.setFullYear(farFuture.getFullYear() + 10);
                    return selectedDate.getTime() >= farFuture.getTime();
                  }
                  if (!dueDateTime) return false;
                  const selectedDate = new Date(dueDateTime);
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  selectedDate.setHours(0, 0, 0, 0);
                  const diffTime = selectedDate.getTime() - today.getTime();
                  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
                  return diffDays === days;
                })();

                return (
                  <Button
                    key={label}
                    type="button"
                    variant={isSelected ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      const pad = (n: number) => String(n).padStart(2, '0');
                      if (days === null) {
                        const d = new Date();
                        d.setFullYear(d.getFullYear() + 10);
                        d.setHours(23, 59, 0, 0);
                        setDueDateTime(
                          `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
                        );
                      } else {
                        const d = new Date();
                        d.setDate(d.getDate() + days);
                        d.setHours(23, 59, 0, 0);
                        setDueDateTime(
                          `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
                        );
                      }
                    }}
                    className={`h-7 px-2.5 text-xs ${
                      isSelected
                        ? 'bg-[#259783] hover:bg-[#1e7a6a] text-white'
                        : 'border-slate-300 dark:border-slate-700'
                    }`}
                  >
                    {label}
                  </Button>
                );
              })}
            </div>
            <Input
              type="datetime-local"
              value={dueDateTime}
              onChange={(e) => setDueDateTime(e.target.value)}
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

      {/* New Supplier Dialog */}
      <Dialog open={newSupplierDialogOpen} onOpenChange={setNewSupplierDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-[#259783]" />
              Add New Supplier
            </DialogTitle>
            <DialogDescription>
              Create a new supplier that will be available for future bills
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {supplierError && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2 text-red-600 dark:text-red-400">
                <AlertCircle className="w-4 h-4" />
                <span className="text-sm">{supplierError}</span>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="supplier-name" className="text-slate-700 dark:text-slate-300 font-bold">
                Supplier Name *
              </Label>
              <Input
                id="supplier-name"
                value={newSupplierName}
                onChange={(e) => setNewSupplierName(e.target.value)}
                placeholder="Enter supplier name"
                required
                className="h-12 border-2 border-slate-200 dark:border-slate-700"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="supplier-phone" className="text-slate-700 dark:text-slate-300 font-bold">
                  Phone
                </Label>
                <Input
                  id="supplier-phone"
                  type="tel"
                  value={newSupplierPhone}
                  onChange={(e) => setNewSupplierPhone(e.target.value)}
                  placeholder="Phone number"
                  className="h-12 border-2 border-slate-200 dark:border-slate-700"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="supplier-email" className="text-slate-700 dark:text-slate-300 font-bold">
                  Email
                </Label>
                <Input
                  id="supplier-email"
                  type="email"
                  value={newSupplierEmail}
                  onChange={(e) => setNewSupplierEmail(e.target.value)}
                  placeholder="Email address"
                  className="h-12 border-2 border-slate-200 dark:border-slate-700"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="supplier-location" className="text-slate-700 dark:text-slate-300 font-bold">
                Location
              </Label>
              <Input
                id="supplier-location"
                value={newSupplierLocation}
                onChange={(e) => setNewSupplierLocation(e.target.value)}
                placeholder="Supplier location"
                className="h-12 border-2 border-slate-200 dark:border-slate-700"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="supplier-notes" className="text-slate-700 dark:text-slate-300 font-bold">
                Notes
              </Label>
              <Textarea
                id="supplier-notes"
                value={newSupplierNotes}
                onChange={(e) => setNewSupplierNotes(e.target.value)}
                placeholder="Additional notes about this supplier"
                rows={3}
                className="border-2 border-slate-200 dark:border-slate-700"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setNewSupplierDialogOpen(false);
                setSupplierError(null);
                setNewSupplierName('');
                setNewSupplierPhone('');
                setNewSupplierEmail('');
                setNewSupplierLocation('');
                setNewSupplierNotes('');
              }}
              disabled={isCreatingSupplier}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleCreateSupplier}
              disabled={isCreatingSupplier}
              className="bg-[#259783] hover:bg-[#1e7a6a] text-white"
            >
              {isCreatingSupplier ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Supplier
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </form>
  );
}
