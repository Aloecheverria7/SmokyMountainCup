import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCsrf, validCsrf } from '../apps/api/src/security';
const secret = 'a'.repeat(64),
  now = 10000000;
test('CSRF requires a matching signed cookie and expires after one hour', () => {
  const token = createCsrf(secret, now);
  assert.equal(validCsrf(secret, token, token, now), true);
  assert.equal(validCsrf(secret, token, undefined, now), false);
  assert.equal(validCsrf(secret, token, token + 'a', now), false);
  assert.equal(validCsrf('wrong', token, token, now), false);
  assert.equal(validCsrf(secret, token, token, now + 3600001), false);
  assert.equal(validCsrf(secret, token, token, now - 1), false);
});
test('untrusted malformed CSRF values are rejected without throwing', () => {
  for (const value of [
    null,
    {},
    [],
    12,
    '',
    '..',
    'é'.repeat(150),
    '1.abc.xyz',
  ])
    assert.equal(validCsrf(secret, value, value, now), false);
});
