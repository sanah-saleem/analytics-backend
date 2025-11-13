import { IsISO8601, IsOptional, IsString } from 'class-validator';

export class EventSummaryQuery {
  @IsString() event!: string;

  @IsOptional() @IsISO8601()
  startDate?: string;

  @IsOptional() @IsISO8601()
  endDate?: string;

  @IsOptional() @IsString()
  app_id?: string; // default to current app
}

// If you want to allow cross-app in future, extend with an owner scope. For now, we use the current appId from guard.

export class UserStatsQuery {
  @IsString()
  userId!: string;

  @IsOptional() @IsString()
  app_id?: string; // default to current app
}
