// routes/reports.js — 신고. 신고하면 그 사람 피드에서 바로 숨깁니다.
//   GET    /api/me/reports
//   PUT    /api/me/reports/:memeId   { reason }
//   DELETE /api/me/reports/:memeId   (숨김 해제)
import { ok, noContent, notFound, badRequest, unauthorized, readJson } from '../http/respond.js';
import { currentUser } from '../auth/session.js';

const REASONS = [
  '부적절하거나 불쾌한 콘텐츠',
  '저작권을 침해하는 이미지',
  '스팸 또는 광고',
  '제목·설명이 내용과 다름',
  '기타',
];

async function requireUser(req, db) {
  const u = await currentUser(req, db);
  if (!u) throw unauthorized('신고하려면 로그인이 필요해요.');
  return u;
}

export function reportRoutes(router) {
  router.get('/api/me/reports', async (req, res, { db }) => {
    const u = await requireUser(req, db);
    ok(res, { reasons: REASONS, reports: await db.reports.list(u.id) });
  });

  router.put('/api/me/reports/:memeId', async (req, res, { db, params }) => {
    const u = await requireUser(req, db);
    const id = Number(params.memeId);
    if (!await db.memes.byId(id)) throw notFound('그런 짤이 없어요');

    const { reason } = await readJson(req);
    if (reason && !REASONS.includes(reason)) throw badRequest('알 수 없는 신고 사유입니다');
    await db.reports.add(u.id, id, reason || '기타');
    noContent(res);
  });

  router.delete('/api/me/reports/:memeId', async (req, res, { db, params }) => {
    const u = await requireUser(req, db);
    await db.reports.remove(u.id, Number(params.memeId));
    noContent(res);
  });
}
