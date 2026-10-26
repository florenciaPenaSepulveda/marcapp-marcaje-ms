import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { validarEntorno } from '../config/env';
import { AuthGuard } from './auth.guard';
import { RolesGuard } from './roles';
import { SessionService } from './session.service';

@Module({
  imports: [
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: validarEntorno(process.env).JWT_SECRET,
        verifyOptions: { algorithms: ['HS256'] },
      }),
    }),
  ],
  providers: [AuthGuard, RolesGuard, SessionService],
  exports: [JwtModule, AuthGuard, RolesGuard, SessionService],
})
export class AuthModule {}
