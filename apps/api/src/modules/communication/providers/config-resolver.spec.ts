import { resolveSmsProviderName } from './config-resolver';

describe('resolveSmsProviderName', () => {
  const original = process.env.NODE_ENV;

  afterEach(() => {
    if (original === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = original;
  });

  it('keeps mock available outside production (dev/tests still need a fake driver)', () => {
    process.env.NODE_ENV = 'test';
    expect(resolveSmsProviderName('mock')).toBe('mock');
    expect(resolveSmsProviderName(undefined)).toBe('');
  });

  it('never allows a stale mock setting in production', () => {
    process.env.NODE_ENV = 'production';
    expect(resolveSmsProviderName('mock')).toBe('bytewave');
    expect(resolveSmsProviderName('')).toBe('bytewave');
    expect(resolveSmsProviderName(undefined)).toBe('bytewave');
    expect(resolveSmsProviderName('BYTEWAVE')).toBe('bytewave');
  });
});
