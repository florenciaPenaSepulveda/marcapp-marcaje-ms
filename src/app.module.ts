import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { MarcajeModule } from './marcaje/marcaje.module';
import { Env, validarEntorno } from './config/env';
import { opcionesBase } from './database/data-source';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validarEntorno }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        throttlers: [
          { ttl: 60000, limit: config.get('RATE_LIMIT', { infer: true }) },
        ],
        skipIf: () =>
          config.get('NODE_ENV', { infer: true }) === 'test' &&
          !process.env.PROBAR_LIMITES,
      }),
    }),
    TypeOrmModule.forRootAsync({
      useFactory: () => {
        const env = validarEntorno(process.env);
        return {
          ...opcionesBase(env.NODE_ENV === 'production'),
          host: env.DB_HOST,
          port: env.DB_PORT,
          username: env.DB_USER,
          password: env.DB_PASSWORD,
          database: env.DB_NAME,
          autoLoadEntities: true,
        };
      },
    }),
    MarcajeModule,
  ],
  controllers: [AppController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
