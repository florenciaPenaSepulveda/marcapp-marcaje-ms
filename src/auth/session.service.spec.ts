import {
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { SessionService } from './session.service';

const respuesta = (estado: number, cuerpo: unknown = {}) =>
  ({
    status: estado,
    ok: estado >= 200 && estado < 300,
    json: async () => cuerpo,
  }) as Response;

const crear = (vigenciaSegundos = 15) =>
  new SessionService({
    get: (clave: string) =>
      clave === 'USERS_SERVICE_URL'
        ? 'http://usuarios:3001/'
        : vigenciaSegundos,
  } as never);

describe('SessionService', () => {
  let fetchSimulado: jest.SpyInstance;

  beforeEach(() => {
    fetchSimulado = jest.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('consulta la sesión con el token y devuelve el rol vigente', async () => {
    fetchSimulado.mockResolvedValue(respuesta(200, { id: 4, role: 'admin' }));
    await expect(crear().validar('tok')).resolves.toEqual({
      id: 4,
      role: 'admin',
    });
    expect(fetchSimulado).toHaveBeenCalledWith(
      'http://usuarios:3001/auth/session',
      expect.objectContaining({ headers: { Authorization: 'Bearer tok' } }),
    );
  });

  it('rechaza cuando el servicio de usuarios responde 401', async () => {
    fetchSimulado.mockResolvedValue(respuesta(401));
    await expect(crear().validar('tok')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it.each([[500], [502], [429]])(
    'informa servicio no disponible ante una respuesta %i',
    async (estado) => {
      fetchSimulado.mockResolvedValue(respuesta(estado));
      await expect(crear().validar('tok')).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    },
  );

  it('informa servicio no disponible si no se puede conectar', async () => {
    fetchSimulado.mockRejectedValue(new Error('ECONNREFUSED'));
    await expect(crear().validar('tok')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('no vuelve a consultar durante la vigencia de la caché', async () => {
    fetchSimulado.mockResolvedValue(respuesta(200, { id: 4, role: 'user' }));
    const servicio = crear(15);
    await servicio.validar('tok');
    await servicio.validar('tok');
    expect(fetchSimulado).toHaveBeenCalledTimes(1);
    await servicio.validar('otro');
    expect(fetchSimulado).toHaveBeenCalledTimes(2);
  });

  it('consulta de nuevo cuando la caché vence', async () => {
    jest.useFakeTimers();
    fetchSimulado.mockResolvedValue(respuesta(200, { id: 4, role: 'user' }));
    const servicio = crear(15);
    await servicio.validar('tok');
    jest.advanceTimersByTime(16000);
    await servicio.validar('tok');
    expect(fetchSimulado).toHaveBeenCalledTimes(2);
  });

  it('con vigencia cero consulta siempre', async () => {
    fetchSimulado.mockResolvedValue(respuesta(200, { id: 4, role: 'user' }));
    const servicio = crear(0);
    await servicio.validar('tok');
    await servicio.validar('tok');
    expect(fetchSimulado).toHaveBeenCalledTimes(2);
  });

  it('no guarda en caché las respuestas rechazadas', async () => {
    fetchSimulado.mockResolvedValueOnce(respuesta(401));
    fetchSimulado.mockResolvedValueOnce(
      respuesta(200, { id: 4, role: 'user' }),
    );
    const servicio = crear(15);
    await expect(servicio.validar('tok')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    await expect(servicio.validar('tok')).resolves.toEqual({
      id: 4,
      role: 'user',
    });
  });

  it('acota el tamaño de la caché', async () => {
    fetchSimulado.mockResolvedValue(respuesta(200, { id: 4, role: 'user' }));
    const servicio = crear(300);
    for (let i = 0; i < 1005; i++) {
      await servicio.validar(`t${i}`);
    }
    const guardadas = (servicio as unknown as { cache: Map<string, unknown> })
      .cache.size;
    expect(guardadas).toBeLessThanOrEqual(1000);
  });

  it('limpia primero las entradas vencidas al llenarse', async () => {
    jest.useFakeTimers();
    fetchSimulado.mockResolvedValue(respuesta(200, { id: 4, role: 'user' }));
    const servicio = crear(1);
    for (let i = 0; i < 1000; i++) {
      await servicio.validar(`v${i}`);
    }
    jest.advanceTimersByTime(2000);
    await servicio.validar('nueva');
    const guardadas = (servicio as unknown as { cache: Map<string, unknown> })
      .cache;
    expect(guardadas.size).toBe(1);
    expect(guardadas.has('nueva')).toBe(true);
  });
});
