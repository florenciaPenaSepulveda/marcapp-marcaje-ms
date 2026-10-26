import 'dotenv/config';
import { DataSource } from 'typeorm';
import { Marcaje } from '../entities/marcaje.entity';

export const opcionesBase = (produccion: boolean) => ({
  type: 'postgres' as const,
  entities: [Marcaje],
  migrations: [`${__dirname}/migrations/*.{ts,js}`],
  synchronize: !produccion,
  migrationsRun: produccion,
});

export default new DataSource({
  ...opcionesBase(false),
  synchronize: false,
  host: process.env.DB_HOST ?? '127.0.0.1',
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USER ?? 'postgres',
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_NAME ?? 'marcajeDB',
});
