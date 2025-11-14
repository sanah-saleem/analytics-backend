import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma.service';
import { RedisService } from '../src/common/redis.service';

// Minimal Prisma mock: avoids real DB connection and supports /healthz/db
class PrismaServiceMock {
  async onModuleInit() {
    // no-op (skip real $connect)
  }
  async $queryRaw() {
    return 1;
  }
}

// Minimal Redis mock: shape-compatible with what your code calls
class RedisServiceMock {
  c = {
    incr: async (_key: string) => 1,
    expire: async (_key: string, _sec: number) => 1,
    get: async (_key: string) => null,
    setex: async (_key: string, _ttl: number, _val: string) => 'OK',
  };
}

describe('Health endpoints (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      // override globals so the app won’t try to connect to real Postgres/Redis
      .overrideProvider(PrismaService)
      .useClass(PrismaServiceMock)
      .overrideProvider(RedisService)
      .useClass(RedisServiceMock)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/healthz (GET) should return ok', async () => {
    const res = await request(app.getHttpServer()).get('/healthz');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'ok');
    expect(res.body).toHaveProperty('time');
  });

  it('/healthz/db (GET) should return db ok', async () => {
    const res = await request(app.getHttpServer()).get('/healthz/db');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('db', 'ok');
    expect(res.body).toHaveProperty('time');
  });
});
