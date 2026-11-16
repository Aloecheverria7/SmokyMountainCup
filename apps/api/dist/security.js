"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCsrf = createCsrf;
exports.validCsrf = validCsrf;
const node_crypto_1 = require("node:crypto");
function createCsrf(secret, now = Date.now()) {
    const value = `${now}.${(0, node_crypto_1.randomBytes)(32).toString('hex')}`;
    return `${value}.${(0, node_crypto_1.createHmac)('sha256', secret).update(value).digest('hex')}`;
}
function validCsrf(secret, token, cookie, now = Date.now()) {
    if (typeof token !== 'string' ||
        typeof cookie !== 'string' ||
        token.length > 200 ||
        cookie.length !== token.length)
        return false;
    const left = Buffer.from(token), right = Buffer.from(cookie);
    if (left.length !== right.length || !(0, node_crypto_1.timingSafeEqual)(left, right))
        return false;
    const [date, nonce, signature, ...rest] = token.split('.');
    if (rest.length ||
        !/^\d+$/.test(date) ||
        !/^[a-f0-9]{64}$/.test(nonce ?? '') ||
        !/^[a-f0-9]{64}$/.test(signature ?? ''))
        return false;
    const age = now - Number(date);
    if (age < 0 || age > 3600000)
        return false;
    const expected = (0, node_crypto_1.createHmac)('sha256', secret)
        .update(`${date}.${nonce}`)
        .digest('hex');
    return (0, node_crypto_1.timingSafeEqual)(Buffer.from(signature), Buffer.from(expected));
}
