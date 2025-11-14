import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ApiKeyGuard } from './api-key.guard';

// Mock matches the guard's method name: verifyFulKeyAndGetApp (ONE L in Ful)
const makeApiKeyService = (result: any) => ({
  verifyFulKeyAndGetApp: jest.fn().mockResolvedValue(result),
});

// Stable req so the guard writes to the same object we assert on;
// also expose it as __req so we can read it directly (no re-calls)
const makeCtx = (headers: Record<string, string> = {}) => {
  const req: any = {
    header: (k: string) => headers[k.toLowerCase()],
    appContext: undefined,
  };
  const ctx = {
    switchToHttp: () => ({
      getRequest: () => req,
    }),
    __req: req,
  };
  return ctx as unknown as ExecutionContext & { __req: any };
};

describe('ApiKeyGuard', () => {
  it('throws 401 when x-api-key is missing', async () => {
    const svc = makeApiKeyService(null);
    const guard = new ApiKeyGuard(svc as any);

    const ctx = makeCtx(); // no headers
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(svc.verifyFulKeyAndGetApp).not.toHaveBeenCalled();
  });

  it('throws 403 when x-api-key is present but invalid/expired', async () => {
    const svc = makeApiKeyService(null);
    const guard = new ApiKeyGuard(svc as any);

    const ctx = makeCtx({ 'x-api-key': 'ak_bad_key' });
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(ForbiddenException);
    expect(svc.verifyFulKeyAndGetApp).toHaveBeenCalledWith('ak_bad_key');
  });

  it('allows request and attaches appContext on valid key', async () => {
    const match = {
      key: { keyPrefix: 'ak_ab12' },
      app: { id: 'app_123' },
    };
    const svc = makeApiKeyService(match);
    const guard = new ApiKeyGuard(svc as any);

    const ctx = makeCtx({ 'x-api-key': 'ak_good_key' });
    const can = await guard.canActivate(ctx);
    expect(can).toBe(true);

    // Assert against the SAME req object the guard mutated
    expect(ctx.__req.appContext).toEqual({ appId: 'app_123', apiKeyPrefix: 'ak_ab12' });
    expect(svc.verifyFulKeyAndGetApp).toHaveBeenCalledWith('ak_good_key');
  });
});
