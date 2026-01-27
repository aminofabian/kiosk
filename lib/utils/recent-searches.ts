// Recent searches storage utility
const RECENT_SEARCHES_KEY = 'pos_recent_searches';
const MAX_RECENT_SEARCHES = 8;

export interface RecentSearch {
  query: string;
  timestamp: number;
}

/**
 * Get recent searches from localStorage
 */
export function getRecentSearches(): RecentSearch[] {
  if (typeof window === 'undefined') return [];
  
  try {
    const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
    if (!stored) return [];
    
    const searches: RecentSearch[] = JSON.parse(stored);
    // Filter out old searches (older than 7 days)
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return searches.filter(s => s.timestamp > sevenDaysAgo);
  } catch {
    return [];
  }
}

/**
 * Add a search query to recent searches
 */
export function addRecentSearch(query: string): void {
  if (typeof window === 'undefined') return;
  if (!query || query.trim().length < 2) return;
  
  const trimmed = query.trim().toLowerCase();
  
  try {
    const current = getRecentSearches();
    
    // Remove existing entry with same query
    const filtered = current.filter(s => s.query.toLowerCase() !== trimmed);
    
    // Add new entry at the beginning
    const updated: RecentSearch[] = [
      { query: trimmed, timestamp: Date.now() },
      ...filtered
    ].slice(0, MAX_RECENT_SEARCHES);
    
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Clear all recent searches
 */
export function clearRecentSearches(): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.removeItem(RECENT_SEARCHES_KEY);
  } catch {
    // Ignore storage errors
  }
}

/**
 * Remove a specific search from history
 */
export function removeRecentSearch(query: string): void {
  if (typeof window === 'undefined') return;
  
  try {
    const current = getRecentSearches();
    const filtered = current.filter(s => s.query.toLowerCase() !== query.toLowerCase());
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(filtered));
  } catch {
    // Ignore storage errors
  }
}
