import * as typeoOrm from 'typeorm';

@typeoOrm.Entity('daily-hours')
export class DailyHours {
  @typeoOrm.PrimaryGeneratedColumn()
  id: number;

  @typeoOrm.Column()
  idUser: number;

  @typeoOrm.Column()
  day: string;

  @typeoOrm.Column('float')
  dailyHoursWorked: number;
}
