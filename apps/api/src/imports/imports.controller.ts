import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  Query,
  Req,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

/** Maximum accepted CSV size (10 MB) — guards the API against runaway uploads. */
const MAX_CSV_SIZE_BYTES = 10 * 1024 * 1024;
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { CurrentUser } from '@app/common/decorators/current-user.decorator';
import { PaginationDto } from '@app/common/dto/pagination.dto';
import { Roles } from '@app/common/decorators/roles.decorator';
import { Role } from '@app/common/enums/role.enum';
import type { RequestUser } from '@app/common/interfaces/request-user.interface';
import type { DuplicateStrategy } from '@orgwise/types';
import { ImportsService } from './imports.service';
import { SAMPLE_EMPLOYEES_CSV } from './sample-data';

/** CSV bulk import — upload, history, error reports and template. */
@ApiTags('Imports')
@ApiBearerAuth('access-token')
@Controller('imports')
export class ImportsController {
  constructor(private readonly importsService: ImportsService) {}

  @Post()
  @Roles(Role.ADMIN, Role.MANAGER)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_CSV_SIZE_BYTES } }))
  @ApiOperation({
    summary: 'Import employees from a CSV file',
    description: 'Admin + manager roles. Returns an import summary with a per-row error report.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary', description: 'CSV file' },
        duplicateStrategy: {
          type: 'string',
          enum: ['skip', 'fail', 'update'],
          description:
            'skip (default) excludes duplicates; fail rejects the whole file; update upserts by employeeCode',
        },
        label: { type: 'string', description: 'Optional batch name shown in history' },
      },
    },
  })
  importCsv(
    @CurrentUser() user: RequestUser,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: Request,
    @Body() body: { duplicateStrategy?: DuplicateStrategy; label?: string },
  ) {
    return this.importsService.importCsv(user, file, req.ip, {
      duplicateStrategy: body?.duplicateStrategy,
      label: body?.label,
    });
  }

  @Post('preview')
  @Roles(Role.ADMIN, Role.MANAGER)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_CSV_SIZE_BYTES } }))
  @ApiOperation({
    summary: 'Dry-run a CSV import',
    description: 'Validates every row and resolves references without writing to the database.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary', description: 'CSV file' },
      },
    },
  })
  previewCsv(@CurrentUser() user: RequestUser, @UploadedFile() file: Express.Multer.File) {
    return this.importsService.previewCsv(user, file);
  }

  @Get('sample')
  @ApiOperation({
    summary: 'Download the demo new-hires CSV',
    description: 'A 30-row sample batch that imports cleanly against the seeded org.',
  })
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="orgwise-sample.csv"')
  getSample(): StreamableFile {
    return new StreamableFile(Buffer.from(SAMPLE_EMPLOYEES_CSV, 'utf-8'));
  }

  @Post(':id/rollback')
  @Roles(Role.ADMIN, Role.MANAGER)
  @ApiOperation({
    summary: 'Roll back an import',
    description: 'Soft-deletes the employees (or removes hiring records) the import created.',
  })
  @ApiParam({ name: 'id', description: 'Import history id' })
  rollback(@CurrentUser() user: RequestUser, @Param('id') id: string, @Req() req: Request) {
    return this.importsService.rollback(user, id, req.ip);
  }

  @Get()
  @ApiOperation({ summary: 'List import history' })
  findAll(@CurrentUser() user: RequestUser, @Query() query: PaginationDto) {
    return this.importsService.findAll(user, query.page, query.pageSize);
  }

  @Get('template')
  @ApiOperation({
    summary: 'Download a CSV template',
    description: 'Pre-filled with one example row.',
  })
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="orgwise-employees-template.csv"')
  getTemplate(): StreamableFile {
    return new StreamableFile(Buffer.from(this.importsService.buildTemplate(), 'utf-8'));
  }

  @Get('template/hiring')
  @ApiOperation({
    summary: 'Download a hiring-pipeline CSV template',
    description: 'Pre-filled with one example requisition row.',
  })
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="orgwise-hiring-template.csv"')
  getHiringTemplate(): StreamableFile {
    return new StreamableFile(Buffer.from(this.importsService.buildHiringTemplate(), 'utf-8'));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an import record with its error report' })
  @ApiParam({ name: 'id', description: 'Import history id' })
  findOne(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.importsService.findOne(user, id);
  }
}
