import { Global, Injectable, OnModuleDestroy } from "@nestjs/common";
import Redis from 'ioredis';

@Global()
@Injectable()
export class RedisService implements OnModuleDestroy {
    private client: Redis;

    constructor() {
        this.client = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
            maxRetriesPerRequest: 2,
            enableAutoPipelining: true
        });
    }

    get c() {
        return this.client;
    }

    async onModuleDestroy() {
        await this.client.quit();
    }

}