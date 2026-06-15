import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { generateUUID } from '@/lib/utils/uuid';
import { b2Authorize, b2DeleteFile, b2GetBucketId, b2UploadFile } from '@/lib/storage/backblaze-native';

function readEnv(...names: string[]): string | undefined {
  for (const name of names) {
    let value = process.env[name]?.trim();
    if (!value) continue;
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1).trim();
    }
    value = value.replace(/[\u200B-\u200D\uFEFF]/g, '');
    if (value) return value;
  }
  return undefined;
}

/** S3-compatible application keys use a 25-char keyID starting with 005. */
const B2_S3_KEY_ID_LENGTH = 25;

export function getBackblazeKeyId(): string | undefined {
  return readEnv('BACKBLAZE_KEY_ID', 'BACKBLAZE_APPLICATION_KEY_ID', 'B2_APPLICATION_KEY_ID');
}

export function getBackblazeApplicationKey(): string | undefined {
  return readEnv('BACKBLAZE_APPLICATION_KEY', 'BACKBLAZE_SECRET_KEY', 'B2_APPLICATION_KEY');
}

const KEY_ID = getBackblazeKeyId();
const APPLICATION_KEY = getBackblazeApplicationKey();
const BUCKET_NAME = readEnv('BACKBLAZE_BUCKET_NAME', 'B2_BUCKET_NAME');
const REGION = readEnv('BACKBLAZE_REGION', 'B2_REGION') || 'us-east-005';
const ENDPOINT = (() => {
  const raw = readEnv('BACKBLAZE_ENDPOINT', 'B2_ENDPOINT');
  if (!raw) return undefined;
  return raw.startsWith('http') ? raw : `https://${raw}`;
})();
const FALLBACK_ENDPOINT = readEnv('BACKBLAZE_FALLBACK_ENDPOINT', 'B2_FALLBACK_ENDPOINT');
const MAX_RETRIES = Number(process.env.BACKBLAZE_MAX_RETRIES ?? 3);
const RETRY_DELAY_MS = Number(process.env.BACKBLAZE_RETRY_DELAY ?? 1000);

/** Master keys (~12 char keyID) and other non-S3 keys use the B2 Native API. */
export function usesB2NativeApi(): boolean {
  if (!KEY_ID) return true;
  return KEY_ID.length !== B2_S3_KEY_ID_LENGTH || !KEY_ID.startsWith('005');
}

export function isMasterApplicationKey(): boolean {
  return Boolean(KEY_ID && KEY_ID.length < 20 && !KEY_ID.startsWith('005'));
}

export function getMissingBackblazeEnvVars(): string[] {
  const missing: string[] = [];
  if (!KEY_ID) missing.push('BACKBLAZE_KEY_ID');
  if (!APPLICATION_KEY) missing.push('BACKBLAZE_APPLICATION_KEY');
  if (!BUCKET_NAME) missing.push('BACKBLAZE_BUCKET_NAME');
  if (!usesB2NativeApi() && !ENDPOINT) missing.push('BACKBLAZE_ENDPOINT');
  return missing;
}

export function isBackblazeConfigured(): boolean {
  return getMissingBackblazeEnvVars().length === 0;
}

export function getBackblazeCredentialError(): string | null {
  if (!KEY_ID || !APPLICATION_KEY) return null;

  if (KEY_ID === APPLICATION_KEY) {
    return 'BACKBLAZE_KEY_ID and BACKBLAZE_APPLICATION_KEY must be different values.';
  }

  if (KEY_ID.startsWith('K')) {
    return (
      'BACKBLAZE_KEY_ID looks like the application key secret. ' +
      'Put keyID in BACKBLAZE_KEY_ID and the secret in BACKBLAZE_APPLICATION_KEY.'
    );
  }

  if (KEY_ID.length > 40) {
    return 'BACKBLAZE_KEY_ID is too long — the long secret belongs in BACKBLAZE_APPLICATION_KEY.';
  }

  if (APPLICATION_KEY.length < 10) {
    return 'BACKBLAZE_APPLICATION_KEY looks too short. Use the full application key from Backblaze.';
  }

  // S3 app key: keyID is 25 chars; if secret field has exactly that, likely swapped
  if (
    !usesB2NativeApi() &&
    APPLICATION_KEY.length === B2_S3_KEY_ID_LENGTH &&
    APPLICATION_KEY.startsWith('005')
  ) {
    return 'Keys may be swapped: 25-char keyID → BACKBLAZE_KEY_ID, long secret → BACKBLAZE_APPLICATION_KEY.';
  }

  return null;
}

function createS3Client(endpoint: string) {
  return new S3Client({
    region: REGION,
    endpoint,
    forcePathStyle: true,
    credentials: {
      accessKeyId: KEY_ID || '',
      secretAccessKey: APPLICATION_KEY || '',
    },
  });
}

function getS3PublicUrl(key: string): string {
  if (!BUCKET_NAME) throw new Error('Backblaze bucket not configured');
  const endpointHost = ENDPOINT?.replace(/^https?:\/\//, '').replace(/\/$/, '');
  if (endpointHost) {
    return `https://${endpointHost}/${BUCKET_NAME}/${key}`;
  }
  return `https://${BUCKET_NAME}.s3.${REGION}.backblazeb2.com/${key}`;
}

async function sendS3WithRetry<T>(fn: (client: S3Client) => Promise<T>): Promise<T> {
  const endpoints = [ENDPOINT, FALLBACK_ENDPOINT].filter(
    (e, i, arr): e is string => Boolean(e) && arr.indexOf(e) === i
  );

  let lastError: unknown;
  for (const endpoint of endpoints) {
    const client = createS3Client(endpoint);
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        return await fn(client);
      } catch (err) {
        lastError = err;
        if (attempt < MAX_RETRIES - 1) {
          await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * (attempt + 1)));
        }
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Backblaze S3 upload failed');
}

export function mapBackblazeUploadError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);

  if (message.includes('unauthorized') || message.includes('bad_auth_token')) {
    return 'Backblaze rejected the credentials. Check BACKBLAZE_KEY_ID and BACKBLAZE_APPLICATION_KEY match the same key pair.';
  }

  const code =
    error && typeof error === 'object' && 'Code' in error
      ? String((error as { Code?: string }).Code)
      : '';

  if (code === 'InvalidAccessKeyId' || message.includes('Malformed Access Key Id')) {
    return (
      'S3 upload failed for this key type. If using the Master Application Key, the app will use the B2 Native API automatically — restart the server after updating .env.'
    );
  }

  return message || 'Backblaze upload failed';
}

export interface StorageUploadResult {
  url: string;
  key: string;
  bucket: string;
}

/** App-relative URL that proxies Backblaze (works for private buckets). */
export function getMediaProxyUrl(storageKey: string): string {
  return `/api/media/${storageKey}`;
}

/** Normalize stored image_url to the app media proxy. */
export function toPublicImageUrl(storedUrl: string | null | undefined): string | null {
  if (!storedUrl?.trim()) return null;
  const trimmed = storedUrl.trim();
  if (trimmed.startsWith('/api/media/')) return trimmed;
  const key = extractStorageKeyFromUrl(trimmed);
  if (key) return getMediaProxyUrl(key);
  return trimmed;
}

export async function uploadItemImage(
  file: Buffer,
  filename: string,
  contentType: string,
  businessId: string,
  itemId: string
): Promise<StorageUploadResult> {
  if (!isBackblazeConfigured()) {
    throw new Error('Backblaze storage is not configured.');
  }

  const credentialError = getBackblazeCredentialError();
  if (credentialError) {
    throw new Error(credentialError);
  }

  const ext = filename.split('.').pop()?.toLowerCase() || 'jpg';
  const key = `items/${businessId}/${itemId}/${generateUUID()}.${ext}`;

  if (usesB2NativeApi()) {
    const auth = await b2Authorize(KEY_ID!, APPLICATION_KEY!);
    const bucketId = await b2GetBucketId(auth, BUCKET_NAME!);
    const uploaded = await b2UploadFile(auth, bucketId, BUCKET_NAME!, key, contentType, file);
    return {
      url: getMediaProxyUrl(uploaded.key),
      key: uploaded.key,
      bucket: BUCKET_NAME!,
    };
  }

  await sendS3WithRetry((client) =>
    client.send(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        Body: file,
        ContentType: contentType,
        CacheControl: 'public, max-age=31536000, immutable',
      })
    )
  );

  return {
    url: getMediaProxyUrl(key),
    key,
    bucket: BUCKET_NAME!,
  };
}

export async function deleteStorageObject(key: string): Promise<void> {
  if (!isBackblazeConfigured()) {
    throw new Error('Backblaze storage is not configured');
  }

  if (usesB2NativeApi()) {
    const auth = await b2Authorize(KEY_ID!, APPLICATION_KEY!);
    const bucketId = await b2GetBucketId(auth, BUCKET_NAME!);
    await b2DeleteFile(auth, bucketId, key);
    return;
  }

  await sendS3WithRetry((client) =>
    client.send(
      new DeleteObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
      })
    )
  );
}

/** Extract object key from a Backblaze URL or /api/media/ proxy path. */
export function extractStorageKeyFromUrl(url: string): string | null {
  if (url.startsWith('/api/media/')) {
    return url.slice('/api/media/'.length);
  }

  try {
    const urlObj = new URL(url, 'http://localhost');
    const path = urlObj.pathname;
    const mediaMatch = path.match(/^\/api\/media\/(items\/.+)$/);
    if (mediaMatch) return decodeURIComponent(mediaMatch[1]);
    const nativeMatch = path.match(/\/file\/[^/]+\/(items\/.+)$/);
    if (nativeMatch) return decodeURIComponent(nativeMatch[1]);
    const idx = path.indexOf('items/');
    if (idx >= 0) return path.slice(idx);
    return null;
  } catch {
    return null;
  }
}
