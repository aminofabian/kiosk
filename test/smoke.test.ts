import { describe, it, expect } from 'vitest';

describe('test framework smoke test', () => {
  it('should run vitest with jsdom', () => {
    expect(typeof document).toBe('object');
    expect(1 + 1).toBe(2);
  });
});
