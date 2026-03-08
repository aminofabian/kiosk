import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { generateSupplierBatchNumber } from '@/lib/utils/batch-number-shared';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { requireAuth, isAuthResponse } from '@/lib/auth/api-auth';

function deriveSupplierCode(name: string): string {
  const cleaned = (name || '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase()
    .slice(0, 5);
  return cleaned || 'SUP';
}

/** Parse batch_number {CODE}-{SEQ} or {CODE}-{DATE}-{SEQ} and return seq, or 0 if invalid */
function parseSeqFromBatchNumber(batchNumber: string): number {
  const parts = (batchNumber || '').split('-');
  if (parts.length < 2) return 0;
  const seq = parseInt(parts[parts.length - 1], 10);
  return isNaN(seq) ? 0 : seq;
}

/**
 * GET /api/batches/next?supplierId=xxx&supplierName=xxx&count=1&existing=CAD-1,CAD-2
 * Returns next batch number(s) for this supplier, continuing from previous batches.
 */
export async function OPTIONS() {
  return optionsResponse();
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (isAuthResponse(auth)) return auth;

    const { searchParams } = new URL(request.url);
    const supplierId = searchParams.get('supplierId');
    const supplierName = searchParams.get('supplierName') || 'Supplier';
    const count = Math.min(parseInt(searchParams.get('count') || '1', 10) || 1, 20);
    const existingParam = searchParams.get('existing') || '';

    const supplierCode = deriveSupplierCode(supplierName);
    let maxSeq = 0;

    // Max seq from DB batches for this supplier
    if (supplierId) {
      const batches = await query<{ batch_number: string }>(
        `SELECT batch_number FROM inventory_batches 
         WHERE supplier_id = ? AND business_id = ?`,
        [supplierId, auth.businessId]
      );
      for (const b of batches) {
        const seq = parseSeqFromBatchNumber(b.batch_number);
        if (seq > maxSeq) maxSeq = seq;
      }
    }

    // Max seq from existing batch numbers in the form (same supplier code)
    const existing = existingParam.split(',').map((s) => s.trim()).filter(Boolean);
    for (const bn of existing) {
      if (bn.toUpperCase().startsWith(supplierCode)) {
        const seq = parseSeqFromBatchNumber(bn);
        if (seq > maxSeq) maxSeq = seq;
      }
    }

    const now = Math.floor(Date.now() / 1000);
    const batchNumbers: string[] = [];
    for (let i = 1; i <= count; i++) {
      batchNumbers.push(generateSupplierBatchNumber(supplierName, maxSeq + i, now));
    }

    return jsonResponse({
      success: true,
      data: { batchNumbers },
    });
  } catch (error) {
    console.error('Error fetching next batch numbers:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Failed to fetch next batch numbers',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}
