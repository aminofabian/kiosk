import { describe, it, expect, vi, beforeEach } from 'vitest';
import { normalizeSaleIdInput } from '@/lib/utils/sale-id';
import { resolveSaleId } from '@/lib/db/resolve-sale-id';

const queryMock = vi.fn();

vi.mock('@/lib/db', () => ({
  query: (...args: unknown[]) => queryMock(...args),
}));

describe('normalizeSaleIdInput', () => {
  it('strips hash and spaces', () => {
    expect(normalizeSaleIdInput('  #C05A6289  ')).toBe('c05a6289');
  });
});

describe('resolveSaleId', () => {
  beforeEach(() => {
    queryMock.mockReset();
  });

  it('resolves a unique receipt prefix', async () => {
    queryMock.mockResolvedValueOnce([{ id: 'c05a6289-abcd-4def-8abc-1234567890ab' }]);

    const result = await resolveSaleId('biz-1', '#C05A6289');
    expect(result).toEqual({
      ok: true,
      saleId: 'c05a6289-abcd-4def-8abc-1234567890ab',
    });
    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining('LIKE ?'),
      ['biz-1', 'c05a6289%']
    );
  });

  it('returns ambiguous when multiple prefix matches', async () => {
    queryMock.mockResolvedValueOnce([{ id: 'a' }, { id: 'b' }]);

    const result = await resolveSaleId('biz-1', 'c05a');
    expect(result).toEqual({ ok: false, reason: 'ambiguous', matchCount: 2 });
  });
});
