import { Controller, Get, Query, Req, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiHeader, ApiTags } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { EventSummaryQuery, UserStatsQuery } from './dto';
import { ApiKeyGuard } from '../ingest/api-key.guard';
import { ReadRateLimitInterceptor } from './read-rate-limit.interceptor';

@ApiTags('Analytics / Queries')
@ApiHeader({
  name: 'x-api-key',
  description: 'API key for authenticating analytics requests',
  required: true,
})
@Controller('api/analytics')
@UseGuards(ApiKeyGuard)
@UseInterceptors(ReadRateLimitInterceptor)
export class AnalyticsController {
  constructor(private readonly service: AnalyticsService) {}

  @Get('event-summary')
  async eventSummary(@Query() q: EventSummaryQuery, @Req() req: any) {
    const appId: string = q.app_id || req.appContext.appId;
    return this.service.eventSummary(appId, q.event, q.startDate, q.endDate);
  }

  @Get('user-stats')
  async userStats(@Query() q: UserStatsQuery, @Req() req: any) {
    const appId: string = q.app_id || req.appContext.appId;
    return this.service.userStats(appId, q.userId);
  }
}
