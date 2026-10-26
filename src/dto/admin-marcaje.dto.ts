import * as validator from 'class-validator';

export const FECHA_HORA = /^\d{2}-\d{2}-\d{4} \d{2}:\d{2}:\d{2}$/;
export const FECHA = /^\d{2}-\d{2}-\d{4}$/;

export class AdminMarcajeDto {
  @validator.IsInt()
  @validator.IsPositive()
  idUser: number;

  @validator.IsString()
  @validator.Matches(FECHA_HORA, {
    message: 'Date must be in the format DD-MM-YYYY HH:mm:ss',
  })
  date: string;
}
