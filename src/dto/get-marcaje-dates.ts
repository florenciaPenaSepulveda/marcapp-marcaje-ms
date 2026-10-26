import * as validator from 'class-validator';
import { FECHA } from './admin-marcaje.dto';

export class PeriodDto {
  @validator.IsString()
  @validator.Matches(FECHA, {
    message: 'Start Date must be in the format DD-MM-YYYY',
  })
  startDate: string;

  @validator.IsString()
  @validator.Matches(FECHA, {
    message: 'End Date must be in the format DD-MM-YYYY',
  })
  endDate: string;
}

export class TodayDto {
  @validator.IsOptional()
  @validator.IsString()
  startDate?: string;

  @validator.IsOptional()
  @validator.IsString()
  endDate?: string;
}
