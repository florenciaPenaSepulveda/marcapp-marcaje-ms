import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { AuthGuard } from './auth.guard';
import { autorizarAcceso, esAdmin, RolesGuard } from './roles';

const contexto = (request: Record<string, unknown>): ExecutionContext =>
  ({
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => undefined,
    getClass: () => undefined,
  }) as unknown as ExecutionContext;

describe('AuthGuard', () => {
  let jwt: { verifyAsync: jest.Mock };
  let guard: AuthGuard;

  beforeEach(() => {
    jwt = { verifyAsync: jest.fn() };
    guard = new AuthGuard(jwt as unknown as JwtService);
  });

  it.each([[undefined], ['Basic abc'], ['Bearer'], ['Bearer ']])(
    'rechaza la cabecera %p sin verificar',
    async (cabecera) => {
      await expect(
        guard.canActivate(contexto({ headers: { authorization: cabecera } })),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(jwt.verifyAsync).not.toHaveBeenCalled();
    },
  );

  it('rechaza un token inválido o vencido', async () => {
    jwt.verifyAsync.mockRejectedValue(new Error('jwt expired'));
    await expect(
      guard.canActivate(
        contexto({ headers: { authorization: 'Bearer malo' } }),
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it.each([[{}], [{ id: 'uno', role: 'user' }], [{ id: 1 }], [null]])(
    'rechaza un token firmado con datos incompletos %p',
    async (payload) => {
      jwt.verifyAsync.mockResolvedValue(payload);
      await expect(
        guard.canActivate(
          contexto({ headers: { authorization: 'Bearer firmado' } }),
        ),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    },
  );

  it('deja solo el id y el rol en la solicitud', async () => {
    jwt.verifyAsync.mockResolvedValue({
      id: 3,
      role: 'user',
      email: 'x@test.cl',
    });
    const request: Record<string, unknown> = {
      headers: { authorization: 'bearer bueno' },
    };
    await expect(guard.canActivate(contexto(request))).resolves.toBe(true);
    expect(request.user).toEqual({ id: 3, role: 'user' });
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
