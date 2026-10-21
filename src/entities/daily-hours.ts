import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('daily-hours')
export class DailyHours {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  idUser: number;

  @Column()
  day: string;

  @Column('float')
  dailyHoursWorked: number;
}