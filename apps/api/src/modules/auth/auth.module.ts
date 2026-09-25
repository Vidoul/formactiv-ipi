import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JetonsService } from './jetons.service';
import { MfaService } from './mfa.service';
import { MotDePasseService } from './mot-de-passe.service';

/** Module E1 — Comptes et authentification (US-03, US-04, US-05). */
@Module({
  // Les secrets sont fournis à chaque appel (access et MFA utilisent des secrets distincts).
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [AuthService, JetonsService, MfaService, MotDePasseService],
  exports: [AuthService, JetonsService, MotDePasseService],
})
export class AuthModule {}
