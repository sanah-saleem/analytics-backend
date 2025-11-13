import { Module } from "@nestjs/common";
import { ApiKeyService } from './apikey.service';
import { ApiKeyController } from './apikey.controller';

@Module({
    providers: [ApiKeyService],
    controllers: [ApiKeyController],
    exports: [ApiKeyService]
})
export class ApiKeyModule {}