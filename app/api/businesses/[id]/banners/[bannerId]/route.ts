import { NextRequest } from 'next/server';
import { query, execute, queryOne } from '@/lib/db';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { requirePermission, isAuthResponse } from '@/lib/auth/api-auth';
import { deleteBannerFromS3 } from '@/lib/aws/s3';
import { parseBusinessBanners, serializeBusinessBanners, type Banner } from '@/lib/types/banner';
import type { Business } from '@/lib/db/types';

export async function OPTIONS() {
  return optionsResponse();
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; bannerId: string }> }
) {
  try {
    const auth = await requirePermission('business_settings');
    if (isAuthResponse(auth)) return auth;

    const { id: businessId, bannerId } = await params;

    if (auth.businessId !== businessId) {
      return jsonResponse(
        { success: false, message: 'Forbidden' },
        403
      );
    }

    const body = await request.json();
    const { title, alt, active, position, startDate, endDate } = body;

    const business = await queryOne<Business>(
      `SELECT * FROM businesses WHERE id = ?`,
      [businessId]
    );

    if (!business) {
      return jsonResponse(
        { success: false, message: 'Business not found' },
        404
      );
    }

    const bannersData = parseBusinessBanners(business.settings);
    const bannerIndex = bannersData.banners.findIndex((b) => b.id === bannerId);

    if (bannerIndex === -1) {
      return jsonResponse(
        { success: false, message: 'Banner not found' },
        404
      );
    }

    const banner = bannersData.banners[bannerIndex];

    if (title !== undefined) banner.title = title;
    if (alt !== undefined) banner.alt = alt;
    if (active !== undefined) banner.active = active;
    if (position !== undefined) {
      const oldPosition = banner.position;
      banner.position = position;
      
      bannersData.banners.sort((a, b) => a.position - b.position);
      
      bannersData.banners.forEach((b, idx) => {
        if (b.id !== bannerId) {
          b.position = idx;
        }
      });
    }
    if (startDate !== undefined) {
      banner.startDate = startDate ? Math.floor(new Date(startDate).getTime() / 1000) : undefined;
    }
    if (endDate !== undefined) {
      banner.endDate = endDate ? Math.floor(new Date(endDate).getTime() / 1000) : undefined;
    }

    const updatedSettings = serializeBusinessBanners(bannersData);

    await execute(
      `UPDATE businesses SET settings = ? WHERE id = ?`,
      [updatedSettings, businessId]
    );

    return jsonResponse({
      success: true,
      data: banner,
    });
  } catch (error) {
    console.error('Error updating banner:', error);
    return jsonResponse(
      { success: false, message: 'Failed to update banner' },
      500
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; bannerId: string }> }
) {
  try {
    const auth = await requirePermission('business_settings');
    if (isAuthResponse(auth)) return auth;

    const { id: businessId, bannerId } = await params;

    if (auth.businessId !== businessId) {
      return jsonResponse(
        { success: false, message: 'Forbidden' },
        403
      );
    }

    const business = await queryOne<Business>(
      `SELECT * FROM businesses WHERE id = ?`,
      [businessId]
    );

    if (!business) {
      return jsonResponse(
        { success: false, message: 'Business not found' },
        404
      );
    }

    const bannersData = parseBusinessBanners(business.settings);
    const bannerIndex = bannersData.banners.findIndex((b) => b.id === bannerId);

    if (bannerIndex === -1) {
      return jsonResponse(
        { success: false, message: 'Banner not found' },
        404
      );
    }

    const banner = bannersData.banners[bannerIndex];

    try {
      await deleteBannerFromS3(banner.s3Key);
    } catch (error) {
      console.error('Error deleting banner from S3:', error);
    }

    bannersData.banners.splice(bannerIndex, 1);
    
    bannersData.banners.forEach((b, idx) => {
      b.position = idx;
    });

    const updatedSettings = serializeBusinessBanners(bannersData);

    await execute(
      `UPDATE businesses SET settings = ? WHERE id = ?`,
      [updatedSettings, businessId]
    );

    return jsonResponse({
      success: true,
      message: 'Banner deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting banner:', error);
    return jsonResponse(
      { success: false, message: 'Failed to delete banner' },
      500
    );
  }
}
