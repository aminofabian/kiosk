export interface ReceiptSettings {
  tagline?: string;
  website?: string;
  phone?: string;
  tillNumber?: string;
}

export interface ParsedBusinessSettings {
  receipt?: ReceiptSettings;
}

export function parseBusinessSettings(raw: string | null | undefined): ParsedBusinessSettings {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const receipt = parsed.receipt;
    if (!receipt || typeof receipt !== 'object') {
      return {};
    }
    const r = receipt as Record<string, unknown>;
    return {
      receipt: {
        tagline: typeof r.tagline === 'string' ? r.tagline : undefined,
        website: typeof r.website === 'string' ? r.website : undefined,
        phone: typeof r.phone === 'string' ? r.phone : undefined,
        tillNumber: typeof r.tillNumber === 'string' ? r.tillNumber : undefined,
      },
    };
  } catch {
    return {};
  }
}
