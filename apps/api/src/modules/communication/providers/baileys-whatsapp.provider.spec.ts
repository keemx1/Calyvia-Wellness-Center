import { BaileysWhatsAppGateway } from './baileys-whatsapp.provider';

function makeGateway() {
  const gw = new BaileysWhatsAppGateway();
  (gw as any).baileys = { DisconnectReason: { loggedOut: 401 } };
  // Don't let a test leave a 5s reconnect timer running.
  (gw as any).scheduleReconnect = jest.fn();
  return gw;
}

describe('BaileysWhatsAppGateway', () => {
  it('captures the real close reason and exposes it in status', () => {
    const gw = makeGateway();

    gw.handleConnectionUpdate({
      connection: 'close',
      lastDisconnect: {
        error: { message: 'websocket error', output: { statusCode: 515 } },
      },
    });

    expect(gw.getStatus()).toMatchObject({
      status: 'disconnected',
      connected: false,
      lastDisconnect: { statusCode: 515, message: 'websocket error' },
    });
    expect((gw as any).scheduleReconnect).toHaveBeenCalled();
  });

  it('treats a logged-out close differently from a network close', () => {
    const gw = makeGateway();

    gw.handleConnectionUpdate({
      connection: 'close',
      lastDisconnect: { error: { message: 'Logged out', output: { statusCode: 401 } } },
    });

    expect(gw.getStatus().status).toBe('closed');
    expect((gw as any).scheduleReconnect).not.toHaveBeenCalled();
  });

  it('resolves pairing waiters when a QR arrives', async () => {
    const gw = makeGateway();
    const waiting = (gw as any).waitForQr(2000);

    gw.handleConnectionUpdate({ qr: 'data:image/png;base64,AAAA' });

    await expect(waiting).resolves.toBeUndefined();
    expect(gw.getStatus()).toMatchObject({ status: 'awaiting_qr', qr: 'data:image/png;base64,AAAA' });
  });

  it('reports the last close reason when the socket never reaches QR', async () => {
    const gw = makeGateway();
    gw.handleConnectionUpdate({
      connection: 'close',
      lastDisconnect: { error: { message: 'ETIMEDOUT' } },
    });

    await expect((gw as any).waitForQr(20)).rejects.toThrow(
      /did not reach pairing state.*ETIMEDOUT/s,
    );
  });

  it('requests a pairing code with country-code digits once the socket is ready', async () => {
    const gw = makeGateway();
    (gw as any).start = jest.fn(async () => {});
    (gw as any).status = 'awaiting_qr';
    const requestPairingCode = jest.fn(async () => 'ABCD-1234');
    (gw as any).sock = { requestPairingCode };

    const code = await gw.requestPairingCode('+254703377395');

    expect(requestPairingCode).toHaveBeenCalledWith('254703377395');
    expect(code).toBe('ABCD-1234');
    expect(gw.getStatus().pairingCode).toBe('ABCD-1234');
  });

  it('waits for QR before asking for a pairing code', async () => {
    const gw = makeGateway();
    (gw as any).start = jest.fn(async () => {});
    const requestPairingCode = jest.fn(async () => 'WXYZ-9876');
    (gw as any).sock = { requestPairingCode };

    const pending = gw.requestPairingCode('+254703377395', 2000);
    expect(requestPairingCode).not.toHaveBeenCalled();

    gw.handleConnectionUpdate({ qr: 'data:image/png;base64,BBBB' });
    await expect(pending).resolves.toBe('WXYZ-9876');
    expect(requestPairingCode).toHaveBeenCalledWith('254703377395');
  });

  it('exposes the protocol version source for diagnostics', () => {
    const gw = makeGateway();
    (gw as any).versionInfo = { version: [2, 3000, 1234567], source: 'bundled' };

    expect(gw.getStatus()).toMatchObject({
      baileysVersion: '2.3000.1234567',
      versionSource: 'bundled',
    });
  });

  it('uses the bundled protocol revision by default (no GitHub master fetch)', async () => {
    const gw = makeGateway();
    const fetchLatest = jest.fn();
    (gw as any).baileys.fetchLatestBaileysVersion = fetchLatest;
    delete process.env.BAILEYS_USE_LATEST_VERSION;
    delete process.env.BAILEYS_CLIENT_VERSION;

    await expect(gw.resolveVersion()).resolves.toBeUndefined();
    expect(fetchLatest).not.toHaveBeenCalled();
    expect(gw.getStatus()).toMatchObject({ versionSource: 'bundled', baileysVersion: null });
  });

  it('honours an explicitly pinned client revision', async () => {
    const gw = makeGateway();
    process.env.BAILEYS_CLIENT_VERSION = '2.3000.1043857760';
    try {
      await expect(gw.resolveVersion()).resolves.toEqual([2, 3000, 1043857760]);
      expect(gw.getStatus()).toMatchObject({
        versionSource: 'override',
        baileysVersion: '2.3000.1043857760',
      });
    } finally {
      delete process.env.BAILEYS_CLIENT_VERSION;
    }
  });

  it('rejects a malformed pinned revision instead of sending garbage to WhatsApp', async () => {
    const gw = makeGateway();
    process.env.BAILEYS_CLIENT_VERSION = 'latest';
    try {
      await expect(gw.resolveVersion()).rejects.toThrow(/invalid/);
    } finally {
      delete process.env.BAILEYS_CLIENT_VERSION;
    }
  });

  it('fails a pending pairing request immediately when the socket closes with 428', async () => {
    const gw = makeGateway();
    const waiting = (gw as any).waitForQr(5000);

    gw.handleConnectionUpdate({
      connection: 'close',
      lastDisconnect: { error: { message: 'Connection Terminated', output: { statusCode: 428 } } },
    });

    await expect(waiting).rejects.toThrow(/code=428.*WebSocket access/s);
    expect(gw.getStatus()).toMatchObject({
      status: 'disconnected',
      lastDisconnect: { statusCode: 428, message: 'Connection Terminated' },
      qr: null,
    });
  });
});
