import * as moment from 'moment-timezone';
import { z } from 'zod';

const esquema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  APP_PORT: z.coerce.number().int().positive().default(3000),
  DB_HOST: z.string().min(1).default('127.0.0.1'),
  DB_PORT: z.coerce.number().int().positive().default(5432),
  DB_USER: z.string().min(1).default('postgres'),
  DB_PASSWORD: z.string().default(''),
  DB_NAME: z.string().min(1).default('marcajeDB'),
  JWT_SECRET: z
    .string()
    .min(32, 'JWT_SECRET debe tener al menos 32 caracteres'),
  USERS_SERVICE_URL: z.string().url().default('http://127.0.0.1:3001'),
  SESSION_CACHE_SECONDS: z.coerce.number().int().min(0).max(300).default(15),
  OFFLINE_MAX_HOURS: z.coerce.number().int().min(1).max(720).default(72),
  TIMEZONE: z
    .string()
    .refine((zona) => moment.tz.zone(zona) !== null, 'Zona horaria desconocida')
    .default('America/Santiago'),
  CORS_ORIGINS: z.string().default(''),
  RATE_LIMIT: z.coerce.number().int().positive().default(60),
  TRUST_PROXY: z.enum(['true', 'false']).default('false'),
});

export type Env = z.infer<typeof esquema>;

export const validarEntorno = (entrada: Record<string, unknown>): Env => {
  const resultado = esquema.safeParse(entrada);
  if (!resultado.success) {
    const detalle = resultado.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ');
    throw new Error(`Configuración inválida: ${detalle}`);
  }
  return resultado.data;
};

export const origenesPermitidos = (valor: string): string[] =>
  valor
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
