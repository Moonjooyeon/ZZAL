// Google and Sign in with Apple authorization-code flows.
import crypto from 'node:crypto';
import fs from 'node:fs';
import { config } from '../config.js';
import { badRequest } from '../http/respond.js';

export const PROVIDERS = ['apple', 'google'];
const redirectUri = provider => `${config.publicOrigin}/api/auth/${provider}/callback`;
const appleIssuer = 'https://appleid.apple.com';
let appleKeys = null;
let appleKeysUntil = 0;

export const isConfigured = provider => provider === 'apple'
  ? !!(config.auth.apple.id && config.auth.apple.teamId && config.auth.apple.keyId &&
      (config.auth.apple.privateKeyPem || config.auth.apple.privateKeyPath || config.auth.apple.privateKeyBase64))
  : !!(config.auth.google.id && config.auth.google.secret);

export const makeState = () => crypto.randomBytes(24).toString('hex');

export function authorizeUrl(provider, state) {
  const u = new URL(provider === 'apple' ? `${appleIssuer}/auth/authorize`
    : 'https://accounts.google.com/o/oauth2/v2/auth');
  u.searchParams.set('client_id', config.auth[provider].id);
  u.searchParams.set('redirect_uri', redirectUri(provider));
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('scope', provider === 'apple' ? 'name email' : 'openid email profile');
  u.searchParams.set('state', state);
  if (provider === 'apple') u.searchParams.set('response_mode', 'form_post');
  return u.toString();
}

function appleClientSecret() {
  const { id, teamId, keyId, privateKeyPem, privateKeyPath, privateKeyBase64 } = config.auth.apple;
  const key = privateKeyPem ? privateKeyPem.replace(/\\n/g, '\n')
    : privateKeyBase64 ? Buffer.from(privateKeyBase64, 'base64').toString('utf8')
      : fs.readFileSync(privateKeyPath, 'utf8');
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'ES256', kid: keyId, typ: 'JWT' };
  const payload = { iss: teamId, iat: now, exp: now + 3600, aud: appleIssuer, sub: id };
  const encoded = [header, payload].map(value => Buffer.from(JSON.stringify(value)).toString('base64url')).join('.');
  const signature = crypto.sign('sha256', Buffer.from(encoded),
    { key, dsaEncoding: 'ieee-p1363' }).toString('base64url');
  return `${encoded}.${signature}`;
}

async function verifyAppleIdentity(token) {
  if (typeof token !== 'string' || token.length > 10000) throw badRequest('Apple 인증 토큰이 올바르지 않습니다');
  const parts = token.split('.');
  if (parts.length !== 3) throw badRequest('Apple 인증 토큰이 올바르지 않습니다');
  let header, payload;
  try {
    header = JSON.parse(Buffer.from(parts[0], 'base64url'));
    payload = JSON.parse(Buffer.from(parts[1], 'base64url'));
  } catch { throw badRequest('Apple 인증 토큰이 올바르지 않습니다'); }
  if (header.alg !== 'RS256' || typeof header.kid !== 'string') throw badRequest('Apple 인증 토큰이 올바르지 않습니다');
  if (!appleKeys || Date.now() >= appleKeysUntil || !appleKeys.some(k => k.kid === header.kid)) {
    const response = await fetch(`${appleIssuer}/auth/keys`);
    if (!response.ok) throw badRequest('Apple 공개키를 확인할 수 없습니다');
    appleKeys = (await response.json()).keys;
    if (!Array.isArray(appleKeys)) throw badRequest('Apple 공개키가 올바르지 않습니다');
    appleKeysUntil = Date.now() + 60 * 60 * 1000;
  }
  const jwk = appleKeys.find(k => k.kid === header.kid && k.kty === 'RSA');
  if (!jwk || !crypto.verify('RSA-SHA256', Buffer.from(`${parts[0]}.${parts[1]}`),
    crypto.createPublicKey({ key: jwk, format: 'jwk' }), Buffer.from(parts[2], 'base64url')))
    throw badRequest('Apple 인증 서명을 확인할 수 없습니다');
  const now = Math.floor(Date.now() / 1000);
  if (payload.iss !== appleIssuer || payload.aud !== config.auth.apple.id ||
      !Number.isInteger(payload.exp) || payload.exp <= now ||
      !Number.isInteger(payload.iat) || payload.iat > now + 300 ||
      typeof payload.sub !== 'string' || !payload.sub)
    throw badRequest('Apple 인증 정보가 올바르지 않습니다');
  return payload;
}

export async function exchange(provider, code, firstLoginUser = null) {
  const isApple = provider === 'apple';
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: config.auth[provider].id,
    client_secret: isApple ? appleClientSecret() : config.auth.google.secret,
    redirect_uri: redirectUri(provider),
    code,
  });
  const tokenRes = await fetch(isApple ? `${appleIssuer}/auth/token` : 'https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body,
  });
  if (!tokenRes.ok) throw badRequest(`${isApple ? 'Apple' : 'Google'} 토큰 교환에 실패했습니다 (${tokenRes.status})`);
  const tokens = await tokenRes.json();
  if (isApple) {
    const claims = await verifyAppleIdentity(tokens.id_token);
    const name = [firstLoginUser?.name?.firstName, firstLoginUser?.name?.lastName].filter(Boolean).join(' ');
    return { provider, providerId: claims.sub, name: name || 'Apple 사용자',
      email: claims.email || firstLoginUser?.email || null, avatarUrl: null };
  }
  if (!tokens.access_token) throw badRequest('Google 토큰이 없습니다');
  const profileRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { authorization: `Bearer ${tokens.access_token}` },
  });
  if (!profileRes.ok) throw badRequest(`Google 프로필 조회에 실패했습니다 (${profileRes.status})`);
  const profile = await profileRes.json();
  if (!profile.sub) throw badRequest('Google 계정 식별자가 없습니다');
  return { provider, providerId: profile.sub, name: profile.name || 'Google 사용자',
    email: profile.email || null, avatarUrl: profile.picture || null };
}

export const demoProfile = provider => ({ provider, providerId: 'demo',
  name: `${provider === 'apple' ? 'Apple' : 'Google'} 사용자`, email: null, avatarUrl: null });
