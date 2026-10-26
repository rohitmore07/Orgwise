import { Body, Controller, Get, Param, Patch, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CurrentUser } from '@app/common/decorators/current-user.decorator';
import { Roles } from '@app/common/decorators/roles.decorator';
import { Role } from '@app/common/enums/role.enum';
import type { RequestUser } from '@app/common/interfaces/request-user.interface';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { UsersService } from './users.service';

/** Users — profile and admin role management. */
@ApiTags('Users')
@ApiBearerAuth('access-token')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get the current user profile' })
  me(@CurrentUser() user: RequestUser) {
    return this.usersService.me(user);
  }

  @Get()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'List users', description: 'Admin only.' })
  @ApiQuery({ name: 'search', required: false, description: 'Filter by name or email' })
  @ApiQuery({
    name: 'role',
    required: false,
    description: 'Filter by role — comma-separated values, e.g. `manager,admin`',
  })
  findAll(
    @CurrentUser() user: RequestUser,
    @Query('search') search?: string,
    @Query('role') role?: string,
  ) {
    return this.usersService.findAll(user, search, role);
  }

  @Patch(':id/role')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: "Change a user's role", description: 'Admin only.' })
  @ApiParam({ name: 'id', description: 'User id' })
  updateRole(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: UpdateUserRoleDto,
    @Req() req: Request,
  ) {
    return this.usersService.updateRole(user, id, dto, req.ip);
  }
}
