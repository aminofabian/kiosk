'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, SlidersHorizontal } from 'lucide-react';

interface FilterOption {
  value: string;
  label: string;
}

interface SearchFilterSectionProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  filters?: Array<{
    label: string;
    value: string;
    options: FilterOption[];
    onChange: (value: string) => void;
  }>;
  sortOptions?: FilterOption[];
  sortValue?: string;
  onSortChange?: (value: string) => void;
}

export function SearchFilterSection({
  searchQuery,
  onSearchChange,
  searchPlaceholder = 'Search...',
  filters = [],
  sortOptions = [],
  sortValue,
  onSortChange,
}: SearchFilterSectionProps) {
  const hasFilters = filters.length > 0 || sortOptions.length > 0;

  return (
    <Card className="bg-white dark:bg-[#1c2e18] border border-slate-200 dark:border-slate-800">
      <CardContent className="p-4">
        <div className="flex flex-col gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder={searchPlaceholder}
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-9 h-11 bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 focus-visible:ring-[#259783]"
            />
          </div>

          {hasFilters && (
            <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              {filters.length > 0 && (
                <>
                  <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                    <SlidersHorizontal className="h-4 w-4" />
                    <span className="hidden sm:inline">Filters:</span>
                  </div>
                  {filters.map((filter, index) => (
                    <Select
                      key={index}
                      value={filter.value}
                      onValueChange={filter.onChange}
                    >
                      <SelectTrigger className="h-9 min-w-[140px] bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
                        <SelectValue placeholder={filter.label} />
                      </SelectTrigger>
                      <SelectContent>
                        {filter.options.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ))}
                </>
              )}

              {sortOptions.length > 0 && sortValue && onSortChange && (
                <Select value={sortValue} onValueChange={onSortChange}>
                  <SelectTrigger className="h-9 min-w-[160px] ml-auto bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    {sortOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
