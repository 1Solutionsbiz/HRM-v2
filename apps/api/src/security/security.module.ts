import { Global, Module } from '@nestjs/common';
import { PasswordService } from './password.service.js';
import { EncryptionService } from './encryption.service.js';

/**
 * Global: password hashing and at-rest encryption are infrastructure every
 * module that touches `User.passwordHash` or an `*Encrypted` field needs.
 */
@Global()
@Module({
  providers: [PasswordService, EncryptionService],
  exports: [PasswordService, EncryptionService],
})
export class SecurityModule {}
