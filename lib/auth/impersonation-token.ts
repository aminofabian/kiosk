import { createHmac, timingSafeEqual } from 'crypto';

const TOKEN_TTL_SECONDS = 5 * 60;

export interface ImpersonationPayload {
  userId: string;
  businessId: string;
  issuedBy: string;
  exp: number;
}

function getSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error('NEXTAUTH_SECRET is not set');
  }
  return secret;
}

function sign(data: string): string {
  return createHmac('sha256', getSecret()).update(data).digest('base64url');
}

export function createImpersonationToken(
  userId: string,
  businessId: string,
  issuedBy: string,
): string {
  const payload: ImpersonationPayload = {
    userId,
    businessId,
    issuedBy,
    exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${body}.${sign(body)}`;
}

export function verifyImpersonationToken(
  token: string,
): ImpersonationPayload | null {
  const [body, signature] = token.split('.');
  if (!body || !signature) return null;

  const expected = sign(body);
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(body, 'base64url').toString('utf8'),
    ) as ImpersonationPayload;

    if (
      !payload.userId ||
      !payload.businessId ||
      !payload.issuedBy ||
      !payload.exp
    ) {
      return null;
    }

    if (payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}
