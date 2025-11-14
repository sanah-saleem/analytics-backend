import { BadRequestException, NotFoundException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { ApiKeyService } from './apikey.service';

// --- Mocks ---
jest.mock('argon2', () => ({
  hash: jest.fn(async (s: string) => `HASH(${s})`),
  verify: jest.fn(async (_hash: string, _val: string) => false),
}));

// Minimal Prisma shape used by the service
type PrismaMock = {
  user: {
    findUnique: jest.Mock;
    create: jest.Mock;
  };
  app: {
    create: jest.Mock;
    findUnique: jest.Mock;
  };
  apiKey: {
    create: jest.Mock;
    findMany: jest.Mock;
    findUnique: jest.Mock;
    update: jest.Mock;
  };
};

const makePrisma = (): PrismaMock =>
  ({
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    app: {
      create: jest.fn(),
      findUnique: jest.fn(),
    },
    apiKey: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  } as unknown as PrismaMock);

describe('ApiKeyService', () => {
  let prisma: PrismaMock;
  let service: ApiKeyService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = makePrisma();
    service = new ApiKeyService(prisma as any);
  });

  // ---------- ensureUser ----------
  it('ensureUser: returns existing user', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'a@b.com' });
    const u = await service.ensureUser('a@b.com');
    expect(u).toEqual({ id: 'u1', email: 'a@b.com' });
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('ensureUser: creates user when missing', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({ id: 'u2', email: 'a@b.com', provider: 'dev' });
    const u = await service.ensureUser('a@b.com');
    expect(prisma.user.create).toHaveBeenCalledWith({ data: { email: 'a@b.com', provider: 'dev' } });
    expect(u).toEqual({ id: 'u2', email: 'a@b.com', provider: 'dev' });
  });

  // ---------- registerApp ----------
  it('registerApp: creates app for owner', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'owner@x.com' });
    prisma.app.create.mockResolvedValue({ id: 'app1', name: 'Demo', ownerId: 'u1' });
    const app = await service.registerApp('owner@x.com', 'Demo');
    expect(prisma.app.create).toHaveBeenCalledWith({ data: { name: 'Demo', ownerId: 'u1' } });
    expect(app).toEqual({ id: 'app1', name: 'Demo', ownerId: 'u1' });
  });

  // ---------- createKey ----------
  it('createKey: throws if app missing', async () => {
    prisma.app.findUnique.mockResolvedValue(null);
    await expect(service.createKey('missing-app')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('createKey: creates key, returns plaintext once', async () => {
    prisma.app.findUnique.mockResolvedValue({ id: 'app1' });
    prisma.apiKey.create.mockResolvedValue({
      id: 'key1',
      appId: 'app1',
      keyPrefix: 'ak_ab12',
      keyHash: 'HASH(...)',
      status: 'active',
      expiresAt: null,
    });

    const result = await service.createKey('app1');
    // plaintext `apiKey` is returned; prefix begins with 'ak_'
    expect(result.apiKeyId).toBe('key1');
    expect(result.prefix.startsWith('ak_')).toBe(true);
    expect(typeof result.apiKey).toBe('string');
    expect(result.expiresAt).toBeNull();

    // argon2.hash was called with plaintext
    expect(argon2.hash).toHaveBeenCalledTimes(1);
    // prisma create got a HASH(...), not plaintext
    const call = prisma.apiKey.create.mock.calls[0][0];
    expect(call.data.keyHash).toMatch(/^HASH\(.+\)$/);
  });

  // ---------- listKeys ----------
  it('listKeys: passes through from prisma', async () => {
    prisma.apiKey.findMany.mockResolvedValue([
      { id: 'k1', keyPrefix: 'ak_x1', status: 'active', createdAt: 't', expiresAt: null },
    ]);
    const keys = await service.listKeys('app1');
    expect(prisma.apiKey.findMany).toHaveBeenCalledWith({
      where: { appId: 'app1' },
      select: { id: true, keyPrefix: true, status: true, createdAt: true, expiresAt: true },
      orderBy: { createdAt: 'desc' },
    });
    expect(keys.length).toBe(1);
  });

  // ---------- revoke ----------
  it('revoke: throws if key not found', async () => {
    prisma.apiKey.findUnique.mockResolvedValue(null);
    await expect(service.revoke('k-missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('revoke: returns key unchanged if already revoked', async () => {
    prisma.apiKey.findUnique.mockResolvedValue({ id: 'k1', status: 'revoked' });
    const res = await service.revoke('k1');
    expect(prisma.apiKey.update).not.toHaveBeenCalled();
    expect(res).toEqual({ id: 'k1', status: 'revoked' });
  });

  it('revoke: updates status to revoked', async () => {
    prisma.apiKey.findUnique.mockResolvedValue({ id: 'k2', status: 'active' });
    prisma.apiKey.update.mockResolvedValue({ id: 'k2', status: 'revoked' });
    const res = await service.revoke('k2');
    expect(prisma.apiKey.update).toHaveBeenCalledWith({ where: { id: 'k2' }, data: { status: 'revoked' } });
    expect(res).toEqual({ id: 'k2', status: 'revoked' });
  });

  // ---------- regenerate ----------
  it('regenerate: throws if key not found', async () => {
    prisma.apiKey.findUnique.mockResolvedValue(null);
    await expect(service.regenerate('k-missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('regenerate: revokes previous and creates new with plaintext', async () => {
    prisma.apiKey.findUnique.mockResolvedValue({ id: 'k1', appId: 'app1', expiresAt: null });
    prisma.apiKey.update.mockResolvedValue({ id: 'k1', status: 'revoked' });
    prisma.apiKey.create.mockResolvedValue({
      id: 'k2',
      appId: 'app1',
      keyPrefix: 'ak_cd34',
      keyHash: 'HASH(new)',
      status: 'active',
      expiresAt: null,
      regeneratedFromId: 'k1',
    });

    const res = await service.regenerate('k1');
    expect(prisma.apiKey.update).toHaveBeenCalledWith({ where: { id: 'k1' }, data: { status: 'revoked' } });
    expect(prisma.apiKey.create).toHaveBeenCalled();
    expect(res.apiKeyId).toBe('k2');
    expect(res.prefix.startsWith('ak_')).toBe(true);
    expect(typeof res.apiKey).toBe('string');
  });

  // ---------- verifyFulKeyAndGetApp ----------
  it('verifyFulKeyAndGetApp: rejects malformed key', async () => {
    await expect(service.verifyFulKeyAndGetApp('not_ak_format')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('verifyFulKeyAndGetApp: returns match when argon2.verify passes and not expired', async () => {
    // key format: ak_ab12_... (we only check prefix & verify)
    const now = new Date();
    prisma.apiKey.findMany.mockResolvedValue([
      {
        id: 'k1',
        appId: 'app1',
        keyPrefix: 'ak_ab12',
        keyHash: 'HASH(plaintext)',
        status: 'active',
        expiresAt: new Date(now.getTime() + 60_000), // future
      },
    ]);
    (argon2.verify as jest.Mock).mockResolvedValue(true);
    prisma.app.findUnique.mockResolvedValue({ id: 'app1' });

    const result = await service.verifyFulKeyAndGetApp('ak_ab12_plaintextBodyHere');
    expect(prisma.apiKey.findMany).toHaveBeenCalledWith({
      where: { keyPrefix: 'ak_ab12', status: 'active' },
    });
    expect(result).toEqual({
      key: expect.objectContaining({ id: 'k1', keyPrefix: 'ak_ab12' }),
      app: { id: 'app1' },
    });
  });

  it('verifyFulKeyAndGetApp: skips expired keys and returns null if none match', async () => {
    prisma.apiKey.findMany.mockResolvedValue([
      {
        id: 'k2',
        appId: 'app1',
        keyPrefix: 'ak_ab12',
        keyHash: 'HASH(whatever)',
        status: 'active',
        expiresAt: new Date('2000-01-01T00:00:00Z'), // expired
      },
    ]);
    (argon2.verify as jest.Mock).mockResolvedValue(false);

    const result = await service.verifyFulKeyAndGetApp('ak_ab12_plaintextBodyHere');
    expect(result).toBeNull();
  });
});
