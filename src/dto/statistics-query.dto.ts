import { Type } from 'class-transformer';
import * as validator from 'class-validator';
import { FECHA } from './admin-marcaje.dto';

export class StatisticsQueryDto {
  @validator.IsOptional()
  @Type(() => Number)
  @validator.IsInt()
  @validator.IsPositive()
  userId?: number;
}

export class PageQueryDto {
  @validator.IsOptional()
  @Type(() => Number)
  @validator.IsInt()
  @validator.Min(1)
  @validator.Max(1000)
  limit?: number;

  @validator.IsOptional()
  @Type(() => Number)
  @validator.IsInt()
  @validator.Min(0)
  offset?: number;
}

export class SummaryQueryDto extends StatisticsQueryDto {
  @validator.IsOptional()
  @validator.Matches(FECHA, { message: 'from must use the format DD-MM-YYYY' })
  from?: string;

  @validator.IsOptional()
  @validator.Matches(FECHA, { message: 'to must use the format DD-MM-YYYY' })
  to?: string;
}
