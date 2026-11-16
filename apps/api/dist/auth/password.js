"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.passwordHash = void 0;
exports.validatePassword = validatePassword;
exports.passwordMatches = passwordMatches;
const common_1 = require("@nestjs/common");
const node_crypto_1 = require("node:crypto");
const hash_wasm_1 = require("hash-wasm");
// Keep the PHC format and work factors used by the previous native addon.
const parameters = {
    memorySize: 19456,
    iterations: 2,
    parallelism: 1,
    hashLength: 32,
};
function validatePassword(value) {
    if (typeof value !== 'string' || value.length < 12 || value.length > 128)
        throw new common_1.BadRequestException('Usa una contraseña de 12 a 128 caracteres.');
}
const passwordHash = (value) => (0, hash_wasm_1.argon2id)({
    ...parameters,
    password: value,
    salt: (0, node_crypto_1.randomBytes)(16),
    outputType: 'encoded',
});
exports.passwordHash = passwordHash;
async function passwordMatches(hash, password) {
    try {
        // Only accept the algorithm/work factors emitted by this application.
        // Decode the salt from existing native hashes and compare raw bytes in constant time.
        const match = /^\$argon2id\$v=19\$m=19456,t=2,p=1\$([A-Za-z0-9+/]{22})\$([A-Za-z0-9+/]{43})$/.exec(hash);
        if (!match)
            return false;
        const salt = Buffer.from(match[1], 'base64');
        const expected = Buffer.from(match[2], 'base64');
        if (salt.toString('base64url').replace(/-/g, '+').replace(/_/g, '/') !==
            match[1] ||
            expected.toString('base64url').replace(/-/g, '+').replace(/_/g, '/') !==
                match[2])
            return false;
        const actual = await (0, hash_wasm_1.argon2id)({
            ...parameters,
            password,
            salt,
            outputType: 'binary',
        });
        return (0, node_crypto_1.timingSafeEqual)(expected, actual);
    }
    catch {
        return false;
    }
}
