"use client";

import { useEffect, useMemo } from "react";
import { Clock, Package, Search, Tag, X } from "lucide-react";
import type { PosSearchSuggestion } from "@/lib/hooks/use-pos-search";
import { groupPosSearchSuggestions } from "@/lib/search/group-pos-suggestions";
import { highlightSearchMatch } from "@/lib/search/highlight-match";

export interface PosSearchSuggestionsDropdownProps {
  isDesktop?: boolean;
  searchQuery: string;
  debouncedSearchQuery: string;
  loadingSuggestions: boolean;
  showSuggestions: boolean;
  searchFocused: boolean;
  recentSearches: string[];
  searchSuggestions: PosSearchSuggestion[];
  selectedSuggestionIndex: number;
  flatSuggestionsRef: React.MutableRefObject<PosSearchSuggestion[]>;
  onSelectSuggestion: (suggestion: PosSearchSuggestion) => void;
  onRecentSearchClick: (query: string) => void;
  onDismiss: () => void;
  onClearSearch: () => void;
  setSelectedSuggestionIndex: (index: number | ((prev: number) => number)) => void;
}

export function PosSearchSuggestionsDropdown({
  isDesktop = false,
  searchQuery,
  debouncedSearchQuery,
  loadingSuggestions,
  showSuggestions,
  searchFocused,
  recentSearches,
  searchSuggestions,
  selectedSuggestionIndex,
  flatSuggestionsRef,
  onSelectSuggestion,
  onRecentSearchClick,
  onDismiss,
  onClearSearch,
  setSelectedSuggestionIndex,
}: PosSearchSuggestionsDropdownProps) {
  const grouped = useMemo(
    () => groupPosSearchSuggestions(searchSuggestions),
    [searchSuggestions],
  );

  useEffect(() => {
    flatSuggestionsRef.current = grouped.flatItems;
  }, [grouped.flatItems, flatSuggestionsRef]);

  const showSkeleton =
    loadingSuggestions &&
    searchQuery &&
    searchSuggestions.length === 0 &&
    !showSuggestions &&
    !debouncedSearchQuery;
  const showResults = showSuggestions && searchSuggestions.length > 0;
  const showRecentSearches =
    searchFocused &&
    !searchQuery.trim() &&
    recentSearches.length > 0 &&
    showSuggestions;
  const showNoResults =
    !loadingSuggestions &&
    searchQuery.length >= 2 &&
    searchSuggestions.length === 0 &&
    showSuggestions &&
    !showRecentSearches;

  if (!showSkeleton && !showResults && !showNoResults && !showRecentSearches) {
    return null;
  }

  const { groups, flatItems } = grouped;
  let flatIndex = -1;

  const renderItem = (
    suggestion: PosSearchSuggestion,
    isVariant: boolean,
    isLastInGroup: boolean,
  ) => {
    flatIndex++;
    const currentFlatIndex = flatIndex;
    const isSelected = currentFlatIndex === selectedSuggestionIndex;

    return (
      <button
        key={suggestion.id}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onSelectSuggestion(suggestion);
        }}
        onMouseEnter={() => setSelectedSuggestionIndex(currentFlatIndex)}
        className={`w-full flex items-center gap-2.5 text-left transition-colors duration-75 ${
          isVariant
            ? `pl-3 pr-3 py-[9px] ${!isLastInGroup ? "border-b border-gray-100/60 dark:border-gray-800/40" : ""}`
            : "px-3 py-[10px]"
        } ${
          isSelected
            ? "bg-[#1c6a1e]/[0.06] dark:bg-[#1c6a1e]/10"
            : "hover:bg-gray-50/80 dark:hover:bg-white/[0.03]"
        }`}
      >
        <div
          className={`${isVariant ? "w-7 h-7" : "w-9 h-9"} rounded-[3px] flex items-center justify-center flex-shrink-0 transition-all duration-100 ${
            isSelected
              ? "bg-[#1c6a1e] shadow-sm shadow-[#1c6a1e]/20"
              : isVariant
                ? "bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700/40"
                : "bg-gray-100 dark:bg-gray-800/70 border border-gray-100 dark:border-gray-700/40"
          }`}
        >
          {isVariant ? (
            <Tag
              className={`w-3 h-3 ${isSelected ? "text-white" : "text-gray-400 dark:text-gray-500"}`}
            />
          ) : (
            <Package
              className={`w-4 h-4 ${isSelected ? "text-white" : "text-gray-400 dark:text-gray-500"}`}
            />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div
            className={`${isVariant ? "text-[12.5px]" : "text-[13px]"} font-medium truncate leading-snug transition-colors ${
              isSelected
                ? "text-[#1c6a1e] dark:text-[#2a8a30]"
                : "text-gray-800 dark:text-gray-200"
            }`}
          >
            {isVariant && suggestion.variant_name
              ? highlightSearchMatch(suggestion.variant_name, searchQuery)
              : highlightSearchMatch(suggestion.name, searchQuery)}
          </div>
          <div className="flex items-center gap-1 mt-[2px] flex-wrap">
            {!isVariant &&
              suggestion.variant_name &&
              suggestion.sibling_count &&
              suggestion.sibling_count > 1 &&
              suggestion.parent_name && (
                <span className="text-[10px] text-gray-400 dark:text-gray-500">
                  {highlightSearchMatch(suggestion.parent_name, searchQuery)} ›
                </span>
              )}
            {!isVariant && suggestion.variant_name && (
              <span className="text-[10.5px] text-gray-400 dark:text-gray-500 truncate">
                {highlightSearchMatch(suggestion.variant_name, searchQuery)}
              </span>
            )}
            {suggestion.category_name && (
              <span
                className={`text-[9.5px] font-medium px-1.5 py-[1px] rounded-[2px] flex-shrink-0 ${
                  isSelected
                    ? "text-[#1c6a1e]/70 dark:text-[#2a8a30]/60 bg-[#1c6a1e]/[0.06] dark:bg-[#1c6a1e]/10"
                    : "text-gray-400 dark:text-gray-500 bg-gray-100/80 dark:bg-gray-800/60"
                }`}
              >
                {suggestion.category_name}
              </span>
            )}
            {suggestion.batch_number && (
              <span className="text-[9.5px] font-mono text-slate-500 dark:text-slate-400">
                Lot: {suggestion.batch_number}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end flex-shrink-0 ml-auto pl-2">
          <span
            className={`text-[13px] font-semibold tabular-nums transition-colors leading-tight ${
              isSelected
                ? "text-[#1c6a1e] dark:text-[#2a8a30]"
                : "text-gray-800 dark:text-gray-200"
            }`}
          >
            {suggestion.current_sell_price.toFixed(0)}
          </span>
          <span
            className={`text-[9.5px] tabular-nums transition-colors ${
              isSelected
                ? "text-[#1c6a1e]/50 dark:text-[#2a8a30]/40"
                : "text-gray-400 dark:text-gray-500"
            }`}
          >
            KES{suggestion.unit_type ? `/${suggestion.unit_type}` : ""}
          </span>
        </div>
      </button>
    );
  };

  return (
    <div
      className={`absolute top-full left-0 right-0 mt-1 bg-white dark:bg-[#192e15] border border-gray-200/90 dark:border-gray-700/50 shadow-xl shadow-black/[0.08] dark:shadow-black/30 z-50 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150 rounded-[4px] ${isDesktop ? "max-h-[440px]" : "max-h-[65vh]"}`}
    >
      {showRecentSearches && (
        <div className="py-2">
          <div className="flex items-center gap-1.5 px-3.5 pb-2">
            <Clock className="w-3 h-3 text-gray-400 dark:text-gray-500" />
            <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400">
              Recent searches
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5 px-3 pb-1">
            {recentSearches.map((query) => (
              <button
                key={query}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRecentSearchClick(query);
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[12px] font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-800/70 hover:bg-[#1c6a1e]/10 dark:hover:bg-[#1c6a1e]/15 hover:text-[#1c6a1e] dark:hover:text-[#2a8a30] rounded-md transition-colors"
              >
                <Clock className="w-3 h-3 opacity-50" />
                {query}
              </button>
            ))}
          </div>
        </div>
      )}

      {showSkeleton && (
        <div className="p-1.5">
          {[0.9, 0.7, 0.8, 0.6].map((w, i) => (
            <div key={i} className="flex items-center gap-2.5 px-3 py-[10px]">
              <div className="w-9 h-9 rounded-[3px] bg-gray-100 dark:bg-gray-800/70 animate-pulse flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div
                  className="h-3.5 bg-gray-100 dark:bg-gray-800/70 rounded-[2px] animate-pulse"
                  style={{ width: `${w * 60}%` }}
                />
                <div
                  className="h-2.5 bg-gray-50 dark:bg-gray-800/40 rounded-[2px] animate-pulse"
                  style={{ width: `${w * 35}%` }}
                />
              </div>
              <div className="h-4 w-12 bg-gray-100 dark:bg-gray-800/70 rounded-[2px] animate-pulse" />
            </div>
          ))}
        </div>
      )}

      {showResults && (
        <>
          <div className="flex items-center justify-between px-3.5 py-2 border-b border-gray-100 dark:border-gray-800/60 bg-gray-50/50 dark:bg-black/10">
            <div className="flex items-center gap-1.5">
              <Search className="w-3 h-3 text-gray-400 dark:text-gray-500" />
              <span className="text-[11px] text-gray-500 dark:text-gray-400">
                <span className="font-medium text-gray-600 dark:text-gray-300">
                  {flatItems.length}
                </span>{" "}
                result{flatItems.length !== 1 ? "s" : ""}
              </span>
            </div>
            <button
              type="button"
              onClick={onDismiss}
              className="flex h-5 w-5 items-center justify-center rounded-[3px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-200/60 dark:hover:bg-gray-700/50 transition-colors"
              aria-label="Close"
            >
              <X className="w-3 h-3" />
            </button>
          </div>

          <div
            className="overflow-y-auto overscroll-contain"
            style={{ maxHeight: isDesktop ? "350px" : "48vh" }}
          >
            <div className="py-1">
              {groups.map((group, gi) => {
                if (group.type === "variant-group") {
                  return (
                    <div key={`group-${group.parentId}`}>
                      {gi > 0 && (
                        <div className="mx-3 my-1 border-t border-gray-100 dark:border-gray-800/50" />
                      )}
                      <div className="flex items-center gap-2 px-3.5 pt-2.5 pb-1">
                        <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 truncate">
                          {highlightSearchMatch(group.parentName, searchQuery)}
                        </span>
                        <span className="text-[9px] font-semibold text-[#1c6a1e] dark:text-[#2a8a30]/80 bg-[#1c6a1e]/[0.07] dark:bg-[#1c6a1e]/10 px-1.5 py-[2px] rounded-[2px] flex-shrink-0 leading-tight">
                          {group.items.length} variant
                          {group.items.length !== 1 ? "s" : ""}
                        </span>
                      </div>
                      <div className="ml-3.5 border-l-[2px] border-[#1c6a1e]/15 dark:border-[#1c6a1e]/10">
                        {group.items.map((item, idx) =>
                          renderItem(item, true, idx === group.items.length - 1),
                        )}
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={group.item.id}>
                    {gi > 0 && groups[gi - 1]?.type !== "variant-group" && (
                      <div className="mx-3 border-t border-gray-50 dark:border-gray-800/30" />
                    )}
                    {gi > 0 && groups[gi - 1]?.type === "variant-group" && (
                      <div className="mx-3 my-1 border-t border-gray-100 dark:border-gray-800/50" />
                    )}
                    {renderItem(group.item, false, true)}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="px-3.5 py-1.5 border-t border-gray-100 dark:border-gray-800/60 bg-gray-50/40 dark:bg-black/10">
            <div className="flex items-center justify-between text-[10px] text-gray-400 dark:text-gray-500">
              <div className="hidden md:flex items-center gap-2.5">
                <span className="flex items-center gap-1">
                  <kbd className="inline-flex items-center justify-center min-w-[18px] h-[18px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-[3px] text-[9px] font-mono shadow-[0_1px_0_0_rgba(0,0,0,0.05)]">
                    ↑↓
                  </kbd>
                  <span className="text-gray-400">navigate</span>
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-[3px] text-[9px] font-mono shadow-[0_1px_0_0_rgba(0,0,0,0.05)]">
                    ↵
                  </kbd>
                  <span className="text-gray-400">select</span>
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-[3px] text-[9px] font-mono shadow-[0_1px_0_0_rgba(0,0,0,0.05)]">
                    esc
                  </kbd>
                  <span className="text-gray-400">close</span>
                </span>
              </div>
              <div className="md:hidden text-gray-400 dark:text-gray-500">
                Tap to select
              </div>
              <span className="font-medium text-[#1c6a1e]/80 dark:text-[#2a8a30]/70">
                {flatItems.length} found
              </span>
            </div>
          </div>
        </>
      )}

      {showNoResults && (
        <div className="px-5 py-8 text-center">
          <div className="w-11 h-11 mx-auto mb-3 bg-gray-100 dark:bg-gray-800/70 rounded-full flex items-center justify-center">
            <Search className="w-4.5 h-4.5 text-gray-300 dark:text-gray-600" />
          </div>
          <p className="text-[13px] font-semibold text-gray-600 dark:text-gray-300">
            No matches for &ldquo;{searchQuery}&rdquo;
          </p>
          <p className="text-[11.5px] text-gray-400 dark:text-gray-500 mt-1.5 max-w-[260px] mx-auto leading-relaxed">
            Try a shorter or different term. Misspellings are handled automatically.
          </p>
          <div className="mt-4 flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={onClearSearch}
              className="text-[11px] font-medium text-[#1c6a1e] dark:text-[#2a8a30] hover:underline"
            >
              Clear search
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
