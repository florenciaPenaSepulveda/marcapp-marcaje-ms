import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import * as moment from 'moment-timezone';
import { Env } from '../config/env';
import { analizarFecha, FORMATO_FECHA } from '../common/fechas';

const DIAS_MAXIMOS_DE_RESUMEN = 366;

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

const RESUMEN = `
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
  en_rango AS (
    SELECT * FROM jornadas WHERE dia BETWEEN $3::date AND $4::date
  )
  SELECT
    id_user AS "idUser",
    COUNT(*) FILTER (WHERE entrada IS NOT NULL AND salida > entrada)::int AS "daysWorked",
    COALESCE(
      SUM(EXTRACT(EPOCH FROM (salida - entrada)) / 3600)
        FILTER (WHERE entrada IS NOT NULL AND salida > entrada),
      0
    ) AS "totalHours",
    COUNT(*) FILTER (WHERE entrada IS NOT NULL AND salida IS NULL)::int AS "incompleteDays"
  FROM en_rango
  GROUP BY id_user
  ORDER BY id_user
`;

export type ResumenDeHoras = {
  idUser: number;
  daysWorked: number;
  totalHours: number;
  averageHoursPerDay: number;
  incompleteDays: number;
};

const redondear = (valor: number) => Math.round(valor * 100) / 100;

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

  resumenDelPeriodo(idUser: number | null, from?: string, to?: string) {
    const hoy = moment.tz(this.zona).startOf('day');
    const desde = from
      ? analizarFecha(from, this.zona)
      : hoy.clone().startOf('month');
    const hasta = to ? analizarFecha(to, this.zona) : hoy;
    if (!desde || !hasta) {
      throw new BadRequestException(
        `Dates must use the format ${FORMATO_FECHA}`,
      );
    }
    if (hasta.isBefore(desde)) {
      throw new BadRequestException(
        'The end date must not be before the start date',
      );
    }
    if (hasta.diff(desde, 'days') > DIAS_MAXIMOS_DE_RESUMEN) {
      throw new BadRequestException(
        `The period cannot exceed ${DIAS_MAXIMOS_DE_RESUMEN} days`,
      );
    }
    return this.resumen(
      idUser,
      desde.format('YYYY-MM-DD'),
      hasta.format('YYYY-MM-DD'),
    );
  }

  async resumen(idUser: number | null, desde: string, hasta: string) {
    const filas: {
      idUser: number;
      daysWorked: number;
      totalHours: string;
      incompleteDays: number;
    }[] = await this.dataSource.query(RESUMEN, [
      this.zona,
      idUser,
      desde,
      hasta,
    ]);
    const porUsuario: ResumenDeHoras[] = filas.map((fila) => ({
      idUser: fila.idUser,
      daysWorked: fila.daysWorked,
      totalHours: redondear(Number(fila.totalHours)),
      averageHoursPerDay: fila.daysWorked
        ? redondear(Number(fila.totalHours) / fila.daysWorked)
        : 0,
      incompleteDays: fila.incompleteDays,
    }));
    const daysWorked = porUsuario.reduce((s, u) => s + u.daysWorked, 0);
    const totalHours = redondear(
      porUsuario.reduce((s, u) => s + u.totalHours, 0),
    );
    return {
      from: desde,
      to: hasta,
      daysWorked,
      totalHours,
      averageHoursPerDay: daysWorked ? redondear(totalHours / daysWorked) : 0,
      incompleteDays: porUsuario.reduce((s, u) => s + u.incompleteDays, 0),
      perUser: porUsuario,
    };
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
