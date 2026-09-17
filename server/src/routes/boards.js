// routes/boards.js — 보드와 그 안에 담은 짤.
//   GET    /api/me/boards                      보드 목록 + 담은 것 전부
//   POST   /api/me/boards                      { name, private }
//   PATCH  /api/me/boards/:id                  { name }
//   DELETE /api/me/boards/:id                  보드와 담은 것 같이 삭제
//   PUT    /api/me/boards/:id/pins/:memeId     담기
//   DELETE /api/me/boards/:id/pins/:memeId     그 보드에서만 빼기
//   DELETE /api/me/pins/:memeId                모든 보드에서 빼기
import { ok, created, noContent, notFound, badRequest, unauthorized, readJson } from '../http/respond.js';
import { currentUser } from '../auth/session.js';

const MAX_NAME = 30;
const MAX_BOARDS = 200;

async function requireUser(req, db) {
  const u = await currentUser(req, db);
  if (!u) throw unauthorized('보드를 쓰려면 로그인이 필요해요.');
  return u;
}

function cleanName(v) {
  const name = String(v || '').trim();
  if (!name) throw badRequest('보드 이름을 적어주세요');
  if (name.length > MAX_NAME) throw badRequest(`보드 이름은 ${MAX_NAME}자까지 넣을 수 있어요`);
  return name;
}

/** 내 보드인지 확인하고 돌려줍니다 */
async function myBoard(db, id, userId) {
  const b = await db.boards.byId(id, userId);
  if (!b) throw notFound('내 보드가 아니에요');
  return b;
}

export function boardRoutes(router) {
  router.get('/api/me/boards', async (req, res, { db }) => {
    const u = await requireUser(req, db);
    const [boards, pins] = await Promise.all([db.boards.list(u.id), db.saves.list(u.id)]);
    ok(res, { boards, pins });
  });

  router.post('/api/me/boards', async (req, res, { db }) => {
    const u = await requireUser(req, db);
    const body = await readJson(req);
    const name = cleanName(body.name);
    if ((await db.boards.list(u.id)).length >= MAX_BOARDS) {
      throw badRequest(`보드는 ${MAX_BOARDS}개까지 만들 수 있어요`);
    }
    created(res, { board: await db.boards.create(u.id, { name, isPrivate: body.private }) });
  });

  router.patch('/api/me/boards/:id', async (req, res, { db, params }) => {
    const u = await requireUser(req, db);
    const name = cleanName((await readJson(req)).name);
    if (!await db.boards.rename(Number(params.id), u.id, name)) throw notFound('내 보드가 아니에요');
    noContent(res);
  });

  router.delete('/api/me/boards/:id', async (req, res, { db, params }) => {
    const u = await requireUser(req, db);
    if (!await db.boards.remove(Number(params.id), u.id)) throw notFound('내 보드가 아니에요');
    noContent(res);
  });

  router.put('/api/me/boards/:id/pins/:memeId', async (req, res, { db, params }) => {
    const u = await requireUser(req, db);
    const boardId = Number(params.id);
    const memeId = Number(params.memeId);
    await myBoard(db, boardId, u.id);
    if (!await db.memes.byId(memeId)) throw notFound('그런 짤이 없어요');
    await db.saves.add(u.id, boardId, memeId);
    await db.boards.touch(boardId);
    noContent(res);
  });

  router.delete('/api/me/boards/:id/pins/:memeId', async (req, res, { db, params }) => {
    const u = await requireUser(req, db);
    const boardId = Number(params.id);
    await myBoard(db, boardId, u.id);
    await db.saves.remove(u.id, boardId, Number(params.memeId));
    await db.boards.touch(boardId);
    noContent(res);
  });

  router.delete('/api/me/pins/:memeId', async (req, res, { db, params }) => {
    const u = await requireUser(req, db);
    await db.saves.remove(u.id, null, Number(params.memeId));
    noContent(res);
  });
}
