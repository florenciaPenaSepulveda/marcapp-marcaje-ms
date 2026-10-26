import { origenesPermitidos, validarEntorno } from './env';

const base = { JWT_SECRET: 'x'.repeat(40) };

describe('validarEntorno', () => {
  it('aplica valores por defecto', () => {
    expect(validarEntorno(base)).toMatchObject({
      APP_PORT: 3000,
      DB_PORT: 5432,
      TIMEZONE: 'America/Santiago',
      NODE_ENV: 'development',
      USERS_SERVICE_URL: 'http://127.0.0.1:3001',
      SESSION_CACHE_SECONDS: 15,
      OFFLINE_MAX_HOURS: 72,
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

  it('valida la URL del servicio de usuarios y la vigencia de la caché', () => {
    expect(() =>
      validarEntorno({ ...base, USERS_SERVICE_URL: 'no-es-url' }),
    ).toThrow(/USERS_SERVICE_URL/);
    expect(() =>
      validarEntorno({ ...base, SESSION_CACHE_SECONDS: '301' }),
    ).toThrow(/SESSION_CACHE_SECONDS/);
    expect(
      validarEntorno({ ...base, SESSION_CACHE_SECONDS: '0' })
        .SESSION_CACHE_SECONDS,
    ).toBe(0);
  });

  it('acota las horas máximas para registros sin conexión', () => {
    expect(() => validarEntorno({ ...base, OFFLINE_MAX_HOURS: '0' })).toThrow(
      /OFFLINE_MAX_HOURS/,
    );
    expect(() => validarEntorno({ ...base, OFFLINE_MAX_HOURS: '721' })).toThrow(
      /OFFLINE_MAX_HOURS/,
    );
    expect(
      validarEntorno({ ...base, OFFLINE_MAX_HOURS: '24' }).OFFLINE_MAX_HOURS,
    ).toBe(24);
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
