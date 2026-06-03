import { createRemoteJWKSet, jwtVerify } from 'jose';
import type {
  SessionClaims,
  VerifySessionTokenOptions,
} from '../../types/index.js';

const ISSUER = 'glass';
const DEFAULT_JWKS_URL = 'https://api.seeit.ai/glass/.well-known/jwks.json';

const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function getJwks(jwksUrl: string) {
  let jwks = jwksCache.get(jwksUrl);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(jwksUrl));
    jwksCache.set(jwksUrl, jwks);
  }
  return jwks;
}

export async function verifySessionToken(
  token: string | undefined | null,
  options: VerifySessionTokenOptions,
): Promise<SessionClaims> {
  if (!token) throw new Error('verifySessionToken: missing token');

  const raw = token.startsWith('Bearer ')
    ? token.slice(7).trim()
    : token.trim();
  const jwksUrl = options.jwksUrl ?? DEFAULT_JWKS_URL;

  const { payload } = await jwtVerify(raw, getJwks(jwksUrl), {
    issuer: ISSUER,
    audience: options.appId,
  });

  const tokenType = payload.tokenType;
  if (tokenType !== 'launch' && tokenType !== 'session') {
    throw new Error('verifySessionToken: unexpected tokenType');
  }

  if (!payload.sub) {
    throw new Error('verifySessionToken: token has no subject (userId)');
  }

  const result: SessionClaims = {
    userId: payload.sub,
    appId: options.appId,
    tokenType,
  };
  if (typeof payload.name === 'string') result.name = payload.name;
  if (typeof payload.email === 'string') result.email = payload.email;
  if (typeof payload.sessionToken === 'string')
    result.sessionToken = payload.sessionToken;
  if (typeof payload.exp === 'number') result.expiresAt = payload.exp;

  return result;
}
