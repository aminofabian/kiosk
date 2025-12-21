import type { Banner } from '@/lib/types/banner';

export function getActiveBanners(banners: Banner[]): Banner[] {
  const now = Math.floor(Date.now() / 1000);
  
  return banners
    .filter((banner) => {
      if (!banner.active) return false;
      if (banner.startDate && banner.startDate > now) return false;
      if (banner.endDate && banner.endDate < now) return false;
      return true;
    })
    .sort((a, b) => a.position - b.position);
}

export function getHomepageBanners(banners: Banner[]): Banner[] {
  return getActiveBanners(banners.filter((b) => b.type === 'homepage'));
}

export function getCategoryBanners(banners: Banner[], categoryId?: string): Banner[] {
  const categoryBanners = banners.filter(
    (b) => b.type === 'category' && (!categoryId || b.categoryId === categoryId)
  );
  return getActiveBanners(categoryBanners);
}

export function getPromoBanners(banners: Banner[]): Banner[] {
  return getActiveBanners(banners.filter((b) => b.type === 'promo'));
}
