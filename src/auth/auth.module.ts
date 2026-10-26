import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { validarEntorno } from '../config/env';
import { AuthGuard } from './auth.guard';
import { RolesGuard } from './roles';

@Module({
  imports: [
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: validarEntorno(process.env).JWT_SECRET,
        verifyOptions: { algorithms: ['HS256'] },
      }),
    }),
  ],
  providers: [AuthGuard, RolesGuard],
  exports: [JwtModule, AuthGuard, RolesGuard],
})
export class AuthModule {}
