import { Body, Controller, Get, Post, Query, Req, UseGuards } from "@nestjs/common";
import { DevAuthGuard } from "src/auth/dev-auth.guard";
import { ApiKeyService } from "./apikey.service";
import { GetApiKeyQuery, RegenerateDto, RegisterAppDto, RevokeDto } from "./dto";
import { PrismaService } from "src/common/prisma.service";
import { ApiHeader, ApiTags } from "@nestjs/swagger";

@ApiTags('Auth / API Keys')
@Controller('api/auth')
@UseGuards(DevAuthGuard) // swap with real google auth later
export class ApiKeyController { 
    constructor(
        private readonly service: ApiKeyService,
        private readonly prisma: PrismaService
    ) {}

    //Registers one app and issues one api key
    @Post('register')
    @ApiHeader({
        name: 'x-dev-user',
        required: true,
        description: 'Developer email for creating/owning apps (temporary for assignment).'
    })
    async register(@Body() body: RegisterAppDto, @Req() req: any) {
        const email = req.user.email as string;
        const app = await this.service.registerApp(email, body.name);
        const created = await this.service.createKey(app.id);
        return {
            app,
            apiKey: created.apiKey,   //show once
            apiKeyId: created.apiKeyId,
            prefix: created.prefix,
            expiresAt: created.expiresAt
        };
    }

    // Lists key metadata for an app (never returns full key again)
    @Get('api-key')
    async getKey(@Query() q: GetApiKeyQuery, @Req() req: any) {
        const email = req.user.email as string;
        // If appId provided, list for that app; otherwise list across user's apps
        if (q.appId) {
            const keys = await this.service.listKeys(q.appId);
            return { appId: q.appId, keys };
        } else {
            const user = await this.service.ensureUser(email);
            const apps = await this.prisma.app.findMany({ where: { ownerId: user.id }});
            const result = [];
            for (const a of apps) {
                const keys = await this.service.listKeys(a.id);
                result.push({ app: a, keys });
            }
            return result;
        }
    }

    @Post('revoke')
    async revoke(@Body() body: RevokeDto) {
        const key = await this.service.revoke(body.apiKeyId);
        return { id: key.id, status: key.status };
    }

    @Post('regenerate')
    async regenerate(@Body() body: RegenerateDto) {
        const expiresAt = body.expiresAt ? new Date(body.expiresAt) : undefined;
        const  next = await this.service.regenerate(body.apiKeyId, expiresAt);
        return {
            apiKeyId: next.apiKeyId,
            apiKey: next.apiKey,    //show once
            prefix: next.prefix,
            expiresAt: next.expiresAt
        };
    }

}