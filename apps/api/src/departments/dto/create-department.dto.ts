import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/** Payload for creating a department. */
export class CreateDepartmentDto {
  @ApiProperty({ example: 'Engineering', description: 'Department name' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({ example: 'Builds the core product platform' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({
    example: 'clx123...',
    description: 'Id of the parent department (org hierarchy)',
  })
  @IsOptional()
  @IsString()
  parentId?: string;

  @ApiPropertyOptional({
    example: 'clx456...',
    description: 'Id of the user assigned to manage this department (RBAC scope)',
  })
  @IsOptional()
  @IsString()
  managerUserId?: string;
}
