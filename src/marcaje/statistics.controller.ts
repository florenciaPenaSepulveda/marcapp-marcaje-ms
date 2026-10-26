import { Controller, Get, Query, Request, UseGuards } from '@nestjs/common';
import { StatisticsService } from './statistics.service';
import { AuthGuard, Sesion } from '../auth/auth.guard';
import { esAdmin } from '../auth/roles';
import {
  StatisticsQueryDto,
  SummaryQueryDto,
} from '../dto/statistics-query.dto';

const alcance = (sesion: Sesion, userId?: number): number | null =>
  esAdmin(sesion) ? userId ?? null : sesion.id;

@UseGuards(AuthGuard)
@Controller('statistics')
export class StatisticsController {
  constructor(private readonly statistics: StatisticsService) {}

  @Get('/daily')
  getDailyUserHours(
    @Request() req: { user: Sesion },
    @Query() { userId }: StatisticsQueryDto,
  ) {
    return this.statistics.diarias(alcance(req.user, userId));
  }

  @Get('/monthly')
  getMonthlyUserHours(
    @Request() req: { user: Sesion },
    @Query() { userId }: StatisticsQueryDto,
  ) {
    return this.statistics.mensuales(alcance(req.user, userId));
  }

  @Get('/yearly')
  getYearlyUserHours(
    @Request() req: { user: Sesion },
    @Query() { userId }: StatisticsQueryDto,
  ) {
    return this.statistics.anuales(alcance(req.user, userId));
  }

  @Get('/summary')
  getSummary(
    @Request() req: { user: Sesion },
    @Query() { userId, from, to }: SummaryQueryDto,
  ) {
    return this.statistics.resumenDelPeriodo(
      alcance(req.user, userId),
      from,
      to,
    );
  }
}
