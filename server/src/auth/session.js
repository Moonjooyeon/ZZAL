// auth/session.js — 서명된 httpOnly 쿠키 세션. 토큰 본문은 사용자 id 뿐입니다.
import crypto from 'node:crypto';
import { config } from '../config.js';

const COOKIE = 'zzal_session';
const MAX_AGE = 60 * 60 * 24 * 30;   // 30일

const b64 = buf => Buffer.from(buf).toString('base64url');
const sign = payload =>
  crypto.createHmac('sha256', config.sessionSecret).update(payload).digest('base64url');

export function makeToken(userId) {
  const payload = b64(JSON.stringify({ uid: userId, exp: Date.now() + MAX_AGE * 1000 }));
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

export function setSession(res, userId) {
  const bits = [
    `${COOKIE}=${makeToken(userId)}`,
    'Path=/', 'HttpOnly', 'SameSite=Lax', `Max-Age=${MAX_AGE}`,
  ];
  if (config.cookieSecure) bits.push('Secure');
  res.setHeader('set-cookie', bits.join('; '));
}

export function clearSession(res) {
  res.setHeader('set-cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

/** 요청에서 로그인한 사용자를 꺼냅니다. 없으면 null. */
export async function currentUser(req, db) {
  const uid = readToken(parseCookies(req.headers.cookie)[COOKIE]);
  if (uid == null) return null;
  return db.users.byId(uid);
}
