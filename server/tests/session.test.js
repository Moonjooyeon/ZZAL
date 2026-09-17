import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createJsonDb } from '../src/db/json.js';
import { setSession, clearSession, currentUser } from '../src/auth/session.js';

const response = () => ({ headers: {}, setHeader(name, value) { this.headers[name] = value; } });

test('session exists in DB, is unique per login, and logout revokes only its cookie', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'zzal-session-'));
  try {
    const db = createJsonDb(path.join(dir, 'db.json'));
    const user = await db.users.findOrCreate({ provider: 'google', providerId: 'test', name: 'Test' });
    const first = response();
    const second = response();
    await setSession(first, db, user.id);
    await setSession(second, db, user.id);
    const cookie1 = first.headers['set-cookie'].split(';')[0];
    const cookie2 = second.headers['set-cookie'].split(';')[0];
    assert.notEqual(cookie1, cookie2);
    assert.equal((await currentUser({ headers: { cookie: cookie1 } }, db))?.id, user.id);
    assert.equal((await currentUser({ headers: { cookie: cookie2 } }, db))?.id, user.id);
    await clearSession({ headers: { cookie: cookie1 } }, response(), db);
    assert.equal(await currentUser({ headers: { cookie: cookie1 } }, db), null);
    assert.equal((await currentUser({ headers: { cookie: cookie2 } }, db))?.id, user.id);
  } finally {
    await new Promise(resolve => setTimeout(resolve, 450));
    rmSync(dir, { recursive: true, force: true });
  }
});
