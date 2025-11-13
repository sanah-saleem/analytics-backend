import { CallHandler, ExecutionContext, HttpException, HttpStatus, Injectable, NestInterceptor } from "@nestjs/common";
import { Observable } from "rxjs";
import { RedisService } from "src/common/redis.service";

const DEFAULT_LIMIT = Number(process.env.INGEST_RPS_LIMIT ?? 100);

@Injectable()
export class RateLimitInterceptor implements NestInterceptor {
    constructor(private readonly redis: RedisService) {}

    async intercept(ctx: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
        const req = ctx.switchToHttp().getRequest();
        const prefix: string = req.appContext?.apiKeyPrefix ?? 'anon';
        const nowSec = Math.floor(Date.now() / 1000);
        const key = `rl:${prefix}:${nowSec}`

        const count = await this.redis.c.incr(key);
        if(count == 1) await this.redis.c.expire(key, 1);   // 1-sec window 

        if (count > DEFAULT_LIMIT) {
            throw new HttpException('Rate limit exceeded', HttpStatus.TOO_MANY_REQUESTS);
        }
        return next.handle();
    }
}