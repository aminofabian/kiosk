'use client';

import { Camera, Loader2, Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import type { RefObject } from 'react';

interface PosMobileSearchBarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onSearchSubmit: (e: React.FormEvent) => void;
  onSearchKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onClear: () => void;
  onOpenCamera: () => void;
  onFocus?: () => void;
  inputRef?: RefObject<HTMLInputElement | null>;
  containerRef?: RefObject<HTMLDivElement | null>;
  placeholder?: string;
  isPending?: boolean;
  isScanning?: boolean;
  isLoadingSuggestions?: boolean;
  suggestions?: React.ReactNode;
  className?: string;
}

export function PosMobileSearchBar({
  searchQuery,
  onSearchChange,
  onSearchSubmit,
  onSearchKeyDown,
  onClear,
  onOpenCamera,
  onFocus,
  inputRef,
  containerRef,
  placeholder = 'Search products, scan barcode...',
  isPending,
  isScanning,
  isLoadingSuggestions,
  suggestions,
  className = '',
}: PosMobileSearchBarProps) {
  const showSpinner = isPending || isScanning || isLoadingSuggestions;

  return (
    <div
      className={`shrink-0 z-20 border-b border-gray-100/80 dark:border-gray-800/60 bg-white/95 dark:bg-[#1a2c17]/95 backdrop-blur-xl px-3 py-2 ${className}`}
    >
      <div ref={containerRef} className="relative max-w-3xl mx-auto">
        <form onSubmit={onSearchSubmit}>
          <div className="relative group/input">
            <div className="relative">
              {showSpinner ? (
                <Loader2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#1c6a1e] animate-spin z-10" />
              ) : (
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within/input:text-[#1c6a1e] transition-colors z-10" />
              )}
              <Input
                ref={inputRef}
                type="search"
                enterKeyHint="search"
                placeholder={placeholder}
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                onFocus={onFocus}
                onKeyDown={onSearchKeyDown}
                className="pl-10 pr-[4.5rem] h-11 bg-white dark:bg-[#1c2e18] rounded-xl border border-gray-200/80 dark:border-gray-700/60 focus:border-transparent focus:ring-0 text-[15px] font-medium shadow-sm"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                data-barcode-enabled="true"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 z-10">
                <button
                  type="button"
                  onClick={onOpenCamera}
                  className="h-8 w-8 flex items-center justify-center rounded-lg bg-[#1c6a1e]/10 dark:bg-[#1c6a1e]/20 hover:bg-[#1c6a1e]/20 transition-all active:scale-90"
                  aria-label="Scan barcode with camera"
                >
                  <Camera className="w-4 h-4 text-[#1c6a1e]" />
                </button>
                {searchQuery && (
                  <button
                    type="button"
                    onClick={onClear}
                    className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                    aria-label="Clear search"
                  >
                    <X className="w-4 h-4 text-gray-500" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </form>
        {suggestions}
      </div>
    </div>
  );
}
