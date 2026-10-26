import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { SessionService } from './session.service';

export interface Sesion {
  id: number;
  role: string;
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private sessionService: SessionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);
    if (!token) {
      throw new UnauthorizedException();
    }
    try {
      await this.jwtService.verifyAsync(token);
    } catch {
      throw new UnauthorizedException();
    }
    const { id, role } = await this.sessionService.validar(token);
    if (!Number.isInteger(id) || typeof role !== 'string') {
      throw new UnauthorizedException();
    }
    request.user = { id, role } satisfies Sesion;
    return true;
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = (request.headers.authorization ?? '').split(' ');
    return type?.toLowerCase() === 'bearer' && token ? token : undefined;
  }
}
