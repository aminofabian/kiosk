export interface Banner {
  id: string;
  url: string;
  s3Key: string;
  title?: string;
  alt?: string;
  type: 'homepage' | 'category' | 'promo';
  categoryId?: string;
  categoryName?: string;
  startDate?: number;
  endDate?: number;
  active: boolean;
  position: number;
  createdAt: number;
}

export interface BusinessBanners {
  banners: Banner[];
}

export function parseBusinessBanners(settingsJson: string | null): BusinessBanners {
  if (!settingsJson) {
    return { banners: [] };
  }

  try {
    const settings = JSON.parse(settingsJson);
    return {
      banners: settings.banners || [],
    };
  } catch {
    return { banners: [] };
  }
}

export function serializeBusinessBanners(banners: BusinessBanners): string {
  return JSON.stringify(banners);
}
