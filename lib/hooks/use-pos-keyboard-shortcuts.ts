'use client';

import { useEffect } from 'react';

function isTypingInField(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return (el as HTMLElement).isContentEditable;
}

export interface PosKeyboardShortcutHandlers {
  onFocusSearch: () => void;
  onCloseSearch: () => void;
  onOpenCheckout?: () => void;
  onClearCart?: () => void;
  onNewCart?: () => void;
  searchOpen?: boolean;
  suggestionsOpen?: boolean;
  cartHasItems?: boolean;
}

/**
 * Global POS keyboard shortcuts (ignored while typing in inputs).
 * - Ctrl/Cmd+K or / → focus search
 * - Escape → close suggestions, then search
 * - Ctrl/Cmd+Enter → checkout (when cart has items)
 * - Ctrl/Cmd+Shift+C → clear cart (handler should confirm)
 * - Ctrl/Cmd+T → new cart tab
 */
export function usePosKeyboardShortcuts(handlers: PosKeyboardShortcutHandlers): void {
  const {
    onFocusSearch,
    onCloseSearch,
    onOpenCheckout,
    onClearCart,
    onNewCart,
    searchOpen = false,
    suggestionsOpen = false,
    cartHasItems = false,
  } = handlers;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;

      if (mod && e.key === 'k') {
        e.preventDefault();
        onFocusSearch();
        return;
      }

      if (!isTypingInField() && e.key === '/' && !mod && !e.altKey) {
        e.preventDefault();
        onFocusSearch();
        return;
      }

      if (e.key === 'Escape') {
        if (suggestionsOpen) {
          e.preventDefault();
          onCloseSearch();
          return;
        }
        if (searchOpen) {
          e.preventDefault();
          onCloseSearch();
        }
        return;
      }

      if (mod && e.key === 'Enter' && cartHasItems && onOpenCheckout) {
        e.preventDefault();
        onOpenCheckout();
        return;
      }

      if (mod && e.shiftKey && (e.key === 'c' || e.key === 'C') && onClearCart) {
        e.preventDefault();
        onClearCart();
        return;
      }

      if (mod && (e.key === 't' || e.key === 'T') && onNewCart) {
        e.preventDefault();
        onNewCart();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    onFocusSearch,
    onCloseSearch,
    onOpenCheckout,
    onClearCart,
    onNewCart,
    searchOpen,
    suggestionsOpen,
    cartHasItems,
  ]);
}
