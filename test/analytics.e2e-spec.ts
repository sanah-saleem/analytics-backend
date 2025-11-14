import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma.service';
import { RedisService } from '../src/common/redis.service';

// ---- Mock ApiKeyGuard (so we don't need a real key/DB) ----
jest.mock('../src/ingest/api-key.guard', () => ({
  ApiKeyGuard: class {
    canActivate(ctx: any) {
      const req = ctx.switchToHttp().getRequest();
      const key = req.header('x-api-key');
      if (!key) return false;
      req.appContext = { appId: 'app_123', apiKeyPrefix: 'ak_test' };
      return true;
    }
  },
}));

// ---- Test doubles so the app won't touch real Postgres/Redis ----
class PrismaServiceMock {
  async onModuleInit() {/* no-op: skip $connect */}
  async $queryRaw() { return 1; }
  // if your analytics service uses prisma.event.create etc., stub only what you need:
  event = {
    create: jest.fn().mockResolvedValue({ id: 'evt_1' }),
  };
}

class RedisServiceMock {
  c = {
    incr: async (_key: string) => 1,
    expire: async (_key: string, _sec: number) => 1,
    get: async (_key: string) => null,
    setex: async (_key: string, _ttl: number, _val: string) => 'OK',
  };
}

describe('AnalyticsController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useClass(PrismaServiceMock)
      .overrideProvider(RedisService)
      .useClass(RedisServiceMock)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects POST /api/analytics/collect without x-api-key', () => {
    return request(app.getHttpServer())
      .post('/api/analytics/collect')
      .send({
        event: 'login_button_click',
        url: 'https://example.com',
      })
      .expect(403); // guard mock returns false (simulates forbidden)
  });

  it('accepts valid event payload', () => {
    const payload = {
      event: 'login_button_click',
      url: 'https://example.com',
      referrer: 'https://google.com',
      device: 'mobile',
      metadata: { browser: 'Chrome', os: 'Android' },
      userId: 'user_42',
    };
    return request(app.getHttpServer())
      .post('/api/analytics/collect')
      .set('x-api-key', 'ak_good_key')
      .send(payload)
      .expect(202)
      .expect(res => {
        expect(res.body).toHaveProperty('status', 'accepted');
      });
  });

  it('rejects malformed body', () => {
    return request(app.getHttpServer())
      .post('/api/analytics/collect')
      .set('x-api-key', 'ak_good_key')
      .send({}) // missing required fields
      .expect(400);
  });
});
