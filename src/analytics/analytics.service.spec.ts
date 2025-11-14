import { AnalyticsService } from './analytics.service';
import { PrismaService } from '../common/prisma.service';
import { RedisService } from '../common/redis.service';

const b64 = (obj: Record<string, unknown>) =>
  Buffer.from(JSON.stringify(obj)).toString('base64url');

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let prisma: any;
  let redis: any;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = {
      event: {
        count: jest.fn(),
        groupBy: jest.fn(),
        findMany: jest.fn(),
      },
    };
    redis = {
      c: {
        get: jest.fn(),
        setex: jest.fn(),
      },
    };
    service = new AnalyticsService(prisma as unknown as PrismaService, redis as unknown as RedisService);
  });

  it('returns cached result if available', async () => {
    // cache key format: cache:eventSummary:<appId>:<base64url(JSON)>
    const appId = 'app_123';
    const event = 'login_form_cta_click';
    const key = `cache:eventSummary:${appId}:${b64({ event })}`;

    const cachedObj = {
      event,
      count: 3400,
      uniqueUsers: 1200,
      deviceData: { mobile: 2200, desktop: 1200 },
      range: { start: undefined, end: undefined },
    };
    redis.c.get.mockResolvedValue(JSON.stringify(cachedObj));

    const res = await service.eventSummary(appId, event);

    expect(redis.c.get).toHaveBeenCalledWith(key);
    expect(res).toEqual(cachedObj);
    // DB not queried when cache hit
    expect(prisma.event.count).not.toHaveBeenCalled();
    expect(prisma.event.groupBy).not.toHaveBeenCalled();
  });

  it('queries DB and caches result when cache miss', async () => {
    const appId = 'app_123';
    const event = 'signup_click';
    const key = `cache:eventSummary:${appId}:${b64({ event })}`;

    redis.c.get.mockResolvedValue(null);
    prisma.event.count.mockResolvedValue(100);

    // 1st groupBy (unique users)
    prisma.event.groupBy
      .mockResolvedValueOnce([
        // by: ['userId'] ... we only care about .length
        { userId: 'u1', _count: { userId: 1 } },
        { userId: 'u2', _count: { userId: 1 } },
      ])
      // 2nd groupBy (device breakdown)
      .mockResolvedValueOnce([
        { device: 'mobile', _count: { _all: 60 } },
        { device: 'desktop', _count: { _all: 40 } },
      ]);

    const result = await service.eventSummary(appId, event);

    expect(result.count).toBe(100);
    expect(result.uniqueUsers).toBe(2);
    expect(result.deviceData).toEqual({ mobile: 60, desktop: 40 });
    expect(result.range).toEqual({ start: undefined, end: undefined });

    // cached with TTL (default 90 if env not set)
    expect(redis.c.setex).toHaveBeenCalledWith(
      key,
      Number(process.env.CACHE_TTL_SECONDS ?? 90),
      JSON.stringify(result),
    );
  });

  it('applies start/end filters and uses them in cache key', async () => {
    const appId = 'app_123';
    const event = 'page_view';
    const start = '2024-02-01';
    const end = '2024-02-10';
    const key = `cache:eventSummary:${appId}:${b64({ event, start, end })}`;

    redis.c.get.mockResolvedValue(null);
    prisma.event.count.mockResolvedValue(5);

    prisma.event.groupBy
      // unique users
      .mockResolvedValueOnce([{ userId: 'u1', _count: { userId: 3 } }])
      // device breakdown
      .mockResolvedValueOnce([{ device: 'mobile', _count: { _all: 5 } }]);

    const result = await service.eventSummary(appId, event, start, end);

    // correct cache key
    expect(redis.c.setex).toHaveBeenCalledWith(
      key,
      Number(process.env.CACHE_TTL_SECONDS ?? 90),
      JSON.stringify(result),
    );

    // verify where clauses roughly match (date filters present)
    expect(prisma.event.count.mock.calls[0][0].where).toMatchObject({
      appId,
      event,
      ts: { gte: new Date(start), lte: new Date(end) },
    });

    expect(result.deviceData).toEqual({ mobile: 5 });
  });
});
