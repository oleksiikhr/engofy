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
