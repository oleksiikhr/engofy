import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Logger } from '@nestjs/common';
import { SubCommand } from 'nest-commander';
import { parseUsagePointContentSeedFile } from '../../../modules/post/domain/usage-point-content-seed.js';
import { GrammarUsagePoint } from '../../../modules/post/entities/grammar-usage-point.entity.js';
import { ContentLanguage } from '../../../modules/post/enums/content-language.enum.js';
import { CliCommandRunner } from '../cli-command.runner.js';

const ASSET_PATH = join(
  process.cwd(),
  'assets',
  'grammar-usage-point-content.json',
);

// Loads hand-written learner content (explanation, examples, uk translation)
// from assets/grammar-usage-point-content.json (format documented in
// assets/README.md; content is written in a separate session, no AI call
// here). The seed is authoritative: every usage point it lists is
// overwritten, so re-running picks up edits. grammar_enrichment then skips
// these points (it only gap-fills missing translations).
@SubCommand({
  name: 'import-usage-point-content',
  description: `Seed usage-point learner content from ${ASSET_PATH}`,
})
export class GrammarImportUsagePointContentCommand extends CliCommandRunner {
  private readonly logger = new Logger(this.constructor.name);

  protected async execute(): Promise<void> {
    const seed = parseUsagePointContentSeedFile(
      JSON.parse(await readFile(ASSET_PATH, 'utf-8')),
    );
    const em = this.orm.em;

    const egpIndexes = Object.keys(seed).map(Number);
    const usagePoints = await em.find(GrammarUsagePoint, {
      egpIndex: { $in: egpIndexes },
    });
    const usagePointByEgpIndex = new Map(
      usagePoints.map((p) => [p.egpIndex, p]),
    );

    const missing = egpIndexes.filter((i) => !usagePointByEgpIndex.has(i));
    if (missing.length > 0) {
      throw new Error(
        `Seed references egpIndex(es) with no matching usage point: ${missing.join(', ')}`,
      );
    }

    for (const [key, content] of Object.entries(seed)) {
      const usagePoint = usagePointByEgpIndex.get(Number(key));
      if (!usagePoint) {
        continue;
      }
      usagePoint.learnerExplanation = content.explanation;
      usagePoint.learnerExamples = content.examples;
      usagePoint.translations = {
        ...usagePoint.translations,
        [ContentLanguage.Uk]: { explanation: content.uk.explanation },
      };
    }

    await em.flush();

    this.logger.log(
      { usagePointsImported: egpIndexes.length },
      'Usage-point learner content imported',
    );
  }
}
