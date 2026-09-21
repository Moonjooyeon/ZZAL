// routes/auth.js — 로그인/로그아웃.
//   GET  /api/auth/me                내 정보
//   GET  /api/auth/:provider         공급자 로그인 화면으로
//   GET  /api/auth/:provider/callback  공급자가 되돌려 보내는 곳
//   POST /api/auth/logout
//   DELETE /api/auth/account          계정과 연결된 데이터 영구 삭제
import crypto from 'node:crypto';
import { ok, redirect, noContent, notFound, badRequest, unauthorized, readJson } from '../http/respond.js';
import { setSession, clearSession, currentUser } from '../auth/session.js';
import { PROVIDERS, isConfigured, authorizeUrl, makeState, exchange, demoProfile } from '../auth/providers.js';
import { config } from '../config.js';
import { recordAudit } from '../db/audit.js';

const publicUser = u => u && ({ id: u.id, name: u.name, provider: u.provider, avatarUrl: u.avatar_url });
const stateCookie = (value, provider, maxAge = 600) =>
  `zzal_oauth_state=${value}; Path=/api/auth/; HttpOnly; SameSite=${provider === 'apple' ? 'None; Secure' : 'Lax'}; Max-Age=${maxAge}`;
const ticketHash = ticket => crypto.createHash('sha256').update(ticket).digest('hex');

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
  const mobile = sent === `${provider}.${state}.ios`;
  if (!sent || !state || (!mobile && sent !== `${provider}.${state}`))
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
  if (mobile) {
    const ticket = crypto.randomBytes(32).toString('base64url');
    await db.sessions.create(ticketHash(ticket), user.id, new Date(Date.now() + 2 * 60 * 1000));
    return redirect(res, `izzal://auth?ticket=${ticket}`);
  }
  await setSession(res, db, user.id);
  await recordAudit(db, { userId: user.id, action: 'auth.login', targetType: 'user', targetId: user.id,
    metadata: { provider } });
  redirect(res, '/');
}

export function authRoutes(router) {
  router.get('/api/auth/me', async (req, res, { db }) => {
    ok(res, { user: publicUser(await currentUser(req, db)) });
  });

  router.get('/api/auth/:provider', async (req, res, { db, params, query }) => {
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
    const mobile = query.get('mobile') === 'ios';
    if (mobile && !config.publicOrigin.startsWith('https://'))
      throw badRequest('앱 로그인은 HTTPS 주소가 필요합니다');
    res.setHeader('set-cookie', stateCookie(`${p}.${state}${mobile ? '.ios' : ''}`, p));
    redirect(res, authorizeUrl(p, state));
  });

  router.post('/api/auth/mobile/consume', async (req, res, { db }) => {
    const { ticket } = await readJson(req, 1024);
    if (typeof ticket !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(ticket))
      throw badRequest('앱 로그인 코드가 올바르지 않습니다');
    const userId = await db.sessions.consume(ticketHash(ticket));
    if (userId == null) throw badRequest('앱 로그인 코드가 만료되었어요. 다시 시도해 주세요');
    await setSession(res, db, userId);
    await recordAudit(db, { userId, action: 'auth.login', targetType: 'user', targetId: userId,
      metadata: { client: 'ios' } });
    ok(res, { user: publicUser(await db.users.byId(userId)) });
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

  router.delete('/api/auth/account', async (req, res, { db }) => {
    const user = await currentUser(req, db);
    if (!user) throw unauthorized('로그인이 필요합니다');
    await clearSession(req, res, db);
    await db.users.remove(user.id);
    noContent(res);
  });
}
