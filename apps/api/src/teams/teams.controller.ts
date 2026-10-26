import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CurrentUser } from '@app/common/decorators/current-user.decorator';
import { Roles } from '@app/common/decorators/roles.decorator';
import { Role } from '@app/common/enums/role.enum';
import type { RequestUser } from '@app/common/interfaces/request-user.interface';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { TeamsService } from './teams.service';

/** Teams — sub-units within departments. */
@ApiTags('Teams')
@ApiBearerAuth('access-token')
@Controller('teams')
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Get()
  @ApiOperation({ summary: 'List teams', description: 'Optionally filter by department.' })
  @ApiQuery({ name: 'departmentId', required: false, description: 'Filter teams by department id' })
  findAll(@CurrentUser() user: RequestUser, @Query('departmentId') departmentId?: string) {
    return this.teamsService.findAll(user, departmentId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a team by id' })
  @ApiParam({ name: 'id', description: 'Team id' })
  findOne(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.teamsService.findOne(user, id);
  }

  @Post()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Create a team', description: 'Admin only.' })
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateTeamDto, @Req() req: Request) {
    return this.teamsService.create(user, dto, req.ip);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Update a team', description: 'Admin only.' })
  @ApiParam({ name: 'id', description: 'Team id' })
  update(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: UpdateTeamDto,
    @Req() req: Request,
  ) {
    return this.teamsService.update(user, id, dto, req.ip);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Soft-delete a team',
    description: 'Admin only. Teams with employees cannot be deleted.',
  })
  @ApiParam({ name: 'id', description: 'Team id' })
  remove(@CurrentUser() user: RequestUser, @Param('id') id: string, @Req() req: Request) {
    return this.teamsService.remove(user, id, req.ip);
  }
}
