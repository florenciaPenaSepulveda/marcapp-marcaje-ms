import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, DataSource, Repository } from 'typeorm';
import { Marcaje } from '../entities/marcaje.entity';
import { MarcajeType } from '../enum/marcaje-type.enum';
import { Env } from '../config/env';
import {
  analizarFecha,
  analizarFechaHora,
  formatearFechaHora,
  mismoDia,
  rangoDeLaSemana,
  rangoDelDia,
} from '../common/fechas';

export type Resultado<T> =
  | { success: true; data: T }
  | { success: false; message: string };

export type MarcajeFormateado = ReturnType<MarcajeService['formatear']>;

const LIMITE_POR_DEFECTO = 200;
const DIAS_MAXIMOS_POR_CONSULTA = 366;
export const ESPERA_MINIMA_SEGUNDOS = 30;

@Injectable()
export class MarcajeService {
  private readonly zona: string;

  constructor(
    @InjectRepository(Marcaje) private marcajeRepository: Repository<Marcaje>,
    private dataSource: DataSource,
    config: ConfigService<Env, true>,
  ) {
    this.zona = config.get('TIMEZONE', { infer: true });
  }

  formatear(marca: Marcaje) {
    return {
      id: marca.id,
      id_user: marca.id_user,
      date: formatearFechaHora(marca.date, this.zona),
      type: marca.type,
      adminFlag: marca.adminFlag,
      latCoordinate: marca.latCoordinate,
      longCoordinate: marca.longCoordinate,
    };
  }

  registrar(
    idUser: number,
    latCoordinate: string,
    longCoordinate: string,
  ): Promise<Resultado<MarcajeFormateado>> {
    return this.crearMarca(idUser, new Date(), {
      latCoordinate,
      longCoordinate,
      adminFlag: false,
      esperaMinima: ESPERA_MINIMA_SEGUNDOS,
    });
  }

  async registrarComoAdmin(
    idUser: number,
    fechaTexto: string,
  ): Promise<Resultado<MarcajeFormateado>> {
    const fecha = analizarFechaHora(fechaTexto, this.zona);
    if (!fecha) {
      return {
        success: false,
        message: `Invalid date ${fechaTexto}, the format must be DD-MM-YYYY HH:mm:ss`,
      };
    }
    if (fecha.isAfter()) {
      return { success: false, message: 'The date cannot be in the future' };
    }
    return this.crearMarca(idUser, fecha.toDate(), {
      latCoordinate: '0',
      longCoordinate: '0',
      adminFlag: true,
      esperaMinima: 0,
    });
  }

  private crearMarca(
    idUser: number,
    fecha: Date,
    datos: Pick<Marcaje, 'latCoordinate' | 'longCoordinate' | 'adminFlag'> & {
      esperaMinima: number;
    },
  ): Promise<Resultado<MarcajeFormateado>> {
    return this.dataSource.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock($1)', [idUser]);
      const repositorio = manager.getRepository(Marcaje);
      const { inicio, fin } = rangoDelDia(fecha, this.zona);
      const delDia = await repositorio.find({
        where: { id_user: idUser, date: Between(inicio, fin) },
      });
      const entrada = delDia.find((m) => m.type === MarcajeType.ENTRY);
      const salida = delDia.find((m) => m.type === MarcajeType.EXIT);

      if (entrada && salida) {
        return {
          success: false,
          message: 'Entry and exit already registered for today',
        } as const;
      }
      if (entrada && fecha <= entrada.date) {
        return {
          success: false,
          message: 'Exit time must be after entry time',
        } as const;
      }
      if (
        entrada &&
        fecha.getTime() - entrada.date.getTime() < datos.esperaMinima * 1000
      ) {
        return {
          success: false,
          message: 'Please wait a few seconds before registering again',
        } as const;
      }
      const { esperaMinima: _omitida, ...campos } = datos;
      const guardada = await repositorio.save(
        repositorio.create({
          id_user: idUser,
          date: fecha,
          type: entrada ? MarcajeType.EXIT : MarcajeType.ENTRY,
          ...campos,
        }),
      );
      return { success: true, data: this.formatear(guardada) } as const;
    });
  }

  async actualizar(
    id: number,
    fechaTexto: string,
  ): Promise<Resultado<MarcajeFormateado>> {
    const marca = await this.marcajeRepository.findOne({ where: { id } });
    if (!marca) {
      throw new NotFoundException('Time registration not found');
    }
    const nueva = analizarFechaHora(fechaTexto, this.zona);
    if (!nueva) {
      return {
        success: false,
        message: `Invalid date ${fechaTexto}, the format must be DD-MM-YYYY HH:mm:ss`,
      };
    }
    const fecha = nueva.toDate();
    if (nueva.isAfter()) {
      return { success: false, message: 'The date cannot be in the future' };
    }
    if (!mismoDia(fecha, marca.date, this.zona)) {
      return {
        success: false,
        message: 'The time registration must stay on the same day',
      };
    }

    const { inicio, fin } = rangoDelDia(marca.date, this.zona);
    const delDia = await this.marcajeRepository.find({
      where: { id_user: marca.id_user, date: Between(inicio, fin) },
    });
    const otra = delDia.find((m) => m.type !== marca.type);
    if (otra) {
      if (marca.type === MarcajeType.ENTRY && fecha >= otra.date) {
        return {
          success: false,
          message: 'Entry time must be before exit time',
        };
      }
      if (marca.type === MarcajeType.EXIT && fecha <= otra.date) {
        return {
          success: false,
          message: 'Exit time must be after entry time',
        };
      }
    }

    marca.date = fecha;
    marca.adminFlag = true;
    return {
      success: true,
      data: this.formatear(await this.marcajeRepository.save(marca)),
    };
  }

  async obtener(id: number): Promise<Marcaje> {
    const marca = await this.marcajeRepository.findOne({ where: { id } });
    if (!marca) {
      throw new NotFoundException('Time registration not found');
    }
    return marca;
  }

  async todas(limit = LIMITE_POR_DEFECTO, offset = 0) {
    const marcas = await this.marcajeRepository.find({
      order: { date: 'ASC' },
      take: limit,
      skip: offset,
    });
    return marcas.map((m) => this.formatear(m));
  }

  async deUsuario(idUser: number, limit = LIMITE_POR_DEFECTO, offset = 0) {
    const marcas = await this.marcajeRepository.find({
      where: { id_user: idUser },
      order: { date: 'DESC' },
      take: limit,
      skip: offset,
    });
    return marcas.map((m) => this.formatear(m));
  }

  async porPeriodo(idUser: number, desde: string, hasta: string) {
    const inicio = analizarFecha(desde, this.zona);
    const fin = analizarFecha(hasta, this.zona);
    if (!inicio || !fin) {
      throw new BadRequestException('Dates must use the format DD-MM-YYYY');
    }
    if (fin.isBefore(inicio)) {
      throw new BadRequestException(
        'The end date must not be before the start date',
      );
    }
    if (fin.diff(inicio, 'days') > DIAS_MAXIMOS_POR_CONSULTA) {
      throw new BadRequestException(
        `The period cannot exceed ${DIAS_MAXIMOS_POR_CONSULTA} days`,
      );
    }
    const marcas = await this.marcajeRepository.find({
      where: {
        id_user: idUser,
        date: Between(inicio.toDate(), fin.clone().endOf('day').toDate()),
      },
      order: { date: 'ASC' },
    });
    return marcas.map((m) => this.formatear(m));
  }

  async semanaActual(idUser: number) {
    const { inicio, fin } = rangoDeLaSemana(new Date(), this.zona);
    const marcas = await this.marcajeRepository.find({
      where: { id_user: idUser, date: Between(inicio, fin) },
      order: { date: 'DESC' },
    });
    return marcas.map((m) => this.formatear(m));
  }

  async estadoDelDia(idUser: number): Promise<0 | 1 | 2> {
    const { inicio, fin } = rangoDelDia(new Date(), this.zona);
    const delDia = await this.marcajeRepository.find({
      where: { id_user: idUser, date: Between(inicio, fin) },
    });
    if (delDia.some((m) => m.type === MarcajeType.EXIT)) {
      return 2;
    }
    return delDia.some((m) => m.type === MarcajeType.ENTRY) ? 1 : 0;
  }

  async estadoDeHoyDeTodos() {
    const { inicio, fin } = rangoDelDia(new Date(), this.zona);
    const marcas = await this.marcajeRepository.find({
      where: { date: Between(inicio, fin) },
      order: { date: 'ASC' },
    });
    const porUsuario = new Map<
      number,
      { checkIn: string | null; checkOut: string | null }
    >();
    marcas.forEach((marca) => {
      const jornada = porUsuario.get(marca.id_user) ?? {
        checkIn: null,
        checkOut: null,
      };
      const fecha = formatearFechaHora(marca.date, this.zona);
      if (marca.type === MarcajeType.ENTRY) {
        jornada.checkIn = fecha;
      } else {
        jornada.checkOut = fecha;
      }
      porUsuario.set(marca.id_user, jornada);
    });
    return [...porUsuario.entries()]
      .map(([idUser, jornada]) => ({
        idUser,
        state: jornada.checkOut ? ('done' as const) : ('working' as const),
        ...jornada,
      }))
      .sort((a, b) => a.idUser - b.idUser);
  }

  async eliminarDeUsuario(
    idUser: number,
  ): Promise<{ success: true; deleted: number }> {
    const { affected } = await this.marcajeRepository.delete({
      id_user: idUser,
    });
    return { success: true, deleted: affected ?? 0 };
  }

  async eliminar(id: number): Promise<{ success: true }> {
    const marca = await this.obtener(id);
    await this.marcajeRepository.remove(marca);
    return { success: true };
  }
}
