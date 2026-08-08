import { MikroORM } from '@mikro-orm/core';
import { Inject } from '@nestjs/common';
import { CommandRunner } from 'nest-commander';
import { withRequestContext } from '../../core/database/helpers/request-context.helper.js';

export abstract class CliCommandRunner<
  O extends object = Record<string, unknown>,
> extends CommandRunner {
  @Inject(MikroORM)
  protected readonly orm!: MikroORM;

  override async run(
    args: string[],
    options?: Record<string, unknown>,
  ): Promise<void> {
    await withRequestContext(this.orm.em, () =>
      this.execute(args, (options ?? {}) as O),
    );
  }

  protected abstract execute(args: string[], options?: O): Promise<void>;
}
