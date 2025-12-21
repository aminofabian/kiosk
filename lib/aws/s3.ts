import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { generateUUID } from '@/lib/utils/uuid';

const REGION = process.env.AWS_REGION || 'eu-north-1';
const ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID;
const SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY;
const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME || 'alexawriters';

if (!ACCESS_KEY_ID || !SECRET_ACCESS_KEY) {
  console.warn('⚠️ AWS credentials not configured. S3 uploads will fail.');
}

const s3Client = new S3Client({
  region: REGION,
  credentials: {
    accessKeyId: ACCESS_KEY_ID || '',
    secretAccessKey: SECRET_ACCESS_KEY || '',
  },
});

export interface UploadResult {
  url: string;
  key: string;
  bucket: string;
}

export async function uploadBannerToS3(
  file: Buffer,
  filename: string,
  contentType: string,
  businessId: string
): Promise<UploadResult> {
  if (!ACCESS_KEY_ID || !SECRET_ACCESS_KEY) {
    throw new Error('AWS credentials not configured');
  }

  const fileExtension = filename.split('.').pop()?.toLowerCase() || 'jpg';
  const key = `banners/${businessId}/${generateUUID()}.${fileExtension}`;

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: file,
    ContentType: contentType,
    ACL: 'public-read',
    CacheControl: 'public, max-age=31536000, immutable',
  });

  await s3Client.send(command);

  const url = `https://${BUCKET_NAME}.s3.${REGION}.amazonaws.com/${key}`;

  return {
    url,
    key,
    bucket: BUCKET_NAME,
  };
}

export async function deleteBannerFromS3(key: string): Promise<void> {
  if (!ACCESS_KEY_ID || !SECRET_ACCESS_KEY) {
    throw new Error('AWS credentials not configured');
  }

  const command = new DeleteObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

  await s3Client.send(command);
}

export function extractS3KeyFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url);
    
    if (urlObj.hostname.includes(BUCKET_NAME) || urlObj.hostname.includes('s3')) {
      const pathParts = urlObj.pathname.split('/').filter(Boolean);
      
      if (pathParts.length >= 2 && pathParts[0] === 'banners') {
        return pathParts.join('/');
      }
      
      const bucketIndex = pathParts.findIndex(p => p === BUCKET_NAME);
      if (bucketIndex >= 0 && pathParts.length > bucketIndex + 1) {
        return pathParts.slice(bucketIndex + 1).join('/');
      }
      
      if (pathParts.length > 0) {
        return pathParts.join('/');
      }
    }
    
    return null;
  } catch {
    return null;
  }
}
