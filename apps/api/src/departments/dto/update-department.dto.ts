import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateDepartmentDto } from './create-department.dto';

/** Payload for updating a department — all fields optional. */
export class UpdateDepartmentDto extends PartialType(CreateDepartmentDto) {
  @ApiPropertyOptional({ description: 'Soft-disable the department' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
