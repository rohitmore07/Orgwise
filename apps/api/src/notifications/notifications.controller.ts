import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@app/common/decorators/current-user.decorator';
import type { RequestUser } from '@app/common/interfaces/request-user.interface';
import { NotificationsService } from './notifications.service';

/** Topbar activity feed — recent imports and the caller's own audit actions. */
@ApiTags('Notifications')
@ApiBearerAuth('access-token')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'List recent activity for the signed-in user' })
  findAll(@CurrentUser() user: RequestUser, @Query('limit') limit = '10') {
    return this.notificationsService.findAll(user, Number(limit) || 10);
  }
}
