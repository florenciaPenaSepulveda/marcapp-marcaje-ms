import * as validator from 'class-validator';

export class UpdateMarcajeDto {
  @validator.IsString()
  @validator.Matches(/^\d{2}-\d{2}-\d{4} \d{2}:\d{2}:\d{2}$/, {
    message: 'Date must be in the format DD-MM-YYYY hh:mm:ss',
  })
  date: string;
}
