// http/respond.js — 응답 만들기 도우미.

export function json(res, status, body) {
  const s = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(s),
    'cache-control': 'no-store',
  });
  res.end(s);
}

export const ok = (res, body = {}) => json(res, 200, body);
export const created = (res, body = {}) => json(res, 201, body);
export const noContent = res => { res.writeHead(204); res.end(); };

/** 라우트 안에서 throw 하면 index.js가 받아 상태코드로 바꿔줍니다 */
export class HttpError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code || null;
  }
}
export const badRequest = (m = '요청이 올바르지 않습니다') => new HttpError(400, m, 'bad_request');
export const unauthorized = (m = '로그인이 필요합니다') => new HttpError(401, m, 'unauthorized');
export const forbidden = (m = '권한이 없습니다') => new HttpError(403, m, 'forbidden');
export const notFound = (m = '찾을 수 없습니다') => new HttpError(404, m, 'not_found');
export const tooLarge = (m = '파일이 너무 큽니다') => new HttpError(413, m, 'too_large');

/** JSON 본문 읽기 (기본 2MB 제한) */
export async function readJson(req, limit = 2 * 1024 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > limit) throw tooLarge('본문이 너무 큽니다');
    chunks.push(c);
  }
  if (!size) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw badRequest('JSON을 읽을 수 없습니다'); }
}

export function redirect(res, url) {
  res.writeHead(302, { location: url, 'cache-control': 'no-store' });
  res.end();
}
