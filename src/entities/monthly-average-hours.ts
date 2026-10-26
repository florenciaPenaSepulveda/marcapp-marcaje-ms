import * as typeOrm from 'typeorm';

@typeOrm.Entity('monthly-average-hours')
export class MonthlyAverageHours {
  @typeOrm.PrimaryGeneratedColumn()
  id: number;

  @typeOrm.Column()
  idUser: number;

  @typeOrm.Column()
  month: string;

  @typeOrm.Column('float')
  average_hours_worked: number;
}
