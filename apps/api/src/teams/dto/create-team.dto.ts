import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/** Payload for creating a team. */
export class CreateTeamDto {
  @ApiProperty({ example: 'Platform', description: 'Team name' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({ example: 'Core platform infrastructure' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({ example: 'clx123...', description: 'Parent department id' })
  @IsString()
  @IsNotEmpty()
  departmentId!: string;

  @ApiPropertyOptional({
    example: 'clx456...',
    description: 'Id of the employee leading this team',
  })
  @IsOptional()
  @IsString()
  leadEmployeeId?: string;
}
