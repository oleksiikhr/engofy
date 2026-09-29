import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { EntityManager } from '@mikro-orm/postgresql';
import { Logger } from '@nestjs/common';
import { SubCommand } from 'nest-commander';
import { parsePhraseContentSeedFile } from '../../../modules/post/domain/lexicon-content-seed.js';
import { upsertPhraseId } from '../../../modules/post/domain/upsert-phrase-id.js';
import { Phrase } from '../../../modules/post/entities/phrase.entity.js';
import { ContentLanguage } from '../../../modules/post/enums/content-language.enum.js';
import { CliCommandRunner } from '../cli-command.runner.js';

const ASSET_PATH = join(process.cwd(), 'assets', 'phrase-content.json');

// Loads hand-written dictionary entries for the phrases of the handcrafted
// grammar pages (phrasal verbs spaCy groups there, and the idioms / fixed
// expressions `grammar annotate-pages` links from this same list) from
// assets/phrase-content.json. The Phrase is created when missing; the seed is
// authoritative, so re-running picks up edits.
@SubCommand({
  name: 'import-phrase-content',
  description: `Seed phrase dictionary entries from ${ASSET_PATH}`,
})
export class WordsImportPhraseContentCommand extends CliCommandRunner {
  private readonly logger = new Logger(this.constructor.name);

  constructor(private readonly em: EntityManager) {
    super();
  }

  protected async execute(): Promise<void> {
    const seed = parsePhraseContentSeedFile(
      JSON.parse(await readFile(ASSET_PATH, 'utf-8')),
    );

    for (const [text, entry] of Object.entries(seed)) {
      // biome-ignore lint/performance/noAwaitInLoops: sequential on purpose — each upsert is its own round trip against the lower(phrase_text) index.
      const phraseId = await upsertPhraseId(this.em, text, entry.type ?? null);
      const phrase = await this.em.findOneOrFail(Phrase, phraseId);
      phrase.definition = entry.definition;
      phrase.exampleSentence = entry.example;
      phrase.cefrLevel = entry.cefrLevel;
      phrase.translations = {
        ...phrase.translations,
        [ContentLanguage.Uk]: { translation: entry.uk.translation },
      };
    }

    await this.em.flush();

    this.logger.log(
      { phrasesImported: Object.keys(seed).length },
      'Phrase content imported',
    );
  }
}
