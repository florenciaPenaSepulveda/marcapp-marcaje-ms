import { Injectable } from '@nestjs/common';
import * as shedule from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { YearlyAverageHours } from 'src/entities/yearly-average-hours.entity';
import { Repository } from 'typeorm';

@Injectable()
export class YearlyAverageHourService {
  constructor(
    @InjectRepository(YearlyAverageHours)
    private readonly yearlyUserHoursRepository: Repository<YearlyAverageHours>,
  ) {}

  @shedule.Cron(shedule.CronExpression.EVERY_10_SECONDS)
  async updateMonthlyUserHours(): Promise<void> {
    console.log(`Yearly Cron en progreso `);
    await this.yearlyUserHoursRepository.query(
      `DELETE FROM "yearly-average-hours"`,
    );

    await this.yearlyUserHoursRepository.query(`
    WITH dailyMarks AS (
        SELECT
            id_user AS idUser,
            "type",
            "date"::date AS "day",
            "date"
        FROM marcajes
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
    yearMarks AS (
        SELECT 
            idUser AS "user",
            "day",
            entryTime,
            exitTime,
            EXTRACT(epoch FROM (exitTime - entryTime))/3600 AS hoursWorked
        FROM timeMarks
        WHERE entryTime IS NOT NULL AND exitTime IS NOT NULL
    )
    INSERT INTO "yearly-average-hours" ("idUser", year, average_hours_worked)

    SELECT 
        "user",
        TO_CHAR(DATE_TRUNC('year', "day"), 'YYYY') AS "year",
        AVG(hoursWorked) AS average
    FROM yearMarks
    GROUP BY TO_CHAR(DATE_TRUNC('year', "day"), 'YYYY'), "user";
    `);
  }

  async getYearlyUserHours(): Promise<YearlyAverageHours[]> {
    return await this.yearlyUserHoursRepository.find({
      order: {
        idUser: 'ASC',
        year: 'ASC',
      },
    });
  }
}
