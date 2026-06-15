import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { requirePermission, isAuthResponse } from '@/lib/auth/api-auth';
import {
  getBackblazeCredentialError,
  getMissingBackblazeEnvVars,
  isBackblazeConfigured,
  isMasterApplicationKey,
  usesB2NativeApi,
} from '@/lib/storage/backblaze';

export async function OPTIONS() {
  return optionsResponse();
}

/** GET — check Backblaze env setup (lengths only, never exposes secrets). */
export async function GET() {
  try {
    const auth = await requirePermission('manage_items');
    if (isAuthResponse(auth)) return auth;

    const keyId = process.env.BACKBLAZE_KEY_ID?.trim() ?? '';
    const appKey = process.env.BACKBLAZE_APPLICATION_KEY?.trim() ?? '';

    return jsonResponse({
      success: true,
      data: {
        configured: isBackblazeConfigured(),
        missing: getMissingBackblazeEnvVars(),
        keyIdLength: keyId.length,
        applicationKeyLength: appKey.length,
        usesNativeApi: usesB2NativeApi(),
        isMasterKey: isMasterApplicationKey(),
        credentialError: getBackblazeCredentialError(),
        hint: usesB2NativeApi()
          ? 'Using B2 Native API (Master or non-S3 application key). ENDPOINT is optional.'
          : 'Using S3-compatible API. Requires 25-char keyID and BACKBLAZE_ENDPOINT.',
      },
    });
  } catch (error) {
    console.error('Backblaze status check failed:', error);
    return jsonResponse({ success: false, message: 'Failed to check Backblaze config' }, 500);
  }
}
