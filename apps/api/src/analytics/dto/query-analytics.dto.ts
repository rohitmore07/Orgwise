import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import type { AgeGroup, EmployeeStatus, Gender, TenureGroup } from '@orgwise/types';
// Global analytics filters — one coherent filter state that slices every dashboard section server-side. The…
// same DTO drives the overview endpoint; every filter is intersected with the caller's RBAC scope.
export class QueryAnalyticsDto {
  @ApiPropertyOptional({ description: 'Restrict to one department (scope-aware)' })
  @IsOptional()
  @IsString()
  departmentId?: string;

  @ApiPropertyOptional({ description: 'Restrict to one team' })
  @IsOptional()
  @IsString()
  teamId?: string;

  @ApiPropertyOptional({
    enum: ['active', 'on_leave', 'probation', 'terminated'],
    description: 'Restrict to one employment status',
  })
  @IsOptional()
  @IsEnum(['active', 'on_leave', 'probation', 'terminated'] as const)
  status?: EmployeeStatus;

  @ApiPropertyOptional({
    enum: ['female', 'male', 'non_binary', 'prefer_not_to_say'],
    description: 'Restrict to one gender',
  })
  @IsOptional()
  @IsEnum(['female', 'male', 'non_binary', 'prefer_not_to_say'] as const)
  gender?: Gender;

  @ApiPropertyOptional({ description: 'Restrict to one job title' })
  @IsOptional()
  @IsString()
  jobTitle?: string;

  @ApiPropertyOptional({ description: 'Restrict to overtime / non-overtime employees' })
  @IsOptional()
  // Tolerant parse: true/1/yes mean true; anything else (false/0/no) means
  // false — a naive `value === 'true'` would silently flip unknown spellings.
  @Transform(({ value }) => value === true || value === 'true' || value === '1' || value === 'yes')
  @IsBoolean()
  overTime?: boolean;

  @ApiPropertyOptional({ description: 'Restrict to attrition / non-attrition records' })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1' || value === 'yes')
  @IsBoolean()
  attrition?: boolean;

  @ApiPropertyOptional({ description: 'Restrict to one job satisfaction level (1–4)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(4)
  jobSatisfaction?: number;

  @ApiPropertyOptional({ description: 'Restrict to one environment satisfaction level (1–4)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(4)
  environmentSatisfaction?: number;

  @ApiPropertyOptional({ description: 'Restrict to one relationship satisfaction level (1–4)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(4)
  relationshipSatisfaction?: number;

  @ApiPropertyOptional({ description: 'Restrict to one work-life balance level (1–4)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(4)
  workLifeBalance?: number;

  @ApiPropertyOptional({
    enum: ['<25', '25-34', '35-44', '45-54', '55+'],
    description: 'Restrict to one age bucket',
  })
  @IsOptional()
  @IsIn(['<25', '25-34', '35-44', '45-54', '55+'] as const)
  ageGroup?: AgeGroup;

  @ApiPropertyOptional({
    enum: ['<1', '1-2', '3-5', '6-10', '10+'],
    description: 'Restrict to one tenure bucket (years at company)',
  })
  @IsOptional()
  @IsIn(['<1', '1-2', '3-5', '6-10', '10+'] as const)
  tenureGroup?: TenureGroup;

  @ApiPropertyOptional({ description: 'Restrict to one education level (1–5)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  education?: number;
}
