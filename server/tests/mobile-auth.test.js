import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import test from 'node:test';
import { createJsonDb } from '../src/db/json.js';
import { createRouter } from '../src/http/router.js';
import { authRoutes } from '../src/routes/auth.js';
import { json, HttpError } from '../src/http/respond.js';

test('iOS ticket creates a web session and cannot be reused', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'zzal-mobile-auth-'));
  const db = createJsonDb(path.join(dir, 'db.json'));
  const user = await db.users.findOrCreate({ provider: 'google', providerId: 'ios-test', name: 'iOS Test' });
  const ticket = crypto.randomBytes(32).toString('base64url');
  await db.sessions.create(crypto.createHash('sha256').update(ticket).digest('hex'),
    user.id, new Date(Date.now() + 120000));

  const router = createRouter();
  authRoutes(router);
  const request = async (method, url, body, cookie = '') => {
    const req = Readable.from(body ? [Buffer.from(JSON.stringify(body))] : []);
    Object.assign(req, { method, url, headers: { cookie,
      'content-type': body ? 'application/json' : undefined } });
    const res = {
      headers: {}, status: 200, body: '',
      setHeader(name, value) { this.headers[name] = value; },
      getHeader(name) { return this.headers[name]; },
      writeHead(status, headers = {}) { this.status = status; Object.assign(this.headers, headers); },
      end(value = '') { this.body = value; },
    };
    try { if (!await router.handle(req, res, { db })) json(res, 404, {}); }
    catch (error) {
      if (error instanceof HttpError) json(res, error.status, { error: error.code });
      else json(res, 500, { error: 'internal' });
    }
    return res;
  };
  try {
    const consume = () => request('POST', '/api/auth/mobile/consume', { ticket });
    const first = await consume();
    assert.equal(first.status, 200);
    assert.equal(JSON.parse(first.body).user.id, user.id);
    const cookie = first.headers['set-cookie'].split(';')[0];
    const me = await request('GET', '/api/auth/me', null, cookie);
    assert.equal(JSON.parse(me.body).user.id, user.id);
    assert.equal((await consume()).status, 400);
  } finally {
    await new Promise(resolve => setTimeout(resolve, 450));
    rmSync(dir, { recursive: true, force: true });
  }
});
