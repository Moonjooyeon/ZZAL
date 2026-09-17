// routes/auth.js — 로그인/로그아웃.
//   GET  /api/auth/me                내 정보
//   GET  /api/auth/:provider         공급자 로그인 화면으로
//   GET  /api/auth/:provider/callback  공급자가 되돌려 보내는 곳
//   POST /api/auth/logout
import { ok, redirect, noContent, notFound, badRequest } from '../http/respond.js';
import { setSession, clearSession, currentUser } from '../auth/session.js';
import { PROVIDERS, isConfigured, authorizeUrl, makeState, exchange, demoProfile } from '../auth/providers.js';
import { config } from '../config.js';
import { recordAudit } from '../db/audit.js';

const publicUser = u => u && ({ id: u.id, name: u.name, provider: u.provider, avatarUrl: u.avatar_url });
const stateCookie = (value, provider, maxAge = 600) =>
  `zzal_oauth_state=${value}; Path=/api/auth/; HttpOnly; SameSite=${provider === 'apple' ? 'None; Secure' : 'Lax'}; Max-Age=${maxAge}`;

async function appleForm(req) {
  if (!req.headers['content-type']?.startsWith('application/x-www-form-urlencoded'))
    throw badRequest('Apple 응답 형식이 올바르지 않습니다');
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 16384) throw badRequest('Apple 응답이 너무 큽니다');
    chunks.push(chunk);
  }
  return new URLSearchParams(Buffer.concat(chunks).toString('utf8'));
}

async function finishLogin(req, res, db, provider, values) {
  const sent = (req.headers.cookie || '').match(/(?:^|;\s*)zzal_oauth_state=([^;]+)/)?.[1];
  const state = values.get('state');
  if (!sent || !state || sent !== `${provider}.${state}`)
    throw badRequest('로그인 요청이 만료되었어요. 다시 시도해주세요');
  if (values.get('error')) throw badRequest('로그인이 취소되었거나 거절되었습니다');
  const code = values.get('code');
  if (!code) throw badRequest('인가 코드가 없습니다');
  let firstLoginUser = null;
  if (provider === 'apple' && values.get('user')) {
    try { firstLoginUser = JSON.parse(values.get('user')); }
    catch { throw badRequest('Apple 사용자 정보를 읽을 수 없습니다'); }
  }
  const profile = await exchange(provider, code, firstLoginUser);
  const user = await db.users.findOrCreate(profile);
  res.setHeader('set-cookie', stateCookie('', provider, 0));
  await setSession(res, db, user.id);
  await recordAudit(db, { userId: user.id, action: 'auth.login', targetType: 'user', targetId: user.id,
    metadata: { provider } });
  redirect(res, '/');
}

export function authRoutes(router) {
  router.get('/api/auth/me', async (req, res, { db }) => {
    ok(res, { user: publicUser(await currentUser(req, db)) });
  });

  router.get('/api/auth/:provider', async (req, res, { db, params }) => {
    const p = params.provider;
    if (!PROVIDERS.includes(p)) throw notFound('없는 로그인 방식입니다');

    if (!isConfigured(p)) {
      if (!config.auth.demo) throw badRequest(`${p} 앱 키가 설정되지 않았습니다`);
      // 키가 없을 때: 바로 임시 계정으로 로그인시켜 프론트를 끝까지 볼 수 있게 합니다
      const user = await db.users.findOrCreate(demoProfile(p));
      await setSession(res, db, user.id);
      await recordAudit(db, { userId: user.id, action: 'auth.login', targetType: 'user', targetId: user.id,
        metadata: { provider: p, demo: true } });
      return redirect(res, '/?login=demo');
    }

    if (p === 'apple' && !config.publicOrigin.startsWith('https://'))
      throw badRequest('Apple 로그인은 HTTPS 주소가 필요합니다');
    const state = makeState();
    res.setHeader('set-cookie', stateCookie(`${p}.${state}`, p));
    redirect(res, authorizeUrl(p, state));
  });

  router.get('/api/auth/:provider/callback', async (req, res, { db, params, query }) => {
    const p = params.provider;
    if (p !== 'google') throw notFound('없는 로그인 방식입니다');
    await finishLogin(req, res, db, p, query);
  });

  router.post('/api/auth/apple/callback', async (req, res, { db }) => {
    await finishLogin(req, res, db, 'apple', await appleForm(req));
  });

  router.post('/api/auth/logout', async (req, res, { db }) => {
    const user = await currentUser(req, db);
    await clearSession(req, res, db);
    if (user) await recordAudit(db, { userId: user.id, action: 'auth.logout',
      targetType: 'user', targetId: user.id });
    noContent(res);
  });
}
