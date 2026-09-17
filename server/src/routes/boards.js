// routes/boards.js — 저장함과 그 안에 담은 짤.
//   GET    /api/me/boards                      저장함 목록 + 담은 것 전부
//   POST   /api/me/boards                      { name, private }
//   PATCH  /api/me/boards/:id                  { name }
//   DELETE /api/me/boards/:id                  저장함과 담은 것 같이 삭제
//   PUT    /api/me/boards/:id/pins/:memeId     저장함에 담기
//   DELETE /api/me/boards/:id/pins/:memeId     그 저장함에서만 빼기
//   PUT    /api/me/pins/:memeId                저장함 없이 저장
//   DELETE /api/me/pins/:memeId                저장함 없이 저장한 것만 빼기
//   DELETE /api/me/saves/:memeId               어디에 담겼든 전부 빼기
import { ok, created, noContent, notFound, badRequest, unauthorized, readJson } from '../http/respond.js';
import { currentUser } from '../auth/session.js';
import { recordAudit } from '../db/audit.js';

const MAX_NAME = 30;
const MAX_BOARDS = 200;

async function requireUser(req, db) {
  const u = await currentUser(req, db);
  if (!u) throw unauthorized('저장함을 쓰려면 로그인이 필요해요.');
  return u;
}

function cleanName(v) {
  const name = String(v || '').trim();
  if (!name) throw badRequest('저장함 이름을 적어주세요');
  if (name.length > MAX_NAME) throw badRequest(`저장함 이름은 ${MAX_NAME}자까지 넣을 수 있어요`);
  return name;
}

/** 내 저장함인지 확인하고 돌려줍니다 */
async function myBoard(db, id, userId) {
  const b = await db.boards.byId(id, userId);
  if (!b) throw notFound('내 저장함이 아니에요');
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
      throw badRequest(`저장함은 ${MAX_BOARDS}개까지 만들 수 있어요`);
    }
    const board = await db.boards.create(u.id, { name, isPrivate: body.private });
    await recordAudit(db, { userId: u.id, action: 'board.create', targetType: 'board', targetId: board.id,
      metadata: { private: !!body.private } });
    created(res, { board });
  });

  router.patch('/api/me/boards/:id', async (req, res, { db, params }) => {
    const u = await requireUser(req, db);
    const name = cleanName((await readJson(req)).name);
    if (!await db.boards.rename(Number(params.id), u.id, name)) throw notFound('내 저장함이 아니에요');
    await recordAudit(db, { userId: u.id, action: 'board.rename', targetType: 'board', targetId: params.id });
    noContent(res);
  });

  router.delete('/api/me/boards/:id', async (req, res, { db, params }) => {
    const u = await requireUser(req, db);
    if (!await db.boards.remove(Number(params.id), u.id)) throw notFound('내 저장함이 아니에요');
    await recordAudit(db, { userId: u.id, action: 'board.delete', targetType: 'board', targetId: params.id });
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
    await recordAudit(db, { userId: u.id, action: 'save.add', targetType: 'meme', targetId: memeId,
      metadata: { board_id: boardId } });
    noContent(res);
  });

  router.delete('/api/me/boards/:id/pins/:memeId', async (req, res, { db, params }) => {
    const u = await requireUser(req, db);
    const boardId = Number(params.id);
    await myBoard(db, boardId, u.id);
    await db.saves.remove(u.id, boardId, Number(params.memeId));
    await db.boards.touch(boardId);
    await recordAudit(db, { userId: u.id, action: 'save.remove', targetType: 'meme', targetId: params.memeId,
      metadata: { board_id: boardId } });
    noContent(res);
  });

  // 저장함에 넣지 않고 저장만 해두는 자리
  router.put('/api/me/pins/:memeId', async (req, res, { db, params }) => {
    const u = await requireUser(req, db);
    const memeId = Number(params.memeId);
    if (!await db.memes.byId(memeId)) throw notFound('그런 짤이 없어요');
    await db.saves.add(u.id, null, memeId);
    await recordAudit(db, { userId: u.id, action: 'save.add', targetType: 'meme', targetId: memeId });
    noContent(res);
  });

  router.delete('/api/me/pins/:memeId', async (req, res, { db, params }) => {
    const u = await requireUser(req, db);
    await db.saves.remove(u.id, null, Number(params.memeId));
    await recordAudit(db, { userId: u.id, action: 'save.remove', targetType: 'meme', targetId: params.memeId });
    noContent(res);
  });

  // 어디에 담겼든 전부
  router.delete('/api/me/saves/:memeId', async (req, res, { db, params }) => {
    const u = await requireUser(req, db);
    await db.saves.clear(u.id, Number(params.memeId));
    await recordAudit(db, { userId: u.id, action: 'save.clear', targetType: 'meme', targetId: params.memeId });
    noContent(res);
  });
}
