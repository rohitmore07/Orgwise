import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import type { EmployeeStatus, Gender } from '@orgwise/types';
// Optional slice filters for the dashboard overview. All filters are applied server-side and intersected with…
// the caller's RBAC scope (managers only ever see their assigned departments), so the client cannot widen…
export class QueryDashboardDto {
  @ApiPropertyOptional({
    description: 'Restrict the overview to one department (scope-aware)',
  })
  @IsOptional()
  @IsString()
  departmentId?: string;

  @ApiPropertyOptional({
    description: 'Restrict the overview to one team',
  })
  @IsOptional()
  @IsString()
  teamId?: string;

  @ApiPropertyOptional({
    enum: ['active', 'on_leave', 'probation', 'terminated'],
    description: 'Restrict to one employment status',
  })
  @IsOptional()
  @IsEnum(['active', 'on_leave', 'probation', 'terminated'] as const)
  status?: EmployeeStatus;

  @ApiPropertyOptional({
    enum: ['female', 'male', 'non_binary', 'prefer_not_to_say'],
    description: 'Restrict to one gender',
  })
  @IsOptional()
  @IsEnum(['female', 'male', 'non_binary', 'prefer_not_to_say'] as const)
  gender?: Gender;
}
