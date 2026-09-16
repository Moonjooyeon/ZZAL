// routes/saves.js — 저장한 짤.
//   GET    /api/me/saves
//   PUT    /api/me/saves/:memeId
//   DELETE /api/me/saves/:memeId
import { ok, noContent, notFound, unauthorized } from '../http/respond.js';
import { currentUser } from '../auth/session.js';

async function requireUser(req, db) {
  const u = await currentUser(req, db);
  if (!u) throw unauthorized('짤을 저장하려면 로그인이 필요해요.');
  return u;
}

export function saveRoutes(router) {
  router.get('/api/me/saves', async (req, res, { db }) => {
    const u = await requireUser(req, db);
    ok(res, { saved: await db.saves.list(u.id) });
  });

  router.put('/api/me/saves/:memeId', async (req, res, { db, params }) => {
    const u = await requireUser(req, db);
    const id = Number(params.memeId);
    if (!await db.memes.byId(id)) throw notFound('그런 짤이 없어요');
    await db.saves.add(u.id, id);
    noContent(res);
  });

  router.delete('/api/me/saves/:memeId', async (req, res, { db, params }) => {
    const u = await requireUser(req, db);
    await db.saves.remove(u.id, Number(params.memeId));
    noContent(res);
  });
}
