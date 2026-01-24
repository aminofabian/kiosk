'use client';

import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/drawer';
import { ArrowRight, User, Loader2, CreditCard, CheckCircle, DollarSign, X, ShoppingBag, Package } from 'lucide-react';
import type { CreditAccount, CreditTransaction, SaleItem } from '@/lib/db/types';
import { SearchFilterSection } from './SearchFilterSection';
import { PaymentForm } from './PaymentForm';
import { apiGet } from '@/lib/utils/api-client';

interface SaleItemWithDetails extends SaleItem {
  item_name: string;
  item_unit_type: string;
}

interface CreditTransactionWithDetails extends CreditTransaction {
  user_name?: string;
  sale_date?: number;
  items?: SaleItemWithDetails[];
}

export function CreditList() {
  const [accounts, setAccounts] = useState<CreditAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'amount' | 'date'>('amount');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<CreditAccount | null>(null);
  const [transactions, setTransactions] = useState<CreditTransactionWithDetails[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    async function fetchCredits() {
      try {
        setLoading(true);
        const result = await apiGet<CreditAccount[]>('/api/credits');

        if (result.success) {
          setAccounts(result.data ?? []);
        } else {
          setError(result.message || 'Failed to load credits');
        }
      } catch (err) {
        setError('Failed to load credits');
        console.error('Error fetching credits:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchCredits();
  }, []);

  const formatPrice = (price: number) => {
    return `KES ${price.toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  const formatDate = (timestamp: number | null) => {
    if (!timestamp) return 'Never';
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString('en-KE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const handleOpenPaymentDrawer = async (account: CreditAccount) => {
    setSelectedAccount(account);
    setDrawerOpen(true);
    setLoadingDetails(true);
    setTransactions([]);

    try {
      const result = await apiGet<{ account: CreditAccount; transactions: CreditTransactionWithDetails[] }>(
        `/api/credits/${account.id}`
      );
      if (result.success && result.data?.transactions) {
        setTransactions(result.data.transactions);
      }
    } catch (err) {
      console.error('Error fetching credit details:', err);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handlePaymentSuccess = async () => {
    setDrawerOpen(false);
    setSelectedAccount(null);
    // Refresh the credits list
    try {
      const result = await apiGet<CreditAccount[]>('/api/credits');
      if (result.success) {
        setAccounts(result.data ?? []);
      }
    } catch (err) {
      console.error('Error refreshing credits:', err);
    }
  };

  const outstandingAccounts = useMemo(() => {
    return accounts
      .filter((acc) => acc.total_credit > 0)
      .filter((acc) => {
        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          return (
            acc.customer_name.toLowerCase().includes(query) ||
            acc.customer_phone?.toLowerCase().includes(query)
          );
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'name') {
          return a.customer_name.localeCompare(b.customer_name);
        }
        if (sortBy === 'date') {
          const aDate = a.last_transaction_at || 0;
          const bDate = b.last_transaction_at || 0;
          return bDate - aDate;
        }
        return b.total_credit - a.total_credit;
      });
  }, [accounts, searchQuery, sortBy]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center mx-auto">
            <Loader2 className="h-8 w-8 text-red-500 animate-spin" />
          </div>
          <p className="text-slate-500 dark:text-slate-400 font-medium">Loading credits...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-3">
          <div className="w-16 h-16 mx-auto bg-red-50 dark:bg-red-900/20 rounded-2xl flex items-center justify-center">
            <span className="text-2xl">⚠️</span>
          </div>
          <p className="text-red-600 dark:text-red-400 font-semibold">{error}</p>
        </div>
      </div>
    );
  }

  if (accounts.length === 0 || outstandingAccounts.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-4">
          <div className="w-20 h-20 mx-auto bg-green-50 dark:bg-green-900/20 rounded-2xl flex items-center justify-center">
            <CheckCircle className="w-10 h-10 text-green-500" />
          </div>
          <p className="text-lg font-semibold text-green-600 dark:text-green-400">No outstanding credits!</p>
          <p className="text-sm text-slate-400">
            {searchQuery ? 'Try adjusting your search' : 'All customers have paid their debts'}
          </p>
        </div>
      </div>
    );
  }

  const totalOutstanding = outstandingAccounts.reduce((sum, acc) => sum + acc.total_credit, 0);

  return (
    <div className="space-y-4">
      {/* Summary Card */}
      <Card className="bg-gradient-to-br from-red-500 to-red-600 border-0 shadow-lg shadow-red-500/20">
        <CardContent className="p-3.5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-red-100 text-[10px] font-bold uppercase tracking-wide mb-0.5">Total Outstanding</p>
              <p className="text-xl font-black text-white">{formatPrice(totalOutstanding)}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="bg-white/20 text-white border-0 text-[9px]">
                {outstandingAccounts.length} customers
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <SearchFilterSection
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search by customer name or phone..."
        sortOptions={[
          { value: 'amount', label: 'Sort by Amount (Highest)' },
          { value: 'name', label: 'Sort by Name' },
          { value: 'date', label: 'Sort by Last Transaction' },
        ]}
        sortValue={sortBy}
        onSortChange={(v) => setSortBy(v as 'name' | 'amount' | 'date')}
      />

      <div className="space-y-3">
        {outstandingAccounts.map((account) => (
          <Card
            key={account.id}
            className="bg-white dark:bg-[#1c2e18] border border-slate-200 dark:border-slate-800 hover:shadow-lg hover:shadow-slate-200/50 dark:hover:shadow-slate-900/50 transition-all"
          >
            <CardContent className="p-3">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="w-9 h-9 bg-red-50 dark:bg-red-900/20 flex items-center justify-center flex-shrink-0 border-2 border-red-200 dark:border-red-800">
                    <User className="w-4 h-4 text-red-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <h3 className="font-black text-sm text-slate-900 dark:text-white truncate">
                        {account.customer_name}
                      </h3>
                      <Badge variant="destructive" className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 text-[9px]">
                        Outstanding
                      </Badge>
                    </div>
                    {account.customer_phone && (
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        📱 {account.customer_phone}
                      </p>
                    )}
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Last transaction: {formatDate(account.last_transaction_at)}
                    </p>
                  </div>
                </div>
                <div className="text-right flex flex-col items-end gap-2">
                  <p className="text-lg font-black text-red-500">
                    {formatPrice(account.total_credit)}
                  </p>
                  <Button 
                    className="bg-[#259783] hover:bg-[#45d827] text-white rounded-lg" 
                    size="sm"
                    onClick={() => handleOpenPaymentDrawer(account)}
                  >
                    Collect
                    <ArrowRight className="ml-2 h-3 w-3" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Payment Drawer */}
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen} direction="right">
        <DrawerContent className="!w-full sm:!w-[600px] !max-w-none h-full max-h-screen">
          <DrawerHeader className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 relative pr-12">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setDrawerOpen(false)}
              className="absolute right-4 top-4 h-10 w-10 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-400 border-2 border-slate-300 dark:border-slate-700 hover:border-red-300 dark:hover:border-red-700 transition-all shadow-sm hover:shadow-md"
            >
              <X className="h-5 w-5" />
              <span className="sr-only">Close</span>
            </Button>
            <DrawerTitle className="flex items-center gap-2 text-slate-900 dark:text-white pr-8">
              <DollarSign className="w-5 h-5 text-[#259783]" />
              Collect Payment
            </DrawerTitle>
            <DrawerDescription className="text-slate-600 dark:text-slate-400">
              {selectedAccount && `Record payment for ${selectedAccount.customer_name}`}
            </DrawerDescription>
          </DrawerHeader>
          <div className="overflow-y-auto p-6 flex-1 bg-white dark:bg-[#0f1a0d]">
            {selectedAccount && (
              <div className="space-y-6">
                {/* Items Purchased Section */}
                <Card className="border border-slate-200 dark:border-slate-800">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-4">
                      <ShoppingBag className="w-5 h-5 text-[#259783]" />
                      <h3 className="font-bold text-slate-900 dark:text-white">Items Purchased on Credit</h3>
                    </div>
                    
                    {loadingDetails ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-6 h-6 text-[#259783] animate-spin" />
                      </div>
                    ) : transactions.filter(t => t.type === 'debt' && t.items && t.items.length > 0).length === 0 ? (
                      <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-4">
                        No item details available
                      </p>
                    ) : (
                      <div className="space-y-4">
                        {transactions
                          .filter(t => t.type === 'debt' && t.items && t.items.length > 0)
                          .map((transaction) => (
                            <div key={transaction.id} className="border border-slate-100 dark:border-slate-800 rounded-lg p-3">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                                  {transaction.sale_date
                                    ? new Date(transaction.sale_date * 1000).toLocaleDateString('en-KE', {
                                        year: 'numeric',
                                        month: 'short',
                                        day: 'numeric',
                                      })
                                    : formatDate(transaction.created_at)}
                                </span>
                                <Badge variant="outline" className="text-[9px] bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400 border-amber-200 dark:border-amber-800">
                                  {formatPrice(transaction.amount)}
                                </Badge>
                              </div>
                              <div className="space-y-1.5">
                                {transaction.items?.map((item) => (
                                  <div key={item.id} className="flex items-center justify-between text-sm">
                                    <div className="flex items-center gap-2">
                                      <Package className="w-3.5 h-3.5 text-slate-400" />
                                      <span className="text-slate-700 dark:text-slate-300">{item.item_name}</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                                      <span>
                                        {item.quantity_sold} {item.item_unit_type === 'kg' ? 'kg' : item.quantity_sold === 1 ? 'pc' : 'pcs'}
                                      </span>
                                      <span className="font-medium text-slate-700 dark:text-slate-300">
                                        {formatPrice(item.sell_price_per_unit * item.quantity_sold)}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Payment Form */}
                <PaymentForm account={selectedAccount} onSuccess={handlePaymentSuccess} />
              </div>
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
