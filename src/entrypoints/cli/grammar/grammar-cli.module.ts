import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import AppConfig from '../../../core/config/app.config.js';
import { PostModule } from '../../../modules/post/post.module.js';
import { GrammarCommand } from './grammar.command.js';
import { GrammarAnnotatePagesCommand } from './grammar-annotate-pages.command.js';
import { GrammarImportEgpCommand } from './grammar-import-egp.command.js';
import { GrammarImportIrregularVerbsCommand } from './grammar-import-irregular-verbs.command.js';
import { GrammarImportUsagePointContentCommand } from './grammar-import-usage-point-content.command.js';
import { GrammarImportUsagePointExercisesCommand } from './grammar-import-usage-point-exercises.command.js';

@Module({
  imports: [PostModule, ConfigModule.forFeature(AppConfig)],
  providers: [
    GrammarCommand,
    GrammarImportIrregularVerbsCommand,
    GrammarImportEgpCommand,
    GrammarImportUsagePointExercisesCommand,
    GrammarImportUsagePointContentCommand,
    GrammarAnnotatePagesCommand,
  ],
})
export class GrammarCliModule {}
