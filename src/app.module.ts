import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './common/prisma.module';
import { ApiKeyModule } from './apikey/apikey.module';
import { RedisModule } from './common/redis.module';
import { IngestModule } from './ingest/ingest.module';
import { AnalyticsModule } from './analytics/analytics.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    HealthModule,
    ApiKeyModule,
    RedisModule,
    IngestModule,
    AnalyticsModule
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
