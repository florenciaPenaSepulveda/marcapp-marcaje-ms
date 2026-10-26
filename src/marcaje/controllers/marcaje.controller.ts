import * as nestCommon from '@nestjs/common';
import { MarcajeService } from '../services/marcaje.service';
import { CreateMarcajeDto } from '../../dto/create-marcaje.dto';
import { UpdateMarcajeDto } from '../../dto/update-marcaje.dto';
import { PeriodDto } from '../../dto/get-marcaje-dates';
import { AdminMarcajeDto } from 'src/dto/admin-marcaje.dto';

@nestCommon.Controller('marcaje')
export class MarcajeController {
  constructor(private readonly marcajeService: MarcajeService) {}

  @nestCommon.Post()
  @nestCommon.UsePipes(new nestCommon.ValidationPipe())
  async create(@nestCommon.Body() createMarcaje: CreateMarcajeDto) {
    console.log('Controller');

    const { token } = createMarcaje;
    const { latCoordinate } = createMarcaje;
    const { longCoordinate } = createMarcaje;
    const response = await this.marcajeService.createMarcaje(
      token,
      latCoordinate,
      longCoordinate,
    );

    if (response?.success) {
      console.log('Respuesta: ', response.data);
      return { success: true, data: response.data };
    } else {
      return { success: false, message: response.message };
    }
  }

  @nestCommon.Post('/admin')
  @nestCommon.UsePipes(new nestCommon.ValidationPipe())
  async marcajeAdmin(@nestCommon.Body() adminMarcajeDto: AdminMarcajeDto) {
    const { token } = adminMarcajeDto;
    const { idUser } = adminMarcajeDto;
    const { date } = adminMarcajeDto;
    return this.marcajeService.adminCreate(token, idUser, date);
  }

  @nestCommon.Get('/admin')
  async findAll() {
    return this.marcajeService.findAll();
  }

  @nestCommon.Post('/date/:id')
  @nestCommon.UsePipes(new nestCommon.ValidationPipe())
  async findByDate(
    @nestCommon.Param('id') id: number,
    @nestCommon.Body() periodDto: PeriodDto,
  ) {
    const { startDate, endDate } = periodDto;
    return await this.marcajeService.getByPeriod(id, startDate, endDate);
  }

  @nestCommon.Get('/user/week/:id')
  async obtainWeekStart(@nestCommon.Param('id') id: number) {
    return await this.marcajeService.getWeekStart(id);
  }

  @nestCommon.Post('/user/today/:id')
  @nestCommon.UsePipes(new nestCommon.ValidationPipe())
  existTimeRegistration(
    @nestCommon.Param('id') id: number,
    @nestCommon.Body() period: PeriodDto,
  ) {
    console.log(period);
    return this.marcajeService.findFromTodayType(id, period);
  }

  @nestCommon.Get('/user/:id')
  findFromUser(@nestCommon.Param('id') id: number) {
    return this.marcajeService.findAllFromUser(+id);
  }

  @nestCommon.Patch('/admin/:id')
  @nestCommon.UsePipes(new nestCommon.ValidationPipe())
  update(
    @nestCommon.Param('id') id: number,
    @nestCommon.Body() updateMarcaje: UpdateMarcajeDto,
  ) {
    const { date } = updateMarcaje;
    return this.marcajeService.update(id, date);
  }

  @nestCommon.Delete(':id')
  remove(@nestCommon.Param('id') id: string) {
    return this.marcajeService.remove(+id);
  }

  @nestCommon.Get('/obtain/:id')
  obtainOne(@nestCommon.Param('id') id: string) {
    return this.marcajeService.obtainOne(+id);
  }
}
