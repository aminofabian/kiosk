"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useDebounce } from "@/lib/hooks/use-debounce";
import { isValidBarcode } from "@/lib/hooks/use-barcode-scanner";
import { searchItemsOffline } from "@/lib/offline/search";
import {
  addRecentSearch,
  getRecentSearches,
} from "@/lib/utils/recent-searches";

/** Single debounce for both suggestions and grid — matches department feel */
export const POS_SEARCH_DEBOUNCE_MS = 200;

const SUGGEST_CACHE_TTL = 5 * 60_000;

export interface PosSearchSuggestion {
  id: string;
  name: string;
  variant_name?: string | null;
  current_sell_price: number;
  unit_type?: string;
  category_name?: string | null;
  parent_item_id?: string | null;
  parent_name?: string | null;
  sibling_count?: number;
  batch_number?: string | null;
}

export function usePosSearch() {
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebounce(searchQuery, POS_SEARCH_DEBOUNCE_MS);
  const isSearchPending =
    searchQuery !== debouncedSearchQuery && searchQuery.length > 0;

  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [searchSuggestions, setSearchSuggestions] = useState<
    PosSearchSuggestion[]
  >([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);

  const suggestionsAbortRef = useRef<AbortController | null>(null);
  const flatSuggestionsRef = useRef<PosSearchSuggestion[]>([]);
  const suggestCacheRef = useRef<
    Map<string, { data: PosSearchSuggestion[]; ts: number }>
  >(new Map());

  useEffect(() => {
    const searches = getRecentSearches();
    setRecentSearches(searches.map((s) => s.query));
  }, []);

  useEffect(() => {
    if (debouncedSearchQuery && debouncedSearchQuery.length >= 2) {
      addRecentSearch(debouncedSearchQuery);
      setRecentSearches((prev) => {
        const filtered = prev.filter(
          (s) => s.toLowerCase() !== debouncedSearchQuery.toLowerCase(),
        );
        return [debouncedSearchQuery, ...filtered].slice(0, 8);
      });
    }
  }, [debouncedSearchQuery]);

  const mapSuggestItem = useCallback(
    (item: {
      id: string;
      name: string;
      variant_name?: string | null;
      current_sell_price: number;
      unit_type?: string;
      category_name?: string | null;
      parent_item_id?: string | null;
      parent_name?: string | null;
      sibling_count?: number;
      batch_number?: string | null;
    }): PosSearchSuggestion => ({
      id: item.id,
      name: item.name,
      variant_name: item.variant_name,
      current_sell_price: item.current_sell_price,
      unit_type: item.unit_type,
      category_name: item.category_name,
      parent_item_id: item.parent_item_id,
      parent_name: item.parent_name,
      sibling_count: item.sibling_count,
      batch_number: item.batch_number,
    }),
    [],
  );

  const filterSuggestionsForQuery = useCallback(
    (suggestions: PosSearchSuggestion[], query: string): PosSearchSuggestion[] => {
      const q = query.toLowerCase().trim();
      if (!q) return suggestions;
      const filtered = suggestions.filter((s) => {
        const hay =
          `${s.name} ${s.variant_name ?? ""} ${s.parent_name ?? ""} ${s.category_name ?? ""}`.toLowerCase();
        return hay.includes(q);
      });
      return filtered.length > 0 ? filtered : suggestions;
    },
    [],
  );

  const findWarmSuggestionCache = useCallback((query: string) => {
    const key = query.toLowerCase().trim();
    const exact = suggestCacheRef.current.get(key);
    if (exact) return exact;
    for (let len = key.length - 1; len >= 1; len--) {
      const prefix = suggestCacheRef.current.get(key.slice(0, len));
      if (prefix) return prefix;
    }
    return null;
  }, []);

  useEffect(() => {
    const suggestionQuery = debouncedSearchQuery.trim();
    if (suggestionsAbortRef.current) {
      suggestionsAbortRef.current.abort();
    }

    if (!suggestionQuery || suggestionQuery.length < 1) {
      setSearchSuggestions([]);
      if (!searchFocused) {
        setShowSuggestions(false);
      }
      return;
    }

    if (isValidBarcode(suggestionQuery)) {
      setSearchSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const cacheKey = suggestionQuery.toLowerCase();
    const isOffline = typeof navigator !== "undefined" && !navigator.onLine;

    const applySuggestions = (suggestions: PosSearchSuggestion[]) => {
      setSearchSuggestions(suggestions);
      if (suggestions.length > 0) {
        setShowSuggestions(true);
      }
      setSelectedSuggestionIndex(-1);
    };

    if (isOffline) {
      setLoadingSuggestions(true);
      searchItemsOffline(suggestionQuery, 10)
        .then((suggestions) => {
          applySuggestions(suggestions);
        })
        .catch((err) => console.error("Offline search error:", err))
        .finally(() => setLoadingSuggestions(false));
      return;
    }

    const warmCache = findWarmSuggestionCache(cacheKey);
    if (warmCache) {
      applySuggestions(filterSuggestionsForQuery(warmCache.data, cacheKey));
    }

    const cached = suggestCacheRef.current.get(cacheKey);
    if (cached && Date.now() - cached.ts < SUGGEST_CACHE_TTL) {
      applySuggestions(cached.data);
    }

    const controller = new AbortController();
    suggestionsAbortRef.current = controller;
    let cancelled = false;

    async function fetchSuggestions() {
      if (cancelled) return;
      try {
        if (!warmCache && !cached) setLoadingSuggestions(true);
        const response = await fetch(
          `/api/items/suggest?q=${encodeURIComponent(suggestionQuery)}&limit=10`,
          { signal: controller.signal, cache: "no-store" },
        );

        if (cancelled) return;

        const result = await response.json();

        if (cancelled) return;
        if (result.success && result.data) {
          const suggestions = result.data.map(mapSuggestItem);
          if (suggestions.length > 0) {
            suggestCacheRef.current.set(cacheKey, {
              data: suggestions,
              ts: Date.now(),
            });
            if (suggestCacheRef.current.size > 50) {
              const oldest = [...suggestCacheRef.current.entries()].sort(
                (a, b) => a[1].ts - b[1].ts,
              )[0];
              if (oldest) suggestCacheRef.current.delete(oldest[0]);
            }
          }
          applySuggestions(suggestions);
        }
      } catch (err) {
        if (cancelled) return;
        if (err instanceof Error && err.name === "AbortError") return;
        console.error("Error fetching suggestions:", err);
      } finally {
        setLoadingSuggestions(false);
      }
    }

    void fetchSuggestions();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [
    debouncedSearchQuery,
    mapSuggestItem,
    filterSuggestionsForQuery,
    findWarmSuggestionCache,
    searchFocused,
  ]);

  const handleSearchFocus = useCallback(() => {
    setSearchFocused(true);
    if (!searchQuery.trim() && recentSearches.length > 0) {
      setShowSuggestions(true);
    } else if (searchSuggestions.length > 0) {
      setShowSuggestions(true);
    }
  }, [searchQuery, recentSearches.length, searchSuggestions.length]);

  const handleRecentSearchClick = useCallback((query: string) => {
    setSearchQuery(query);
    setShowSuggestions(false);
    setSelectedSuggestionIndex(-1);
  }, []);

  const dismissSuggestions = useCallback(() => {
    setShowSuggestions(false);
    setSearchFocused(false);
  }, []);

  const resetSearch = useCallback(() => {
    setSearchQuery("");
    setSearchSuggestions([]);
    setShowSuggestions(false);
    setSearchFocused(false);
    setSelectedSuggestionIndex(-1);
  }, []);

  const handleSearchKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showSuggestions) {
          e.preventDefault();
          setShowSuggestions(false);
          setSelectedSuggestionIndex(-1);
        }
        return;
      }

      const flatLen = flatSuggestionsRef.current.length;
      if (!showSuggestions || flatLen === 0) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedSuggestionIndex((prev) =>
          prev < flatLen - 1 ? prev + 1 : 0,
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedSuggestionIndex((prev) =>
          prev > 0 ? prev - 1 : flatLen - 1,
        );
      }
    },
    [showSuggestions],
  );

  return {
    searchQuery,
    setSearchQuery,
    debouncedSearchQuery,
    isSearchPending,
    recentSearches,
    searchSuggestions,
    showSuggestions,
    setShowSuggestions,
    searchFocused,
    setSearchFocused,
    loadingSuggestions,
    selectedSuggestionIndex,
    setSelectedSuggestionIndex,
    flatSuggestionsRef,
    handleSearchFocus,
    handleRecentSearchClick,
    handleSearchKeyDown,
    dismissSuggestions,
    resetSearch,
  };
}
