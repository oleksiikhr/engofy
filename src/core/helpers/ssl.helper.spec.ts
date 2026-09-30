import { tlsOptions } from './ssl.helper.js';

describe('tlsOptions', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('is off unless <PREFIX>_SSL is enabled', () => {
    expect(tlsOptions('DB')).toBeUndefined();

    vi.stubEnv('DB_SSL', 'false');

    expect(tlsOptions('DB')).toBeUndefined();
  });

  it('verifies the server certificate and passes the CA through', () => {
    vi.stubEnv('DB_SSL', 'true');
    vi.stubEnv('DB_SSL_CA', '-----BEGIN CERTIFICATE-----');

    expect(tlsOptions('DB')).toEqual({
      ca: '-----BEGIN CERTIFICATE-----',
      rejectUnauthorized: true,
    });
  });

  it('keeps the prefixes independent', () => {
    vi.stubEnv('REDIS_SSL', 'true');

    expect(tlsOptions('DB')).toBeUndefined();
    expect(tlsOptions('REDIS')).toMatchObject({ rejectUnauthorized: true });
  });
});
