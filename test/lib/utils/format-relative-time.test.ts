import { describe, expect, it } from 'vitest';
import {
  formatRelativeTime,
  isWithinLastWeek,
  ONE_WEEK_SECONDS,
} from '@/lib/utils/format-relative-time';

describe('formatRelativeTime', () => {
  const now = 1_700_000_000;

  it('shows minutes for recent updates', () => {
    expect(formatRelativeTime(now - 120, now)).toBe('2m ago');
  });

  it('shows days within a week', () => {
    expect(formatRelativeTime(now - 86400 * 3, now)).toBe('3d ago');
  });
});

describe('isWithinLastWeek', () => {
  const now = 1_700_000_000;

  it('returns true inside seven days', () => {
    expect(isWithinLastWeek(now - ONE_WEEK_SECONDS + 60, now)).toBe(true);
  });

  it('returns false outside seven days', () => {
    expect(isWithinLastWeek(now - ONE_WEEK_SECONDS - 1, now)).toBe(false);
  });
});
