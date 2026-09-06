import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Logger } from '@nestjs/common';
import { SubCommand } from 'nest-commander';
import { parseIrregularVerbs } from '../../../modules/post/domain/irregular-verb.js';
import { Word } from '../../../modules/post/entities/word.entity.js';
import { CliCommandRunner } from '../cli-command.runner.js';

const ASSET_PATH = join(process.cwd(), 'assets', 'irregular-verbs.json');

// Ensures a `words` row exists for every irregular verb's base form
// (assets/irregular-verbs.json). Idempotent — re-running only fills gaps. The
// inflected forms live in the JSON, not the DB (PLAN.md §3.3).
@SubCommand({
  name: 'import-irregular-verbs',
  description: `Seed words with irregular-verb base forms from ${ASSET_PATH}`,
})
export class GrammarImportIrregularVerbsCommand extends CliCommandRunner {
  private readonly logger = new Logger(this.constructor.name);

  protected async execute(): Promise<void> {
    const entries = parseIrregularVerbs(
      JSON.parse(await readFile(ASSET_PATH, 'utf-8')),
    );

    const em = this.orm.em;
    const existing = await em.find(Word, {}, { fields: ['lemma'] as const });
    const known = new Set(existing.map((w) => w.lemma.toLowerCase()));

    let created = 0;
    for (const entry of entries) {
      if (known.has(entry.base_form.toLowerCase())) {
        continue;
      }

      const word = new Word();
      word.lemma = entry.base_form;
      em.persist(word);
      known.add(entry.base_form.toLowerCase());
      created += 1;
    }

    await em.flush();

    this.logger.log(
      { total: entries.length, created, skipped: entries.length - created },
      'irregular verbs imported',
    );
  }
}
