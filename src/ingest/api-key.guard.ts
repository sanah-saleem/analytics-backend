import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { ApiKeyService } from "src/apikey/apikey.service";

@Injectable()
export class ApiKeyGuard implements CanActivate {

    constructor(private readonly service: ApiKeyService) {}

    async canActivate(ctx: ExecutionContext): Promise<boolean> {
        const req = ctx.switchToHttp().getRequest();
        const key = req.header('x-api-key') as string | undefined;
        if(!key) throw new UnauthorizedException('Missing x-api-key');

        const match = await this.service.verifyFulKeyAndGetApp(key);
        if(!match) throw new ForbiddenException('invalid or expired api key');

        //attach for downstream handlers
        req.appContext = { appId: match.app?.id, apiKeyPrefix: match.key.keyPrefix };
        return true;
    }

}