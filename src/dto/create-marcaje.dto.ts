import * as validator from 'class-validator';

export class CreateMarcajeDto {
  @validator.IsString()
  @validator.IsLatitude()
  latCoordinate: string;

  @validator.IsString()
  @validator.IsLongitude()
  longCoordinate: string;

  @validator.IsOptional()
  @validator.IsISO8601({ strict: true, strictSeparator: true })
  recordedAt?: string;

  @validator.IsOptional()
  @validator.IsUUID('4')
  clientId?: string;
}
