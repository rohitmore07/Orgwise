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
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CurrentUser } from '@app/common/decorators/current-user.decorator';
import { Roles } from '@app/common/decorators/roles.decorator';
import { Role } from '@app/common/enums/role.enum';
import type { RequestUser } from '@app/common/interfaces/request-user.interface';
import { DepartmentsService } from './departments.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';

/** Organization structure — departments, hierarchy and manager assignment. */
@ApiTags('Departments')
@ApiBearerAuth('access-token')
@Controller('departments')
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @Get()
  @ApiOperation({
    summary: 'List departments',
    description:
      'All roles can list departments; managers are scoped to their assigned departments.',
  })
  findAll(@CurrentUser() user: RequestUser) {
    return this.departmentsService.findAll(user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a department by id' })
  @ApiParam({ name: 'id', description: 'Department id' })
  findOne(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.departmentsService.findOne(user, id);
  }

  @Post()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Create a department', description: 'Admin only.' })
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateDepartmentDto, @Req() req: Request) {
    return this.departmentsService.create(user, dto, req.ip);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Update a department', description: 'Admin only.' })
  @ApiParam({ name: 'id', description: 'Department id' })
  update(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: UpdateDepartmentDto,
    @Req() req: Request,
  ) {
    return this.departmentsService.update(user, id, dto, req.ip);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Soft-delete a department',
    description: 'Admin only. Departments with employees cannot be deleted.',
  })
  @ApiParam({ name: 'id', description: 'Department id' })
  remove(@CurrentUser() user: RequestUser, @Param('id') id: string, @Req() req: Request) {
    return this.departmentsService.remove(user, id, req.ip);
  }
}
