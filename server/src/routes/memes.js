// routes/memes.js — 짤 카탈로그 조회.
//   GET /api/memes?cat=동물&q=비둘기&limit=60&offset=0
//   GET /api/memes/:id
//
// keywords(숨은 키워드)는 검색에만 쓰고 응답에 담지 않습니다.
import { ok, notFound } from '../http/respond.js';
import { currentUser } from '../auth/session.js';

const publicMeme = m => ({
  id: m.id,
  name: m.name,
  src: m.image_path,
  cat: m.cat,
  tags: m.tags,
  why: m.why,
  mine: m.owner_id !== null,
});

export function memeRoutes(router) {
  router.get('/api/memes', async (req, res, { db, query }) => {
    const user = await currentUser(req, db);
    const { total, rows } = await db.memes.list({
      cat: query.get('cat') || undefined,
      q: query.get('q') || undefined,
      limit: Math.min(Number(query.get('limit') || 200), 1000),
      offset: Number(query.get('offset') || 0),
      userId: user ? user.id : null,
    });
    ok(res, { total, memes: rows.map(publicMeme) });
  });

  router.get('/api/memes/:id', async (req, res, { db, params }) => {
    const m = await db.memes.byId(Number(params.id));
    const user = await currentUser(req, db);
    if (!m || (m.owner_id !== null && Number(m.owner_id) !== Number(user?.id))) {
      throw notFound('그런 짤이 없어요');
    }
    ok(res, { meme: publicMeme(m) });
  });
}
