import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { MarcajeService } from './marcaje.service';
import { AuthGuard, Sesion } from '../auth/auth.guard';
import {
  autorizarAcceso,
  esAdmin,
  Roles,
  RolesGuard,
  ROL_ADMIN,
} from '../auth/roles';
import { CreateMarcajeDto } from '../dto/create-marcaje.dto';
import { AdminMarcajeDto } from '../dto/admin-marcaje.dto';
import { UpdateMarcajeDto } from '../dto/update-marcaje.dto';
import { PeriodDto, TodayDto } from '../dto/get-marcaje-dates';
import { PageQueryDto } from '../dto/statistics-query.dto';

@UseGuards(AuthGuard, RolesGuard)
@Controller('marcaje')
export class MarcajeController {
  constructor(private readonly marcajeService: MarcajeService) {}

  @Post()
  create(@Request() req: { user: Sesion }, @Body() dto: CreateMarcajeDto) {
    return this.marcajeService.registrar(
      req.user.id,
      dto.latCoordinate,
      dto.longCoordinate,
      { recordedAt: dto.recordedAt, clientId: dto.clientId },
    );
  }

  @Roles(ROL_ADMIN)
  @Post('/admin')
  marcajeAdmin(@Body() dto: AdminMarcajeDto) {
    return this.marcajeService.registrarComoAdmin(dto.idUser, dto.date);
  }

  @Roles(ROL_ADMIN)
  @Get('/admin/today')
  todayStatus() {
    return this.marcajeService.estadoDeHoyDeTodos();
  }

  @Roles(ROL_ADMIN)
  @Get('/admin')
  findAll(@Query() { limit, offset }: PageQueryDto) {
    return this.marcajeService.todas(limit, offset);
  }

  @Roles(ROL_ADMIN)
  @Patch('/admin/:id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateMarcajeDto) {
    return this.marcajeService.actualizar(id, dto.date);
  }

  @Roles(ROL_ADMIN)
  @Delete('/admin/user/:userId')
  removeAllFromUser(@Param('userId', ParseIntPipe) userId: number) {
    return this.marcajeService.eliminarDeUsuario(userId);
  }

  @Roles(ROL_ADMIN)
  @Delete('/admin/:id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.marcajeService.eliminar(id);
  }

  @Post('/date/:id')
  findByDate(
    @Request() req: { user: Sesion },
    @Param('id', ParseIntPipe) id: number,
    @Body() { startDate, endDate }: PeriodDto,
  ) {
    autorizarAcceso(req.user, id);
    return this.marcajeService.porPeriodo(id, startDate, endDate);
  }

  @Get('/user/week/:id')
  obtainWeekStart(
    @Request() req: { user: Sesion },
    @Param('id', ParseIntPipe) id: number,
  ) {
    autorizarAcceso(req.user, id);
    return this.marcajeService.semanaActual(id);
  }

  @Header('Content-Type', 'application/json')
  @Post('/user/today/:id')
  existTimeRegistration(
    @Request() req: { user: Sesion },
    @Param('id', ParseIntPipe) id: number,
    @Body() _hoy: TodayDto,
  ) {
    autorizarAcceso(req.user, id);
    return this.marcajeService.estadoDelDia(id);
  }

  @Get('/user/:id')
  findFromUser(
    @Request() req: { user: Sesion },
    @Param('id', ParseIntPipe) id: number,
    @Query() { limit, offset }: PageQueryDto,
  ) {
    autorizarAcceso(req.user, id);
    return this.marcajeService.deUsuario(id, limit, offset);
  }

  @Get('/obtain/:id')
  async obtainOne(
    @Request() req: { user: Sesion },
    @Param('id', ParseIntPipe) id: number,
  ) {
    const marca = await this.marcajeService.obtener(id);
    if (!esAdmin(req.user)) {
      autorizarAcceso(req.user, marca.id_user);
    }
    return this.marcajeService.formatear(marca);
  }
}
