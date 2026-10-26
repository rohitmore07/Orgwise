import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString } from 'class-validator';

/** Query params for comparing two time periods. Dates are ISO-8601 (YYYY-MM-DD). */
export class QueryPeriodCompareDto {
  @ApiProperty({
    description: 'Start of current period (YYYY-MM-DD)',
    example: '2026-07-01',
  })
  @IsDateString()
  currentStart!: string;

  @ApiProperty({
    description: 'End of current period (YYYY-MM-DD)',
    example: '2026-08-27',
  })
  @IsDateString()
  currentEnd!: string;

  @ApiPropertyOptional({
    description:
      'Start of previous period (YYYY-MM-DD). Defaults to equal-length window before currentStart.',
    example: '2026-04-01',
  })
  @IsOptional()
  @IsDateString()
  previousStart?: string;

  @ApiPropertyOptional({
    description: 'End of previous period (YYYY-MM-DD). Defaults to currentStart - 1 day.',
    example: '2026-06-30',
  })
  @IsOptional()
  @IsDateString()
  previousEnd?: string;

  @ApiPropertyOptional({
    description: 'Optional department scope',
  })
  @IsOptional()
  @IsString()
  departmentId?: string;
}
