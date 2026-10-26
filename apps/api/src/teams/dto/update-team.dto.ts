import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateTeamDto } from './create-team.dto';

/** Payload for updating a team — all fields optional. */
export class UpdateTeamDto extends PartialType(CreateTeamDto) {
  @ApiPropertyOptional({ description: 'Soft-disable the team' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
