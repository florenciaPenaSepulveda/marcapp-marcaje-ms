import * as validator from 'class-validator';
import { FECHA_HORA } from './admin-marcaje.dto';

export class UpdateMarcajeDto {
  @validator.IsString()
  @validator.Matches(FECHA_HORA, {
    message: 'Date must be in the format DD-MM-YYYY HH:mm:ss',
  })
  date: string;
}
