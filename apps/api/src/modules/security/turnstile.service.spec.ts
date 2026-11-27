import { ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { TurnstileService } from './turnstile.service';

describe('TurnstileService', () => {
  let service: TurnstileService;
  let fetchMock: jest.MockedFunction<typeof fetch>;
  const originalSiteKey = process.env.TURNSTILE_SITE_KEY;
  const originalSecretKey = process.env.TURNSTILE_SECRET_KEY;

  const mockSiteverify = (body: Record<string, unknown>, ok = true) => {
    fetchMock.mockResolvedValue({
      ok,
      status: ok ? 200 : 500,
      json: async () => body,
    } as Response);
  };

  beforeEach(() => {
    service = new TurnstileService();
    process.env.TURNSTILE_SITE_KEY = 'public-site-key';
    process.env.TURNSTILE_SECRET_KEY = 'test-secret-key';
    fetchMock = jest.spyOn(global, 'fetch') as jest.MockedFunction<typeof fetch>;
    fetchMock.mockReset();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (originalSiteKey === undefined) delete process.env.TURNSTILE_SITE_KEY;
    else process.env.TURNSTILE_SITE_KEY = originalSiteKey;
    if (originalSecretKey === undefined) delete process.env.TURNSTILE_SECRET_KEY;
    else process.env.TURNSTILE_SECRET_KEY = originalSecretKey;
  });

  it('returns only the public site key', () => {
    expect(service.getSiteKey()).toBe('public-site-key');
  });

  it('returns null when the site key is not configured', () => {
    delete process.env.TURNSTILE_SITE_KEY;
    expect(service.getSiteKey()).toBeNull();
  });

  it('fails closed when the secret key is missing', async () => {
    delete process.env.TURNSTILE_SECRET_KEY;

    await expect(service.verify('token', '203.0.113.10')).rejects.toThrow(
      ServiceUnavailableException,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects an empty token before calling Siteverify', async () => {
    await expect(service.verify('   ')).rejects.toThrow(UnauthorizedException);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('submits the token and secret to Cloudflare Siteverify', async () => {
    mockSiteverify({ success: true });

    await service.verify('valid-token', '203.0.113.10');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://challenges.cloudflare.com/turnstile/v0/siteverify');
    expect(init?.method).toBe('POST');
    expect(String(init?.body)).toContain('secret=test-secret-key');
    expect(String(init?.body)).toContain('response=valid-token');
    expect(String(init?.body)).toContain('remoteip=203.0.113.10');
  });

  it('maps an expired or duplicate token to an expiry message', async () => {
    mockSiteverify({ success: false, 'error-codes': ['timeout-or-duplicate'] });

    await expect(service.verify('old-token')).rejects.toThrow(
      'Security verification expired. Please complete it again.',
    );
  });

  it('does not blame the user for a misconfigured secret', async () => {
    mockSiteverify({ success: false, 'error-codes': ['invalid-input-secret'] });

    await expect(service.verify('valid-token')).rejects.toThrow(ServiceUnavailableException);
  });

  it('fails closed when Cloudflare is unreachable', async () => {
    fetchMock.mockRejectedValue(new Error('network down'));

    await expect(service.verify('valid-token')).rejects.toThrow(ServiceUnavailableException);
  });
});
