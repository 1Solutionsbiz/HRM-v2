import { describe, expect, it } from 'vitest';
import { PasswordService } from './password.service.js';

describe('PasswordService', () => {
  const service = new PasswordService();

  it('verifies a password against its own hash', async () => {
    const hash = await service.hash('correct horse battery staple');
    await expect(
      service.verify('correct horse battery staple', hash),
    ).resolves.toBe(true);
  });

  it('rejects the wrong password', async () => {
    const hash = await service.hash('correct horse battery staple');
    await expect(service.verify('wrong password', hash)).resolves.toBe(false);
  });

  it('produces a different hash each time (random salt)', async () => {
    const [a, b] = await Promise.all([
      service.hash('same-password'),
      service.hash('same-password'),
    ]);
    expect(a).not.toBe(b);
  });

  it('encodes recoverable scrypt parameters in the stored string', async () => {
    const hash = await service.hash('same-password');
    expect(hash).toMatch(/^scrypt\$N=16384,r=8,p=1\$[a-f0-9]+\$[a-f0-9]+$/);
  });

  it('rejects a malformed stored hash instead of throwing', async () => {
    await expect(service.verify('anything', 'not-a-real-hash')).resolves.toBe(
      false,
    );
  });

  it('simulateVerification resolves without a stored hash', async () => {
    await expect(service.simulateVerification()).resolves.toBeUndefined();
  });
});
