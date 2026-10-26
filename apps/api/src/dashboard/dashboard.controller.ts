import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@app/common/decorators/current-user.decorator';
import type { RequestUser } from '@app/common/interfaces/request-user.interface';
import { DashboardService } from './dashboard.service';
import { QueryDashboardDto } from './dto/query-dashboard.dto';

/** Analytics dashboard — KPIs and distributions, role-scoped. */
@ApiTags('Dashboard')
@ApiBearerAuth('access-token')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('overview')
  @ApiOperation({
    summary: 'Get dashboard overview',
    description:
      'KPIs + department/status/gender distributions + recent hires. Optional department/team/status/gender slice filters are applied server-side and scoped for managers.',
  })
  getOverview(@CurrentUser() user: RequestUser, @Query() query: QueryDashboardDto) {
    return this.dashboardService.getOverview(user, query);
  }
}
