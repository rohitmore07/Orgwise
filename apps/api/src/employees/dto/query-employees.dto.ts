import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import type { AgeGroup, EmployeeStatus, Gender, TenureGroup } from '@orgwise/types';

/** Sortable employee fields. */
export const EMPLOYEE_SORT_FIELDS = [
  'firstName',
  'lastName',
  'email',
  'jobTitle',
  'status',
  'hiredAt',
  'createdAt',
] as const;

export type EmployeeSortField = (typeof EMPLOYEE_SORT_FIELDS)[number];
// Query parameters for the employees list endpoint — combines pagination, free-text search, structured filters,…
// and sorting.
export class QueryEmployeesDto {
  @ApiPropertyOptional({ example: '1', description: 'Page number (1-based)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ example: '20', description: 'Page size (max 100)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 20;

  @ApiPropertyOptional({
    example: 'alex',
    description: 'Free-text search across name, email, code, title',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by department id' })
  @IsOptional()
  @IsString()
  departmentId?: string;

  @ApiPropertyOptional({ description: 'Filter by team id' })
  @IsOptional()
  @IsString()
  teamId?: string;

  @ApiPropertyOptional({
    enum: ['active', 'on_leave', 'probation', 'terminated'],
    description: 'Filter by employment status',
  })
  @IsOptional()
  @IsEnum(['active', 'on_leave', 'probation', 'terminated'] as const)
  status?: EmployeeStatus;

  @ApiPropertyOptional({
    enum: ['female', 'male', 'non_binary', 'prefer_not_to_say'],
    description: 'Filter by gender',
  })
  @IsOptional()
  @IsEnum(['female', 'male', 'non_binary', 'prefer_not_to_say'] as const)
  gender?: Gender;

  @ApiPropertyOptional({
    default: false,
    description: 'Include soft-deleted employees (for audit/restore workflows)',
  })
  @IsOptional()
  // Explicit parse instead of `@Type(() => Boolean)`: the Boolean constructor treats ANY non-empty string…
  // (including 'false') as truthy, which would silently flip this flag. Accept only the literal 'true' or a…
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  includeDeleted?: boolean;

  @ApiPropertyOptional({
    enum: EMPLOYEE_SORT_FIELDS,
    default: 'createdAt',
    description: 'Sort field',
  })
  @IsOptional()
  @IsIn(EMPLOYEE_SORT_FIELDS)
  sortBy: EmployeeSortField = 'createdAt';

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc', description: 'Sort direction' })
  @IsOptional()
  @IsIn(['asc', 'desc'] as const)
  sortOrder: 'asc' | 'desc' = 'desc';

  // ── Phase 4 analytics explorer filters ────────────────────────────────────

  @ApiPropertyOptional({ description: 'Filter by exact job title' })
  @IsOptional()
  @IsString()
  jobTitle?: string;

  @ApiPropertyOptional({ description: 'Filter by overtime flag' })
  @IsOptional()
  // Tolerant parse: true/1/yes mean true; anything else means false.
  @Transform(({ value }) => value === true || value === 'true' || value === '1' || value === 'yes')
  @IsBoolean()
  overTime?: boolean;

  @ApiPropertyOptional({ description: 'Filter by observed attrition flag' })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1' || value === 'yes')
  @IsBoolean()
  attrition?: boolean;

  @ApiPropertyOptional({ description: 'Filter by job satisfaction level (1–4)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(4)
  jobSatisfaction?: number;

  @ApiPropertyOptional({ description: 'Filter by environment satisfaction level (1–4)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(4)
  environmentSatisfaction?: number;

  @ApiPropertyOptional({ description: 'Filter by relationship satisfaction level (1–4)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(4)
  relationshipSatisfaction?: number;

  @ApiPropertyOptional({ description: 'Filter by work-life balance level (1–4)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(4)
  workLifeBalance?: number;

  @ApiPropertyOptional({
    enum: ['<25', '25-34', '35-44', '45-54', '55+'],
    description: 'Filter by age bucket (derived from dateOfBirth)',
  })
  @IsOptional()
  @IsIn(['<25', '25-34', '35-44', '45-54', '55+'] as const)
  ageGroup?: AgeGroup;

  @ApiPropertyOptional({
    enum: ['<1', '1-2', '3-5', '6-10', '10+'],
    description: 'Filter by tenure bucket (years at company)',
  })
  @IsOptional()
  @IsIn(['<1', '1-2', '3-5', '6-10', '10+'] as const)
  tenureGroup?: TenureGroup;

  @ApiPropertyOptional({ description: 'Filter by education level (1–5)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  education?: number;
}
