import { BadRequestException } from '@nestjs/common';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { argon2id } from 'hash-wasm';

// Keep the PHC format and work factors used by the previous native addon.
const parameters = {
  memorySize: 19456,
  iterations: 2,
  parallelism: 1,
  hashLength: 32,
};
export function validatePassword(value: unknown): asserts value is string {
  if (typeof value !== 'string' || value.length < 12 || value.length > 128)
    throw new BadRequestException('Usa una contraseña de 12 a 128 caracteres.');
}
export const passwordHash = (value: string) =>
  argon2id({
    ...parameters,
    password: value,
    salt: randomBytes(16),
    outputType: 'encoded',
  });
export async function passwordMatches(hash: string, password: string) {
  try {
    // Only accept the algorithm/work factors emitted by this application.
    // Decode the salt from existing native hashes and compare raw bytes in constant time.
    const match =
      /^\$argon2id\$v=19\$m=19456,t=2,p=1\$([A-Za-z0-9+/]{22})\$([A-Za-z0-9+/]{43})$/.exec(
        hash,
      );
    if (!match) return false;
    const salt = Buffer.from(match[1], 'base64');
    const expected = Buffer.from(match[2], 'base64');
    if (
      salt.toString('base64url').replace(/-/g, '+').replace(/_/g, '/') !==
        match[1] ||
      expected.toString('base64url').replace(/-/g, '+').replace(/_/g, '/') !==
        match[2]
    )
      return false;
    const actual = await argon2id({
      ...parameters,
      password,
      salt,
      outputType: 'binary',
    });
    return timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}
