import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { AuthGuard } from './auth.guard';
import { SessionService } from './session.service';
import { autorizarAcceso, esAdmin, RolesGuard } from './roles';

const contexto = (request: Record<string, unknown>): ExecutionContext =>
  ({
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => undefined,
    getClass: () => undefined,
  }) as unknown as ExecutionContext;

describe('AuthGuard', () => {
  let jwt: { verifyAsync: jest.Mock };
  let sesiones: { validar: jest.Mock };
  let guard: AuthGuard;

  beforeEach(() => {
    jwt = { verifyAsync: jest.fn().mockResolvedValue({ id: 3, role: 'user' }) };
    sesiones = {
      validar: jest.fn().mockResolvedValue({ id: 3, role: 'user' }),
    };
    guard = new AuthGuard(
      jwt as unknown as JwtService,
      sesiones as unknown as SessionService,
    );
  });

  it.each([[undefined], ['Basic abc'], ['Bearer'], ['Bearer ']])(
    'rechaza la cabecera %p sin verificar',
    async (cabecera) => {
      await expect(
        guard.canActivate(contexto({ headers: { authorization: cabecera } })),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(jwt.verifyAsync).not.toHaveBeenCalled();
      expect(sesiones.validar).not.toHaveBeenCalled();
    },
  );

  it('rechaza un token inválido o vencido sin consultar al servicio de usuarios', async () => {
    jwt.verifyAsync.mockRejectedValue(new Error('jwt expired'));
    await expect(
      guard.canActivate(
        contexto({ headers: { authorization: 'Bearer malo' } }),
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(sesiones.validar).not.toHaveBeenCalled();
  });

  it('propaga el rechazo cuando el servicio de usuarios revoca la sesión', async () => {
    sesiones.validar.mockRejectedValue(new UnauthorizedException());
    await expect(
      guard.canActivate(
        contexto({ headers: { authorization: 'Bearer revocado' } }),
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it.each([[{}], [{ id: 'uno', role: 'user' }], [{ id: 1 }], [{ role: 'x' }]])(
    'rechaza una respuesta de sesión con datos incompletos %p',
    async (respuesta) => {
      sesiones.validar.mockResolvedValue(respuesta);
      await expect(
        guard.canActivate(
          contexto({ headers: { authorization: 'Bearer firmado' } }),
        ),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    },
  );

  it('toma el id y el rol vigentes del servicio de usuarios y no los del token', async () => {
    jwt.verifyAsync.mockResolvedValue({ id: 3, role: 'admin' });
    sesiones.validar.mockResolvedValue({ id: 3, role: 'user' });
    const request: Record<string, unknown> = {
      headers: { authorization: 'bearer bueno' },
    };
    await expect(guard.canActivate(contexto(request))).resolves.toBe(true);
    expect(request.user).toEqual({ id: 3, role: 'user' });
    expect(sesiones.validar).toHaveBeenCalledWith('bueno');
  });
});

describe('RolesGuard', () => {
  let reflector: { getAllAndOverride: jest.Mock };
  let guard: RolesGuard;

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    guard = new RolesGuard(reflector as unknown as Reflector);
  });

  it('permite rutas sin roles exigidos', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    expect(guard.canActivate(contexto({}))).toBe(true);
  });

  it('exige que el rol de la sesión esté entre los permitidos', () => {
    reflector.getAllAndOverride.mockReturnValue(['admin']);
    expect(guard.canActivate(contexto({}))).toBe(false);
    expect(guard.canActivate(contexto({ user: { id: 1, role: 'user' } }))).toBe(
      false,
    );
    expect(
      guard.canActivate(contexto({ user: { id: 1, role: 'admin' } })),
    ).toBe(true);
  });
});

describe('autorizarAcceso', () => {
  it('permite al dueño y al administrador', () => {
    expect(() => autorizarAcceso({ id: 4, role: 'user' }, 4)).not.toThrow();
    expect(() => autorizarAcceso({ id: 1, role: 'admin' }, 4)).not.toThrow();
    expect(esAdmin({ id: 1, role: 'admin' })).toBe(true);
  });

  it('niega el acceso a datos ajenos', () => {
    expect(() => autorizarAcceso({ id: 4, role: 'user' }, 5)).toThrow(
      ForbiddenException,
    );
  });
});
