import { Module } from '@nestjs/common';
import { GrammarCommand } from './grammar.command.js';
import { GrammarImportEgpCommand } from './grammar-import-egp.command.js';
import { GrammarImportIrregularVerbsCommand } from './grammar-import-irregular-verbs.command.js';

@Module({
  providers: [
    GrammarCommand,
    GrammarImportIrregularVerbsCommand,
    GrammarImportEgpCommand,
  ],
})
export class GrammarCliModule {}
