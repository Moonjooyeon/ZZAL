// routes/uploads.js — 내가 올린 짤.
//   GET    /api/me/uploads
//   POST   /api/me/uploads     { name, image, cat?, tags? }  image는 data: URL
//   DELETE /api/me/uploads/:id
//
// 지금은 이미지를 data URL 그대로 보관합니다. 실서비스에서는 여기서
// 오브젝트 스토리지(S3/R2)에 올리고 그 키만 image_path에 넣으세요.
import { ok, created, noContent, notFound, badRequest, tooLarge, unauthorized, readJson } from '../http/respond.js';
import { currentUser } from '../auth/session.js';

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED = ['image/jpeg', 'image/png', 'image/gif'];

async function requireUser(req, db) {
  const u = await currentUser(req, db);
  if (!u) throw unauthorized('짤을 올리려면 로그인이 필요해요.');
  return u;
}

export function uploadRoutes(router) {
  router.get('/api/me/uploads', async (req, res, { db }) => {
    const u = await requireUser(req, db);
    const { rows } = await db.memes.list({ userId: u.id, limit: 1000 });
    ok(res, { uploads: rows.filter(m => m.owner_id === u.id) });
  });

  router.post('/api/me/uploads', async (req, res, { db }) => {
    const u = await requireUser(req, db);
    const body = await readJson(req, MAX_BYTES + 1024 * 1024);

    const name = String(body.name || '').trim();
    if (!name) throw badRequest('언제 쓰는 짤인지 한 줄 적어주세요');
    if (name.length > 80) throw badRequest('설명은 80자까지 넣을 수 있어요');

    const m = /^data:([\w/+-]+);base64,(.+)$/.exec(String(body.image || ''));
    if (!m) throw badRequest('이미지를 읽을 수 없습니다');
    if (!ALLOWED.includes(m[1])) throw badRequest('JPG, PNG, GIF 파일을 올려주세요');
    if (Buffer.byteLength(m[2], 'base64') > MAX_BYTES) throw tooLarge('10MB 이하의 이미지를 올려주세요');

    // 먼저 규칙으로 임시 분류해 바로 응답합니다.
    // 이미지를 보고 제대로 나누고 숨은 키워드를 붙이는 일은
    // ai/enrich.js 의 주기 작업이 잠시 뒤에 이어서 합니다.
    const meme = await db.memes.create({
      name,
      image_path: body.image,          // TODO: 오브젝트 스토리지 키로 바꾸기
      cat: body.cat || '직접 올림',
      tags: Array.isArray(body.tags) ? body.tags.slice(0, 5) : ['직접 올림'],
      keywords: name.split(/\s+/).filter(Boolean),
      why: name,
      owner_id: u.id,
      visibility: 'private',
      enriched_at: null,
    });
    created(res, { meme: { id: meme.id, name: meme.name, src: meme.image_path, cat: meme.cat, tags: meme.tags, why: meme.why, mine: true } });
  });

  router.delete('/api/me/uploads/:id', async (req, res, { db, params }) => {
    const u = await requireUser(req, db);
    if (!await db.memes.remove(Number(params.id), u.id)) throw notFound('내가 올린 짤이 아니에요');
    noContent(res);
  });
}
