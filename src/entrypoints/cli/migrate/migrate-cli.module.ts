import { Module } from '@nestjs/common';
import { MigrateCommand } from './migrate.command.js';
import { MigrateDownCommand } from './migrate-down.command.js';
import { MigrateUpCommand } from './migrate-up.command.js';

@Module({
  providers: [MigrateCommand, MigrateUpCommand, MigrateDownCommand],
})
export class MigrateCliModule {}
