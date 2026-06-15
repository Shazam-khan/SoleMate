import bcrypt from "bcryptjs";

/**
 * Password hashing helpers.
 *
 * Uses bcryptjs (pure-JS, so it builds cleanly in Alpine/Docker with no native
 * toolchain). Passwords are NEVER stored or compared in plaintext.
 */

const SALT_ROUNDS = 10;

export const hashPassword = (plain) => bcrypt.hash(plain, SALT_ROUNDS);

export const verifyPassword = (plain, hash) => bcrypt.compare(plain, hash);

/** True if a stored value looks like a bcrypt hash (vs. legacy plaintext). */
export const isHashed = (value) =>
  typeof value === "string" && /^\$2[aby]\$/.test(value);
