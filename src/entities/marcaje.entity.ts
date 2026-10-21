import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { MarcajeType } from '../enum/marcaje-type.enum';

@Entity({ name: 'marcajes' })
export class Marcaje {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  id_user: number;

  @CreateDateColumn({
    type: 'timestamp with time zone',
    default: () => 'CURRENT_TIMESTAMP',
  })
  date: Date;

  @Column({
    type: 'enum',
    enum: MarcajeType,
    default: MarcajeType.ENTRY,
  })
  type: MarcajeType;

  @Column({ default: false })
  adminFlag: boolean;

  @Column({ nullable: true })
  latCoordinate: string;

  @Column({ nullable: true })
  longCoordinate: string;
}
