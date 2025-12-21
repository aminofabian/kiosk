'use client';

import { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/layouts/admin-layout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/drawer';
import {
  Receipt,
  Plus,
  Loader2,
  TrendingDown,
  Building2,
  Zap,
  Calendar,
  Pencil,
  Trash2,
  MoreVertical,
  X,
  DollarSign,
  Target,
  AlertTriangle,
} from 'lucide-react';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/utils/api-client';
import type { ExpenseCategory, ExpenseFrequency } from '@/lib/db/types';

interface Expense {
  id: string;
  name: string;
  category: ExpenseCategory;
  amount: number;
  frequency: ExpenseFrequency;
  start_date: number;
  notes: string | null;
  active: number;
  daily_cost: number;
}

interface ExpenseSummary {
  dailyOperatingCost: number;
  fixedDailyCost: number;
  variableDailyCost: number;
  weeklyOperatingCost: number;
  monthlyOperatingCost: number;
  activeCount: number;
  totalCount: number;
}

interface ExpenseData {
  expenses: Expense[];
  summary: ExpenseSummary;
}

type DrawerMode = 'create' | 'edit';

const FREQUENCY_LABELS: Record<ExpenseFrequency, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  yearly: 'Yearly',
};

const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  fixed: 'Fixed',
  variable: 'Variable',
};

export default function ExpensesPage() {
  const [data, setData] = useState<ExpenseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<DrawerMode>('create');
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    category: 'fixed' as ExpenseCategory,
    amount: '',
    frequency: 'monthly' as ExpenseFrequency,
    startDate: new Date().toISOString().split('T')[0],
    notes: '',
  });

  const fetchExpenses = async () => {
    try {
      setLoading(true);
      const result = await apiGet<ExpenseData>('/api/expenses');
      if (result.success && result.data) {
        setData(result.data);
      } else {
        setError(result.message || 'Failed to load expenses');
      }
    } catch {
      setError('Failed to load expenses');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpenses();
  }, []);

  const formatPrice = (price: number) => {
    return `KES ${price.toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  const openCreateDrawer = () => {
    setDrawerMode('create');
    setSelectedExpense(null);
    setFormData({
      name: '',
      category: 'fixed',
      amount: '',
      frequency: 'monthly',
      startDate: new Date().toISOString().split('T')[0],
      notes: '',
    });
    setFormError('');
    setDrawerOpen(true);
  };

  const openEditDrawer = (expense: Expense) => {
    setDrawerMode('edit');
    setSelectedExpense(expense);
    setFormData({
      name: expense.name,
      category: expense.category,
      amount: expense.amount.toString(),
      frequency: expense.frequency,
      startDate: new Date(expense.start_date * 1000).toISOString().split('T')[0],
      notes: expense.notes || '',
    });
    setFormError('');
    setMenuOpenId(null);
    setDrawerOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);

    const amount = parseFloat(formData.amount);
    if (isNaN(amount) || amount <= 0) {
      setFormError('Please enter a valid amount');
      setSubmitting(false);
      return;
    }

    try {
      if (drawerMode === 'create') {
        const result = await apiPost('/api/expenses', {
          name: formData.name,
          category: formData.category,
          amount,
          frequency: formData.frequency,
          startDate: formData.startDate,
          notes: formData.notes || null,
        });
        if (result.success) {
          setDrawerOpen(false);
          fetchExpenses();
        } else {
          setFormError(result.message || 'Failed to create expense');
        }
      } else if (selectedExpense) {
        const result = await apiPut(`/api/expenses/${selectedExpense.id}`, {
          name: formData.name,
          category: formData.category,
          amount,
          frequency: formData.frequency,
          startDate: formData.startDate,
          notes: formData.notes || null,
        });
        if (result.success) {
          setDrawerOpen(false);
          fetchExpenses();
        } else {
          setFormError(result.message || 'Failed to update expense');
        }
      }
    } catch {
      setFormError('An error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (expense: Expense) => {
    setMenuOpenId(null);
    try {
      const result = await apiPut(`/api/expenses/${expense.id}`, {
        active: expense.active === 1 ? false : true,
      });
      if (result.success) {
        fetchExpenses();
      }
    } catch {
      // Handle error silently
    }
  };

  const handleDelete = async (expense: Expense) => {
    setMenuOpenId(null);
    if (!confirm(`Delete "${expense.name}"? This cannot be undone.`)) return;

    try {
      const result = await apiDelete(`/api/expenses/${expense.id}`);
      if (result.success) {
        fetchExpenses();
      }
    } catch {
      // Handle error silently
    }
  };

  const fixedExpenses = data?.expenses.filter((e) => e.category === 'fixed' && e.active === 1) || [];
  const variableExpenses = data?.expenses.filter((e) => e.category === 'variable' && e.active === 1) || [];
  const inactiveExpenses = data?.expenses.filter((e) => e.active === 0) || [];

  return (
    <AdminLayout>
      <div className="min-h-screen">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white/80 dark:bg-[#0f1a0d]/80 backdrop-blur-lg border-b border-slate-200 dark:border-slate-800">
          <div className="px-4 md:px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center shadow-lg shadow-orange-500/20">
                  <Receipt className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white">Operating Expenses</h1>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Track your daily cost of running the business</p>
                </div>
              </div>
              <Button
                onClick={openCreateDrawer}
                className="bg-[#259783] hover:bg-[#1e7a6a] text-white"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Expense
              </Button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 md:p-6 pb-24 md:pb-6">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center space-y-4">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-orange-500" />
                <p className="text-slate-500 dark:text-slate-400 font-medium">Loading expenses...</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center space-y-3">
                <AlertTriangle className="w-12 h-12 text-red-500 mx-auto" />
                <p className="text-red-600 dark:text-red-400 font-semibold">{error}</p>
                <Button onClick={fetchExpenses} variant="outline">Try Again</Button>
              </div>
            </div>
          ) : data && (
            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Daily Operating Cost - THE KEY NUMBER */}
                <Card className="bg-gradient-to-br from-orange-500 to-red-600 border-0 shadow-lg shadow-orange-500/20 md:col-span-1">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between mb-3">
                      <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                        <Target className="w-6 h-6 text-white" />
                      </div>
                      <Badge className="bg-white/20 text-white border-0">
                        Survival Rate
                      </Badge>
                    </div>
                    <p className="text-orange-100 text-sm font-medium mb-1">Daily Operating Cost</p>
                    <p className="text-3xl font-black text-white">{formatPrice(data.summary.dailyOperatingCost)}</p>
                    <p className="text-orange-200 text-xs mt-2">
                      You must make at least this much profit daily to survive
                    </p>
                  </CardContent>
                </Card>

                {/* Fixed vs Variable Split */}
                <Card className="bg-white dark:bg-[#1c2e18] border border-slate-200 dark:border-slate-800">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
                        <Building2 className="w-5 h-5 text-blue-500" />
                      </div>
                      <div>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Fixed Costs</p>
                        <p className="text-xl font-bold text-slate-900 dark:text-white">{formatPrice(data.summary.fixedDailyCost)}/day</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center">
                        <Zap className="w-5 h-5 text-amber-500" />
                      </div>
                      <div>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Variable Costs</p>
                        <p className="text-xl font-bold text-slate-900 dark:text-white">{formatPrice(data.summary.variableDailyCost)}/day</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Monthly Projection */}
                <Card className="bg-white dark:bg-[#1c2e18] border border-slate-200 dark:border-slate-800">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center">
                        <Calendar className="w-5 h-5 text-purple-500" />
                      </div>
                      <div>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Monthly Total</p>
                        <p className="text-xl font-bold text-slate-900 dark:text-white">{formatPrice(data.summary.monthlyOperatingCost)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-green-50 dark:bg-green-900/20 flex items-center justify-center">
                        <DollarSign className="w-5 h-5 text-green-500" />
                      </div>
                      <div>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Weekly Total</p>
                        <p className="text-xl font-bold text-slate-900 dark:text-white">{formatPrice(data.summary.weeklyOperatingCost)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Fixed Expenses */}
              {fixedExpenses.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-blue-500" />
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Fixed Expenses</h2>
                    <Badge variant="outline" className="text-blue-600 border-blue-200 dark:border-blue-800">
                      {fixedExpenses.length}
                    </Badge>
                  </div>
                  <div className="grid gap-3">
                    {fixedExpenses.map((expense) => (
                      <ExpenseCard
                        key={expense.id}
                        expense={expense}
                        menuOpenId={menuOpenId}
                        setMenuOpenId={setMenuOpenId}
                        onEdit={openEditDrawer}
                        onToggle={handleToggleActive}
                        onDelete={handleDelete}
                        formatPrice={formatPrice}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Variable Expenses */}
              {variableExpenses.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Zap className="w-5 h-5 text-amber-500" />
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Variable Expenses</h2>
                    <Badge variant="outline" className="text-amber-600 border-amber-200 dark:border-amber-800">
                      {variableExpenses.length}
                    </Badge>
                  </div>
                  <div className="grid gap-3">
                    {variableExpenses.map((expense) => (
                      <ExpenseCard
                        key={expense.id}
                        expense={expense}
                        menuOpenId={menuOpenId}
                        setMenuOpenId={setMenuOpenId}
                        onEdit={openEditDrawer}
                        onToggle={handleToggleActive}
                        onDelete={handleDelete}
                        formatPrice={formatPrice}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Inactive Expenses */}
              {inactiveExpenses.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <TrendingDown className="w-5 h-5 text-slate-400" />
                    <h2 className="text-lg font-semibold text-slate-500 dark:text-slate-400">Inactive Expenses</h2>
                    <Badge variant="outline" className="text-slate-500 border-slate-300 dark:border-slate-700">
                      {inactiveExpenses.length}
                    </Badge>
                  </div>
                  <div className="grid gap-3 opacity-60">
                    {inactiveExpenses.map((expense) => (
                      <ExpenseCard
                        key={expense.id}
                        expense={expense}
                        menuOpenId={menuOpenId}
                        setMenuOpenId={setMenuOpenId}
                        onEdit={openEditDrawer}
                        onToggle={handleToggleActive}
                        onDelete={handleDelete}
                        formatPrice={formatPrice}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Empty State */}
              {data.expenses.length === 0 && (
                <div className="text-center py-16">
                  <div className="w-20 h-20 mx-auto bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mb-4">
                    <Receipt className="w-10 h-10 text-slate-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">No expenses yet</h3>
                  <p className="text-slate-500 dark:text-slate-400 mb-6 max-w-md mx-auto">
                    Add your operating expenses like rent, salaries, utilities to understand your true daily cost of running the business.
                  </p>
                  <Button onClick={openCreateDrawer} className="bg-[#259783] hover:bg-[#1e7a6a] text-white">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Your First Expense
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Add/Edit Expense Drawer */}
        <Drawer open={drawerOpen} onOpenChange={setDrawerOpen} direction="right">
          <DrawerContent className="!w-full sm:!w-[500px] !max-w-none h-full max-h-screen">
            <DrawerHeader className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 relative pr-12">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setDrawerOpen(false)}
                className="absolute right-4 top-4 h-10 w-10 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-400 border-2 border-slate-300 dark:border-slate-700 hover:border-red-300 dark:hover:border-red-700 transition-all shadow-sm hover:shadow-md"
              >
                <X className="h-5 w-5" />
              </Button>
              <DrawerTitle className="flex items-center gap-2 text-slate-900 dark:text-white pr-8">
                <Receipt className="w-5 h-5 text-orange-500" />
                {drawerMode === 'create' ? 'Add Expense' : 'Edit Expense'}
              </DrawerTitle>
              <DrawerDescription className="text-slate-600 dark:text-slate-400">
                {drawerMode === 'create' 
                  ? 'Add a recurring operating expense' 
                  : `Update ${selectedExpense?.name}`}
              </DrawerDescription>
            </DrawerHeader>
            <div className="overflow-y-auto p-6 flex-1 bg-white dark:bg-[#0f1a0d]">
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label className="text-slate-700 dark:text-slate-300">Expense Name *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Rent, Electricity, Salary"
                    required
                    className="h-12"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-slate-700 dark:text-slate-300">Category *</Label>
                    <Select
                      value={formData.category}
                      onValueChange={(value) => setFormData({ ...formData, category: value as ExpenseCategory })}
                    >
                      <SelectTrigger className="h-12">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fixed">
                          <div className="flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-blue-500" />
                            Fixed
                          </div>
                        </SelectItem>
                        <SelectItem value="variable">
                          <div className="flex items-center gap-2">
                            <Zap className="w-4 h-4 text-amber-500" />
                            Variable
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-slate-500">
                      {formData.category === 'fixed' 
                        ? 'Same cost regardless of sales' 
                        : 'Changes based on usage'}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-slate-700 dark:text-slate-300">Frequency *</Label>
                    <Select
                      value={formData.frequency}
                      onValueChange={(value) => setFormData({ ...formData, frequency: value as ExpenseFrequency })}
                    >
                      <SelectTrigger className="h-12">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="yearly">Yearly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-700 dark:text-slate-300">Amount (KES) *</Label>
                  <Input
                    type="number"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    placeholder="e.g., 30000"
                    required
                    min="0"
                    step="0.01"
                    className="h-12 text-lg"
                  />
                  {formData.amount && parseFloat(formData.amount) > 0 && (
                    <p className="text-sm text-[#259783] font-medium">
                      = {formatPrice(parseFloat(formData.amount) / (
                        formData.frequency === 'daily' ? 1 :
                        formData.frequency === 'weekly' ? 7 :
                        formData.frequency === 'monthly' ? 30 : 365
                      ))}/day
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-700 dark:text-slate-300">Start Date</Label>
                  <Input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="h-12"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-700 dark:text-slate-300">Notes (Optional)</Label>
                  <Input
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Any additional details"
                  />
                </div>

                {formError && (
                  <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm">
                    {formError}
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => setDrawerOpen(false)}
                    disabled={submitting}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 bg-[#259783] hover:bg-[#1e7a6a] text-white"
                    disabled={submitting}
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        {drawerMode === 'create' ? 'Adding...' : 'Saving...'}
                      </>
                    ) : (
                      drawerMode === 'create' ? 'Add Expense' : 'Save Changes'
                    )}
                  </Button>
                </div>
              </form>
            </div>
          </DrawerContent>
        </Drawer>

        {/* Click outside to close menu */}
        {menuOpenId && (
          <div className="fixed inset-0 z-0" onClick={() => setMenuOpenId(null)} />
        )}
      </div>
    </AdminLayout>
  );
}

// Expense Card Component
interface ExpenseCardProps {
  expense: Expense;
  menuOpenId: string | null;
  setMenuOpenId: (id: string | null) => void;
  onEdit: (expense: Expense) => void;
  onToggle: (expense: Expense) => void;
  onDelete: (expense: Expense) => void;
  formatPrice: (price: number) => string;
}

function ExpenseCard({
  expense,
  menuOpenId,
  setMenuOpenId,
  onEdit,
  onToggle,
  onDelete,
  formatPrice,
}: ExpenseCardProps) {
  return (
    <Card className="bg-white dark:bg-[#1c2e18] border border-slate-200 dark:border-slate-800">
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
              expense.category === 'fixed' 
                ? 'bg-blue-50 dark:bg-blue-900/20' 
                : 'bg-amber-50 dark:bg-amber-900/20'
            }`}>
              {expense.category === 'fixed' ? (
                <Building2 className="w-5 h-5 text-blue-500" />
              ) : (
                <Zap className="w-5 h-5 text-amber-500" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-slate-900 dark:text-white truncate">
                  {expense.name}
                </h3>
                <Badge variant="outline" className="text-xs">
                  {FREQUENCY_LABELS[expense.frequency]}
                </Badge>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {formatPrice(expense.amount)} {expense.frequency}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-lg font-bold text-orange-600 dark:text-orange-400">
                {formatPrice(expense.daily_cost)}
              </p>
              <p className="text-xs text-slate-400">/day</p>
            </div>
            <div className="relative">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setMenuOpenId(menuOpenId === expense.id ? null : expense.id)}
              >
                <MoreVertical className="w-4 h-4" />
              </Button>
              {menuOpenId === expense.id && (
                <div className="absolute right-0 top-full mt-1 w-40 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl z-10 py-1">
                  <button
                    className="w-full px-4 py-2 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2"
                    onClick={() => onEdit(expense)}
                  >
                    <Pencil className="w-4 h-4" />
                    Edit
                  </button>
                  <button
                    className="w-full px-4 py-2 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2"
                    onClick={() => onToggle(expense)}
                  >
                    <TrendingDown className="w-4 h-4" />
                    {expense.active === 1 ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2"
                    onClick={() => onDelete(expense)}
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
