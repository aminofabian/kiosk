import { NextRequest } from 'next/server';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import {
  getBackblazeApplicationKey,
  getBackblazeKeyId,
  getMissingBackblazeEnvVars,
  isBackblazeConfigured,
} from '@/lib/storage/backblaze';
import { b2Authorize, b2DownloadFile, b2GetBucketId } from '@/lib/storage/backblaze-native';

export async function OPTIONS() {
  return optionsResponse();
}

/**
 * GET /api/media/items/{businessId}/{itemId}/{file}
 * Serves product images from Backblaze with server-side auth (works for private buckets).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    if (!isBackblazeConfigured()) {
      return jsonResponse({ success: false, message: 'Storage not configured' }, 503);
    }

    const { path } = await params;
    const key = path.join('/');

    if (!key.startsWith('items/')) {
      return jsonResponse({ success: false, message: 'Not found' }, 404);
    }

    const keyId = getBackblazeKeyId();
    const appKey = getBackblazeApplicationKey();
    const bucketName = process.env.BACKBLAZE_BUCKET_NAME?.trim();

    if (!keyId || !appKey || !bucketName) {
      return jsonResponse(
        { success: false, message: `Missing: ${getMissingBackblazeEnvVars().join(', ')}` },
        503
      );
    }

    const auth = await b2Authorize(keyId, appKey);
    const bucketId = await b2GetBucketId(auth, bucketName);
    const { body, contentType } = await b2DownloadFile(auth, bucketId, bucketName, key);

    return new Response(new Uint8Array(body), {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
      },
    });
  } catch (error) {
    console.error('Error serving media:', error);
    return jsonResponse({ success: false, message: 'Image not found' }, 404);
  }
}
