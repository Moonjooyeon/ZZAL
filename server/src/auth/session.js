// auth/session.js — 서명된 httpOnly 쿠키 + DB에 저장한 토큰 해시.
import crypto from 'node:crypto';
import { config } from '../config.js';

const COOKIE = 'zzal_session';
const MAX_AGE = 60 * 60 * 24 * 30;   // 30일

const b64 = buf => Buffer.from(buf).toString('base64url');
const hash = token => crypto.createHash('sha256').update(token).digest('hex');
const sign = payload =>
  crypto.createHmac('sha256', config.sessionSecret).update(payload).digest('base64url');

export function makeToken(userId) {
  const payload = b64(JSON.stringify({ uid: userId, exp: Date.now() + MAX_AGE * 1000,
    jti: crypto.randomBytes(16).toString('hex') }));
  return `${payload}.${sign(payload)}`;
}

export function readToken(token) {
  if (!token || !token.includes('.')) return null;
  const [payload, mac] = token.split('.');
  const expected = sign(payload);
  // 길이가 다르면 timingSafeEqual이 던지므로 먼저 확인합니다
  if (mac.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!data.exp || data.exp < Date.now()) return null;
    return data.uid;
  } catch { return null; }
}

const parseCookies = header => Object.fromEntries(
  (header || '').split(';').map(p => p.trim()).filter(Boolean)
    .map(p => { const i = p.indexOf('='); return [p.slice(0, i), decodeURIComponent(p.slice(i + 1))]; }));

export async function setSession(res, db, userId) {
  const token = makeToken(userId);
  await db.sessions.create(hash(token), userId, new Date(Date.now() + MAX_AGE * 1000));
  const bits = [
    `${COOKIE}=${token}`,
    'Path=/', 'HttpOnly', 'SameSite=Lax', `Max-Age=${MAX_AGE}`,
  ];
  if (config.cookieSecure) bits.push('Secure');
  const existing = res.getHeader?.('set-cookie');
  res.setHeader('set-cookie', existing ? [...(Array.isArray(existing) ? existing : [existing]), bits.join('; ')] : bits.join('; '));
}

export async function clearSession(req, res, db) {
  const token = parseCookies(req.headers.cookie)[COOKIE];
  if (token) await db.sessions.remove(hash(token));
  res.setHeader('set-cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

/** 요청에서 로그인한 사용자를 꺼냅니다. 없으면 null. */
export async function currentUser(req, db) {
  const token = parseCookies(req.headers.cookie)[COOKIE];
  const uid = readToken(token);
  if (uid == null) return null;
  const sessionUserId = await db.sessions.userId(hash(token));
  if (sessionUserId == null || Number(sessionUserId) !== Number(uid)) return null;
  return db.users.byId(uid);
}
