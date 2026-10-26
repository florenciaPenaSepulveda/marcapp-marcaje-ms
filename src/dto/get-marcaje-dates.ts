import * as validator from 'class-validator';

export class PeriodDto {
  @validator.IsString()
  @validator.Matches(/^\d{2}-\d{2}-\d{4}$/, {
    message: 'Start Date must be in the format DD-MM-YYYY',
  })
  startDate: string;

  @validator.IsString()
  @validator.Matches(/^\d{2}-\d{2}-\d{4}$/, {
    message: 'End Date must be in the format DD-MM-YYYY ',
  })
  endDate: string;
}
