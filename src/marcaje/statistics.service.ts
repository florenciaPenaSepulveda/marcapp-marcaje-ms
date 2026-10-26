import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { Env } from '../config/env';

const JORNADAS = `
  WITH marcas AS (
    SELECT id_user, type, (date AT TIME ZONE $1) AS local
    FROM marcajes
    WHERE ($2::int IS NULL OR id_user = $2)
  ),
  jornadas AS (
    SELECT
      id_user,
      local::date AS dia,
      MAX(local) FILTER (WHERE type = 'entry') AS entrada,
      MAX(local) FILTER (WHERE type = 'exit') AS salida
    FROM marcas
    GROUP BY id_user, local::date
  ),
  horas AS (
    SELECT id_user, dia, EXTRACT(EPOCH FROM (salida - entrada)) / 3600 AS trabajadas
    FROM jornadas
    WHERE entrada IS NOT NULL AND salida IS NOT NULL AND salida > entrada
  )
`;

@Injectable()
export class StatisticsService {
  private readonly zona: string;

  constructor(
    private dataSource: DataSource,
    config: ConfigService<Env, true>,
  ) {
    this.zona = config.get('TIMEZONE', { infer: true });
  }

  async diarias(idUser: number | null) {
    const filas: { idUser: number; dia: string; trabajadas: number }[] =
      await this.dataSource.query(
        `${JORNADAS}
         SELECT id_user AS "idUser", TO_CHAR(dia, 'DD-MM-YYYY') AS dia, trabajadas
         FROM horas ORDER BY id_user, horas.dia`,
        [this.zona, idUser],
      );
    return filas.map((f, i) => ({
      id: i + 1,
      idUser: f.idUser,
      day: f.dia,
      dailyHoursWorked: Number(f.trabajadas),
    }));
  }

  async mensuales(idUser: number | null) {
    const filas: { idUser: number; mes: string; promedio: number }[] =
      await this.dataSource.query(
        `${JORNADAS}
         SELECT id_user AS "idUser",
                TO_CHAR(DATE_TRUNC('month', dia), 'MM-YYYY') AS mes,
                AVG(trabajadas) AS promedio
         FROM horas
         WHERE EXTRACT(ISODOW FROM dia) BETWEEN 1 AND 5
         GROUP BY id_user, DATE_TRUNC('month', dia)
         ORDER BY id_user, DATE_TRUNC('month', dia)`,
        [this.zona, idUser],
      );
    return filas.map((f, i) => ({
      id: i + 1,
      idUser: f.idUser,
      month: f.mes,
      average_hours_worked: Number(f.promedio),
    }));
  }

  async anuales(idUser: number | null) {
    const filas: { idUser: number; anio: string; promedio: number }[] =
      await this.dataSource.query(
        `${JORNADAS}
         SELECT id_user AS "idUser",
                TO_CHAR(DATE_TRUNC('year', dia), 'YYYY') AS anio,
                AVG(trabajadas) AS promedio
         FROM horas
         GROUP BY id_user, DATE_TRUNC('year', dia)
         ORDER BY id_user, DATE_TRUNC('year', dia)`,
        [this.zona, idUser],
      );
    return filas.map((f, i) => ({
      id: i + 1,
      idUser: f.idUser,
      year: f.anio,
      average_hours_worked: Number(f.promedio),
    }));
  }
}
