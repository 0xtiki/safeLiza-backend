import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller.js';
import { WebAuthnStrategy } from './webauthn.strategy.js';
import { ConfigModule } from '@nestjs/config';
import { UserModule } from '../user/user.module.js';
import { PasskeyService } from './passkey.service.js';
import { SessionGuard } from './session.guard.js';

@Module({
  imports: [PassportModule, ConfigModule, UserModule],
  controllers: [AuthController],
  providers: [WebAuthnStrategy, PasskeyService, SessionGuard],
  exports: [WebAuthnStrategy, SessionGuard],
})
export class AuthModule {}
