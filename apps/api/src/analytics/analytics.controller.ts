import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@app/common/decorators/current-user.decorator';
import type { RequestUser } from '@app/common/interfaces/request-user.interface';
// Value imports — NOT type-only: the global ValidationPipe resolves the DTO
// class from emitted `design:paramtypes` metadata (see security audit).
import { AnalyticsService } from './analytics.service';
import { QueryAnalyticsDto } from './dto/query-analytics.dto';
import { QueryCompareDto } from './dto/query-compare.dto';
import { QueryPeriodCompareDto } from './dto/query-period-compare.dto';
// Workforce-intelligence APIs. Every view is role-scoped server-side (managers see only their departments);…
// viewers read but never receive salary aggregates. All analytics are computed from the current dataset —…
@ApiTags('Analytics')
@ApiBearerAuth('access-token')
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('overview')
  @ApiOperation({
    summary: 'Full workforce-intelligence overview',
    description:
      'Executive summary, KPIs, attrition, engagement, composition, insights and data quality for one filter state. Filters are intersected with the caller RBAC scope.',
  })
  getOverview(@CurrentUser() user: RequestUser, @Query() query: QueryAnalyticsDto) {
    return this.analyticsService.getOverview(user, query);
  }

  @Get('compare')
  @ApiOperation({
    summary: 'Compare departments',
    description:
      'Headcount, attrition, tenure, income, overtime, satisfaction and performance side-by-side. Managers may only compare departments in their scope; out-of-scope ids are dropped.',
  })
  getCompare(@CurrentUser() user: RequestUser, @Query() query: QueryCompareDto) {
    const departmentIds = query.departmentIds
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);
    return this.analyticsService.getCompare(user, departmentIds);
  }

  @Get('filters')
  @ApiOperation({
    summary: 'Analytics filter options',
    description: 'Scope-aware option lists (departments, job titles, buckets) for the filter bar.',
  })
  getFilters(@CurrentUser() user: RequestUser) {
    return this.analyticsService.getFilters(user);
  }

  @Get('compare-periods')
  @ApiOperation({
    summary: 'Compare two time periods',
    description:
      'Current vs previous period metrics: headcount, attrition, tenure, income, overtime, satisfaction, new hires. Auto-derives previous period if not specified.',
  })
  comparePeriods(@CurrentUser() user: RequestUser, @Query() query: QueryPeriodCompareDto) {
    return this.analyticsService.comparePeriods(user, query);
  }

  @Get('hierarchy')
  @ApiOperation({
    summary: 'Organization hierarchy',
    description:
      'Tree of departments → teams → employees with employee profile previews. Scoped to a manager assigned departments. Optional `search` filters the tree server-side (matching employees, or department/team names) keeping ancestor paths.',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Filter the tree to matching employees / department names (server-side)',
  })
  getHierarchy(@CurrentUser() user: RequestUser, @Query('search') search?: string) {
    return this.analyticsService.getHierarchy(user, search);
  }
}
