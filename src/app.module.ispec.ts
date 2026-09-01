import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from './app.module.js';

type EntrypointName = Exclude<
  {
    [K in keyof typeof AppModule]: (typeof AppModule)[K] extends () => object
      ? K
      : never;
  }[keyof typeof AppModule],
  'common'
>;

const entrypoints = Object.getOwnPropertyNames(AppModule).filter(
  (name): name is EntrypointName =>
    name !== 'common' &&
    typeof AppModule[name as keyof typeof AppModule] === 'function',
);

// This is a DI-graph smoke test: `.compile()` resolves every provider in each
// entrypoint composition, which is what a module-wiring regression breaks.
// It deliberately stops short of `.init()` — the lifecycle hooks that would run
// (`WorkerRegistrarService` calling `boss.work()`, `@nestjs/schedule` starting
// cron timers, `PgBoss*` shutdown hooks) act on real pg-boss / cron infra a
// unit-level smoke test must not touch. Runtime behaviour of those services is
// covered by their own `.ispec.ts` / `.spec.ts` against fakes.
describe('AppModule', () => {
  let moduleRef: TestingModule;

  afterEach(async () => {
    await moduleRef?.close();
  });

  it.each(entrypoints)(
    'should compile %s module without errors',
    async (moduleType) => {
      moduleRef = await Test.createTestingModule({
        imports: [AppModule[moduleType]()],
      }).compile();

      expect(moduleRef).toBeDefined();
    },
  );
});
