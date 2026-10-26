import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MonthlyAverageHours } from 'src/entities/monthly-average-hours';
import * as shedule from '@nestjs/schedule';
import * as moment from 'moment';

@Injectable()
export class MonthlyAverageHoursService {
  constructor(
    @InjectRepository(MonthlyAverageHours)
    private readonly monthlyUserHoursRepository: Repository<MonthlyAverageHours>,
  ) {}

  @shedule.Cron(shedule.CronExpression.EVERY_10_SECONDS)
  async updateMonthlyUserHours(): Promise<void> {
    console.log(`MonthlyCron en progreso `);
    await this.monthlyUserHoursRepository.query(
      `DELETE FROM "monthly-average-hours"`,
    );

    await this.monthlyUserHoursRepository.query(`
    WITH dailyMarks AS (
      SELECT
          id_user AS idUser,
          "type",
          "date"::date AS "day",
          "date"
      FROM marcajes
      WHERE EXTRACT(DOW FROM "date") BETWEEN 1 AND 5
  ),
  timeMarks AS (
      SELECT
          idUser,
          "day",
          MAX(CASE WHEN "type" = 'entry' THEN "date" END) AS entryTime,
          MAX(CASE WHEN "type" = 'exit' THEN "date" END) AS exitTime
      FROM dailyMarks
      GROUP BY idUser, "day"
  ),
  monthMarks AS (
      SELECT 
          idUser AS "user",
          "day",
          entryTime,
          exitTime,
          EXTRACT(epoch FROM (exitTime - entryTime))/3600 AS hoursWorked
      FROM timeMarks
      WHERE entryTime IS NOT NULL AND exitTime IS NOT NULL
  )
  INSERT INTO "monthly-average-hours" ("idUser", month, average_hours_worked)
  SELECT 
      "user",
      TO_CHAR(DATE_TRUNC('month', "day"), 'YYYY-MM') AS "month",
      AVG(hoursWorked) AS average
  FROM monthMarks
  GROUP BY TO_CHAR(DATE_TRUNC('month', "day"), 'YYYY-MM'), "user";
  
  
    `);
  }

  async getMonthlyUserHours(): Promise<MonthlyAverageHours[]> {
    const monthlyHoursWork = await this.monthlyUserHoursRepository.find({
      order: {
        idUser: 'ASC',
        month: 'ASC',
      },
    });
    return monthlyHoursWork.map((monthlyHoursWork) => ({
      id: monthlyHoursWork.id,
      idUser: monthlyHoursWork.idUser,
      month: moment(monthlyHoursWork.month).format('MM-YYYY'),
      average_hours_worked: monthlyHoursWork.average_hours_worked,
    }));
  }
}
