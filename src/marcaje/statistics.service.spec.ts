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
});
