import * as validator from 'class-validator';

export class CreateMarcajeDto {
  @validator.IsString()
  token: string;

  @validator.IsString()
  latCoordinate?: string;

  @validator.IsString()
  longCoordinate?: string;
}
