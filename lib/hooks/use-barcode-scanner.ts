'use client';

import { useEffect, useRef, useCallback } from 'react';

interface UseBarcodeScanner {
  onScan: (barcode: string) => void;
  enabled?: boolean;
  minLength?: number; // Minimum barcode length (default: 4)
  maxDelay?: number; // Max time between keystrokes in ms (default: 50)
}

/**
 * Hook to detect barcode scanner input.
 * 
 * USB/Bluetooth barcode scanners act as keyboard devices - they "type" the barcode
 * characters very quickly (faster than human typing) and then press Enter.
 * 
 * This hook detects rapid keyboard input followed by Enter and treats it as a barcode scan.
 */
export function useBarcodeScanner({
  onScan,
  enabled = true,
  minLength = 4,
  maxDelay = 50, // Scanners typically type faster than 50ms between characters
}: UseBarcodeScanner) {
  const bufferRef = useRef<string>('');
  const lastKeyTimeRef = useRef<number>(0);
  const onScanRef = useRef(onScan);

  // Keep callback ref updated
  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled) return;

      const target = e.target as HTMLElement;
      const isSearchInput = target.getAttribute('data-barcode-enabled') === 'true';
      const isInputField = target.tagName === 'INPUT' || 
                          target.tagName === 'TEXTAREA' || 
                          target.isContentEditable;
      
      const currentTime = Date.now();
      const timeDiff = currentTime - lastKeyTimeRef.current;

      // Allow barcode scanning globally (when page has focus or search input)
      // Only block if user is clearly typing slowly in a non-search input
      if (isInputField && !isSearchInput) {
        // If there's a significant delay (> 150ms) and we have buffered characters,
        // it's likely normal human typing, not a barcode scanner
        if (timeDiff > 150 && bufferRef.current.length > 0) {
          bufferRef.current = '';
          return;
        }
        // Fast typing (< 150ms) in any input is likely a barcode scanner, so continue
      }


      // If too much time has passed, reset buffer
      if (timeDiff > maxDelay && bufferRef.current.length > 0) {
        bufferRef.current = '';
      }

      lastKeyTimeRef.current = currentTime;

      // Handle Enter key - this signals end of barcode scan
      if (e.key === 'Enter') {
        const barcode = bufferRef.current.trim();
        if (barcode.length >= minLength) {
          e.preventDefault();
          e.stopPropagation();
          onScanRef.current(barcode);
        }
        bufferRef.current = '';
        return;
      }

      // Only add printable characters to buffer
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        bufferRef.current += e.key;
      }
    },
    [enabled, minLength, maxDelay]
  );

  useEffect(() => {
    if (!enabled) return;

    // Use capture phase to catch events before other handlers
    window.addEventListener('keydown', handleKeyDown, { capture: true });

    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
    };
  }, [handleKeyDown, enabled]);

  // Method to manually clear the buffer
  const clearBuffer = useCallback(() => {
    bufferRef.current = '';
  }, []);

  // Method to manually trigger a scan (useful for testing or manual input)
  const manualScan = useCallback((barcode: string) => {
    if (barcode.length >= minLength) {
      onScanRef.current(barcode);
    }
  }, [minLength]);

  return { clearBuffer, manualScan };
}

/**
 * Check if a string looks like a barcode
 * Common formats: EAN-13, EAN-8, UPC-A, UPC-E, Code 128, etc.
 */
export function isValidBarcode(code: string): boolean {
  if (!code || code.length < 4) return false;
  
  // Remove any whitespace
  const cleaned = code.trim();
  
  // Check common barcode patterns
  // EAN-13: 13 digits
  // EAN-8: 8 digits
  // UPC-A: 12 digits
  // UPC-E: 6-8 digits
  // Code 128: Alphanumeric, variable length
  
  // For simplicity, accept numeric barcodes of common lengths
  // or alphanumeric codes of 4+ characters
  if (/^\d{6,14}$/.test(cleaned)) {
    return true;
  }
  
  // Accept alphanumeric codes (Code 128, Code 39, etc.)
  if (/^[A-Za-z0-9\-\.]{4,}$/.test(cleaned)) {
    return true;
  }
  
  return false;
}
