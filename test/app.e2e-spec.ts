process.env.NODE_ENV = 'test';
process.env.JWT_SECRET ??= 'secreto-de-pruebas-con-mas-de-32-caracteres';
process.env.DB_NAME = process.env.DB_NAME_TEST ?? 'marcajedb_test';
process.env.SESSION_CACHE_SECONDS = '0';

import { createServer, Server } from 'http';
import { AddressInfo } from 'net';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as jwt from 'jsonwebtoken';
import * as request from 'supertest';
import { configurarApp } from './../src/app.setup';

const aleatorio = () => Math.floor(Math.random() * 1_000_000) + 1000;
const firmar = (id: number, role: string, secreto = process.env.JWT_SECRET) =>
  jwt.sign({ id, role, email: `u${id}@test.cl` }, secreto, { expiresIn: '1h' });

type ModoDeFallo = 'ninguno' | 'error' | 'caido';

const revocados = new Set<string>();
const rolesVigentes = new Map<number, string>();
let modoDeFallo: ModoDeFallo = 'ninguno';
let servicioDeUsuarios: Server;

const iniciarServicioDeUsuarios = () =>
  new Promise<void>((resolver) => {
    servicioDeUsuarios = createServer((req, res) => {
      if (modoDeFallo === 'caido') {
        req.socket.destroy();
        return;
      }
      if (modoDeFallo === 'error') {
        res.statusCode = 500;
        res.end();
        return;
      }
      const token = (req.headers.authorization ?? '').replace(/^Bearer /i, '');
      try {
        if (revocados.has(token)) {
          throw new Error('revocado');
        }
        const payload = jwt.verify(token, process.env.JWT_SECRET) as {
          id: number;
          role: string;
        };
        res.setHeader('content-type', 'application/json');
        res.end(
          JSON.stringify({
            id: payload.id,
            role: rolesVigentes.get(payload.id) ?? payload.role,
          }),
        );
      } catch {
        res.statusCode = 401;
        res.end();
      }
    });
    servicioDeUsuarios.listen(0, '127.0.0.1', () => {
      process.env.USERS_SERVICE_URL = `http://127.0.0.1:${(servicioDeUsuarios.address() as AddressInfo).port}`;
      resolver();
    });
  });

describe('Marcapp marcaje (e2e)', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());
  const admin = { id: aleatorio(), role: 'admin' };
  const ana = { id: aleatorio(), role: 'user' };
  const beto = { id: aleatorio(), role: 'user' };
  const auth = (u: { id: number; role: string }) => ({
    Authorization: `Bearer ${firmar(u.id, u.role)}`,
  });
  const ubicacion = { latCoordinate: '-33.4489', longCoordinate: '-70.6693' };

  const crear = (idUser: number, date: string) =>
    http().post('/marcaje/admin').set(auth(admin)).send({ idUser, date });

  beforeAll(async () => {
    await iniciarServicioDeUsuarios();
    const { AppModule } = await import('./../src/app.module');
    const modulo = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = modulo.createNestApplication();
    configurarApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await new Promise((resolver) => servicioDeUsuarios.close(resolver));
  });

  describe('acceso', () => {
    it('permite desde el navegador los métodos que usa la aplicación, incluido DELETE', async () => {
      const res = await http()
        .options('/marcaje/admin/1')
        .set('Origin', 'http://localhost:8081')
        .set('Access-Control-Request-Method', 'DELETE')
        .expect(204);
      expect(res.headers['access-control-allow-methods']).toContain('DELETE');
      expect(res.headers['access-control-allow-origin']).toBe(
        'http://localhost:8081',
      );
    });

    it('responde en la raíz y envía cabeceras de seguridad', async () => {
      const res = await http().get('/').expect(200, { status: 'ok' });
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-powered-by']).toBeUndefined();
    });

    it.each([
      ['post', '/marcaje'],
      ['post', '/marcaje/admin'],
      ['get', '/marcaje/admin'],
      ['patch', '/marcaje/admin/1'],
      ['post', '/marcaje/date/1'],
      ['get', '/marcaje/user/week/1'],
      ['post', '/marcaje/user/today/1'],
      ['get', '/marcaje/user/1'],
      ['get', '/marcaje/obtain/1'],
      ['get', '/statistics/daily'],
      ['get', '/statistics/monthly'],
      ['get', '/statistics/yearly'],
    ] as const)('%s %s exige autenticación', async (metodo, ruta) => {
      await http()[metodo](ruta).expect(401);
      await http()
        [metodo](ruta)
        .set('Authorization', 'Bearer inventado')
        .expect(401);
    });

    it('rechaza un token firmado con otro secreto o sin rol', async () => {
      const otro = firmar(
        ana.id,
        'admin',
        'otro-secreto-distinto-de-32-caracteres-xx',
      );
      await http()
        .get('/marcaje/admin')
        .set('Authorization', `Bearer ${otro}`)
        .expect(401);
      const sinRol = jwt.sign({ id: ana.id }, process.env.JWT_SECRET);
      await http()
        .get('/marcaje/user/1')
        .set('Authorization', `Bearer ${sinRol}`)
        .expect(401);
    });

    it('los endpoints sin efecto ya no existen', async () => {
      await http().delete('/marcaje/1').set(auth(admin)).expect(404);
    });
  });

  describe('registro del propio usuario', () => {
    it('la primera marca es la entrada y la identidad sale del token', async () => {
      const res = await http()
        .post('/marcaje')
        .set(auth(ana))
        .send(ubicacion)
        .expect(201);
      expect(res.body).toMatchObject({
        success: true,
        data: {
          id_user: ana.id,
          type: 'entry',
          adminFlag: false,
          latCoordinate: '-33.4489',
        },
      });
    });

    it('un segundo toque inmediato se rechaza y no genera una salida accidental', async () => {
      const res = await http()
        .post('/marcaje')
        .set(auth(ana))
        .send(ubicacion)
        .expect(201);
      expect(res.body).toMatchObject({
        success: false,
        message: expect.stringMatching(/Please wait/),
      });
      const estado = await http()
        .post(`/marcaje/user/today/${ana.id}`)
        .set(auth(ana))
        .send({})
        .expect(201);
      expect(estado.body).toBe(1);
    });

    it('dos solicitudes simultáneas no duplican la entrada', async () => {
      const [a, b] = await Promise.all([
        http().post('/marcaje').set(auth(beto)).send(ubicacion),
        http().post('/marcaje').set(auth(beto)).send(ubicacion),
      ]);
      expect([a.body.success, b.body.success].sort()).toEqual([false, true]);
      const lista = await http()
        .get(`/marcaje/user/${beto.id}`)
        .set(auth(beto))
        .expect(200);
      expect(lista.body).toHaveLength(1);
    });

    it('valida las coordenadas y rechaza campos desconocidos como el token en el cuerpo', async () => {
      await http()
        .post('/marcaje')
        .set(auth(ana))
        .send({ ...ubicacion, latCoordinate: '99' })
        .expect(400);
      await http()
        .post('/marcaje')
        .set(auth(ana))
        .send({ ...ubicacion, token: 'x' })
        .expect(400);
      await http()
        .post('/marcaje')
        .set(auth(ana))
        .send({ ...ubicacion, id_user: 1 })
        .expect(400);
    });
  });

  describe('lectura y propiedad de los datos', () => {
    it('un usuario ve sus marcajes y no los de otro', async () => {
      const propios = await http()
        .get(`/marcaje/user/${ana.id}`)
        .set(auth(ana))
        .expect(200);
      expect(
        propios.body.every((m: { id_user: number }) => m.id_user === ana.id),
      ).toBe(true);
      await http().get(`/marcaje/user/${beto.id}`).set(auth(ana)).expect(403);
      await http()
        .get(`/marcaje/user/week/${beto.id}`)
        .set(auth(ana))
        .expect(403);
      await http()
        .post(`/marcaje/date/${beto.id}`)
        .set(auth(ana))
        .send({ startDate: '01-01-2024', endDate: '31-01-2024' })
        .expect(403);
      await http()
        .post(`/marcaje/user/today/${beto.id}`)
        .set(auth(ana))
        .send({})
        .expect(403);
    });

    it('obtener un marcaje exige ser su dueño o administrador', async () => {
      const [marca] = (
        await http().get(`/marcaje/user/${ana.id}`).set(auth(ana)).expect(200)
      ).body;
      await http()
        .get(`/marcaje/obtain/${marca.id}`)
        .set(auth(ana))
        .expect(200);
      await http()
        .get(`/marcaje/obtain/${marca.id}`)
        .set(auth(beto))
        .expect(403);
      await http()
        .get(`/marcaje/obtain/${marca.id}`)
        .set(auth(admin))
        .expect(200);
      await http().get('/marcaje/obtain/99999999').set(auth(admin)).expect(404);
    });

    it('los identificadores inválidos se rechazan', async () => {
      await http().get('/marcaje/user/abc').set(auth(admin)).expect(400);
      await http().get('/marcaje/user/1?limit=0').set(auth(admin)).expect(400);
    });

    it('un usuario común no accede a las rutas de administración', async () => {
      await http().get('/marcaje/admin').set(auth(ana)).expect(403);
      await http()
        .post('/marcaje/admin')
        .set(auth(ana))
        .send({ idUser: ana.id, date: '01-01-2024 09:00:00' })
        .expect(403);
      await http()
        .patch('/marcaje/admin/1')
        .set(auth(ana))
        .send({ date: '01-01-2024 09:00:00' })
        .expect(403);
    });

    it('el administrador lista todos los marcajes con paginación', async () => {
      const res = await http()
        .get('/marcaje/admin?limit=1')
        .set(auth(admin))
        .expect(200);
      expect(res.body).toHaveLength(1);
    });
  });

  describe('administración de marcajes y zona horaria', () => {
    const usuario = { id: aleatorio(), role: 'user' };

    it('crea la jornada completa con fechas en la zona horaria de Santiago', async () => {
      const entrada = await crear(usuario.id, '11-03-2024 09:00:00').expect(
        201,
      );
      expect(entrada.body).toMatchObject({
        success: true,
        data: { type: 'entry', adminFlag: true, date: '11-03-2024 09:00:00' },
      });
      const salida = await crear(usuario.id, '11-03-2024 17:30:00').expect(201);
      expect(salida.body.data).toMatchObject({
        type: 'exit',
        date: '11-03-2024 17:30:00',
      });
      const completa = await crear(usuario.id, '11-03-2024 18:00:00').expect(
        201,
      );
      expect(completa.body).toEqual({
        success: false,
        message: 'Entry and exit already registered for today',
      });
    });

    it('rechaza fechas inválidas, futuras o con la salida antes de la entrada', async () => {
      await crear(usuario.id, '2024-03-12 09:00:00').expect(400);
      const futura = await crear(usuario.id, '01-01-2099 09:00:00').expect(201);
      expect(futura.body.message).toMatch(/future/);
      await crear(usuario.id, '12-03-2024 10:00:00').expect(201);
      const antes = await crear(usuario.id, '12-03-2024 09:00:00').expect(201);
      expect(antes.body.message).toMatch(/after entry/);
    });

    it('edita un marcaje respetando el orden y el día', async () => {
      const lista = await http()
        .get(`/marcaje/user/${usuario.id}`)
        .set(auth(admin))
        .expect(200);
      const entrada = lista.body.find(
        (m: { date: string; type: string }) => m.date === '11-03-2024 09:00:00',
      );
      const ok = await http()
        .patch(`/marcaje/admin/${entrada.id}`)
        .set(auth(admin))
        .send({ date: '11-03-2024 08:45:00' })
        .expect(200);
      expect(ok.body).toMatchObject({
        success: true,
        data: { date: '11-03-2024 08:45:00', adminFlag: true },
      });
      const despues = await http()
        .patch(`/marcaje/admin/${entrada.id}`)
        .set(auth(admin))
        .send({ date: '11-03-2024 18:00:00' })
        .expect(200);
      expect(despues.body.message).toMatch(/before exit/);
      const otroDia = await http()
        .patch(`/marcaje/admin/${entrada.id}`)
        .set(auth(admin))
        .send({ date: '12-03-2024 08:45:00' })
        .expect(200);
      expect(otroDia.body.message).toMatch(/same day/);
      await http()
        .patch('/marcaje/admin/99999999')
        .set(auth(admin))
        .send({ date: '11-03-2024 08:00:00' })
        .expect(404);
    });

    it('consulta por período incluyendo todo el último día', async () => {
      const res = await http()
        .post(`/marcaje/date/${usuario.id}`)
        .set(auth(usuario))
        .send({ startDate: '11-03-2024', endDate: '11-03-2024' })
        .expect(201);
      expect(res.body.map((m: { date: string }) => m.date)).toEqual([
        '11-03-2024 08:45:00',
        '11-03-2024 17:30:00',
      ]);
      await http()
        .post(`/marcaje/date/${usuario.id}`)
        .set(auth(usuario))
        .send({ startDate: '12-03-2024', endDate: '11-03-2024' })
        .expect(400);
      await http()
        .post(`/marcaje/date/${usuario.id}`)
        .set(auth(usuario))
        .send({ startDate: '01-01-2020', endDate: '01-01-2024' })
        .expect(400);
    });
  });

  describe('estadísticas', () => {
    const trabajador = { id: aleatorio(), role: 'user' };
    const otro = { id: aleatorio(), role: 'user' };

    beforeAll(async () => {
      await crear(trabajador.id, '11-03-2024 09:00:00');
      await crear(trabajador.id, '11-03-2024 17:30:00');
      await crear(trabajador.id, '12-03-2024 22:00:00');
      await crear(trabajador.id, '12-03-2024 23:30:00');
      await crear(trabajador.id, '09-03-2024 10:00:00');
      await crear(trabajador.id, '09-03-2024 14:00:00');
      await crear(otro.id, '11-03-2024 08:00:00');
      await crear(otro.id, '11-03-2024 12:00:00');
    });

    it('calcula las horas por día en hora local, incluso si en UTC cae al día siguiente', async () => {
      const res = await http()
        .get('/statistics/daily')
        .set(auth(trabajador))
        .expect(200);
      expect(
        res.body.map(
          ({
            day,
            dailyHoursWorked,
          }: {
            day: string;
            dailyHoursWorked: number;
          }) => [day, dailyHoursWorked],
        ),
      ).toEqual([
        ['09-03-2024', 4],
        ['11-03-2024', 8.5],
        ['12-03-2024', 1.5],
      ]);
      expect(
        res.body.every((f: { idUser: number }) => f.idUser === trabajador.id),
      ).toBe(true);
    });

    it('el promedio mensual excluye los fines de semana y el anual los incluye', async () => {
      const mensual = await http()
        .get('/statistics/monthly')
        .set(auth(trabajador))
        .expect(200);
      expect(mensual.body).toHaveLength(1);
      expect(mensual.body[0]).toMatchObject({ month: '03-2024' });
      expect(mensual.body[0].average_hours_worked).toBeCloseTo(5, 5);
      const anual = await http()
        .get('/statistics/yearly')
        .set(auth(trabajador))
        .expect(200);
      expect(anual.body[0]).toMatchObject({ year: '2024' });
      expect(anual.body[0].average_hours_worked).toBeCloseTo(14 / 3, 5);
    });

    it('un usuario común solo ve sus propias estadísticas aunque pida las de otro', async () => {
      const res = await http()
        .get(`/statistics/daily?userId=${otro.id}`)
        .set(auth(trabajador))
        .expect(200);
      expect(
        res.body.every((f: { idUser: number }) => f.idUser === trabajador.id),
      ).toBe(true);
    });

    it('el administrador ve a todos o filtra por usuario', async () => {
      const todos = await http()
        .get('/statistics/daily')
        .set(auth(admin))
        .expect(200);
      const ids = new Set(todos.body.map((f: { idUser: number }) => f.idUser));
      expect(ids.has(trabajador.id) && ids.has(otro.id)).toBe(true);
      const uno = await http()
        .get(`/statistics/daily?userId=${otro.id}`)
        .set(auth(admin))
        .expect(200);
      expect(uno.body).toEqual([
        { id: 1, idUser: otro.id, day: '11-03-2024', dailyHoursWorked: 4 },
      ]);
      await http()
        .get('/statistics/daily?userId=abc')
        .set(auth(admin))
        .expect(400);
    });
  });

  describe('validación de la sesión con el servicio de usuarios', () => {
    it('rechaza un token revocado aunque la firma y la vigencia sean correctas', async () => {
      const revocada = { id: aleatorio(), role: 'user' };
      const token = firmar(revocada.id, revocada.role);
      const cabecera = { Authorization: `Bearer ${token}` };
      await http()
        .get(`/marcaje/user/${revocada.id}`)
        .set(cabecera)
        .expect(200);
      revocados.add(token);
      await http()
        .get(`/marcaje/user/${revocada.id}`)
        .set(cabecera)
        .expect(401);
      await http().get('/statistics/daily').set(cabecera).expect(401);
      await http().post('/marcaje').set(cabecera).send(ubicacion).expect(401);
    });

    it('usa el rol vigente del servicio de usuarios y no el que trae el token', async () => {
      const degradado = { id: aleatorio(), role: 'admin' };
      rolesVigentes.set(degradado.id, 'user');
      await http().get('/marcaje/admin').set(auth(degradado)).expect(403);

      const ascendido = { id: aleatorio(), role: 'user' };
      rolesVigentes.set(ascendido.id, 'admin');
      await http().get('/marcaje/admin').set(auth(ascendido)).expect(200);
    });

    it.each(['error', 'caido'] as ModoDeFallo[])(
      'responde 503 cuando el servicio de usuarios falla (%s)',
      async (modo) => {
        modoDeFallo = modo;
        try {
          await http()
            .get(`/marcaje/user/${ana.id}`)
            .set(auth(ana))
            .expect(503);
        } finally {
          modoDeFallo = 'ninguno';
        }
        await http().get(`/marcaje/user/${ana.id}`).set(auth(ana)).expect(200);
      },
    );
  });

  describe('estado de hoy de todos los trabajadores', () => {
    it('exige rol de administrador', async () => {
      await http().get('/marcaje/admin/today').expect(401);
      await http().get('/marcaje/admin/today').set(auth(ana)).expect(403);
    });

    it('el administrador ve quién está trabajando', async () => {
      const res = await http()
        .get('/marcaje/admin/today')
        .set(auth(admin))
        .expect(200);
      const de = (u: { id: number }) =>
        res.body.find((f: { idUser: number }) => f.idUser === u.id);
      expect(de(ana)).toMatchObject({ state: 'working', checkOut: null });
      expect(de(ana).checkIn).toMatch(/^\d{2}-\d{2}-\d{4} \d{2}:\d{2}:\d{2}$/);
      expect(de(beto)).toMatchObject({ state: 'working' });
    });
  });

  describe('resumen de horas', () => {
    const jefe = { id: aleatorio(), role: 'user' };
    const colega = { id: aleatorio(), role: 'user' };
    const periodo = '?from=01-04-2024&to=30-04-2024';

    beforeAll(async () => {
      await crear(jefe.id, '01-04-2024 09:00:00');
      await crear(jefe.id, '01-04-2024 17:00:00');
      await crear(jefe.id, '02-04-2024 09:00:00');
      await crear(jefe.id, '02-04-2024 13:00:00');
      await crear(jefe.id, '03-04-2024 09:00:00');
      await crear(colega.id, '01-04-2024 10:00:00');
      await crear(colega.id, '01-04-2024 12:00:00');
    });

    it('exige autenticación', async () => {
      await http().get('/statistics/summary').expect(401);
    });

    it('un usuario recibe su propio resumen con días incompletos', async () => {
      const res = await http()
        .get(`/statistics/summary${periodo}`)
        .set(auth(jefe))
        .expect(200);
      expect(res.body).toMatchObject({
        from: '2024-04-01',
        to: '2024-04-30',
        daysWorked: 2,
        totalHours: 12,
        averageHoursPerDay: 6,
        incompleteDays: 1,
      });
      expect(res.body.perUser).toEqual([
        {
          idUser: jefe.id,
          daysWorked: 2,
          totalHours: 12,
          averageHoursPerDay: 6,
          incompleteDays: 1,
        },
      ]);
    });

    it('un usuario no puede pedir el resumen de otro', async () => {
      const res = await http()
        .get(`/statistics/summary${periodo}&userId=${colega.id}`)
        .set(auth(jefe))
        .expect(200);
      expect(res.body.perUser.map((u: { idUser: number }) => u.idUser)).toEqual(
        [jefe.id],
      );
    });

    it('el administrador ve a todos o filtra por trabajador', async () => {
      const todos = await http()
        .get(`/statistics/summary${periodo}`)
        .set(auth(admin))
        .expect(200);
      const ids = todos.body.perUser.map((u: { idUser: number }) => u.idUser);
      expect(ids).toEqual(expect.arrayContaining([jefe.id, colega.id]));
      const uno = await http()
        .get(`/statistics/summary${periodo}&userId=${colega.id}`)
        .set(auth(admin))
        .expect(200);
      expect(uno.body).toMatchObject({
        daysWorked: 1,
        totalHours: 2,
        averageHoursPerDay: 2,
      });
    });

    it('sin parámetros usa el mes en curso', async () => {
      const res = await http()
        .get('/statistics/summary')
        .set(auth(jefe))
        .expect(200);
      expect(res.body.from).toMatch(/^\d{4}-\d{2}-01$/);
    });

    it('valida las fechas', async () => {
      await http()
        .get('/statistics/summary?from=2024-04-01')
        .set(auth(admin))
        .expect(400);
      await http()
        .get('/statistics/summary?from=30-04-2024&to=01-04-2024')
        .set(auth(admin))
        .expect(400);
      await http()
        .get('/statistics/summary?from=01-01-2020&to=01-01-2024')
        .set(auth(admin))
        .expect(400);
      await http()
        .get('/statistics/summary?userId=abc')
        .set(auth(admin))
        .expect(400);
    });
  });

  describe('eliminación de marcajes', () => {
    const empleado = { id: aleatorio(), role: 'user' };
    let idMarca: number;

    beforeAll(async () => {
      const res = await crear(empleado.id, '05-03-2024 09:00:00').expect(201);
      idMarca = res.body.data.id;
    });

    it('exige rol de administrador', async () => {
      await http().delete(`/marcaje/admin/${idMarca}`).expect(401);
      await http()
        .delete(`/marcaje/admin/${idMarca}`)
        .set(auth(empleado))
        .expect(403);
    });

    it('valida el identificador', async () => {
      await http().delete('/marcaje/admin/abc').set(auth(admin)).expect(400);
    });

    it('elimina el marcaje y deja de existir', async () => {
      await http()
        .delete(`/marcaje/admin/${idMarca}`)
        .set(auth(admin))
        .expect(200, { success: true });
      await http()
        .get(`/marcaje/obtain/${idMarca}`)
        .set(auth(admin))
        .expect(404);
      await http()
        .delete(`/marcaje/admin/${idMarca}`)
        .set(auth(admin))
        .expect(404);
    });
  });

  describe('eliminación de todos los marcajes de un usuario', () => {
    const exTrabajador = { id: aleatorio(), role: 'user' };

    beforeAll(async () => {
      await crear(exTrabajador.id, '06-03-2024 09:00:00');
      await crear(exTrabajador.id, '06-03-2024 17:00:00');
    });

    it('exige rol de administrador y un identificador válido', async () => {
      await http().delete(`/marcaje/admin/user/${exTrabajador.id}`).expect(401);
      await http()
        .delete(`/marcaje/admin/user/${exTrabajador.id}`)
        .set(auth(exTrabajador))
        .expect(403);
      await http()
        .delete('/marcaje/admin/user/abc')
        .set(auth(admin))
        .expect(400);
    });

    it('elimina los marcajes del usuario y deja los de otros', async () => {
      const antes = await http()
        .get(`/marcaje/user/${exTrabajador.id}`)
        .set(auth(admin))
        .expect(200);
      expect(antes.body).toHaveLength(2);
      await http()
        .delete(`/marcaje/admin/user/${exTrabajador.id}`)
        .set(auth(admin))
        .expect(200, { success: true, deleted: 2 });
      const despues = await http()
        .get(`/marcaje/user/${exTrabajador.id}`)
        .set(auth(admin))
        .expect(200);
      expect(despues.body).toEqual([]);
      await http()
        .delete(`/marcaje/admin/user/${exTrabajador.id}`)
        .set(auth(admin))
        .expect(200, { success: true, deleted: 0 });
      const deAna = await http()
        .get(`/marcaje/user/${ana.id}`)
        .set(auth(admin))
        .expect(200);
      expect(deAna.body.length).toBeGreaterThan(0);
    });
  });

  describe('límite de solicitudes', () => {
    it('responde 429 al superar el límite', async () => {
      process.env.PROBAR_LIMITES = '1';
      try {
        const estados: number[] = [];
        for (let i = 0; i < 70; i++) {
          estados.push((await http().get('/health')).status);
        }
        expect(estados).toContain(429);
      } finally {
        delete process.env.PROBAR_LIMITES;
      }
    });
  });
});
