import * as validator from 'class-validator';

export class CreateMarcajeDto {
  @validator.IsString()
  @validator.IsLatitude()
  latCoordinate: string;

  @validator.IsString()
  @validator.IsLongitude()
  longCoordinate: string;
}
