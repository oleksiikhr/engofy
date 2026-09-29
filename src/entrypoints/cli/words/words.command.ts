import { Command, CommandRunner } from 'nest-commander';
import { WordsImportFrequencyCommand } from './words-import-frequency.command.js';
import { WordsImportLexiconContentCommand } from './words-import-lexicon-content.command.js';

@Command({
  name: 'words',
  subCommands: [WordsImportFrequencyCommand, WordsImportLexiconContentCommand],
  description: 'Word reference-data commands',
})
export class WordsCommand extends CommandRunner {
  async run(): Promise<void> {
    // Handled by subcommands
  }
}
