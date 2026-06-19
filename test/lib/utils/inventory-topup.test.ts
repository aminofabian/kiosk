import { describe, it, expect } from 'vitest';
import { computeTopup } from '@/lib/utils/inventory-topup';

describe('computeTopup', () => {
  it('returns gap when at or below minimum', () => {
    expect(computeTopup(4, 5, 60)).toBe(56);
    expect(computeTopup(5, 5, 60)).toBe(55);
  });

  it('returns 0 when above minimum', () => {
    expect(computeTopup(100, 5, 60)).toBe(0);
  });

  it('clamps to 0 when expected is below current', () => {
    expect(computeTopup(4, 5, 3)).toBe(0);
  });

  it('returns 0 when min or expected is unset', () => {
    expect(computeTopup(4, null, 60)).toBe(0);
    expect(computeTopup(4, 5, null)).toBe(0);
  });
});
