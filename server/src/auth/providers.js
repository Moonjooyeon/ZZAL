// auth/providers.js — 카카오·구글 OAuth 2.0.
// 앱 키가 없으면 config.auth.demo 모드에서 임시 계정으로 로그인합니다.
import crypto from 'node:crypto';
import { config } from '../config.js';
import { badRequest } from '../http/respond.js';

export const PROVIDERS = ['kakao', 'google'];

const redirectUri = provider => `${config.publicOrigin}/api/auth/${provider}/callback`;

const SPEC = {
  kakao: {
    authorize: 'https://kauth.kakao.com/oauth/authorize',
    token: 'https://kauth.kakao.com/oauth/token',
    profile: 'https://kapi.kakao.com/v2/user/me',
    scope: 'profile_nickname profile_image',
    parse: p => ({
      providerId: String(p.id),
      name: p.kakao_account?.profile?.nickname || '카카오 사용자',
      email: p.kakao_account?.email || null,
      avatarUrl: p.kakao_account?.profile?.profile_image_url || null,
    }),
  },
  google: {
    authorize: 'https://accounts.google.com/o/oauth2/v2/auth',
    token: 'https://oauth2.googleapis.com/token',
    profile: 'https://www.googleapis.com/oauth2/v3/userinfo',
    scope: 'openid email profile',
    parse: p => ({
      providerId: p.sub,
      name: p.name || 'Google 사용자',
      email: p.email || null,
      avatarUrl: p.picture || null,
    }),
  },
};

export const isConfigured = provider =>
  !!(config.auth[provider] && config.auth[provider].id);

/** 공급자 로그인 화면 주소. state는 CSRF 방지용으로 쿠키와 대조합니다. */
export function authorizeUrl(provider, state) {
  const spec = SPEC[provider];
  const u = new URL(spec.authorize);
  u.searchParams.set('client_id', config.auth[provider].id);
  u.searchParams.set('redirect_uri', redirectUri(provider));
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('scope', spec.scope);
  u.searchParams.set('state', state);
  return u.toString();
}

export const makeState = () => crypto.randomBytes(16).toString('hex');

/** 인가 코드 → 공급자 프로필 */
export async function exchange(provider, code) {
  const spec = SPEC[provider];
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: config.auth[provider].id,
    client_secret: config.auth[provider].secret,
    redirect_uri: redirectUri(provider),
    code,
  });

  const tokenRes = await fetch(spec.token, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!tokenRes.ok) throw badRequest(`${provider} 토큰 교환에 실패했습니다 (${tokenRes.status})`);
  const { access_token } = await tokenRes.json();

  const profileRes = await fetch(spec.profile, {
    headers: { authorization: `Bearer ${access_token}` },
  });
  if (!profileRes.ok) throw badRequest(`${provider} 프로필 조회에 실패했습니다 (${profileRes.status})`);

  return { provider, ...spec.parse(await profileRes.json()) };
}

/** 앱 키가 아직 없을 때 쓰는 임시 계정 */
export const demoProfile = provider => ({
  provider,
  providerId: 'demo',
  name: (provider === 'kakao' ? '카카오' : 'Google') + ' 사용자',
  email: null,
  avatarUrl: null,
});
