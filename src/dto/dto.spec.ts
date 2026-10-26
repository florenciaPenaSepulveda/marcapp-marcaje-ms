import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateMarcajeDto } from './create-marcaje.dto';
import { AdminMarcajeDto } from './admin-marcaje.dto';
import { UpdateMarcajeDto } from './update-marcaje.dto';
import { PeriodDto, TodayDto } from './get-marcaje-dates';
import {
  PageQueryDto,
  StatisticsQueryDto,
  SummaryQueryDto,
} from './statistics-query.dto';

const errores = async (
  clase: new () => object,
  datos: Record<string, unknown>,
) => (await validate(plainToInstance(clase, datos))).map((e) => e.property);

describe('CreateMarcajeDto', () => {
  it('acepta coordenadas válidas como texto', async () => {
    expect(
      await errores(CreateMarcajeDto, {
        latCoordinate: '-33.4489',
        longCoordinate: '-70.6693',
      }),
    ).toEqual([]);
  });

  it.each([
    ['latCoordinate', '91'],
    ['latCoordinate', 'abc'],
    ['latCoordinate', -33.4],
    ['longCoordinate', '181'],
    ['longCoordinate', ''],
  ])('rechaza %s = %p', async (campo, valor) => {
    const base = { latCoordinate: '-33.4489', longCoordinate: '-70.6693' };
    expect(
      await errores(CreateMarcajeDto, { ...base, [campo]: valor }),
    ).toContain(campo);
  });
});

describe('CreateMarcajeDto sin conexión', () => {
  const base = { latCoordinate: '-33.4489', longCoordinate: '-70.6693' };

  it('acepta la hora ISO y el identificador UUID opcionales', async () => {
    expect(
      await errores(CreateMarcajeDto, {
        ...base,
        recordedAt: '2026-10-26T12:30:00.000Z',
        clientId: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
      }),
    ).toEqual([]);
  });

  it.each([
    ['recordedAt', '26-10-2026 12:30:00'],
    ['recordedAt', '2026-13-40T99:00:00Z'],
    ['recordedAt', 'ayer'],
    ['clientId', 'no-es-uuid'],
    ['clientId', '3f2504e0-4f89-11d3-9a0c-0305e82c3301'],
  ])('rechaza %s = %s', async (campo, valor) => {
    expect(
      await errores(CreateMarcajeDto, { ...base, [campo]: valor }),
    ).toEqual([campo]);
  });
});

describe('AdminMarcajeDto y UpdateMarcajeDto', () => {
  it('acepta el formato DD-MM-YYYY HH:mm:ss', async () => {
    expect(
      await errores(AdminMarcajeDto, {
        idUser: 3,
        date: '11-03-2024 09:00:00',
      }),
    ).toEqual([]);
    expect(
      await errores(UpdateMarcajeDto, { date: '11-03-2024 09:00:00' }),
    ).toEqual([]);
  });

  it.each([['2024-03-11 09:00:00'], ['11-03-2024'], ['11-03-2024 9:00:00']])(
    'rechaza la fecha %p',
    async (date) => {
      expect(await errores(AdminMarcajeDto, { idUser: 3, date })).toEqual([
        'date',
      ]);
      expect(await errores(UpdateMarcajeDto, { date })).toEqual(['date']);
    },
  );

  it.each([[0], [-1], [1.5], ['3']])('rechaza el idUser %p', async (idUser) => {
    expect(
      await errores(AdminMarcajeDto, { idUser, date: '11-03-2024 09:00:00' }),
    ).toEqual(['idUser']);
  });
});

describe('PeriodDto y TodayDto', () => {
  it('exige fechas con formato DD-MM-YYYY', async () => {
    expect(
      await errores(PeriodDto, {
        startDate: '01-03-2024',
        endDate: '07-03-2024',
      }),
    ).toEqual([]);
    expect(
      await errores(PeriodDto, { startDate: '2024-03-01', endDate: '' }),
    ).toEqual(['startDate', 'endDate']);
  });

  it('las fechas de TodayDto son opcionales', async () => {
    expect(await errores(TodayDto, {})).toEqual([]);
    expect(await errores(TodayDto, { startDate: 5 })).toEqual(['startDate']);
  });
});

describe('consultas', () => {
  it('convierte y acota los parámetros', async () => {
    const consulta = plainToInstance(PageQueryDto, {
      limit: '50',
      offset: '10',
    });
    expect(consulta).toMatchObject({ limit: 50, offset: 10 });
    expect(await validate(consulta)).toHaveLength(0);
    expect(await errores(PageQueryDto, { limit: '5000' })).toEqual(['limit']);
    expect(await errores(PageQueryDto, { offset: '-1' })).toEqual(['offset']);
  });

  it('el filtro de estadísticas exige un id positivo', async () => {
    expect(await errores(StatisticsQueryDto, {})).toEqual([]);
    expect(await errores(StatisticsQueryDto, { userId: '7' })).toEqual([]);
    expect(await errores(StatisticsQueryDto, { userId: '0' })).toEqual([
      'userId',
    ]);
    expect(await errores(StatisticsQueryDto, { userId: 'abc' })).toEqual([
      'userId',
    ]);
  });

  it('el resumen acepta un período opcional con formato DD-MM-YYYY', async () => {
    expect(await errores(SummaryQueryDto, {})).toEqual([]);
    expect(
      await errores(SummaryQueryDto, {
        userId: '7',
        from: '01-03-2024',
        to: '31-03-2024',
      }),
    ).toEqual([]);
    expect(
      await errores(SummaryQueryDto, { from: '2024-03-01', to: '31/03/2024' }),
    ).toEqual(['from', 'to']);
  });
});
