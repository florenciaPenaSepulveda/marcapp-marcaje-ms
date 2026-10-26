import { BadRequestException } from '@nestjs/common';
import * as moment from 'moment-timezone';
import { StatisticsService } from './statistics.service';

describe('StatisticsService', () => {
  let query: jest.Mock;
  let servicio: StatisticsService;

  beforeEach(() => {
    query = jest.fn();
    servicio = new StatisticsService(
      { query } as never,
      { get: () => 'America/Santiago' } as never,
    );
  });

  it('calcula las horas diarias en la zona horaria y renombra los campos', async () => {
    query.mockResolvedValue([
      { idUser: 7, dia: '11-03-2024', trabajadas: '8.5' },
    ]);
    expect(await servicio.diarias(7)).toEqual([
      { id: 1, idUser: 7, day: '11-03-2024', dailyHoursWorked: 8.5 },
    ]);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('AT TIME ZONE $1'),
      ['America/Santiago', 7],
    );
  });

  it('el promedio mensual solo considera días hábiles', async () => {
    query.mockResolvedValue([
      { idUser: 7, mes: '03-2024', promedio: '8' },
      { idUser: 7, mes: '04-2024', promedio: '7.25' },
    ]);
    const filas = await servicio.mensuales(null);
    expect(filas).toEqual([
      { id: 1, idUser: 7, month: '03-2024', average_hours_worked: 8 },
      { id: 2, idUser: 7, month: '04-2024', average_hours_worked: 7.25 },
    ]);
    expect(query.mock.calls[0][0]).toContain('ISODOW');
    expect(query.mock.calls[0][1]).toEqual(['America/Santiago', null]);
  });

  it('calcula el promedio anual', async () => {
    query.mockResolvedValue([{ idUser: 7, anio: '2024', promedio: '7.9' }]);
    expect(await servicio.anuales(7)).toEqual([
      { id: 1, idUser: 7, year: '2024', average_hours_worked: 7.9 },
    ]);
  });

  it('devuelve listas vacías cuando no hay jornadas completas', async () => {
    query.mockResolvedValue([]);
    expect(await servicio.diarias(null)).toEqual([]);
    expect(await servicio.mensuales(null)).toEqual([]);
    expect(await servicio.anuales(null)).toEqual([]);
  });

  describe('resumen', () => {
    it('suma las jornadas, calcula promedios y redondea', async () => {
      query.mockResolvedValue([
        { idUser: 7, daysWorked: 2, totalHours: '16.555', incompleteDays: 1 },
        { idUser: 8, daysWorked: 1, totalHours: '4', incompleteDays: 0 },
      ]);
      const res = await servicio.resumen(null, '2024-03-01', '2024-03-31');
      expect(res).toEqual({
        from: '2024-03-01',
        to: '2024-03-31',
        daysWorked: 3,
        totalHours: 20.56,
        averageHoursPerDay: 6.85,
        incompleteDays: 1,
        perUser: [
          {
            idUser: 7,
            daysWorked: 2,
            totalHours: 16.56,
            averageHoursPerDay: 8.28,
            incompleteDays: 1,
          },
          {
            idUser: 8,
            daysWorked: 1,
            totalHours: 4,
            averageHoursPerDay: 4,
            incompleteDays: 0,
          },
        ],
      });
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('BETWEEN $3::date AND $4::date'),
        ['America/Santiago', null, '2024-03-01', '2024-03-31'],
      );
    });

    it('devuelve ceros cuando no hay jornadas', async () => {
      query.mockResolvedValue([]);
      expect(
        await servicio.resumen(7, '2024-03-01', '2024-03-31'),
      ).toMatchObject({
        daysWorked: 0,
        totalHours: 0,
        averageHoursPerDay: 0,
        perUser: [],
      });
    });

    it('un usuario sin días completos tiene promedio cero', async () => {
      query.mockResolvedValue([
        { idUser: 7, daysWorked: 0, totalHours: '0', incompleteDays: 2 },
      ]);
      const res = await servicio.resumen(7, '2024-03-01', '2024-03-31');
      expect(res.perUser[0].averageHoursPerDay).toBe(0);
      expect(res.incompleteDays).toBe(2);
    });

    it('por defecto abarca desde el inicio del mes hasta hoy', async () => {
      query.mockResolvedValue([]);
      await servicio.resumenDelPeriodo(7);
      const hoy = moment.tz('America/Santiago');
      expect(query.mock.calls[0][1]).toEqual([
        'America/Santiago',
        7,
        hoy.clone().startOf('month').format('YYYY-MM-DD'),
        hoy.format('YYYY-MM-DD'),
      ]);
    });

    it('convierte las fechas recibidas', async () => {
      query.mockResolvedValue([]);
      await servicio.resumenDelPeriodo(null, '01-03-2024', '31-03-2024');
      expect(query.mock.calls[0][1]).toEqual([
        'America/Santiago',
        null,
        '2024-03-01',
        '2024-03-31',
      ]);
    });

    it('valida formato, orden y duración', () => {
      expect(() => servicio.resumenDelPeriodo(7, 'x', '01-03-2024')).toThrow(
        BadRequestException,
      );
      expect(() =>
        servicio.resumenDelPeriodo(7, '05-03-2024', '01-03-2024'),
      ).toThrow(/must not be before/);
      expect(() =>
        servicio.resumenDelPeriodo(7, '01-01-2020', '01-01-2024'),
      ).toThrow(/cannot exceed/);
    });
  });
});
