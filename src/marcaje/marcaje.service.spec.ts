import { BadRequestException, NotFoundException } from '@nestjs/common';
import * as moment from 'moment-timezone';
import { ESPERA_MINIMA_SEGUNDOS, MarcajeService } from './marcaje.service';
import { Marcaje } from '../entities/marcaje.entity';
import { MarcajeType } from '../enum/marcaje-type.enum';

const ZONA = 'America/Santiago';
const hace = (minutos: number) => new Date(Date.now() - minutos * 60000);
const texto = (fecha: Date) =>
  moment.tz(fecha, ZONA).format('DD-MM-YYYY HH:mm:ss');
const marca = (datos: Partial<Marcaje>): Marcaje =>
  ({
    id: 1,
    id_user: 7,
    date: hace(0),
    type: MarcajeType.ENTRY,
    adminFlag: false,
    latCoordinate: '1',
    longCoordinate: '2',
    ...datos,
  }) as Marcaje;

describe('MarcajeService', () => {
  let repo: {
    find: jest.Mock;
    findOne: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
  };
  let manager: { query: jest.Mock; getRepository: jest.Mock };
  let servicio: MarcajeService;

  beforeEach(() => {
    repo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
      save: jest.fn(async (m) => ({ id: 99, ...m })),
      create: jest.fn((m) => m),
    };
    manager = { query: jest.fn(), getRepository: jest.fn(() => repo) };
    const dataSource = { transaction: jest.fn((fn) => fn(manager)) };
    servicio = new MarcajeService(
      repo as never,
      dataSource as never,
      {
        get: () => ZONA,
      } as never,
    );
  });

  describe('registrar', () => {
    it('crea la entrada si no hay marcajes en el día y bloquea al usuario durante la transacción', async () => {
      const res = await servicio.registrar(7, '-33.4', '-70.6');
      expect(res).toMatchObject({
        success: true,
        data: { type: 'entry', adminFlag: false },
      });
      expect(manager.query).toHaveBeenCalledWith(
        expect.stringContaining('pg_advisory_xact_lock'),
        [7],
      );
    });

    it('crea la salida cuando ya hay una entrada anterior', async () => {
      repo.find.mockResolvedValue([marca({ date: hace(60) })]);
      const res = await servicio.registrar(7, '-33.4', '-70.6');
      expect(res).toMatchObject({ success: true, data: { type: 'exit' } });
    });

    it('guarda solo los campos del marcaje y no los de control', async () => {
      await servicio.registrar(7, '-33.4', '-70.6');
      expect(repo.create.mock.calls[0][0]).not.toHaveProperty('esperaMinima');
      expect(repo.create.mock.calls[0][0]).toMatchObject({
        id_user: 7,
        latCoordinate: '-33.4',
        longCoordinate: '-70.6',
      });
    });

    it('rechaza un nuevo registro cuando la jornada ya está completa', async () => {
      repo.find.mockResolvedValue([
        marca({ date: hace(120) }),
        marca({ id: 2, type: MarcajeType.EXIT, date: hace(60) }),
      ]);
      const res = await servicio.registrar(7, '1', '2');
      expect(res).toEqual({
        success: false,
        message: 'Ya se registró marcaje de entrada y salida',
      });
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('evita el doble toque: exige una espera mínima desde la entrada', async () => {
      repo.find.mockResolvedValue([
        marca({
          date: new Date(Date.now() - (ESPERA_MINIMA_SEGUNDOS - 5) * 1000),
        }),
      ]);
      const res = await servicio.registrar(7, '1', '2');
      expect(res).toMatchObject({
        success: false,
        message: expect.stringMatching(/Espera/),
      });
      expect(repo.save).not.toHaveBeenCalled();
    });
  });

  describe('registrarComoAdmin', () => {
    it('rechaza fechas con formato inválido o futuras', async () => {
      expect(await servicio.registrarComoAdmin(7, '2024-03-11')).toMatchObject({
        success: false,
        message: expect.stringMatching(/no es válida/),
      });
      const futura = texto(new Date(Date.now() + 86400000));
      expect(await servicio.registrarComoAdmin(7, futura)).toEqual({
        success: false,
        message: 'La fecha no puede ser futura',
      });
    });

    it('crea marcajes marcados como administrativos y sin espera mínima', async () => {
      repo.find.mockResolvedValue([marca({ date: hace(61) })]);
      const res = await servicio.registrarComoAdmin(7, texto(hace(60)));
      expect(res).toMatchObject({
        success: true,
        data: { type: 'exit', adminFlag: true, latCoordinate: '0' },
      });
    });

    it('la salida debe ser posterior a la entrada', async () => {
      repo.find.mockResolvedValue([marca({ date: hace(30) })]);
      const res = await servicio.registrarComoAdmin(7, texto(hace(60)));
      expect(res).toEqual({
        success: false,
        message: 'La salida debe ser posterior a la entrada',
      });
    });
  });

  describe('actualizar', () => {
    const entrada = marca({
      id: 5,
      date: moment.tz('2024-03-11 09:00', ZONA).toDate(),
    });
    const salida = marca({
      id: 6,
      type: MarcajeType.EXIT,
      date: moment.tz('2024-03-11 17:00', ZONA).toDate(),
    });

    it('falla si el marcaje no existe', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(
        servicio.actualizar(5, '11-03-2024 09:30:00'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('valida el formato y que no sea futura', async () => {
      repo.findOne.mockResolvedValue({ ...entrada });
      expect(await servicio.actualizar(5, 'mal')).toMatchObject({
        success: false,
      });
      expect(
        await servicio.actualizar(5, texto(new Date(Date.now() + 86400000))),
      ).toEqual({
        success: false,
        message: 'La fecha no puede ser futura',
      });
    });

    it('no permite mover el marcaje a otro día', async () => {
      repo.findOne.mockResolvedValue({ ...entrada });
      expect(await servicio.actualizar(5, '12-03-2024 09:00:00')).toEqual({
        success: false,
        message: 'El marcaje debe seguir en el mismo día',
      });
    });

    it('mantiene la entrada antes de la salida y la salida después de la entrada', async () => {
      repo.findOne.mockResolvedValue({ ...entrada });
      repo.find.mockResolvedValue([entrada, salida]);
      expect(await servicio.actualizar(5, '11-03-2024 18:00:00')).toMatchObject(
        {
          success: false,
          message: 'La entrada debe ser anterior a la salida',
        },
      );
      repo.findOne.mockResolvedValue({ ...salida });
      expect(await servicio.actualizar(6, '11-03-2024 08:00:00')).toMatchObject(
        {
          success: false,
          message: 'La salida debe ser posterior a la entrada',
        },
      );
    });

    it('actualiza la fecha y deja constancia de la edición administrativa', async () => {
      repo.findOne.mockResolvedValue({ ...entrada });
      repo.find.mockResolvedValue([entrada, salida]);
      const res = await servicio.actualizar(5, '11-03-2024 09:30:00');
      expect(res).toMatchObject({
        success: true,
        data: { date: '11-03-2024 09:30:00', adminFlag: true },
      });
    });

    it('permite editar cuando no existe la otra marca del día', async () => {
      repo.findOne.mockResolvedValue({ ...entrada });
      repo.find.mockResolvedValue([entrada]);
      expect(await servicio.actualizar(5, '11-03-2024 10:00:00')).toMatchObject(
        { success: true },
      );
    });
  });

  describe('consultas', () => {
    it('obtener falla si no existe', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(servicio.obtener(1)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      repo.findOne.mockResolvedValue(marca({}));
      await expect(servicio.obtener(1)).resolves.toMatchObject({ id: 1 });
    });

    it('lista con límite y desplazamiento por defecto', async () => {
      await servicio.todas();
      expect(repo.find).toHaveBeenLastCalledWith(
        expect.objectContaining({ take: 200, skip: 0 }),
      );
      await servicio.deUsuario(7, 10, 20);
      expect(repo.find).toHaveBeenLastCalledWith(
        expect.objectContaining({ where: { id_user: 7 }, take: 10, skip: 20 }),
      );
    });

    it('formatea las fechas en la zona horaria configurada', async () => {
      repo.find.mockResolvedValue([
        marca({ date: new Date('2024-03-12T02:30:00Z') }),
      ]);
      const [primero] = await servicio.todas();
      expect(primero.date).toBe('11-03-2024 23:30:00');
    });

    describe('porPeriodo', () => {
      it('valida formato, orden y duración máxima', async () => {
        await expect(
          servicio.porPeriodo(7, 'x', '01-03-2024'),
        ).rejects.toBeInstanceOf(BadRequestException);
        await expect(
          servicio.porPeriodo(7, '05-03-2024', '01-03-2024'),
        ).rejects.toBeInstanceOf(BadRequestException);
        await expect(
          servicio.porPeriodo(7, '01-01-2020', '01-01-2024'),
        ).rejects.toThrow(/no puede superar/);
      });

      it('incluye todo el último día del período', async () => {
        await servicio.porPeriodo(7, '01-03-2024', '07-03-2024');
        const { date } = repo.find.mock.calls[0][0].where;
        const [desde, hasta] = date.value;
        expect(moment.tz(desde, ZONA).format('DD-MM-YYYY HH:mm:ss')).toBe(
          '01-03-2024 00:00:00',
        );
        expect(moment.tz(hasta, ZONA).format('DD-MM-YYYY HH:mm:ss')).toBe(
          '07-03-2024 23:59:59',
        );
      });
    });

    it('consulta la semana actual', async () => {
      await servicio.semanaActual(7);
      expect(repo.find).toHaveBeenCalledWith(
        expect.objectContaining({ order: { date: 'DESC' } }),
      );
    });

    it.each([
      [[], 0],
      [[marca({})], 1],
      [[marca({}), marca({ type: MarcajeType.EXIT })], 2],
    ])('estado del día con %j marcajes', async (marcas, esperado) => {
      repo.find.mockResolvedValue(marcas);
      expect(await servicio.estadoDelDia(7)).toBe(esperado);
    });
  });
});
