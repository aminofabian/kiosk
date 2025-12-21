'use client';

import { useEffect, useState, useMemo } from 'react';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  X, TrendingUp, TrendingDown, Minus, BarChart3, Loader2, 
  Package, DollarSign, ShoppingCart, AlertTriangle, Zap, Clock
} from 'lucide-react';
import type { UnitType } from '@/lib/constants';

interface StockAnalysisItem {
  itemId: string;
  itemName: string;
  variantName: string | null;
  unitType: UnitType;
  categoryName: string;
  currentStock: number;
  currentSellPrice: number;
  inventoryValue: number;
  totalPurchased: number;
  totalSold: number;
  totalRevenue: number;
  totalProfit: number;
  turnoverRate: number;
  firstPurchaseDate: number | null;
  lastSaleDate: number | null;
  daysSinceLastSale: number | null;
  status: 'top_seller' | 'fast_moving' | 'normal' | 'slow_moving' | 'dead_stock' | 'new';
}

interface AnalysisData {
  summary: {
    totalItems: number;
    totalInventoryValue: number;
    totalStockUnits: number;
    totalPurchased: number;
    totalPurchaseValue: number;
    totalSold: number;
    totalSalesRevenue: number;
    totalProfit: number;
    turnoverRate: number;
    profitMargin: number;
    firstActivityDate: number | null;
    daysSinceStart: number;
  };
  healthIndicators: {
    topSellersCount: number;
    fastMovingCount: number;
    slowMovingCount: number;
    deadStockCount: number;
    stockHealthScore: number;
  };
  items: StockAnalysisItem[];
  topSellers: { itemId: string; itemName: string; totalSold: number; revenue: number; profit: number }[];
  slowMoving: { itemId: string; itemName: string; currentStock: number; daysSinceLastSale: number | null; inventoryValue: number }[];
  deadStock: { itemId: string; itemName: string; currentStock: number; inventoryValue: number }[];
}

interface StockAnalysisDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function StockAnalysisDrawer({ open, onOpenChange }: StockAnalysisDrawerProps) {
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'items' | 'alerts'>('overview');

  useEffect(() => {
    if (!open) return;

    async function fetchAnalysis() {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch('/api/stock/analysis');
        const result = await response.json();

        if (result.success) {
          setAnalysisData(result.data);
        } else {
          setError(result.message || 'Failed to load stock analysis');
        }
      } catch (err) {
        setError('Failed to load stock analysis');
        console.error('Error fetching stock analysis:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchAnalysis();
  }, [open]);

  const formatCurrency = (amount: number) => {
    return `KES ${amount.toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  const formatNumber = (num: number) => {
    return num.toLocaleString('en-KE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  };

  const getBusinessHealth = (score: number) => {
    if (score >= 70) return { label: 'Excellent', color: 'text-green-600', bg: 'bg-green-500' };
    if (score >= 50) return { label: 'Good', color: 'text-[#259783]', bg: 'bg-[#259783]' };
    if (score >= 30) return { label: 'Fair', color: 'text-amber-600', bg: 'bg-amber-500' };
    return { label: 'Needs Attention', color: 'text-red-600', bg: 'bg-red-500' };
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'top_seller': return { label: 'Top Seller', color: 'bg-green-500 text-white' };
      case 'fast_moving': return { label: 'Fast Moving', color: 'bg-[#259783] text-white' };
      case 'normal': return { label: 'Normal', color: 'bg-slate-400 text-white' };
      case 'slow_moving': return { label: 'Slow', color: 'bg-amber-500 text-white' };
      case 'dead_stock': return { label: 'Dead Stock', color: 'bg-red-500 text-white' };
      case 'new': return { label: 'New', color: 'bg-blue-500 text-white' };
      default: return { label: 'Unknown', color: 'bg-slate-400 text-white' };
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="right">
      <DrawerContent className="!w-full sm:!w-[600px] md:!w-[700px] !max-w-none h-full max-h-screen flex flex-col">
        <DrawerHeader className="border-b bg-gradient-to-br from-[#259783]/10 via-[#259783]/5 to-white dark:from-[#259783]/20 dark:via-[#259783]/10 dark:to-[#0f1a0d] relative pr-12 pb-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onOpenChange(false)}
            className="absolute right-3 top-3 h-7 w-7 hover:bg-[#259783]/20"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-full bg-[#259783] flex items-center justify-center shadow-md shadow-[#259783]/30">
              <BarChart3 className="w-4.5 h-4.5 text-white" />
            </div>
            <div>
              <DrawerTitle className="text-lg text-[#259783] dark:text-[#45d827]">
                Business Health
              </DrawerTitle>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Stock & Sales Analysis
              </p>
            </div>
          </div>
          
          {/* Tabs */}
          <div className="flex gap-1 mt-3">
            {(['overview', 'items', 'alerts'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  activeTab === tab
                    ? 'bg-[#259783] text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {tab === 'overview' ? 'Overview' : tab === 'items' ? 'Items' : 'Alerts'}
                {tab === 'alerts' && analysisData && (analysisData.healthIndicators.slowMovingCount + analysisData.healthIndicators.deadStockCount) > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 text-xs bg-red-500 text-white rounded-full">
                    {analysisData.healthIndicators.slowMovingCount + analysisData.healthIndicators.deadStockCount}
                  </span>
                )}
              </button>
            ))}
          </div>
        </DrawerHeader>

        <div className="overflow-y-auto px-3 sm:px-4 pb-4 flex-1 bg-white dark:bg-[#0f1a0d]">
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <div className="text-center space-y-2">
                <Loader2 className="h-6 w-6 animate-spin mx-auto text-[#259783]" />
                <p className="text-sm text-muted-foreground">Analyzing business...</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-48">
              <div className="text-center space-y-2">
                <p className="text-sm text-destructive">{error}</p>
                <Button onClick={() => onOpenChange(false)} variant="outline" size="sm">
                  Close
                </Button>
              </div>
            </div>
          ) : analysisData ? (
            <div className="space-y-3 py-3">
              {activeTab === 'overview' && (
                <>
                  {/* Health Score */}
                  <Card className="border-[#259783]/30 bg-gradient-to-br from-[#259783]/5 to-white dark:from-[#259783]/10 dark:to-[#0f1a0d]">
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-slate-600 dark:text-slate-400">Stock Health Score</span>
                        <Badge className={getBusinessHealth(analysisData.healthIndicators.stockHealthScore).color + ' text-xs'}>
                          {getBusinessHealth(analysisData.healthIndicators.stockHealthScore).label}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-3xl font-bold text-[#259783]">
                          {analysisData.healthIndicators.stockHealthScore}%
                        </span>
                        <div className="flex-1">
                          <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${getBusinessHealth(analysisData.healthIndicators.stockHealthScore).bg}`}
                              style={{ width: `${analysisData.healthIndicators.stockHealthScore}%` }}
                            />
                          </div>
                        </div>
                      </div>
                      {analysisData.summary.daysSinceStart > 0 && (
                        <p className="text-xs text-slate-500 mt-2">
                          Business running for {analysisData.summary.daysSinceStart} days
                        </p>
                      )}
                    </CardContent>
                  </Card>

                  {/* Key Metrics */}
                  <div className="grid grid-cols-2 gap-2">
                    <Card className="bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
                      <CardContent className="p-2.5">
                        <div className="flex items-center gap-1.5 mb-1">
                          <DollarSign className="w-3.5 h-3.5 text-green-600" />
                          <span className="text-xs text-green-700 dark:text-green-300">Revenue</span>
                        </div>
                        <p className="text-lg font-bold text-green-600">
                          {formatCurrency(analysisData.summary.totalSalesRevenue)}
                        </p>
                        <p className="text-xs text-green-600/70 mt-0.5">
                          Profit: {formatCurrency(analysisData.summary.totalProfit)}
                        </p>
                      </CardContent>
                    </Card>
                    <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
                      <CardContent className="p-2.5">
                        <div className="flex items-center gap-1.5 mb-1">
                          <Package className="w-3.5 h-3.5 text-blue-600" />
                          <span className="text-xs text-blue-700 dark:text-blue-300">Inventory Value</span>
                        </div>
                        <p className="text-lg font-bold text-blue-600">
                          {formatCurrency(analysisData.summary.totalInventoryValue)}
                        </p>
                        <p className="text-xs text-blue-600/70 mt-0.5">
                          {formatNumber(analysisData.summary.totalStockUnits)} units in stock
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Turnover & Margin */}
                  <div className="grid grid-cols-2 gap-2">
                    <Card className="border-slate-200 dark:border-slate-700">
                      <CardContent className="p-2.5">
                        <div className="flex items-center gap-1.5 mb-1">
                          <TrendingUp className="w-3.5 h-3.5 text-[#259783]" />
                          <span className="text-xs text-slate-600 dark:text-slate-400">Turnover Rate</span>
                        </div>
                        <p className="text-lg font-bold text-[#259783]">
                          {analysisData.summary.turnoverRate.toFixed(1)}%
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Stock sold vs purchased
                        </p>
                      </CardContent>
                    </Card>
                    <Card className="border-slate-200 dark:border-slate-700">
                      <CardContent className="p-2.5">
                        <div className="flex items-center gap-1.5 mb-1">
                          <Zap className="w-3.5 h-3.5 text-amber-600" />
                          <span className="text-xs text-slate-600 dark:text-slate-400">Profit Margin</span>
                        </div>
                        <p className="text-lg font-bold text-amber-600">
                          {analysisData.summary.profitMargin.toFixed(1)}%
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Profit / Revenue
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Stock Health Breakdown */}
                  <Card>
                    <CardContent className="p-3">
                      <h3 className="text-sm font-semibold mb-2">Stock Status Breakdown</h3>
                      <div className="grid grid-cols-4 gap-2">
                        <div className="text-center p-2 bg-green-50 dark:bg-green-950/20 rounded">
                          <Zap className="w-4 h-4 text-green-600 mx-auto mb-1" />
                          <p className="text-lg font-bold text-green-600">{analysisData.healthIndicators.topSellersCount}</p>
                          <p className="text-xs text-slate-600">Top Sellers</p>
                        </div>
                        <div className="text-center p-2 bg-[#259783]/10 dark:bg-[#259783]/20 rounded">
                          <TrendingUp className="w-4 h-4 text-[#259783] mx-auto mb-1" />
                          <p className="text-lg font-bold text-[#259783]">{analysisData.healthIndicators.fastMovingCount}</p>
                          <p className="text-xs text-slate-600">Fast Moving</p>
                        </div>
                        <div className="text-center p-2 bg-amber-50 dark:bg-amber-950/20 rounded">
                          <Clock className="w-4 h-4 text-amber-600 mx-auto mb-1" />
                          <p className="text-lg font-bold text-amber-600">{analysisData.healthIndicators.slowMovingCount}</p>
                          <p className="text-xs text-slate-600">Slow Moving</p>
                        </div>
                        <div className="text-center p-2 bg-red-50 dark:bg-red-950/20 rounded">
                          <AlertTriangle className="w-4 h-4 text-red-600 mx-auto mb-1" />
                          <p className="text-lg font-bold text-red-600">{analysisData.healthIndicators.deadStockCount}</p>
                          <p className="text-xs text-slate-600">Dead Stock</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Top Sellers */}
                  {analysisData.topSellers.length > 0 && (
                    <Card>
                      <CardContent className="p-3">
                        <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                          <Zap className="w-4 h-4 text-green-600" />
                          Top Sellers
                        </h3>
                        <div className="space-y-2">
                          {analysisData.topSellers.map((item, i) => (
                            <div key={item.itemId} className="flex items-center justify-between text-xs">
                              <div className="flex items-center gap-2">
                                <span className="w-5 h-5 rounded-full bg-green-100 text-green-600 flex items-center justify-center font-bold text-xs">
                                  {i + 1}
                                </span>
                                <span className="font-medium truncate max-w-[150px]">{item.itemName}</span>
                              </div>
                              <div className="text-right">
                                <span className="font-bold text-green-600">{formatCurrency(item.revenue)}</span>
                                <span className="text-slate-400 ml-1">({formatNumber(item.totalSold)} sold)</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </>
              )}

              {activeTab === 'items' && (
                <div className="space-y-2">
                  {analysisData.items.map((item) => {
                    const statusConfig = getStatusConfig(item.status);
                    return (
                      <Card key={item.itemId} className="border-l-2 border-l-slate-300">
                        <CardContent className="p-3">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex-1 min-w-0">
                              <h4 className="font-semibold text-sm truncate">
                                {item.variantName ? `${item.itemName} (${item.variantName})` : item.itemName}
                              </h4>
                              <p className="text-xs text-slate-500">{item.categoryName}</p>
                            </div>
                            <Badge className={`${statusConfig.color} text-xs h-5`}>
                              {statusConfig.label}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-xs">
                            <div>
                              <p className="text-slate-500">Stock</p>
                              <p className="font-semibold">{formatNumber(item.currentStock)} {item.unitType}</p>
                            </div>
                            <div>
                              <p className="text-slate-500">Sold</p>
                              <p className="font-semibold text-green-600">{formatNumber(item.totalSold)}</p>
                            </div>
                            <div>
                              <p className="text-slate-500">Revenue</p>
                              <p className="font-semibold">{formatCurrency(item.totalRevenue)}</p>
                            </div>
                          </div>
                          <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-slate-500">Turnover</span>
                              <span className="font-semibold">{item.turnoverRate.toFixed(1)}%</span>
                            </div>
                            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1 mt-1">
                              <div
                                className="h-1 rounded-full bg-[#259783]"
                                style={{ width: `${Math.min(item.turnoverRate, 100)}%` }}
                              />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}

              {activeTab === 'alerts' && (
                <div className="space-y-3">
                  {analysisData.deadStock.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5 text-red-600">
                        <AlertTriangle className="w-4 h-4" />
                        Dead Stock ({analysisData.deadStock.length})
                      </h3>
                      <div className="space-y-2">
                        {analysisData.deadStock.map((item) => (
                          <Card key={item.itemId} className="border-l-2 border-l-red-500 bg-red-50/50 dark:bg-red-950/10">
                            <CardContent className="p-3">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="font-semibold text-sm">{item.itemName}</p>
                                  <p className="text-xs text-slate-500">{formatNumber(item.currentStock)} units • Never sold</p>
                                </div>
                                <div className="text-right">
                                  <p className="text-xs text-slate-500">Value tied up</p>
                                  <p className="font-bold text-red-600 text-sm">{formatCurrency(item.inventoryValue)}</p>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}

                  {analysisData.slowMoving.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5 text-amber-600">
                        <Clock className="w-4 h-4" />
                        Slow Moving ({analysisData.slowMoving.length})
                      </h3>
                      <div className="space-y-2">
                        {analysisData.slowMoving.map((item) => (
                          <Card key={item.itemId} className="border-l-2 border-l-amber-500 bg-amber-50/50 dark:bg-amber-950/10">
                            <CardContent className="p-3">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="font-semibold text-sm">{item.itemName}</p>
                                  <p className="text-xs text-slate-500">
                                    {item.daysSinceLastSale !== null 
                                      ? `Last sale ${item.daysSinceLastSale} days ago`
                                      : 'No recent sales'}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="text-xs text-slate-500">{formatNumber(item.currentStock)} in stock</p>
                                  <p className="font-bold text-amber-600 text-sm">{formatCurrency(item.inventoryValue)}</p>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}

                  {analysisData.deadStock.length === 0 && analysisData.slowMoving.length === 0 && (
                    <div className="text-center py-12">
                      <div className="w-16 h-16 mx-auto bg-green-100 dark:bg-green-950/30 rounded-full flex items-center justify-center mb-3">
                        <TrendingUp className="w-8 h-8 text-green-600" />
                      </div>
                      <p className="font-semibold text-green-600">All Clear!</p>
                      <p className="text-xs text-slate-500 mt-1">No stock issues detected</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : null}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
