import { describe, it, expect } from 'vitest';
import {
  extractKenyaPhoneDigits,
  formatKenyaPhoneForLookup,
} from '@/lib/utils/credit-phones';

describe('credit phone normalization', () => {
  it('extracts 9-digit core from local format', () => {
    expect(extractKenyaPhoneDigits('0712345678')).toBe('712345678');
  });

  it('extracts 9-digit core from +254 format', () => {
    expect(extractKenyaPhoneDigits('+254712345678')).toBe('712345678');
  });

  it('formats lookup phone as +254', () => {
    expect(formatKenyaPhoneForLookup('0712 345 678')).toBe('+254712345678');
  });
});
