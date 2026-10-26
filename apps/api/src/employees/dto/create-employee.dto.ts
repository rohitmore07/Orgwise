import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDate,
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import type { EmployeeStatus, Gender } from '@orgwise/types';

const EMPLOYEE_CODE_PATTERN = /^[A-Za-z0-9._-]{2,30}$/;
// Payload for creating an employee. Validation enforces the profile contract: required identity fields, stable…
// employee code, valid email, and controlled enums for status/gender.
export class CreateEmployeeDto {
  @ApiProperty({ example: 'EMP-0001', description: 'Stable, unique employee code' })
  @IsString()
  @MinLength(2)
  @MaxLength(30)
  @Matches(EMPLOYEE_CODE_PATTERN, {
    message: 'employeeCode may only contain letters, numbers, dots, dashes and underscores',
  })
  employeeCode!: string;

  @ApiProperty({ example: 'Alex' })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  firstName!: string;

  @ApiProperty({ example: 'Morgan' })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  lastName!: string;

  @ApiProperty({ example: 'alex.morgan@company.com' })
  @IsEmail()
  @MaxLength(200)
  email!: string;

  @ApiPropertyOptional({ example: '+1 555 010 0000' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @ApiProperty({ example: 'Senior Engineer' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  jobTitle!: string;

  @ApiProperty({ enum: ['female', 'male', 'non_binary', 'prefer_not_to_say'], example: 'female' })
  @IsEnum(['female', 'male', 'non_binary', 'prefer_not_to_say'] as const)
  gender!: Gender;

  @ApiPropertyOptional({ example: '1992-04-12', description: 'ISO-8601 date (YYYY-MM-DD)' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  dateOfBirth?: Date;

  @ApiProperty({ example: '2023-06-01', description: 'Hire date (ISO-8601)' })
  @Type(() => Date)
  @IsDate()
  hiredAt!: Date;

  @ApiPropertyOptional({
    enum: ['active', 'on_leave', 'probation', 'terminated'],
    default: 'active',
  })
  @IsOptional()
  @IsEnum(['active', 'on_leave', 'probation', 'terminated'] as const)
  status?: EmployeeStatus;

  @ApiProperty({ description: 'Department id' })
  @IsString()
  @IsNotEmpty()
  departmentId!: string;

  @ApiPropertyOptional({ description: 'Team id' })
  @IsOptional()
  @IsString()
  teamId?: string;

  @ApiPropertyOptional({ description: 'Manager employee id (reporting line)' })
  @IsOptional()
  @IsString()
  managerId?: string;

  // ── Analytics & engagement profile (Phase 4) ─────────────────────────────

  @ApiPropertyOptional({ description: 'Observed attrition event (left workforce)' })
  @IsOptional()
  @IsBoolean()
  attrition?: boolean;

  @ApiPropertyOptional({ description: 'When attrition occurred' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  attritionDate?: Date;

  @ApiPropertyOptional({ example: 9800, description: 'Monthly income in USD' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  monthlyIncome?: number;

  @ApiPropertyOptional({ description: '1 (low) – 4 (high)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(4)
  jobSatisfaction?: number;

  @ApiPropertyOptional({ description: '1 (low) – 4 (high)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(4)
  environmentSatisfaction?: number;

  @ApiPropertyOptional({ description: '1 (low) – 4 (high)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(4)
  relationshipSatisfaction?: number;

  @ApiPropertyOptional({ description: '1 (low) – 4 (high)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(4)
  workLifeBalance?: number;

  @ApiPropertyOptional({ description: 'Works beyond standard hours' })
  @IsOptional()
  @IsBoolean()
  overTime?: boolean;

  @ApiPropertyOptional({ description: '1 (low) – 4 (high)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(4)
  performanceRating?: number;

  @ApiPropertyOptional({ description: '1 (below) – 5 (doctorate)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  education?: number;

  @ApiPropertyOptional({ example: 'Technical Degree' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  educationField?: string;

  @ApiPropertyOptional({ description: '1 (entry) – 5 (executive)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  jobLevel?: number;

  @ApiPropertyOptional({ description: 'Years at the company' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  yearsAtCompany?: number;

  @ApiPropertyOptional({ description: 'Total years of working experience' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  totalWorkingYears?: number;
}
