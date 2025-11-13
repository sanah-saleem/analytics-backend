import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './common/prisma.module';
import { ApiKeyModule } from './apikey/apikey.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    HealthModule,
    ApiKeyModule
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
