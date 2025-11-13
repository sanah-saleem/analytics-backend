import { Body, Controller, HttpCode, Ip, Post, Req, UseGuards, UseInterceptors } from "@nestjs/common";
import { ApiKeyGuard } from "./api-key.guard";
import { RateLimitInterceptor } from "./rate-limit.interceptor";
import { IngestService } from './ingest.service';
import { CollectEventDto } from "./dto";
import { ApiTags } from "@nestjs/swagger";

@ApiTags('Aalytics / Ingestion')
@Controller('api/analytics')
@UseGuards(ApiKeyGuard)
@UseInterceptors(RateLimitInterceptor)
export class IngestController {
    constructor(private readonly service: IngestService) {}

    @Post('collect')
    @HttpCode(202)
    async collect(@Body() body: CollectEventDto, @Ip() ip: string, @Req() req: any) {
        const appId: string = req.appContext.appId;
        await this.service.store(appId, body, ip);
        return { status: 'accepted' };
    }
}