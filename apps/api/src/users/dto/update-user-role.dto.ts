import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { Role } from '@app/common/enums/role.enum';

/** Admin-only payload for changing a user's platform role. */
export class UpdateUserRoleDto {
  @ApiProperty({ enum: Role, example: Role.MANAGER })
  @IsEnum(Role)
  role!: Role;
}
