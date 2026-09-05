import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96-bit, the size GCM is designed for
const STORED_VALUE_PATTERN = /^v1\$([a-f0-9]+)\$([a-f0-9]+)\$([a-f0-9]+)$/;

/**
 * Reversible encryption for at-rest PII (`EmployeeBankDetail.*Encrypted`) —
 * a distinct service from `PasswordService` because this one, unlike
 * hashing, must be decryptable. AES-256-GCM: a fresh random IV per call
 * (a reused IV under GCM is a full key/plaintext compromise, not just a
 * weakness) and the auth tag is stored and verified on decrypt, so a
 * tampered or wrong-key ciphertext throws instead of silently returning
 * garbage. The `v1$` prefix mirrors `PasswordService`'s stored-hash format:
 * it's what lets the algorithm or key change later without a schema change.
 */
@Injectable()
export class EncryptionService {
  private readonly key: Buffer;

  constructor(configService: ConfigService) {
    this.key = Buffer.from(
      configService.getOrThrow<string>('ENCRYPTION_KEY'),
      'hex',
    );
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    const ciphertext = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();
    return `v1$${iv.toString('hex')}$${authTag.toString('hex')}$${ciphertext.toString('hex')}`;
  }

  decrypt(stored: string): string {
    const match = STORED_VALUE_PATTERN.exec(stored);
    if (!match) {
      throw new Error('Malformed encrypted value');
    }
    const [, ivHex, authTagHex, ciphertextHex] = match as unknown as [
      string,
      string,
      string,
      string,
    ];
    const decipher = createDecipheriv(
      ALGORITHM,
      this.key,
      Buffer.from(ivHex, 'hex'),
    );
    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
    // Throws on a tampered ciphertext or wrong key (auth tag mismatch) —
    // deliberately not caught here. A security event should surface as an
    // error, not a blank field.
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(ciphertextHex, 'hex')),
      decipher.final(),
    ]);
    return plaintext.toString('utf8');
  }
}
