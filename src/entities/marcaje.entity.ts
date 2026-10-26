import * as typeOrm from 'typeorm';
import { MarcajeType } from '../enum/marcaje-type.enum';

@typeOrm.Entity({ name: 'marcajes' })
export class Marcaje {
  @typeOrm.PrimaryGeneratedColumn()
  id: number;

  @typeOrm.Column()
  id_user: number;

  @typeOrm.CreateDateColumn({
    type: 'timestamp with time zone',
    default: () => 'CURRENT_TIMESTAMP',
  })
  date: Date;

  @typeOrm.Column({
    type: 'enum',
    enum: MarcajeType,
    default: MarcajeType.ENTRY,
  })
  type: MarcajeType;

  @typeOrm.Column({ default: false })
  adminFlag: boolean;

  @typeOrm.Column({ nullable: true })
  latCoordinate: string;

  @typeOrm.Column({ nullable: true })
  longCoordinate: string;
}
