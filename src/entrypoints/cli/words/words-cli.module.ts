import { Module } from '@nestjs/common';
import { WordsCommand } from './words.command.js';
import { WordsImportFrequencyCommand } from './words-import-frequency.command.js';

@Module({
  providers: [WordsCommand, WordsImportFrequencyCommand],
})
export class WordsCliModule {}
