import { NextRequest } from 'next/server';
import { queryOne } from '@/lib/db';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import type { Domain, Business } from '@/lib/db/types';

const DEFAULT_DOMAIN = 'kiosk.ke';

export async function OPTIONS() {
  return optionsResponse();
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    let domain = searchParams.get('domain');

    if (!domain) {
      // Try to get from host header
      const host = request.headers.get('host') || request.headers.get('x-forwarded-host');
      domain = host?.split(':')[0] || DEFAULT_DOMAIN;
    }

    const normalizedDomain = domain.toLowerCase().trim();

    // Try to find the domain in the database
    let domainRecord: Domain | null = null;
    try {
      domainRecord = await queryOne<Domain>(
        `SELECT * FROM domains WHERE domain = ? AND active = 1`,
        [normalizedDomain]
      );
    } catch {
      // Domains table might not exist yet
    }

    if (domainRecord) {
      const business = await queryOne<Business>(
        `SELECT * FROM businesses WHERE id = ? AND active = 1`,
        [domainRecord.business_id]
      );

      if (business) {
        return jsonResponse({
          success: true,
          data: {
            businessId: business.id,
            businessName: business.name,
            domain: normalizedDomain,
            isDefault: normalizedDomain === DEFAULT_DOMAIN,
          },
        });
      }
    }

    // Try default domain
    let defaultDomainRecord: Domain | null = null;
    try {
      defaultDomainRecord = await queryOne<Domain>(
        `SELECT * FROM domains WHERE domain = ? AND active = 1`,
        [DEFAULT_DOMAIN]
      );
    } catch {
      // Domains table might not exist
    }

    if (defaultDomainRecord) {
      const defaultBusiness = await queryOne<Business>(
        `SELECT * FROM businesses WHERE id = ? AND active = 1`,
        [defaultDomainRecord.business_id]
      );

      if (defaultBusiness) {
        return jsonResponse({
          success: true,
          data: {
            businessId: defaultBusiness.id,
            businessName: defaultBusiness.name,
            domain: DEFAULT_DOMAIN,
            isDefault: true,
          },
        });
      }
    }

    // Fallback: get the first active business (for development/migration)
    const fallbackBusiness = await queryOne<Business>(
      `SELECT * FROM businesses WHERE active = 1 ORDER BY created_at ASC LIMIT 1`
    );

    if (fallbackBusiness) {
      return jsonResponse({
        success: true,
        data: {
          businessId: fallbackBusiness.id,
          businessName: fallbackBusiness.name,
          domain: normalizedDomain,
          isDefault: true,
        },
      });
    }

    return jsonResponse({
      success: false,
      message: 'No business found for this domain',
    }, 404);
  } catch (error) {
    console.error('Error resolving domain:', error);
    return jsonResponse(
      { success: false, message: 'Failed to resolve domain' },
      500
    );
  }
}
