import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('monthly-average-hours')
export class MonthlyAverageHours {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  idUser: number;

  @Column()
  month: string;

  @Column('float')
  average_hours_worked: number;
}
