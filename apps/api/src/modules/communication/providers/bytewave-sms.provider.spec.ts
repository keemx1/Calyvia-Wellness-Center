import { ByteWaveSmsProvider, sanitizeByteWaveUrl, splitCombinedKey } from './bytewave-sms.provider';
import { ConfigResolver } from './config-resolver';

function makeResolver(db: Record<string, string> = {}): ConfigResolver & { get: jest.Mock } {
  return {
    get: jest.fn(async (envVar: string, settingKey: string) => {
      const fromEnv = process.env[envVar]?.trim();
      if (fromEnv) return fromEnv;
      return db[settingKey] || undefined;
    }),
  } as any;
}

describe('ByteWaveSmsProvider (HTTP + OAuth2)', () => {
  const ENV_KEYS = [
    'BYTEWAVE_API_MODE',
    'BYTEWAVE_API_URL',
    'BYTEWAVE_API_KEY',
    'BYTEWAVE_CLIENT_ID',
    'BYTEWAVE_CLIENT_SECRET',
    'BYTEWAVE_SENDER_ID',
    'BYTEWAVE_KEY_PARAM',
    'BYTEWAVE_PARAM_TO',
    'BYTEWAVE_PARAM_MESSAGE',
    'BYTEWAVE_PARAM_SENDER',
    'BYTEWAVE_ID_FIELD',
    'SMS_PROVIDER',
  ] as const;
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const k of ENV_KEYS) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
    jest.restoreAllMocks();
  });

  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k]!;
    }
    jest.restoreAllMocks();
  });

  it('fixes the coma/api typo copied from the portal UI', () => {
    expect(sanitizeByteWaveUrl('https://portal.bytewavenetworks.coma/api/v3/')).toBe(
      'https://portal.bytewavenetworks.com/api/v3/',
    );
    expect(sanitizeByteWaveUrl('https://portal.bytewavenetworks.com/api/http/')).toBe(
      'https://portal.bytewavenetworks.com/api/http/',
    );
  });

  it('splits a combined oc_sk_ key into client id and secret', () => {
    expect(splitCombinedKey('oc_sk_abc123_secret-xyz')).toEqual({
      clientId: 'abc123',
      clientSecret: 'secret-xyz',
    });
    expect(splitCombinedKey('plain-http-key')).toBeNull();
    expect(splitCombinedKey('')).toBeNull();
  });

  it('sends via HTTP GET to .../api/http/send with key, sender, recipients, message', async () => {
    const fetchSpy = jest.spyOn(globalThis, 'fetch' as any).mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ success: true, id: 'BW-HTTP-1' }),
    } as any);

    const resolver = makeResolver({
      'gateway.sms.bytewave.mode': 'http',
      'gateway.sms.bytewave.api_url': 'https://portal.bytewavenetworks.com/api/http/',
      'gateway.sms.bytewave.api_key': 'http-key-123',
      'gateway.sms.bytewave.sender_id': 'CALYVIA',
    });

    const driver = new ByteWaveSmsProvider(resolver);
    const res = await driver.send({ to: '+254712345678', body: 'Hello via HTTP' });

    expect(res.status).toBe('SENT');
    expect(res.provider).toBe('bytewave');
    expect(res.providerMessageId).toBe('BW-HTTP-1');
    expect(res.costKes).toBe(0.25);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as any[];
    const u = new URL(url);
    expect(`${u.origin}${u.pathname}`).toBe('https://portal.bytewavenetworks.com/api/http/send');
    expect(u.searchParams.get('apiKey')).toBe('http-key-123');
    expect(u.searchParams.get('sender')).toBe('CALYVIA');
    expect(u.searchParams.get('recipients')).toBe('254712345678');
    expect(u.searchParams.get('message')).toBe('Hello via HTTP');
    expect(init.method).toBe('GET');
  });

  it('marks HTTP dispatch FAILED when the gateway reports success:false', async () => {
    jest.spyOn(globalThis, 'fetch' as any).mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ success: false, error: 'insufficient balance' }),
    } as any);

    const resolver = makeResolver({
      'gateway.sms.bytewave.mode': 'http',
      'gateway.sms.bytewave.api_url': 'https://portal.bytewavenetworks.com/api/http/',
      'gateway.sms.bytewave.api_key': 'http-key-123',
    });

    const res = await new ByteWaveSmsProvider(resolver).send({ to: '+254712345678', body: 'Hi' });
    expect(res.status).toBe('FAILED');
    expect(res.providerMessageId).toBeNull();
    expect(res.costKes).toBe(0);
  });

  it('sends via OAuth2 using a combined oc_sk_ key (token then Bearer send)', async () => {
    const fetchSpy = jest.spyOn(globalThis, 'fetch' as any).mockImplementation(async (url: string, init: any) => {
      if (url.includes('/oauth/token')) {
        // Token endpoint must receive the split client id/secret, not the combined key.
        const body = JSON.parse(init.body);
        expect(body.grant_type).toBe('client_credentials');
        expect(body.client_id).toBe('test-client-id');
        expect(body.client_secret).toBe('test-client-secret');
        return { ok: true, status: 200, text: async () => JSON.stringify({ access_token: 'tok-1', expires_in: 3600 }) } as any;
      }
      if (url.includes('/sms/send')) {
        expect(init.headers.Authorization).toBe('Bearer tok-1');
        const body = JSON.parse(init.body);
        expect(body).toEqual({ sender: 'CALYVIA', recipients: ['254712345678'], message: 'Hello via OAuth2' });
        return { ok: true, status: 200, text: async () => JSON.stringify({ success: true, id: 'BW-OA-1' }) } as any;
      }
      return { ok: false, status: 404, text: async () => 'not found' } as any;
    });

    const resolver = makeResolver({
      'gateway.sms.bytewave.mode': 'oauth2',
      'gateway.sms.bytewave.api_url': 'https://portal.bytewavenetworks.com/api/v3/',
      'gateway.sms.bytewave.api_key': 'oc_sk_test-client-id_test-client-secret',
    });

    const driver = new ByteWaveSmsProvider(resolver);
    const res = await driver.send({ to: '+254712345678', body: 'Hello via OAuth2' });

    expect(res.status).toBe('SENT');
    expect(res.providerMessageId).toBe('BW-OA-1');
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('reuses the cached OAuth2 token for a second send', async () => {
    let tokenCalls = 0;
    jest.spyOn(globalThis, 'fetch' as any).mockImplementation(async (url: string) => {
      if (url.includes('/oauth/token')) {
        tokenCalls += 1;
        return { ok: true, status: 200, text: async () => JSON.stringify({ access_token: 'tok-cached', expires_in: 3600 }) } as any;
      }
      return { ok: true, status: 200, text: async () => JSON.stringify({ success: true, id: 'BW-OA-2' }) } as any;
    });

    const resolver = makeResolver({
      'gateway.sms.bytewave.mode': 'oauth2',
      'gateway.sms.bytewave.api_url': 'https://portal.bytewavenetworks.com/api/v3/',
      'gateway.sms.bytewave.client_id': 'cid',
      'gateway.sms.bytewave.client_secret': 'csecret',
    });

    const driver = new ByteWaveSmsProvider(resolver);
    await driver.send({ to: '+254712345678', body: 'one' });
    const res = await driver.send({ to: '+254712345678', body: 'two' });

    expect(res.status).toBe('SENT');
    expect(tokenCalls).toBe(1);
  });

  it('only falls through send paths on 404 so a rejected SMS is never double-sent', async () => {
    const posts: string[] = [];
    jest.spyOn(globalThis, 'fetch' as any).mockImplementation(async (url: string) => {
      if (url.includes('/oauth/token')) {
        return { ok: true, status: 200, text: async () => JSON.stringify({ access_token: 'tok-x', expires_in: 3600 }) } as any;
      }
      posts.push(url);
      if (url.endsWith('/sms/send')) {
        return { ok: false, status: 404, text: async () => 'no such action' } as any;
      }
      if (url.endsWith('/messages/send')) {
        return { ok: false, status: 400, text: async () => JSON.stringify({ success: false, error: 'rejected' }) } as any;
      }
      return { ok: false, status: 404, text: async () => 'no such action' } as any;
    });

    const resolver = makeResolver({
      'gateway.sms.bytewave.mode': 'oauth2',
      'gateway.sms.bytewave.api_url': 'https://portal.bytewavenetworks.com/api/v3/',
      'gateway.sms.bytewave.client_id': 'cid',
      'gateway.sms.bytewave.client_secret': 'csecret',
    });

    const res = await new ByteWaveSmsProvider(resolver).send({ to: '+254712345678', body: 'Hi' });
    expect(res.status).toBe('FAILED');
    // token + sms/send (404, fall through) + messages/send (400, stop). Must NOT try sms/messages.
    expect(posts).toEqual([
      expect.stringContaining('/sms/send'),
      expect.stringContaining('/messages/send'),
    ]);
  });

  it('throws a clear error when oauth2 credentials are missing', async () => {
    const resolver = makeResolver({ 'gateway.sms.bytewave.mode': 'oauth2' });
    await expect(
      new ByteWaveSmsProvider(resolver).send({ to: '+254712345678', body: 'Hi' }),
    ).rejects.toThrow(/OAuth2 is not configured/);
  });
});
