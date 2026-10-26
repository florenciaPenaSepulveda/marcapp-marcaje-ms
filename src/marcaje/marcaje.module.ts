import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { Marcaje } from '../entities/marcaje.entity';
import { MarcajeController } from './marcaje.controller';
import { MarcajeService } from './marcaje.service';
import { StatisticsController } from './statistics.controller';
import { StatisticsService } from './statistics.service';

@Module({
  imports: [TypeOrmModule.forFeature([Marcaje]), AuthModule],
  controllers: [MarcajeController, StatisticsController],
  providers: [MarcajeService, StatisticsService],
})
export class MarcajeModule {}
