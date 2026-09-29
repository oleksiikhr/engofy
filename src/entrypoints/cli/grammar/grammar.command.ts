import { Command, CommandRunner } from 'nest-commander';
import { GrammarAnnotatePagesCommand } from './grammar-annotate-pages.command.js';
import { GrammarImportEgpCommand } from './grammar-import-egp.command.js';
import { GrammarImportIrregularVerbsCommand } from './grammar-import-irregular-verbs.command.js';
import { GrammarImportUsagePointContentCommand } from './grammar-import-usage-point-content.command.js';
import { GrammarImportUsagePointExercisesCommand } from './grammar-import-usage-point-exercises.command.js';

@Command({
  name: 'grammar',
  subCommands: [
    GrammarImportIrregularVerbsCommand,
    GrammarImportEgpCommand,
    GrammarImportUsagePointExercisesCommand,
    GrammarImportUsagePointContentCommand,
    GrammarAnnotatePagesCommand,
  ],
  description: 'Grammar and reference-data import commands',
})
export class GrammarCommand extends CommandRunner {
  async run(): Promise<void> {
    // Handled by subcommands
  }
}
