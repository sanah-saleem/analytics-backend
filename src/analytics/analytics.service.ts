import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { RedisService } from '../common/redis.service';

type Range = { start?: Date; end?: Date };

function parseRange(start?: string, end?: string): Range {
  const r: Range = {};
  if (start) r.start = new Date(start);
  if (end)   r.end   = new Date(end);
  return r;
}

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService, private readonly redis: RedisService) {}

  private cacheKey(prefix: string, name: string, obj: Record<string, unknown>) {
    const payload = JSON.stringify(obj);
    return `cache:${name}:${prefix}:${Buffer.from(payload).toString('base64url')}`;
  }

  async eventSummary(appId: string, event: string, start?: string, end?: string) {
    const range = parseRange(start, end);
    const cacheKey = this.cacheKey(appId, 'eventSummary', { event, start, end });

    // try cache
    const cached = await this.redis.c.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const where: any = { appId, event };
    if (range.start || range.end) where.ts = {};
    if (range.start) where.ts.gte = range.start;
    if (range.end)   where.ts.lte = range.end;

    // total count
    const total = await this.prisma.event.count({ where });

    // unique users (ignore null)
    const uniqueUsers = await this.prisma.event.groupBy({
      by: ['userId'],
      where: { ...where, NOT: { userId: null } },
      _count: { userId: true },
    });
    const uniqueCount = uniqueUsers.length;

    // device breakdown
    const deviceRows = await this.prisma.event.groupBy({
      by: ['device'],
      where,
      _count: { _all: true },
    });
    const deviceData = deviceRows.reduce<Record<string, number>>((acc, r) => {
      const key = r.device ?? 'unknown';
      acc[key] = (acc[key] ?? 0) + (r._count?._all ?? 0);
      return acc;
    }, {});

    const result = {
      event,
      count: total,
      uniqueUsers: uniqueCount,
      deviceData,
      range: { start: range.start?.toISOString(), end: range.end?.toISOString() },
    };

    await this.redis.c.setex(cacheKey, Number(process.env.CACHE_TTL_SECONDS ?? 90), JSON.stringify(result));
    return result;
  }

  async userStats(appId: string, userId: string) {
    const cacheKey = this.cacheKey(appId, 'userStats', { userId });
    const cached = await this.redis.c.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const where = { appId, userId };

    const totalEvents = await this.prisma.event.count({ where });

    // last device/browser/os/ip from metadata
    const recent = await this.prisma.event.findMany({
      where,
      orderBy: { ts: 'desc' },
      take: 20,
      select: { ts: true, device: true, ipAddress: true, metadata: true, event: true, url: true, referrer: true },
    });

    const last = recent[0];
    const deviceDetails = last?.metadata && typeof last.metadata === 'object'
      ? {
          browser: (last.metadata as any).browser ?? undefined,
          os: (last.metadata as any).os ?? undefined,
        }
      : {};

    const result = {
      userId,
      totalEvents,
      recentEvents: recent, // keep small (20)
      deviceDetails,
      ipAddress: last?.ipAddress ?? null,
    };

    await this.redis.c.setex(cacheKey, Number(process.env.CACHE_TTL_SECONDS ?? 60), JSON.stringify(result));
    return result;
  }
}
