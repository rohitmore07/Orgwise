import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateEmployeeDto } from './create-employee.dto';

/** Payload for updating an employee — all fields optional. */
export class UpdateEmployeeDto extends PartialType(CreateEmployeeDto) {
  @ApiPropertyOptional({ description: 'Soft-disable the employee' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
