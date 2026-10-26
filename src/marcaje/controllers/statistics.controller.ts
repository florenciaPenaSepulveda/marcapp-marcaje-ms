import * as nestCommon from '@nestjs/common';
import { MonthlyAverageHoursService } from '../services/monthly-average.service';
import { MonthlyAverageHours } from 'src/entities/monthly-average-hours';
import { YearlyAverageHourService } from '../services/yearly-average.service';
import { YearlyAverageHours } from 'src/entities/yearly-average-hours.entity';
import { DailyHours } from 'src/entities/daily-hours';
import { DailyHoursService } from '../services/daily-hours.service';

@nestCommon.Controller('statistics')
export class StatisticsController {
  constructor(
    private readonly monthlyService: MonthlyAverageHoursService,
    private readonly yearlyService: YearlyAverageHourService,
    private readonly dailyService: DailyHoursService,
  ) {}

  @nestCommon.Get('/daily')
  async getDailyUserHours(): Promise<DailyHours[]> {
    return this.dailyService.getDailyUserHours();
  }
  @nestCommon.Get('/monthly')
  async getMonthlyUserHours(): Promise<MonthlyAverageHours[]> {
    return this.monthlyService.getMonthlyUserHours();
  }

  @nestCommon.Get('/yearly')
  async getYearlyUserHours(): Promise<YearlyAverageHours[]> {
    return this.yearlyService.getYearlyUserHours();
  }
}
