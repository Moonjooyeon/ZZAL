// routes/blocks.js — 악성 게시자 차단. 차단과 동시에 콘텐츠를 신고하고 즉시 숨깁니다.
import { ok, noContent, notFound, unauthorized } from '../http/respond.js';
import { currentUser } from '../auth/session.js';
import { recordAudit } from '../db/audit.js';

async function requireUser(req, db) {
  const user = await currentUser(req, db);
  if (!user) throw unauthorized('게시자를 차단하려면 로그인이 필요해요.');
  return user;
}

export function blockRoutes(router) {
  router.get('/api/me/blocks', async (req, res, { db }) => {
    const user = await requireUser(req, db);
    ok(res, { blocks: await db.blocks.list(user.id) });
  });

  router.put('/api/me/blocks/:memeId', async (req, res, { db, params }) => {
    const user = await requireUser(req, db);
    const memeId = Number(params.memeId);
    const meme = await db.memes.byId(memeId);
    if (!meme) throw notFound('그런 짤이 없어요');
    await db.blocks.add(user.id, memeId, meme.owner_id);
    await db.reports.add(user.id, memeId, '게시자 차단');
    await recordAudit(db, { userId: user.id, action: 'user.block', targetType: 'meme', targetId: memeId,
      metadata: { blockedOwnerId: meme.owner_id || null, reported: true } });
    noContent(res);
  });
}
