import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Logger } from '@nestjs/common';
import { SubCommand } from 'nest-commander';
import { parseWordFrequencyList } from '../../../modules/post/domain/word-frequency.js';
import { Word } from '../../../modules/post/entities/word.entity.js';
import { CliCommandRunner } from '../cli-command.runner.js';

const LIST_PATH = join(process.cwd(), 'assets', 'word-frequency.txt');

// Sets words.frequency_rank on existing Word rows from the ranked list in
// assets/word-frequency.txt (PLAN.md §3.3). Idempotent — reassigns the rank
// every run; a lemma not in the list is left null.
@SubCommand({
  name: 'import-frequency',
  description: `Set words.frequency_rank from ${LIST_PATH}`,
})
export class WordsImportFrequencyCommand extends CliCommandRunner {
  private readonly logger = new Logger(this.constructor.name);

  protected async execute(): Promise<void> {
    const ranks = parseWordFrequencyList(await readFile(LIST_PATH, 'utf-8'));

    const em = this.orm.em;
    const words = await em.find(Word, {});

    let ranked = 0;
    for (const word of words) {
      const rank = ranks.get(word.lemma.toLowerCase()) ?? null;
      word.frequencyRank = rank;
      if (rank !== null) {
        ranked += 1;
      }
    }

    await em.flush();

    this.logger.log(
      {
        listSize: ranks.size,
        words: words.length,
        ranked,
        unranked: words.length - ranked,
      },
      'word frequencies imported',
    );
  }
}
