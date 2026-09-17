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

    const state = makeState();
    res.setHeader('set-cookie',
      `zzal_oauth_state=${state}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600`);
    redirect(res, authorizeUrl(p, state));
  });

  router.get('/api/auth/:provider/callback', async (req, res, { db, params, query }) => {
    const p = params.provider;
    if (!PROVIDERS.includes(p)) throw notFound('없는 로그인 방식입니다');

    const sent = (req.headers.cookie || '').match(/zzal_oauth_state=([^;]+)/);
    if (!sent || sent[1] !== query.get('state')) throw badRequest('로그인 요청이 만료되었어요. 다시 시도해주세요');

    const code = query.get('code');
    if (!code) throw badRequest('인가 코드가 없습니다');

    const profile = await exchange(p, code);
    const user = await db.users.findOrCreate(profile);
    await setSession(res, db, user.id);
    await recordAudit(db, { userId: user.id, action: 'auth.login', targetType: 'user', targetId: user.id,
      metadata: { provider: p } });
    redirect(res, '/');
  });

  router.post('/api/auth/logout', async (req, res, { db }) => {
    const user = await currentUser(req, db);
    await clearSession(req, res, db);
    if (user) await recordAudit(db, { userId: user.id, action: 'auth.logout',
      targetType: 'user', targetId: user.id });
    noContent(res);
  });
}
