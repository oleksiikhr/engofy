import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { EntityManager } from '@mikro-orm/postgresql';
import { Logger } from '@nestjs/common';
import { SubCommand } from 'nest-commander';
import { parseLexiconContentSeedFile } from '../../../modules/post/domain/lexicon-content-seed.js';
import { upsertWordDefinition } from '../../../modules/post/domain/upsert-word-definition.js';
import { WordDefinition } from '../../../modules/post/entities/word-definition.entity.js';
import { ContentLanguage } from '../../../modules/post/enums/content-language.enum.js';
import type { PartOfSpeech } from '../../../modules/post/enums/part-of-speech.enum.js';
import { CliCommandRunner } from '../cli-command.runner.js';

const ASSET_PATH = join(process.cwd(), 'assets', 'lexicon-content.json');

// Loads hand-written dictionary entries (definition, example, CEFR level, uk
// translation) from assets/lexicon-content.json (format documented in
// assets/README.md; content is written in a separate session, no AI call
// here) — the words of the handcrafted grammar pages. The Word /
// WordDefinition is created when missing; the seed is authoritative, so
// re-running picks up edits. The enrichment job then skips these senses (it
// only fills definitions with no translation yet).
@SubCommand({
  name: 'import-lexicon-content',
  description: `Seed dictionary entries from ${ASSET_PATH}`,
})
export class WordsImportLexiconContentCommand extends CliCommandRunner {
  private readonly logger = new Logger(this.constructor.name);

  constructor(private readonly em: EntityManager) {
    super();
  }

  protected async execute(): Promise<void> {
    const seed = parseLexiconContentSeedFile(
      JSON.parse(await readFile(ASSET_PATH, 'utf-8')),
    );
    const em = this.em;

    let imported = 0;
    for (const [lemma, senses] of Object.entries(seed)) {
      for (const [pos, entry] of Object.entries(senses)) {
        // biome-ignore lint/performance/noAwaitInLoops: sequential on purpose — each upsert must see the previous one's Word row.
        const { wordDefinitionId } = await upsertWordDefinition(
          em,
          lemma,
          pos as PartOfSpeech,
        );
        // biome-ignore lint/performance/noAwaitInLoops: see above.
        const definition = await em.findOneOrFail(
          WordDefinition,
          wordDefinitionId,
        );
        definition.definition = entry.definition;
        definition.exampleSentence = entry.example;
        definition.cefrLevel = entry.cefrLevel;
        definition.translations = {
          ...definition.translations,
          [ContentLanguage.Uk]: { translation: entry.uk.translation },
        };
        imported++;
      }
    }

    await em.flush();

    this.logger.log({ sensesImported: imported }, 'Lexicon content imported');
  }
}
