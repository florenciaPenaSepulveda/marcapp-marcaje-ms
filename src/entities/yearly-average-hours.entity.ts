import * as typeOrm from 'typeorm';

@typeOrm.Entity('yearly-average-hours')
export class YearlyAverageHours {
  @typeOrm.PrimaryGeneratedColumn()
  id: number;

  @typeOrm.Column()
  idUser: number;

  @typeOrm.Column()
  year: string;

  @typeOrm.Column('float')
  average_hours_worked: number;
}
