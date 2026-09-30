import QueueConfig from './queue.config.js';

describe('QueueConfig', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('shares the MikroORM host and port by default', () => {
    vi.stubEnv('MIKRO_ORM_HOST', 'db.internal');
    vi.stubEnv('MIKRO_ORM_PORT', '6432');

    expect(QueueConfig()).toMatchObject({ host: 'db.internal', port: 6432 });
  });

  it('prefers QUEUE_DB_HOST and QUEUE_DB_PORT for the direct connection', () => {
    vi.stubEnv('MIKRO_ORM_HOST', 'pooler.internal');
    vi.stubEnv('MIKRO_ORM_PORT', '25061');
    vi.stubEnv('QUEUE_DB_HOST', 'db.internal');
    vi.stubEnv('QUEUE_DB_PORT', '25060');

    expect(QueueConfig()).toMatchObject({ host: 'db.internal', port: 25060 });
  });

  it('waits two minutes for in-flight jobs on shutdown by default', () => {
    expect(QueueConfig().shutdownTimeoutMs).toBe(120_000);

    vi.stubEnv('QUEUE_SHUTDOWN_TIMEOUT_MS', '45000');

    expect(QueueConfig().shutdownTimeoutMs).toBe(45_000);
  });
});
