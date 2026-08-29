import { Command, CommandRunner } from 'nest-commander';
import { GrammarImportEgpCommand } from './grammar-import-egp.command.js';
import { GrammarImportIrregularVerbsCommand } from './grammar-import-irregular-verbs.command.js';

@Command({
  name: 'grammar',
  subCommands: [GrammarImportIrregularVerbsCommand, GrammarImportEgpCommand],
  description: 'Grammar and reference-data import commands',
})
export class GrammarCommand extends CommandRunner {
  async run(): Promise<void> {
    // Handled by subcommands
  }
}
