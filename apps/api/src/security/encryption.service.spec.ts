import { describe, expect, it } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { EncryptionService } from './encryption.service.js';

// 32 raw bytes, hex-encoded — a fixed test key, never used outside this spec.
const TEST_KEY = 'a'.repeat(64);

function buildService(key = TEST_KEY): EncryptionService {
  const configService = { getOrThrow: () => key } as unknown as ConfigService;
  return new EncryptionService(configService);
}

describe('EncryptionService', () => {
  it('decrypts to the original plaintext', () => {
    const service = buildService();
    const stored = service.encrypt('1234567890123456');
    expect(service.decrypt(stored)).toBe('1234567890123456');
  });

  it('produces a different ciphertext each time (random IV)', () => {
    const service = buildService();
    const a = service.encrypt('same-value');
    const b = service.encrypt('same-value');
    expect(a).not.toBe(b);
  });

  it('encodes a recognizable versioned format', () => {
    const service = buildService();
    const stored = service.encrypt('value');
    expect(stored).toMatch(/^v1\$[a-f0-9]+\$[a-f0-9]+\$[a-f0-9]+$/);
  });

  it('fails to decrypt with the wrong key', () => {
    const stored = buildService(TEST_KEY).encrypt('secret');
    const otherKeyService = buildService('b'.repeat(64));
    expect(() => otherKeyService.decrypt(stored)).toThrow();
  });

  it('rejects tampered ciphertext instead of returning garbage (proves the auth tag is checked)', () => {
    const service = buildService();
    const stored = service.encrypt('secret-value');
    const [prefix, iv, tag, ciphertext] = stored.split('$');
    const hexDigits = '0123456789abcdef';
    // Flip the ciphertext's first hex digit to a different-but-valid one.
    const flipped = hexDigits[(hexDigits.indexOf(ciphertext[0]) + 1) % 16];
    const tampered = `${prefix}$${iv}$${tag}$${flipped}${ciphertext.slice(1)}`;

    expect(() => service.decrypt(tampered)).toThrow();
  });

  it('rejects a malformed stored value', () => {
    const service = buildService();
    expect(() => service.decrypt('not-a-real-value')).toThrow();
  });
});
