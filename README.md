# Marcapp · Marcaje MS

[![CI](https://github.com/florenciaPenaSepulveda/marcapp-marcaje-ms/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/florenciaPenaSepulveda/marcapp-marcaje-ms/actions/workflows/ci.yml)

Microservicio de **marcajes de entrada y salida** y de estadísticas de horas trabajadas de **Marcapp**, una aplicación de control de asistencia con ubicación para empresas. Valida los tokens JWT que emite el servicio de usuarios.

## Inicio rápido

```
cp .env.example .env     # completa DB_PASSWORD y JWT_SECRET (el mismo que login-ms)
npm ci && npm run migration:run
npm run start:dev
```

Necesitas Node.js 24 y PostgreSQL 16. Pruebas: 122 con 99 % de cobertura (`npm run test:cov`).

## Repositorios del proyecto

| Repositorio | Descripción |
|---|---|
| [marcapp-login-ms](https://github.com/florenciaPenaSepulveda/marcapp-login-ms) | Usuarios, registro, ingreso y roles |
| **marcapp-marcaje-ms** (este) | Marcajes y estadísticas de horas |
| [marcapp-front](https://github.com/florenciaPenaSepulveda/marcapp-front) | Aplicación móvil (Expo / React Native) |

## Tecnologías

NestJS 11, TypeScript, TypeORM con PostgreSQL 16, JWT (HS256), moment-timezone, class-validator, Jest y supertest.

## Puesta en marcha

Requisitos: Node.js 24 (ver `.nvmrc`) y PostgreSQL 16.

```bash
cp .env.example .env
npm ci
npm run migration:run
npm run start:dev
```

Completa en `.env` al menos `DB_PASSWORD` y `JWT_SECRET`, que debe ser **el mismo valor** que usa `marcapp-login-ms` (mínimo 32 caracteres). El servicio no arranca si la configuración es inválida.

## Variables de entorno

| Variable | Descripción | Por defecto |
|---|---|---|
| `NODE_ENV` | `development`, `test` o `production` | `development` |
| `APP_PORT` | Puerto HTTP | `3000` |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | Conexión a PostgreSQL | `127.0.0.1`, `5432`, `postgres`, vacío, `marcajeDB` |
| `JWT_SECRET` | Secreto compartido con el servicio de usuarios, obligatorio | — |
| `USERS_SERVICE_URL` | URL del servicio de usuarios, que confirma cada sesión | `http://127.0.0.1:3001` |
| `SESSION_CACHE_SECONDS` | Segundos que se recuerda una sesión confirmada (0 a 300; 0 la consulta siempre) | `15` |
| `OFFLINE_MAX_HOURS` | Antigüedad máxima, en horas, de un registro hecho sin conexión (1 a 720) | `72` |
| `TIMEZONE` | Zona horaria con la que se definen los días de trabajo | `America/Santiago` |
| `CORS_ORIGINS` | Orígenes permitidos separados por coma | ninguno en producción |
| `RATE_LIMIT` | Solicitudes por minuto y por IP | `60` |
| `TRUST_PROXY` | `true` si hay un proxy inverso delante | `false` |

## Endpoints

Todas las rutas, salvo el estado del servicio, exigen `Authorization: Bearer <token>`.

| Método y ruta | Acceso | Descripción |
|---|---|---|
| `GET /` · `GET /health` | Público | Estado del servicio |
| `POST /marcaje` | Usuario | Registra su entrada o su salida con latitud y longitud. Opcionalmente acepta `recordedAt` (hora ISO 8601 del dispositivo) y `clientId` (UUID v4) para registros hechos sin conexión |
| `POST /marcaje/user/today/:id` | Dueño o admin | Estado de hoy: `0` sin marcas, `1` entrada, `2` jornada completa |
| `GET /marcaje/user/:id` | Dueño o admin | Marcajes del usuario (`limit`, `offset`) |
| `POST /marcaje/date/:id` | Dueño o admin | Marcajes entre dos fechas `DD-MM-YYYY` (máximo 366 días) |
| `GET /marcaje/user/week/:id` | Dueño o admin | Marcajes de la semana actual (lunes a domingo) |
| `GET /marcaje/obtain/:id` | Dueño o admin | Un marcaje por identificador |
| `GET /marcaje/admin` | Admin | Todos los marcajes (`limit`, `offset`) |
| `GET /marcaje/admin/today` | Admin | Estado de hoy de cada trabajador que marcó: `working` o `done`, con hora de entrada y salida |
| `POST /marcaje/admin` | Admin | Crea un marcaje para un usuario en una fecha pasada |
| `PATCH /marcaje/admin/:id` | Admin | Corrige la fecha y hora de un marcaje |
| `DELETE /marcaje/admin/user/:userId` | Admin | Elimina todos los marcajes de un usuario (se usa al eliminar a un trabajador) y responde cuántos eran |
| `DELETE /marcaje/admin/:id` | Admin | Elimina un marcaje |
| `GET /statistics/daily` · `monthly` · `yearly` | Usuario | Horas por día, promedio mensual y anual; el admin puede filtrar con `?userId=` |
| `GET /statistics/summary` | Usuario | Resumen de un período (`from`, `to` en `DD-MM-YYYY`; por defecto el mes en curso): días trabajados, horas totales, promedio por día, días sin salida y desglose por trabajador. El admin puede filtrar con `?userId=` |

## Reglas de negocio

- La identidad del usuario sale siempre de la sesión validada, nunca del cuerpo de la solicitud; ningún endpoint recibe el token ni el identificador del usuario en el cuerpo.
- Cada día (en la zona horaria configurada) admite una entrada y luego una salida. La salida debe ser posterior a la entrada.
- Dos marcajes automáticos del mismo usuario deben distanciarse al menos 30 segundos, y el registro usa un bloqueo transaccional por usuario, de modo que un doble toque o dos solicitudes simultáneas no generan marcas duplicadas.
- Los marcajes creados o editados por un administrador quedan señalados con `adminFlag`, no pueden ser futuros y deben mantenerse dentro del mismo día.
- Las estadísticas se calculan al consultar, en la zona horaria local: un turno de 22:00 a 23:30 cuenta en su día aunque en UTC ya sea el siguiente. El promedio mensual considera solo días hábiles (lunes a viernes) y el anual todos los días con jornada completa.

## Registros sin conexión

La aplicación móvil guarda los marcajes en el teléfono cuando no hay señal y los envía al reconectarse. Para eso `POST /marcaje` acepta dos campos opcionales:

- `recordedAt`: la hora del dispositivo cuando se marcó. El servidor la usa en lugar de la hora de recepción, pero la valida: no puede ser futura (se tolera un adelanto de 5 minutos del reloj, que se ajusta a la hora actual) ni más antigua que `OFFLINE_MAX_HOURS`. Con `recordedAt` el marcaje queda con `offline: true`, que el administrador ve en el detalle del trabajador.
- `clientId`: identificador único generado en el teléfono. Hace idempotente el envío: si la respuesta se pierde y la app reintenta, se devuelve el marcaje ya guardado en lugar de duplicarlo. Un identificador que pertenece a otro usuario se rechaza.

Se aplican las mismas reglas de jornada que a un registro en línea (entrada y luego salida, la salida posterior a la entrada y una sola jornada por día), evaluadas sobre la hora del dispositivo. Los rechazos por reglas de negocio responden `{ "success": false, "message": ... }` con estado 201, que es lo que la app interpreta como definitivo y no reintenta.

## Seguridad

- Sin secretos en el código: la configuración sale del entorno y se valida al iniciar.
- Cada solicitud se valida en dos pasos: la firma y la vigencia del token se verifican localmente con HS256, y luego `GET /auth/session` del servicio de usuarios confirma que la sesión no fue revocada (por ejemplo, tras cambiar la contraseña o eliminar al usuario) y entrega el rol vigente, que es el que se usa en lugar del que trae el token. La respuesta se recuerda `SESSION_CACHE_SECONDS` segundos, por lo que una revocación rige como máximo con ese retraso. Si el servicio de usuarios no responde, la API contesta 503 en lugar de aceptar el token sin confirmar.
- Cada usuario solo accede a sus propios datos; las rutas de administración exigen el rol `admin`.
- La hora enviada por el dispositivo es manipulable, por eso se acota (no futura y con antigüedad máxima) y los marcajes que la usan quedan señalados para su revisión.
- Cuerpos y parámetros se validan con lista blanca (un campo no declarado se rechaza con 400).
- Límite de solicitudes por IP, cabeceras de seguridad con helmet y CORS restringido.
- Las consultas SQL de estadísticas usan parámetros; no se concatena ningún dato del usuario.

## Base de datos y migraciones

El esquema se versiona con migraciones de TypeORM (`src/database/migrations`). En desarrollo se sincroniza automáticamente; en producción se ejecutan al iniciar.

```bash
npm run migration:generate -- src/database/migrations/NombreDelCambio
npm run migration:run
npm run migration:check
```

El CI comprueba que las migraciones reproducen exactamente la entidad.

## Pruebas

```bash
npm test
npm run test:cov
npm run test:e2e
```

Las pruebas de integración usan una base PostgreSQL aparte (`DB_NAME_TEST`, por defecto `marcajedb_test`) y cubren autenticación, propiedad de los datos, concurrencia, zona horaria y estadísticas.

## Autoría

Proyecto desarrollado en equipo durante la carrera. Esta copia forma parte del portafolio de [Florencia Peña Sepúlveda](https://github.com/florenciaPenaSepulveda), que la revisó, corrigió y documentó.
