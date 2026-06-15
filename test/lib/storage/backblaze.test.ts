import { describe, expect, it, vi, afterEach } from 'vitest';

describe('getBackblazeCredentialError', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('accepts master application key (short keyID)', async () => {
    vi.stubEnv('BACKBLAZE_KEY_ID', '661d4c5d3f57');
    vi.stubEnv('BACKBLAZE_APPLICATION_KEY', '0057c6a444ede47f2715a66ec3e4ed766d2b1bc299');
    vi.stubEnv('BACKBLAZE_BUCKET_NAME', 'kioskke');

    const { getBackblazeCredentialError, usesB2NativeApi } = await import(
      '@/lib/storage/backblaze'
    );
    expect(getBackblazeCredentialError()).toBeNull();
    expect(usesB2NativeApi()).toBe(true);
  });

  it('accepts S3 application key (25-char keyID)', async () => {
    vi.stubEnv('BACKBLAZE_KEY_ID', '005f4d0819664d80000000004');
    vi.stubEnv('BACKBLAZE_APPLICATION_KEY', 'K005longapplicationkeysecrethere');
    vi.stubEnv('BACKBLAZE_BUCKET_NAME', 'bucket');
    vi.stubEnv('BACKBLAZE_ENDPOINT', 'https://s3.us-east-005.backblazeb2.com');

    const { getBackblazeCredentialError, usesB2NativeApi } = await import(
      '@/lib/storage/backblaze'
    );
    expect(getBackblazeCredentialError()).toBeNull();
    expect(usesB2NativeApi()).toBe(false);
  });

  it('flags identical key and secret', async () => {
    vi.stubEnv('BACKBLAZE_KEY_ID', 'same');
    vi.stubEnv('BACKBLAZE_APPLICATION_KEY', 'same');
    vi.stubEnv('BACKBLAZE_BUCKET_NAME', 'bucket');

    const { getBackblazeCredentialError } = await import('@/lib/storage/backblaze');
    expect(getBackblazeCredentialError()).toMatch(/different/i);
  });
});

describe('extractStorageKeyFromUrl', () => {
  it('parses native B2 download URLs', async () => {
    const { extractStorageKeyFromUrl } = await import('@/lib/storage/backblaze');
    expect(
      extractStorageKeyFromUrl(
        'https://f003.backblazeb2.com/file/kioskke/items/biz/item/abc.jpg'
      )
    ).toBe('items/biz/item/abc.jpg');
  });

  it('parses /api/media/ proxy paths', async () => {
    const { extractStorageKeyFromUrl } = await import('@/lib/storage/backblaze');
    expect(extractStorageKeyFromUrl('/api/media/items/biz/item/abc.jpg')).toBe(
      'items/biz/item/abc.jpg'
    );
  });
});

describe('toPublicImageUrl', () => {
  it('rewrites B2 URLs to media proxy', async () => {
    const { toPublicImageUrl } = await import('@/lib/storage/backblaze');
    expect(
      toPublicImageUrl('https://f003.backblazeb2.com/file/kioskke/items/biz/item/abc.jpg')
    ).toBe('/api/media/items/biz/item/abc.jpg');
  });

  it('passes through proxy URLs unchanged', async () => {
    const { toPublicImageUrl } = await import('@/lib/storage/backblaze');
    expect(toPublicImageUrl('/api/media/items/biz/item/abc.jpg')).toBe(
      '/api/media/items/biz/item/abc.jpg'
    );
  });
});
