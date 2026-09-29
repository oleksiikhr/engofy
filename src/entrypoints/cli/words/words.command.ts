import { Command, CommandRunner } from 'nest-commander';
import { WordsImportFrequencyCommand } from './words-import-frequency.command.js';
import { WordsImportLexiconContentCommand } from './words-import-lexicon-content.command.js';
import { WordsImportPhraseContentCommand } from './words-import-phrase-content.command.js';

@Command({
  name: 'words',
  subCommands: [
    WordsImportFrequencyCommand,
    WordsImportLexiconContentCommand,
    WordsImportPhraseContentCommand,
  ],
  description: 'Word reference-data commands',
})
export class WordsCommand extends CommandRunner {
  async run(): Promise<void> {
    // Handled by subcommands
  }
}
