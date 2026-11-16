import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
export function createCsrf(secret: string, now = Date.now()) {
  const value = `${now}.${randomBytes(32).toString('hex')}`;
  return `${value}.${createHmac('sha256', secret).update(value).digest('hex')}`;
}
export function validCsrf(
  secret: string,
  token: unknown,
  cookie: unknown,
  now = Date.now(),
) {
  if (
    typeof token !== 'string' ||
    typeof cookie !== 'string' ||
    token.length > 200 ||
    cookie.length !== token.length
  )
    return false;
  const left = Buffer.from(token),
    right = Buffer.from(cookie);
  if (left.length !== right.length || !timingSafeEqual(left, right))
    return false;
  const [date, nonce, signature, ...rest] = token.split('.');
  if (
    rest.length ||
    !/^\d+$/.test(date) ||
    !/^[a-f0-9]{64}$/.test(nonce ?? '') ||
    !/^[a-f0-9]{64}$/.test(signature ?? '')
  )
    return false;
  const age = now - Number(date);
  if (age < 0 || age > 3600000) return false;
  const expected = createHmac('sha256', secret)
    .update(`${date}.${nonce}`)
    .digest('hex');
  return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}
