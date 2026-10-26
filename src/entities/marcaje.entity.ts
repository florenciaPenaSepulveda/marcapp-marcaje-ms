import * as typeOrm from 'typeorm';
import { MarcajeType } from '../enum/marcaje-type.enum';

@typeOrm.Entity({ name: 'marcajes' })
@typeOrm.Index(['id_user', 'date'])
export class Marcaje {
  @typeOrm.PrimaryGeneratedColumn()
  id: number;

  @typeOrm.Column()
  id_user: number;

  @typeOrm.Column({ type: 'timestamptz', default: () => 'now()' })
  date: Date;

  @typeOrm.Column({
    type: 'enum',
    enum: MarcajeType,
    default: MarcajeType.ENTRY,
  })
  type: MarcajeType;

  @typeOrm.Column({ default: false })
  adminFlag: boolean;

  @typeOrm.Column({ type: 'varchar', length: 32, nullable: true })
  latCoordinate: string | null;

  @typeOrm.Column({ type: 'varchar', length: 32, nullable: true })
  longCoordinate: string | null;
}
