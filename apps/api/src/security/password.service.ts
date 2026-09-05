import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from 'node:crypto';
import { promisify } from 'node:util';
import { Injectable } from '@nestjs/common';

const scrypt = promisify(scryptCallback) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number },
) => Promise<Buffer>;

// N=2^14, r=8, p=1 costs ~128*N*r = 16MiB of memory per hash, under Node's
// default 32MiB scrypt `maxmem` — raising N further requires passing `maxmem`
// explicitly. Params are encoded into the stored string so they can be
// raised later, or the scheme migrated (e.g. to argon2), without a schema
// change: `User.passwordHash` is a plain String.
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

const STORED_HASH_PATTERN =
  /^scrypt\$N=(\d+),r=(\d+),p=(\d+)\$([a-f0-9]+)\$([a-f0-9]+)$/;

// Fixed inputs used only to pay the same scrypt cost when no real user
// record exists to verify against (see `simulateVerification`).
const DUMMY_PASSWORD = 'dummy-password-for-timing-parity';
const DUMMY_SALT = Buffer.alloc(SALT_LENGTH, 0);

/**
 * Password hashing via Node's built-in `scrypt` rather than bcrypt/argon2:
 * no native module to compile, which matters on this machine (no Homebrew,
 * no Docker, no build tools available in this environment). scrypt is an
 * OWASP-listed choice for password storage.
 */
@Injectable()
export class PasswordService {
  async hash(plainPassword: string): Promise<string> {
    const salt = randomBytes(SALT_LENGTH);
    const derivedKey = await scrypt(plainPassword, salt, KEY_LENGTH, {
      N: SCRYPT_N,
      r: SCRYPT_R,
      p: SCRYPT_P,
    });
    return `scrypt$N=${SCRYPT_N},r=${SCRYPT_R},p=${SCRYPT_P}$${salt.toString('hex')}$${derivedKey.toString('hex')}`;
  }

  async verify(plainPassword: string, storedHash: string): Promise<boolean> {
    const parsed = this.parse(storedHash);
    if (!parsed) return false;
    const derivedKey = await scrypt(
      plainPassword,
      Buffer.from(parsed.salt, 'hex'),
      parsed.keyLength,
      {
        N: parsed.N,
        r: parsed.r,
        p: parsed.p,
      },
    );
    const stored = Buffer.from(parsed.hash, 'hex');
    if (derivedKey.length !== stored.length) return false;
    return timingSafeEqual(derivedKey, stored);
  }

  /**
   * Pays the same scrypt cost as a real `verify` call without a stored hash
   * to check against. Call this on the unknown-email and inactive-account
   * login paths so response timing doesn't reveal account existence.
   */
  async simulateVerification(): Promise<void> {
    await scrypt(DUMMY_PASSWORD, DUMMY_SALT, KEY_LENGTH, {
      N: SCRYPT_N,
      r: SCRYPT_R,
      p: SCRYPT_P,
    });
  }

  private parse(
    stored: string,
  ): {
    N: number;
    r: number;
    p: number;
    salt: string;
    hash: string;
    keyLength: number;
  } | null {
    const match = STORED_HASH_PATTERN.exec(stored);
    if (!match) return null;
    const [, n, r, p, salt, hash] = match as unknown as [
      string,
      string,
      string,
      string,
      string,
      string,
    ];
    return {
      N: Number(n),
      r: Number(r),
      p: Number(p),
      salt,
      hash,
      keyLength: hash.length / 2,
    };
  }
}
