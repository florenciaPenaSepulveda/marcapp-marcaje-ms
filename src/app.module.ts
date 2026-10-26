import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MarcajeModule } from './marcaje/modules/marcaje.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Marcaje } from './entities/marcaje.entity';
import { ConfigModule } from '@nestjs/config';
import { MonthlyAverageHours } from './entities/monthly-average-hours';
import { ScheduleModule } from '@nestjs/schedule';
import { YearlyAverageHours } from './entities/yearly-average-hours.entity';
import { DailyHours } from './entities/daily-hours';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: '127.0.0.1',
      port: 5432,
      username: 'postgres',
      password: 'jmcr0612',
      database: 'postgres',
      entities: [Marcaje, DailyHours, MonthlyAverageHours, YearlyAverageHours],
      synchronize: true,
    }),
    ConfigModule.forRoot(),
    MarcajeModule,
    ScheduleModule.forRoot(),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
