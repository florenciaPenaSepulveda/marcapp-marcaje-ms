import { Type } from 'class-transformer';
import * as validator from 'class-validator';

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
