import { origenesPermitidos, validarEntorno } from './env';

const base = { JWT_SECRET: 'x'.repeat(40) };

describe('validarEntorno', () => {
  it('aplica valores por defecto', () => {
    expect(validarEntorno(base)).toMatchObject({
      APP_PORT: 3000,
      DB_PORT: 5432,
      TIMEZONE: 'America/Santiago',
      NODE_ENV: 'development',
    });
  });

  it('convierte números y acepta otra zona horaria válida', () => {
    expect(
      validarEntorno({ ...base, APP_PORT: '4100', TIMEZONE: 'America/Bogota' }),
    ).toMatchObject({ APP_PORT: 4100, TIMEZONE: 'America/Bogota' });
  });

  it('exige un JWT_SECRET largo', () => {
    expect(() => validarEntorno({ JWT_SECRET: 'corto' })).toThrow(/JWT_SECRET/);
    expect(() => validarEntorno({})).toThrow(/Configuración inválida/);
  });

  it('rechaza una zona horaria desconocida', () => {
    expect(() => validarEntorno({ ...base, TIMEZONE: 'Marte/Olimpo' })).toThrow(
      /Zona horaria/,
    );
  });
});

describe('origenesPermitidos', () => {
  it('separa, recorta y descarta vacíos', () => {
    expect(origenesPermitidos(' http://a.cl , http://b.cl ,,')).toEqual([
      'http://a.cl',
      'http://b.cl',
    ]);
    expect(origenesPermitidos('')).toEqual([]);
  });
});
