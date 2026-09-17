import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import { config } from '../src/config.js';
import { authorizeUrl, exchange, isConfigured } from '../src/auth/providers.js';

test('Apple code exchange signs its client secret and verifies the identity token', async () => {
  const previous = { ...config.auth.apple };
  const originalFetch = globalThis.fetch;
  const signing = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const apple = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const publicJwk = apple.publicKey.export({ format: 'jwk' });
  const jwt = (payload) => {
    const text = [{ alg: 'RS256', kid: 'test-key' }, payload]
      .map(value => Buffer.from(JSON.stringify(value)).toString('base64url')).join('.');
    return `${text}.${crypto.sign('RSA-SHA256', Buffer.from(text), apple.privateKey).toString('base64url')}`;
  };
  const claims = { iss: 'https://appleid.apple.com', aud: 'com.example.zzal', sub: 'apple-user-1',
    iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 600,
    email: 'private@example.com' };
  let identity = jwt(claims);
  try {
    Object.assign(config.auth.apple, { id: 'com.example.zzal', teamId: 'TEAM123456', keyId: 'KEY123456', privateKeyPem: '',
      privateKeyPath: '/missing/apple-signin.p8',
      privateKeyBase64: Buffer.from(signing.privateKey.export({ type: 'pkcs8', format: 'pem' })).toString('base64') });
    assert.equal(isConfigured('apple'), true);
    const authorization = new URL(authorizeUrl('apple', 'state-value'));
    assert.equal(authorization.searchParams.get('response_mode'), 'form_post');
    assert.equal(authorization.searchParams.get('state'), 'state-value');
    globalThis.fetch = async (url, options) => {
      if (url.endsWith('/auth/token')) {
        const secret = options.body.get('client_secret');
        const [header, body, signature] = secret.split('.');
        assert.equal(JSON.parse(Buffer.from(body, 'base64url')).sub, 'com.example.zzal');
        assert.equal(crypto.verify('sha256', Buffer.from(`${header}.${body}`),
          { key: signing.publicKey, dsaEncoding: 'ieee-p1363' }, Buffer.from(signature, 'base64url')), true);
        return new Response(JSON.stringify({ id_token: identity }), { status: 200 });
      }
      assert.equal(url, 'https://appleid.apple.com/auth/keys');
      return new Response(JSON.stringify({ keys: [{ ...publicJwk, kid: 'test-key', alg: 'RS256', use: 'sig' }] }), { status: 200 });
    };
    const user = await exchange('apple', 'code-value', { name: { firstName: 'Kim', lastName: 'J' } });
    assert.deepEqual(user, { provider: 'apple', providerId: 'apple-user-1', name: 'Kim J',
      email: 'private@example.com', avatarUrl: null });
    config.auth.apple.privateKeyPem = signing.privateKey.export({ type: 'pkcs8', format: 'pem' }).replace(/\n/g, '\\n');
    assert.equal((await exchange('apple', 'code-value', null)).providerId, 'apple-user-1');
    identity = jwt({ ...claims, aud: 'another-service' });
    await assert.rejects(exchange('apple', 'code-value', null), /Apple 인증 정보가 올바르지 않습니다/);
  } finally {
    Object.assign(config.auth.apple, previous);
    globalThis.fetch = originalFetch;
  }
});
