import { NextRequest } from 'next/server';
import { queryOne, execute } from '@/lib/db';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { requireAuth, requirePermission, isAuthResponse } from '@/lib/auth/api-auth';
import type { Business } from '@/lib/db/types';
import {
  parseProductTypes,
  mergeSettingsProductTypes,
  type ProductTypeConfig,
} from '@/lib/types/product-types';

export async function OPTIONS() {
  return optionsResponse();
}

/** GET - Return current business settings (product types, etc.). Readable by any authenticated user. */
export async function GET() {
  try {
    const auth = await requireAuth();
    if (isAuthResponse(auth)) return auth;

    const business = await queryOne<
      Business & { loyalty_points_per_kes?: number }
    >(
      `SELECT id, settings, COALESCE(loyalty_points_per_kes, 0) AS loyalty_points_per_kes FROM businesses WHERE id = ?`,
      [auth.businessId]
    );

    if (!business) {
      return jsonResponse(
        { success: false, message: 'Business not found' },
        404
      );
    }

    const productTypes = parseProductTypes(business.settings);

    return jsonResponse({
      success: true,
      data: {
        productTypes,
        loyaltyPointsPerKes: Number(business.loyalty_points_per_kes ?? 0),
      },
    });
  } catch (error) {
    console.error('Error fetching settings:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Failed to fetch settings',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}

/** PATCH - Update business settings (merge; only provided keys are updated) */
export async function PATCH(request: NextRequest) {
  try {
    const auth = await requirePermission('business_settings');
    if (isAuthResponse(auth)) return auth;

    const business = await queryOne<Business>(
      `SELECT id, settings FROM businesses WHERE id = ?`,
      [auth.businessId]
    );

    if (!business) {
      return jsonResponse(
        { success: false, message: 'Business not found' },
        404
      );
    }

    const body = await request.json();
    const { productTypes, loyaltyPointsPerKes } = body as {
      productTypes?: ProductTypeConfig[];
      loyaltyPointsPerKes?: unknown;
    };

    let didUpdate = false;

    if (loyaltyPointsPerKes !== undefined) {
      const n = Number(loyaltyPointsPerKes);
      if (!Number.isFinite(n) || n < 0 || n > 5) {
        return jsonResponse(
          {
            success: false,
            message: 'Loyalty rate must be a number from 0 (off) up to 5 points per KES',
          },
          400
        );
      }
      await execute(`UPDATE businesses SET loyalty_points_per_kes = ? WHERE id = ?`, [
        n,
        auth.businessId,
      ]);
      didUpdate = true;
    }

    if (productTypes !== undefined) {
      if (!Array.isArray(productTypes)) {
        return jsonResponse(
          { success: false, message: 'productTypes must be an array' },
          400
        );
      }
      // Validate each entry
      for (let i = 0; i < productTypes.length; i++) {
        const t = productTypes[i];
        if (!t || typeof t.key !== 'string' || !t.key.trim()) {
          return jsonResponse(
            { success: false, message: `productTypes[${i}]: key is required` },
            400
          );
        }
        if (typeof t.label !== 'string' || !t.label.trim()) {
          return jsonResponse(
            { success: false, message: `productTypes[${i}]: label is required` },
            400
          );
        }
        // key: alphanumeric + underscore only, for DB safety
        if (!/^[a-z0-9_]+$/.test(t.key.trim())) {
          return jsonResponse(
            {
              success: false,
              message: `productTypes[${i}]: key must be lowercase letters, numbers, or underscore`,
            },
            400
          );
        }
      }
      const updated = mergeSettingsProductTypes(business.settings, productTypes);
      await execute(`UPDATE businesses SET settings = ? WHERE id = ?`, [
        updated,
        auth.businessId,
      ]);
      didUpdate = true;
    }

    if (!didUpdate) {
      return jsonResponse(
        { success: false, message: 'Provide productTypes and/or loyaltyPointsPerKes to update' },
        400
      );
    }

    const updatedBusiness = await queryOne<
      Business & { loyalty_points_per_kes?: number }
    >(
      `SELECT id, settings, COALESCE(loyalty_points_per_kes, 0) AS loyalty_points_per_kes FROM businesses WHERE id = ?`,
      [auth.businessId]
    );
    const productTypesOut = parseProductTypes(updatedBusiness?.settings ?? null);

    return jsonResponse({
      success: true,
      message: 'Settings updated',
      data: {
        productTypes: productTypesOut,
        loyaltyPointsPerKes: Number(updatedBusiness?.loyalty_points_per_kes ?? 0),
      },
    });
  } catch (error) {
    console.error('Error updating settings:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Failed to update settings',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}
