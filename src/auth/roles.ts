import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Sesion } from './auth.guard';

export const ROLES_KEY = 'roles';
export const ROL_ADMIN = 'admin';

export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requeridos = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requeridos?.length) {
      return true;
    }
    const sesion: Sesion | undefined = context
      .switchToHttp()
      .getRequest()?.user;
    return !!sesion && requeridos.includes(sesion.role);
  }
}

export const esAdmin = (sesion: Sesion): boolean => sesion.role === ROL_ADMIN;

export const autorizarAcceso = (sesion: Sesion, idUsuario: number): void => {
  if (!esAdmin(sesion) && sesion.id !== idUsuario) {
    throw new ForbiddenException(
      'You do not have permission to access this data',
    );
  }
};
