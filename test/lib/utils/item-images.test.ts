import { describe, expect, it } from 'vitest';
import { getItemImage, resolveItemImageUrl } from '@/lib/utils/item-images';

describe('resolveItemImageUrl', () => {
  it('rewrites B2 image_url to media proxy', () => {
    expect(
      resolveItemImageUrl({
        name: 'Tomatoes',
        image_url: 'https://f003.backblazeb2.com/file/kioskke/items/biz/item/abc.jpg',
      })
    ).toBe('/api/media/items/biz/item/abc.jpg');
  });

  it('prefers uploaded image_url over name map', () => {
    expect(
      resolveItemImageUrl({
        name: 'Tomatoes',
        image_url: 'https://example.com/custom.jpg',
      })
    ).toBe('https://example.com/custom.jpg');
  });

  it('falls back to built-in name map', () => {
    const mapped = getItemImage('Tomatoes');
    expect(
      resolveItemImageUrl({
        name: 'Tomatoes',
        image_url: null,
      })
    ).toBe(mapped);
  });

  it('returns null when no image available', () => {
    expect(
      resolveItemImageUrl({
        name: 'Totally Unknown Product XYZ',
        image_url: null,
      })
    ).toBeNull();
  });
});
