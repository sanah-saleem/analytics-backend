import { Module } from '@nestjs/common';
import { IngestController } from './ingest.controller';
import { IngestService } from './ingest.service';
import { ApiKeyModule } from '../apikey/apikey.module';

@Module({
  imports: [ApiKeyModule],
  controllers: [IngestController],
  providers: [IngestService],
})
export class IngestModule {}
