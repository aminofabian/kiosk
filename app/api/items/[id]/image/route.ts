import { NextRequest } from 'next/server';
import { execute, queryOne } from '@/lib/db';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { requirePermission, isAuthResponse } from '@/lib/auth/api-auth';
import {
  deleteStorageObject,
  extractStorageKeyFromUrl,
  getBackblazeCredentialError,
  getMissingBackblazeEnvVars,
  isBackblazeConfigured,
  mapBackblazeUploadError,
  uploadItemImage,
} from '@/lib/storage/backblaze';
import { logActivity } from '@/lib/db/activity-log';

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/avif',
]);

export async function OPTIONS() {
  return optionsResponse();
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission('manage_items');
    if (isAuthResponse(auth)) return auth;

    if (!isBackblazeConfigured()) {
      const missing = getMissingBackblazeEnvVars();
      return jsonResponse(
        {
          success: false,
          message: `Image storage is not configured. Missing: ${missing.join(', ')}`,
          missing,
        },
        503
      );
    }

    const credentialError = getBackblazeCredentialError();
    if (credentialError) {
      return jsonResponse({ success: false, message: credentialError }, 400);
    }

    const { id: itemId } = await params;

    const item = await queryOne<{ id: string; name: string; image_url: string | null }>(
      'SELECT id, name, image_url FROM items WHERE id = ? AND business_id = ?',
      [itemId, auth.businessId]
    );

    if (!item) {
      return jsonResponse({ success: false, message: 'Item not found' }, 404);
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return jsonResponse({ success: false, message: 'No file provided' }, 400);
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      return jsonResponse(
        { success: false, message: 'Invalid file type. Use JPEG, PNG, WebP, or AVIF.' },
        400
      );
    }

    if (file.size > MAX_BYTES) {
      return jsonResponse({ success: false, message: 'File too large. Maximum 5MB.' }, 400);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const upload = await uploadItemImage(
      buffer,
      file.name,
      file.type,
      auth.businessId,
      itemId
    );

    if (item.image_url) {
      const oldKey = extractStorageKeyFromUrl(item.image_url);
      if (oldKey) {
        try {
          await deleteStorageObject(oldKey);
        } catch (err) {
          console.warn('Failed to delete previous item image:', err);
        }
      }
    }

    await execute('UPDATE items SET image_url = ? WHERE id = ? AND business_id = ?', [
      upload.url,
      itemId,
      auth.businessId,
    ]);

    logActivity({
      businessId: auth.businessId,
      action: 'update',
      entityType: 'item',
      entityId: itemId,
      entityNameSnapshot: item.name,
      details: { imageUploaded: true },
      performedBy: auth.userId,
    });

    return jsonResponse({
      success: true,
      data: {
        imageUrl: upload.url,
        key: upload.key,
      },
    });
  } catch (error) {
    console.error('Error uploading item image:', error);
    return jsonResponse(
      {
        success: false,
        message: mapBackblazeUploadError(error),
      },
      500
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission('manage_items');
    if (isAuthResponse(auth)) return auth;

    const { id: itemId } = await params;

    const item = await queryOne<{ id: string; name: string; image_url: string | null }>(
      'SELECT id, name, image_url FROM items WHERE id = ? AND business_id = ?',
      [itemId, auth.businessId]
    );

    if (!item) {
      return jsonResponse({ success: false, message: 'Item not found' }, 404);
    }

    if (item.image_url) {
      const key = extractStorageKeyFromUrl(item.image_url);
      if (key && isBackblazeConfigured()) {
        try {
          await deleteStorageObject(key);
        } catch (err) {
          console.warn('Failed to delete item image from storage:', err);
        }
      }
    }

    await execute('UPDATE items SET image_url = NULL WHERE id = ? AND business_id = ?', [
      itemId,
      auth.businessId,
    ]);

    return jsonResponse({ success: true, message: 'Image removed' });
  } catch (error) {
    console.error('Error deleting item image:', error);
    return jsonResponse({ success: false, message: 'Failed to remove image' }, 500);
  }
}
