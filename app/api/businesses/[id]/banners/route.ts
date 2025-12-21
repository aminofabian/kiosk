import { NextRequest } from 'next/server';
import { query, execute, queryOne } from '@/lib/db';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { requirePermission, isAuthResponse } from '@/lib/auth/api-auth';
import { uploadBannerToS3, extractS3KeyFromUrl } from '@/lib/aws/s3';
import { generateUUID } from '@/lib/utils/uuid';
import { parseBusinessBanners, serializeBusinessBanners, type Banner } from '@/lib/types/banner';
import type { Business } from '@/lib/db/types';

export async function OPTIONS() {
  return optionsResponse();
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission('business_settings');
    if (isAuthResponse(auth)) return auth;

    const { id: businessId } = await params;

    if (auth.businessId !== businessId) {
      return jsonResponse(
        { success: false, message: 'Forbidden' },
        403
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const title = formData.get('title') as string | null;
    const alt = formData.get('alt') as string | null;
    const type = formData.get('type') as 'homepage' | 'category' | 'promo' | null;
    const categoryId = formData.get('categoryId') as string | null;
    const startDate = formData.get('startDate') as string | null;
    const endDate = formData.get('endDate') as string | null;

    if (!file) {
      return jsonResponse(
        { success: false, message: 'No file provided' },
        400
      );
    }

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/avif'];
    if (!allowedTypes.includes(file.type)) {
      return jsonResponse(
        { success: false, message: 'Invalid file type. Only images are allowed.' },
        400
      );
    }

    if (file.size > 5 * 1024 * 1024) {
      return jsonResponse(
        { success: false, message: 'File size too large. Maximum 5MB.' },
        400
      );
    }

    if (!type || !['homepage', 'category', 'promo'].includes(type)) {
      return jsonResponse(
        { success: false, message: 'Invalid banner type' },
        400
      );
    }

    if (type === 'category' && !categoryId) {
      return jsonResponse(
        { success: false, message: 'categoryId required for category banners' },
        400
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const uploadResult = await uploadBannerToS3(
      buffer,
      file.name,
      file.type,
      businessId
    );

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
    
    let categoryName: string | undefined;
    if (categoryId) {
      const category = await queryOne<{ name: string }>(
        `SELECT name FROM categories WHERE id = ? AND business_id = ?`,
        [categoryId, businessId]
      );
      categoryName = category?.name;
    }

    const now = Math.floor(Date.now() / 1000);
    const bannerId = generateUUID();
    
    const newBanner: Banner = {
      id: bannerId,
      url: uploadResult.url,
      s3Key: uploadResult.key,
      title: title || undefined,
      alt: alt || undefined,
      type,
      categoryId: categoryId || undefined,
      categoryName,
      startDate: startDate ? Math.floor(new Date(startDate).getTime() / 1000) : undefined,
      endDate: endDate ? Math.floor(new Date(endDate).getTime() / 1000) : undefined,
      active: true,
      position: bannersData.banners.length,
      createdAt: now,
    };

    bannersData.banners.push(newBanner);
    const updatedSettings = serializeBusinessBanners(bannersData);

    await execute(
      `UPDATE businesses SET settings = ? WHERE id = ?`,
      [updatedSettings, businessId]
    );

    return jsonResponse({
      success: true,
      data: newBanner,
    }, 201);
  } catch (error) {
    console.error('Error uploading banner:', error);
    return jsonResponse(
      { 
        success: false, 
        message: 'Failed to upload banner',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission('business_settings');
    if (isAuthResponse(auth)) return auth;

    const { id: businessId } = await params;

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
    const now = Math.floor(Date.now() / 1000);

    const activeBanners = bannersData.banners.filter((banner) => {
      if (!banner.active) return false;
      if (banner.startDate && banner.startDate > now) return false;
      if (banner.endDate && banner.endDate < now) return false;
      return true;
    });

    return jsonResponse({
      success: true,
      data: {
        all: bannersData.banners,
        active: activeBanners,
      },
    });
  } catch (error) {
    console.error('Error fetching banners:', error);
    return jsonResponse(
      { success: false, message: 'Failed to fetch banners' },
      500
    );
  }
}
