import {
  analizarFecha,
  analizarFechaHora,
  formatearFechaHora,
  mismoDia,
  rangoDeLaSemana,
  rangoDelDia,
} from './fechas';

const ZONA = 'America/Santiago';

describe('fechas', () => {
  it('interpreta las fechas en la zona horaria y no en la del servidor', () => {
    expect(analizarFechaHora('11-03-2024 09:00:00', ZONA)?.toISOString()).toBe(
      '2024-03-11T12:00:00.000Z',
    );
    expect(analizarFecha('11-07-2024', ZONA)?.toISOString()).toBe(
      '2024-07-11T04:00:00.000Z',
    );
  });

  it('respeta el cambio de horario de verano', () => {
    const verano = analizarFechaHora('15-01-2025 12:00:00', ZONA);
    const invierno = analizarFechaHora('15-07-2025 12:00:00', ZONA);
    expect(verano?.utcOffset()).toBe(-180);
    expect(invierno?.utcOffset()).toBe(-240);
  });

  it.each(['31-02-2024', '2024-03-11', '11/03/2024', '11-03-24', ''])(
    'rechaza la fecha inválida %p',
    (texto) => {
      expect(analizarFecha(texto, ZONA)).toBeNull();
    },
  );

  it.each([
    '11-03-2024 25:00:00',
    '11-03-2024',
    '11-03-2024 09:00',
    '11-13-2024 09:00:00',
  ])('rechaza la fecha y hora inválida %p', (texto) => {
    expect(analizarFechaHora(texto, ZONA)).toBeNull();
  });

  it('formatea en la zona horaria configurada', () => {
    expect(formatearFechaHora(new Date('2024-03-12T02:30:00Z'), ZONA)).toBe(
      '11-03-2024 23:30:00',
    );
  });

  it('delimita el día local aunque en UTC ya sea el día siguiente', () => {
    const { inicio, fin } = rangoDelDia(new Date('2024-03-12T02:30:00Z'), ZONA);
    expect(inicio.toISOString()).toBe('2024-03-11T03:00:00.000Z');
    expect(fin.toISOString()).toBe('2024-03-12T02:59:59.999Z');
  });

  it('compara días según la zona local', () => {
    expect(
      mismoDia(
        new Date('2024-03-12T02:30:00Z'),
        new Date('2024-03-11T13:00:00Z'),
        ZONA,
      ),
    ).toBe(true);
    expect(
      mismoDia(
        new Date('2024-03-12T04:00:00Z'),
        new Date('2024-03-11T13:00:00Z'),
        ZONA,
      ),
    ).toBe(false);
  });

  it('la semana comienza el lunes', () => {
    const { inicio, fin } = rangoDeLaSemana(
      new Date('2024-03-13T15:00:00Z'),
      ZONA,
    );
    expect(formatearFechaHora(inicio, ZONA)).toBe('11-03-2024 00:00:00');
    expect(formatearFechaHora(fin, ZONA)).toBe('17-03-2024 23:59:59');
  });
});
