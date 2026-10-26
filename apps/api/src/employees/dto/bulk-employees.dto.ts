import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import type { EmployeeStatus } from '@orgwise/types';

export type BulkAction = 'update_status' | 'update_department' | 'update_manager' | 'delete';

export class BulkEmployeesDto {
  @ApiProperty({
    description: 'Array of employee IDs to act on',
    example: ['emp-1', 'emp-2', 'emp-3'],
    minItems: 1,
    maxItems: 100,
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsString({ each: true })
  @MinLength(1, { each: true })
  employeeIds!: string[];

  @ApiProperty({
    description: 'The batch action to perform',
    enum: ['update_status', 'update_department', 'update_manager', 'delete'],
  })
  @IsEnum(['update_status', 'update_department', 'update_manager', 'delete'] as const)
  action!: BulkAction;

  @ApiPropertyOptional({
    description: 'New status (required when action is update_status)',
    enum: ['active', 'on_leave', 'probation', 'terminated'],
  })
  @IsOptional()
  @IsEnum(['active', 'on_leave', 'probation', 'terminated'] as const)
  status?: EmployeeStatus;

  @ApiPropertyOptional({
    description: 'New department ID (required when action is update_department)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  departmentId?: string;

  @ApiPropertyOptional({
    description:
      'New manager employee ID (required when action is update_manager). Pass empty string to clear.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  managerId?: string;
}
