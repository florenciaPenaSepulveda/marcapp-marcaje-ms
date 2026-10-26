import {
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Env } from '../config/env';

export interface SesionVigente {
  id: number;
  role: string;
}

const TIEMPO_DE_ESPERA_MS = 3000;
const LIMITE_DE_CACHE = 1000;

@Injectable()
export class SessionService {
  private readonly url: string;
  private readonly vigenciaMs: number;
  private readonly cache = new Map<
    string,
    { sesion: SesionVigente; expira: number }
  >();

  constructor(config: ConfigService<Env, true>) {
    this.url = config
      .get('USERS_SERVICE_URL', { infer: true })
      .replace(/\/+$/, '');
    this.vigenciaMs =
      config.get('SESSION_CACHE_SECONDS', { infer: true }) * 1000;
  }

  async validar(token: string): Promise<SesionVigente> {
    const guardada = this.cache.get(token);
    if (guardada && guardada.expira > Date.now()) {
      return guardada.sesion;
    }
    this.cache.delete(token);

    let respuesta: Response;
    try {
      respuesta = await fetch(`${this.url}/auth/session`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(TIEMPO_DE_ESPERA_MS),
      });
    } catch {
      throw new ServiceUnavailableException('User service unavailable');
    }
    if (respuesta.status === 401) {
      throw new UnauthorizedException();
    }
    if (!respuesta.ok) {
      throw new ServiceUnavailableException('User service unavailable');
    }

    const sesion = (await respuesta.json()) as SesionVigente;
    if (this.vigenciaMs > 0) {
      this.guardar(token, sesion);
    }
    return sesion;
  }

  private guardar(token: string, sesion: SesionVigente): void {
    if (this.cache.size >= LIMITE_DE_CACHE) {
      const ahora = Date.now();
      this.cache.forEach((valor, clave) => {
        if (valor.expira <= ahora) {
          this.cache.delete(clave);
        }
      });
      if (this.cache.size >= LIMITE_DE_CACHE) {
        this.cache.clear();
      }
    }
    this.cache.set(token, { sesion, expira: Date.now() + this.vigenciaMs });
  }
}
