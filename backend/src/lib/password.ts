import argon2 from "argon2";

/**
 * Password hashing with argon2id.
 * Parameters follow the OWASP baseline for argon2id.
 */
const OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

export function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, OPTIONS);
}

export async function verifyPassword(
  plain: string,
  hash: string,
): Promise<boolean> {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    // A malformed or unparsable hash is treated as a failed verification
    // rather than a server error.
    return false;
  }
}
