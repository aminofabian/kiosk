'use client';

import { useEffect, useState } from 'react';
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
  Package, ArrowUpRight, ArrowDownRight, Sparkles, AlertTriangle
} from 'lucide-react';
import type { UnitType } from '@/lib/constants';

interface StockItem {
  itemId: string;
  itemName: string;
  variantName: string | null;
  unitType: UnitType;
  categoryName: string;
  initialStock: number;
  currentStock: number;
  stockChange: number;
  stockChangePercent: number | null;
  initialValue: number;
  currentValue: number;
  valueChange: number;
  firstBatchDate: number | null;
  totalEverStocked: number;
  trend: 'growing' | 'shrinking' | 'stable' | 'new';
}

interface AnalysisData {
  summary: {
    firstActivityDate: number | null;
    daysSinceStart: number;
    trajectory: 'expanding' | 'stable' | 'declining' | 'new';
    totalItems: number;
    itemsWithData: number;
    newItemsCount: number;
  };
  stockGrowth: {
    initialTotalStock: number;
    currentTotalStock: number;
    stockChange: number;
    stockChangePercent: number | null;
    initialTotalValue: number;
    currentTotalValue: number;
    valueChange: number;
    valueChangePercent: number | null;
  };
  trendBreakdown: {
    growing: number;
    shrinking: number;
    stable: number;
    new: number;
  };
  items: StockItem[];
  topGrowing: StockItem[];
  shrinking: StockItem[];
  newItems: StockItem[];
}

interface StockAnalysisDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function StockAnalysisDrawer({ open, onOpenChange }: StockAnalysisDrawerProps) {
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'items'>('overview');
  const [filter, setFilter] = useState<'all' | 'growing' | 'shrinking' | 'stable' | 'new'>('all');

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

  const formatChange = (change: number | null, showSign = true) => {
    if (change === null) return 'N/A';
    const sign = showSign && change >= 0 ? '+' : '';
    return `${sign}${change.toFixed(1)}%`;
  };

  const formatDate = (timestamp: number | null) => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp * 1000).toLocaleDateString('en-KE', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const getTrajectoryConfig = (trajectory: string) => {
    switch (trajectory) {
      case 'expanding':
        return { label: 'Expanding', color: 'text-green-600', bg: 'bg-green-500', icon: TrendingUp, desc: 'Your stock levels are growing!' };
      case 'declining':
        return { label: 'Declining', color: 'text-red-600', bg: 'bg-red-500', icon: TrendingDown, desc: 'Stock levels have decreased' };
      case 'stable':
        return { label: 'Stable', color: 'text-[#259783]', bg: 'bg-[#259783]', icon: Minus, desc: 'Stock levels are steady' };
      default:
        return { label: 'New', color: 'text-blue-600', bg: 'bg-blue-500', icon: Sparkles, desc: 'Just getting started!' };
    }
  };

  const getTrendConfig = (trend: string) => {
    switch (trend) {
      case 'growing': return { label: 'Growing', color: 'bg-green-500 text-white', icon: TrendingUp, textColor: 'text-green-600' };
      case 'shrinking': return { label: 'Shrinking', color: 'bg-red-500 text-white', icon: TrendingDown, textColor: 'text-red-600' };
      case 'stable': return { label: 'Stable', color: 'bg-[#259783] text-white', icon: Minus, textColor: 'text-[#259783]' };
      case 'new': return { label: 'New', color: 'bg-blue-500 text-white', icon: Sparkles, textColor: 'text-blue-600' };
      default: return { label: 'Unknown', color: 'bg-slate-400 text-white', icon: Minus, textColor: 'text-slate-600' };
    }
  };

  const getChangeColor = (change: number | null) => {
    if (change === null) return 'text-slate-500';
    if (change > 0) return 'text-green-600';
    if (change < 0) return 'text-red-600';
    return 'text-slate-600';
  };

  const filteredItems = analysisData?.items.filter(item => {
    if (filter === 'all') return true;
    return item.trend === filter;
  }) || [];

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
                Stock Analysis
              </DrawerTitle>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Initial vs Current Stock Levels
              </p>
            </div>
          </div>
          
          {/* Tabs */}
          <div className="flex gap-1 mt-3">
            {(['overview', 'items'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  activeTab === tab
                    ? 'bg-[#259783] text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {tab === 'overview' ? 'Overview' : 'All Items'}
              </button>
            ))}
          </div>
        </DrawerHeader>

        <div className="overflow-y-auto px-3 sm:px-4 pb-4 flex-1 bg-white dark:bg-[#0f1a0d]">
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <div className="text-center space-y-2">
                <Loader2 className="h-6 w-6 animate-spin mx-auto text-[#259783]" />
                <p className="text-sm text-muted-foreground">Analyzing stock...</p>
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
                  {/* Business Trajectory */}
                  <Card className="border-[#259783]/30 bg-gradient-to-br from-[#259783]/5 to-white dark:from-[#259783]/10 dark:to-[#0f1a0d]">
                    <CardContent className="p-3">
                      {(() => {
                        const trajectory = getTrajectoryConfig(analysisData.summary.trajectory);
                        const TrajectoryIcon = trajectory.icon;
                        return (
                          <>
                            <div className="flex items-center justify-between">
                              <div>
                                <span className="text-xs text-slate-600 dark:text-slate-400">Business Growth</span>
                                <div className="flex items-center gap-2 mt-1">
                                  <div className={`w-8 h-8 rounded-full ${trajectory.bg} flex items-center justify-center`}>
                                    <TrajectoryIcon className="w-4 h-4 text-white" />
                                  </div>
                                  <div>
                                    <span className={`text-xl font-bold ${trajectory.color}`}>
                                      {trajectory.label}
                                    </span>
                                    <p className="text-xs text-slate-500">{trajectory.desc}</p>
                                  </div>
                                </div>
                              </div>
                              {analysisData.stockGrowth.stockChangePercent !== null && (
                                <div className="text-right">
                                  <span className="text-xs text-slate-500">Overall Change</span>
                                  <p className={`text-2xl font-bold ${getChangeColor(analysisData.stockGrowth.stockChangePercent)}`}>
                                    {formatChange(analysisData.stockGrowth.stockChangePercent)}
                                  </p>
                                </div>
                              )}
                            </div>
                            {analysisData.summary.daysSinceStart > 0 && (
                              <p className="text-xs text-slate-500 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                                Tracking since {formatDate(analysisData.summary.firstActivityDate)} ({analysisData.summary.daysSinceStart} days)
                              </p>
                            )}
                          </>
                        );
                      })()}
                    </CardContent>
                  </Card>

                  {/* Stock Comparison */}
                  <div className="grid grid-cols-2 gap-2">
                    <Card className="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700">
                      <CardContent className="p-2.5">
                        <div className="flex items-center gap-1.5 mb-1">
                          <Package className="w-3.5 h-3.5 text-slate-500" />
                          <span className="text-xs text-slate-600 dark:text-slate-400">Initial Stock</span>
                        </div>
                        <p className="text-lg font-bold text-slate-700 dark:text-slate-300">
                          {formatNumber(analysisData.stockGrowth.initialTotalStock)} units
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Value: {formatCurrency(analysisData.stockGrowth.initialTotalValue)}
                        </p>
                      </CardContent>
                    </Card>
                    <Card className={`border-2 ${
                      analysisData.stockGrowth.stockChange > 0 
                        ? 'bg-green-50 dark:bg-green-950/20 border-green-300 dark:border-green-700'
                        : analysisData.stockGrowth.stockChange < 0
                          ? 'bg-red-50 dark:bg-red-950/20 border-red-300 dark:border-red-700'
                          : 'bg-[#259783]/10 dark:bg-[#259783]/20 border-[#259783]/30'
                    }`}>
                      <CardContent className="p-2.5">
                        <div className="flex items-center gap-1.5 mb-1">
                          <Package className={`w-3.5 h-3.5 ${getChangeColor(analysisData.stockGrowth.stockChange)}`} />
                          <span className="text-xs text-slate-600 dark:text-slate-400">Current Stock</span>
                        </div>
                        <p className={`text-lg font-bold ${getChangeColor(analysisData.stockGrowth.stockChange)}`}>
                          {formatNumber(analysisData.stockGrowth.currentTotalStock)} units
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Value: {formatCurrency(analysisData.stockGrowth.currentTotalValue)}
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Change Summary */}
                  <Card>
                    <CardContent className="p-3">
                      <h3 className="text-sm font-semibold mb-2">Stock Change</h3>
                      <div className="grid grid-cols-2 gap-3">
                        <div className={`p-2 rounded-lg ${
                          analysisData.stockGrowth.stockChange > 0 
                            ? 'bg-green-50 dark:bg-green-950/20' 
                            : analysisData.stockGrowth.stockChange < 0 
                              ? 'bg-red-50 dark:bg-red-950/20' 
                              : 'bg-slate-50 dark:bg-slate-900'
                        }`}>
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-xs text-slate-600">Units Change</span>
                            {analysisData.stockGrowth.stockChange > 0 
                              ? <ArrowUpRight className="w-3 h-3 text-green-600" />
                              : analysisData.stockGrowth.stockChange < 0 
                                ? <ArrowDownRight className="w-3 h-3 text-red-600" />
                                : <Minus className="w-3 h-3 text-slate-400" />
                            }
                          </div>
                          <p className={`text-base font-bold ${getChangeColor(analysisData.stockGrowth.stockChange)}`}>
                            {analysisData.stockGrowth.stockChange >= 0 ? '+' : ''}{formatNumber(analysisData.stockGrowth.stockChange)}
                          </p>
                        </div>
                        <div className={`p-2 rounded-lg ${
                          analysisData.stockGrowth.valueChange > 0 
                            ? 'bg-green-50 dark:bg-green-950/20' 
                            : analysisData.stockGrowth.valueChange < 0 
                              ? 'bg-red-50 dark:bg-red-950/20' 
                              : 'bg-slate-50 dark:bg-slate-900'
                        }`}>
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-xs text-slate-600">Value Change</span>
                            {analysisData.stockGrowth.valueChange > 0 
                              ? <ArrowUpRight className="w-3 h-3 text-green-600" />
                              : analysisData.stockGrowth.valueChange < 0 
                                ? <ArrowDownRight className="w-3 h-3 text-red-600" />
                                : <Minus className="w-3 h-3 text-slate-400" />
                            }
                          </div>
                          <p className={`text-base font-bold ${getChangeColor(analysisData.stockGrowth.valueChange)}`}>
                            {formatCurrency(analysisData.stockGrowth.valueChange)}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Trend Breakdown */}
                  <Card>
                    <CardContent className="p-3">
                      <h3 className="text-sm font-semibold mb-2">Items by Trend</h3>
                      <div className="grid grid-cols-4 gap-2">
                        <div className="text-center p-2 bg-green-50 dark:bg-green-950/20 rounded">
                          <TrendingUp className="w-4 h-4 text-green-600 mx-auto mb-1" />
                          <p className="text-lg font-bold text-green-600">{analysisData.trendBreakdown.growing}</p>
                          <p className="text-xs text-slate-600">Growing</p>
                        </div>
                        <div className="text-center p-2 bg-[#259783]/10 dark:bg-[#259783]/20 rounded">
                          <Minus className="w-4 h-4 text-[#259783] mx-auto mb-1" />
                          <p className="text-lg font-bold text-[#259783]">{analysisData.trendBreakdown.stable}</p>
                          <p className="text-xs text-slate-600">Stable</p>
                        </div>
                        <div className="text-center p-2 bg-red-50 dark:bg-red-950/20 rounded">
                          <TrendingDown className="w-4 h-4 text-red-600 mx-auto mb-1" />
                          <p className="text-lg font-bold text-red-600">{analysisData.trendBreakdown.shrinking}</p>
                          <p className="text-xs text-slate-600">Shrinking</p>
                        </div>
                        <div className="text-center p-2 bg-blue-50 dark:bg-blue-950/20 rounded">
                          <Sparkles className="w-4 h-4 text-blue-600 mx-auto mb-1" />
                          <p className="text-lg font-bold text-blue-600">{analysisData.trendBreakdown.new}</p>
                          <p className="text-xs text-slate-600">New Items</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Top Growing Items */}
                  {analysisData.topGrowing.length > 0 && (
                    <Card>
                      <CardContent className="p-3">
                        <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                          <TrendingUp className="w-4 h-4 text-green-600" />
                          Top Growing Items
                        </h3>
                        <div className="space-y-2">
                          {analysisData.topGrowing.map((item) => (
                            <div key={item.itemId} className="flex items-center justify-between text-xs bg-green-50/50 dark:bg-green-950/10 p-2 rounded">
                              <div className="flex-1 min-w-0">
                                <span className="font-medium truncate block">
                                  {item.variantName ? `${item.itemName} (${item.variantName})` : item.itemName}
                                </span>
                                <span className="text-slate-500">
                                  {formatNumber(item.initialStock)} → {formatNumber(item.currentStock)} {item.unitType}
                                </span>
                              </div>
                              <div className="text-right ml-2">
                                <span className="font-bold text-green-600">
                                  {formatChange(item.stockChangePercent)}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Shrinking Items (Warning) */}
                  {analysisData.shrinking.length > 0 && (
                    <Card className="border-red-200 dark:border-red-800">
                      <CardContent className="p-3">
                        <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5 text-red-600">
                          <AlertTriangle className="w-4 h-4" />
                          Shrinking Stock
                        </h3>
                        <div className="space-y-2">
                          {analysisData.shrinking.map((item) => (
                            <div key={item.itemId} className="flex items-center justify-between text-xs bg-red-50/50 dark:bg-red-950/10 p-2 rounded">
                              <div className="flex-1 min-w-0">
                                <span className="font-medium truncate block">
                                  {item.variantName ? `${item.itemName} (${item.variantName})` : item.itemName}
                                </span>
                                <span className="text-slate-500">
                                  {formatNumber(item.initialStock)} → {formatNumber(item.currentStock)} {item.unitType}
                                </span>
                              </div>
                              <div className="text-right ml-2">
                                <span className="font-bold text-red-600">
                                  {formatChange(item.stockChangePercent)}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* New Items */}
                  {analysisData.newItems.length > 0 && (
                    <Card className="border-blue-200 dark:border-blue-800">
                      <CardContent className="p-3">
                        <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5 text-blue-600">
                          <Sparkles className="w-4 h-4" />
                          New Items Added
                        </h3>
                        <div className="space-y-2">
                          {analysisData.newItems.map((item) => (
                            <div key={item.itemId} className="flex items-center justify-between text-xs bg-blue-50/50 dark:bg-blue-950/10 p-2 rounded">
                              <div className="flex-1 min-w-0">
                                <span className="font-medium truncate block">
                                  {item.variantName ? `${item.itemName} (${item.variantName})` : item.itemName}
                                </span>
                                <span className="text-slate-500">{item.categoryName}</span>
                              </div>
                              <div className="text-right ml-2">
                                <span className="font-bold text-blue-600">
                                  {formatNumber(item.currentStock)} {item.unitType}
                                </span>
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
                <>
                  {/* Filter */}
                  <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                    {(['all', 'growing', 'stable', 'shrinking', 'new'] as const).map((f) => (
                      <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`flex-1 px-2 py-1.5 text-xs font-medium rounded-md transition-colors ${
                          filter === f
                            ? 'bg-white dark:bg-slate-700 text-[#259783] shadow-sm'
                            : 'text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        {f.charAt(0).toUpperCase() + f.slice(1)}
                        <span className="ml-1 text-slate-400">
                          ({f === 'all' ? analysisData.items.length : analysisData.trendBreakdown[f as keyof typeof analysisData.trendBreakdown]})
                        </span>
                      </button>
                    ))}
                  </div>

                  {/* Items List */}
                  <div className="space-y-2">
                    {filteredItems.map((item) => {
                      const trendConfig = getTrendConfig(item.trend);
                      const TrendIcon = trendConfig.icon;
                      return (
                        <Card key={item.itemId} className={`border-l-2 ${
                          item.trend === 'growing' ? 'border-l-green-500' :
                          item.trend === 'shrinking' ? 'border-l-red-500' :
                          item.trend === 'new' ? 'border-l-blue-500' :
                          'border-l-[#259783]'
                        }`}>
                          <CardContent className="p-3">
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div className="flex-1 min-w-0">
                                <h4 className="font-semibold text-sm truncate">
                                  {item.variantName ? `${item.itemName} (${item.variantName})` : item.itemName}
                                </h4>
                                <p className="text-xs text-slate-500">{item.categoryName}</p>
                              </div>
                              <Badge className={`${trendConfig.color} text-xs h-5 gap-0.5`}>
                                <TrendIcon className="w-3 h-3" />
                                {trendConfig.label}
                              </Badge>
                            </div>
                            
                            <div className="grid grid-cols-3 gap-2 text-xs">
                              <div className="bg-slate-50 dark:bg-slate-900 p-1.5 rounded">
                                <p className="text-slate-500">Initial</p>
                                <p className="font-semibold">{formatNumber(item.initialStock)} {item.unitType}</p>
                              </div>
                              <div className={`p-1.5 rounded ${
                                item.stockChange > 0 ? 'bg-green-50 dark:bg-green-950/20' :
                                item.stockChange < 0 ? 'bg-red-50 dark:bg-red-950/20' :
                                'bg-[#259783]/10'
                              }`}>
                                <p className="text-slate-500">Current</p>
                                <p className={`font-semibold ${trendConfig.textColor}`}>
                                  {formatNumber(item.currentStock)} {item.unitType}
                                </p>
                              </div>
                              <div className={`p-1.5 rounded ${
                                item.stockChange > 0 ? 'bg-green-50 dark:bg-green-950/20' :
                                item.stockChange < 0 ? 'bg-red-50 dark:bg-red-950/20' :
                                'bg-slate-50 dark:bg-slate-900'
                              }`}>
                                <p className="text-slate-500">Change</p>
                                <p className={`font-semibold ${getChangeColor(item.stockChange)}`}>
                                  {item.stockChange >= 0 ? '+' : ''}{formatNumber(item.stockChange)}
                                  {item.stockChangePercent !== null && (
                                    <span className="text-xs ml-0.5">({formatChange(item.stockChangePercent, false)})</span>
                                  )}
                                </p>
                              </div>
                            </div>

                            {item.firstBatchDate && (
                              <p className="text-xs text-slate-400 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                                First stocked: {formatDate(item.firstBatchDate)}
                              </p>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}

                    {filteredItems.length === 0 && (
                      <div className="text-center py-8 text-slate-500">
                        <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No items match this filter</p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          ) : null}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
