import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import type { AuditAction, AuditEntityType } from '@orgwise/types';
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from '@app/common/constants/shared-types.constants';
// Query parameters for the audit-logs list endpoint — pagination plus filters on action, entity type, and…
// actor/entity search.
export class QueryAuditLogsDto {
  @ApiPropertyOptional({ example: '1', description: 'Page number (1-based)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ example: '20', description: 'Page size (max 100)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 20;

  @ApiPropertyOptional({ enum: AUDIT_ACTIONS, description: 'Filter by action' })
  @IsOptional()
  @IsIn(AUDIT_ACTIONS)
  action?: AuditAction;

  @ApiPropertyOptional({ enum: AUDIT_ENTITY_TYPES, description: 'Filter by entity type' })
  @IsOptional()
  @IsIn(AUDIT_ENTITY_TYPES)
  entityType?: AuditEntityType;

  @ApiPropertyOptional({ description: 'Search actor name/email or entity id' })
  @IsOptional()
  @IsString()
  search?: string;
}
