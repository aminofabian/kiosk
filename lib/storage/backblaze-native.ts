import { createHash } from 'crypto';

export interface B2Auth {
  authorizationToken: string;
  apiUrl: string;
  downloadUrl: string;
  accountId: string;
}

export async function b2Authorize(keyId: string, applicationKey: string): Promise<B2Auth> {
  const credentials = Buffer.from(`${keyId}:${applicationKey}`).toString('base64');
  const res = await fetch('https://api.backblazeb2.com/b2api/v2/b2_authorize_account', {
    headers: { Authorization: `Basic ${credentials}` },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Backblaze authorization failed (${res.status}): ${body}`);
  }

  const data = (await res.json()) as {
    authorizationToken: string;
    apiUrl: string;
    downloadUrl: string;
    accountId: string;
  };

  return {
    authorizationToken: data.authorizationToken,
    apiUrl: data.apiUrl,
    downloadUrl: data.downloadUrl,
    accountId: data.accountId,
  };
}

export async function b2GetBucketId(auth: B2Auth, bucketName: string): Promise<string> {
  const res = await fetch(`${auth.apiUrl}/b2api/v2/b2_list_buckets`, {
    method: 'POST',
    headers: {
      Authorization: auth.authorizationToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      accountId: auth.accountId,
      bucketName,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Backblaze list buckets failed (${res.status}): ${body}`);
  }

  const data = (await res.json()) as { buckets?: Array<{ bucketId: string; bucketName: string }> };
  const bucket = data.buckets?.find((b) => b.bucketName === bucketName);
  if (!bucket) {
    throw new Error(`Backblaze bucket "${bucketName}" not found`);
  }
  return bucket.bucketId;
}

async function b2GetUploadUrl(
  auth: B2Auth,
  bucketId: string
): Promise<{ uploadUrl: string; authorizationToken: string }> {
  const res = await fetch(`${auth.apiUrl}/b2api/v2/b2_get_upload_url`, {
    method: 'POST',
    headers: {
      Authorization: auth.authorizationToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ bucketId }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Backblaze get upload URL failed (${res.status}): ${body}`);
  }

  return res.json() as Promise<{ uploadUrl: string; authorizationToken: string }>;
}

export async function b2UploadFile(
  auth: B2Auth,
  bucketId: string,
  bucketName: string,
  fileName: string,
  contentType: string,
  body: Buffer
): Promise<{ url: string; key: string; fileId: string }> {
  const { uploadUrl, authorizationToken: uploadToken } = await b2GetUploadUrl(auth, bucketId);
  const sha1 = createHash('sha1').update(body).digest('hex');

  const res = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      Authorization: uploadToken,
      'X-Bz-File-Name': fileName,
      'X-Bz-Content-Sha1': sha1,
      'Content-Type': contentType,
      'Content-Length': String(body.length),
    },
    body,
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Backblaze upload failed (${res.status}): ${errBody}`);
  }

  const uploaded = (await res.json()) as { fileId: string; fileName: string };
  // Public URL only works if bucket is allPublic; callers should prefer /api/media/ proxy.
  const url = `${auth.downloadUrl}/file/${bucketName}/${encodeB2FileNameForUrl(uploaded.fileName)}`;

  return { url, key: uploaded.fileName, fileId: uploaded.fileId };
}

/** B2 URLs encode each path segment but keep slashes. */
export function encodeB2FileNameForUrl(fileName: string): string {
  return fileName.split('/').map((segment) => encodeURIComponent(segment)).join('/');
}

export async function b2GetDownloadAuthorization(
  auth: B2Auth,
  bucketId: string,
  fileName: string,
  validSeconds = 900
): Promise<string> {
  const res = await fetch(`${auth.apiUrl}/b2api/v2/b2_get_download_authorization`, {
    method: 'POST',
    headers: {
      Authorization: auth.authorizationToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      bucketId,
      fileNamePrefix: fileName,
      validDurationInSeconds: validSeconds,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Backblaze download auth failed (${res.status}): ${body}`);
  }

  const data = (await res.json()) as { authorizationToken: string };
  return data.authorizationToken;
}

export async function b2DownloadFile(
  auth: B2Auth,
  bucketId: string,
  bucketName: string,
  fileName: string
): Promise<{ body: Buffer; contentType: string }> {
  const downloadAuth = await b2GetDownloadAuthorization(auth, bucketId, fileName);
  const url = `${auth.downloadUrl}/file/${bucketName}/${encodeB2FileNameForUrl(fileName)}`;
  const res = await fetch(url, {
    headers: { Authorization: downloadAuth },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Backblaze download failed (${res.status}): ${body}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  const contentType = res.headers.get('content-type') || guessContentType(fileName);
  return { body: Buffer.from(arrayBuffer), contentType };
}

function guessContentType(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'avif':
      return 'image/avif';
    default:
      return 'application/octet-stream';
  }
}

export async function b2DeleteFile(auth: B2Auth, bucketId: string, fileName: string): Promise<void> {
  const listRes = await fetch(`${auth.apiUrl}/b2api/v2/b2_list_file_names`, {
    method: 'POST',
    headers: {
      Authorization: auth.authorizationToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      bucketId,
      prefix: fileName,
      maxFileCount: 1,
    }),
  });

  if (!listRes.ok) {
    const body = await listRes.text();
    throw new Error(`Backblaze list files failed (${listRes.status}): ${body}`);
  }

  const listData = (await listRes.json()) as {
    files?: Array<{ fileId: string; fileName: string }>;
  };
  const file = listData.files?.find((f) => f.fileName === fileName);
  if (!file) return;

  const delRes = await fetch(`${auth.apiUrl}/b2api/v2/b2_delete_file_version`, {
    method: 'POST',
    headers: {
      Authorization: auth.authorizationToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      fileName: file.fileName,
      fileId: file.fileId,
    }),
  });

  if (!delRes.ok) {
    const body = await delRes.text();
    throw new Error(`Backblaze delete failed (${delRes.status}): ${body}`);
  }
}
