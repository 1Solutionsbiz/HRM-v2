import { Global, Module } from '@nestjs/common';
import { PasswordService } from './password.service.js';

/**
 * Global: password hashing is infrastructure every module that touches
 * `User.passwordHash` needs (Auth now; Users' admin-provisioning flow next).
 */
@Global()
@Module({
  providers: [PasswordService],
  exports: [PasswordService],
})
export class SecurityModule {}
