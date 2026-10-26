import { Injectable } from '@nestjs/common';
import * as shedule from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import * as moment from 'moment-timezone';
import { DailyHours } from 'src/entities/daily-hours';
import { Repository } from 'typeorm';

@Injectable()
export class DailyHoursService {
  constructor(
    @InjectRepository(DailyHours)
    private readonly dailyUserHoursRepository: Repository<DailyHours>,
  ) {}

  @shedule.Cron(shedule.CronExpression.EVERY_10_SECONDS)
  async updateDailyUserHours(): Promise<void> {
    console.log(`Daily Cron en progreso`);
    await this.dailyUserHoursRepository.query(`DELETE FROM "daily-hours"`);

    await this.dailyUserHoursRepository.query(`
    WITH dailyMarks AS (
        SELECT
            "id_user" as idUser,
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
        GROUP BY idUser, day
    )
    INSERT INTO "daily-hours" ("idUser", day, "dailyHoursWorked")
    SELECT 
        idUser,
        "day",
        extract(epoch from (exitTime - entryTime) / 3600) as dailyHoursWorked
    FROM timeMarks
    WHERE (entryTime IS NOT NULL) AND (exitTime IS NOT NULL);
    `);
  }

  async getDailyUserHours(): Promise<DailyHours[]> {
    const dailyHoursWork = await this.dailyUserHoursRepository.find({
      order: {
        idUser: 'ASC',
        day: 'ASC',
      },
    });
    return dailyHoursWork.map((dailyHoursWork) => ({
      id: dailyHoursWork.id,
      idUser: dailyHoursWork.idUser,
      day: moment(dailyHoursWork.day).format('DD-MM-YYYY'),
      dailyHoursWorked: dailyHoursWork.dailyHoursWorked,
    }));
  }
}
