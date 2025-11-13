import { CallHandler, ExecutionContext, HttpException, HttpStatus, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { RedisService } from '../common/redis.service';

const READ_LIMIT = Number(process.env.READ_RPS_LIMIT ?? 20);

@Injectable()
export class ReadRateLimitInterceptor implements NestInterceptor {
  constructor(private readonly redis: RedisService) {}

  async intercept(ctx: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const req = ctx.switchToHttp().getRequest();
    const prefix: string = req.appContext?.apiKeyPrefix ?? 'anon';
    const nowSec = Math.floor(Date.now() / 1_000);
    const key = `rl:read:${prefix}:${nowSec}`;
    const count = await this.redis.c.incr(key);
    if (count === 1) await this.redis.c.expire(key, 1);
    if (count > READ_LIMIT) throw new HttpException('Read rate limit exceeded', HttpStatus.TOO_MANY_REQUESTS);
    return next.handle();
  }
}
