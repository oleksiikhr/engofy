import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Logger } from '@nestjs/common';
import { SubCommand } from 'nest-commander';
import { parseUsagePointExerciseSeedFile } from '../../../modules/post/domain/usage-point-exercise-seed.js';
import { GrammarUsagePoint } from '../../../modules/post/entities/grammar-usage-point.entity.js';
import { GrammarUsagePointExercise } from '../../../modules/post/entities/grammar-usage-point-exercise.entity.js';
import { CliCommandRunner } from '../cli-command.runner.js';

const ASSET_PATH = join(
  process.cwd(),
  'assets',
  'grammar-usage-point-exercises.json',
);

// Loads the usage-point exercise bank from assets/grammar-usage-point-
// -exercises.json (format documented in assets/README.md; content is written
// in a separate session, no AI call here). Idempotent per usage point, not
// per exercise: a usage point that already has any exercises is left alone —
// re-running the command only fills in usage points seeded for the first
// time (PLAN.md grammar-usage-point-exercises, slice 2).
@SubCommand({
  name: 'import-usage-point-exercises',
  description: `Seed the usage-point exercise bank from ${ASSET_PATH}`,
})
export class GrammarImportUsagePointExercisesCommand extends CliCommandRunner {
  private readonly logger = new Logger(this.constructor.name);

  protected async execute(): Promise<void> {
    const seed = parseUsagePointExerciseSeedFile(
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

    const alreadySeeded = new Set(
      (
        await em.find(GrammarUsagePointExercise, {
          usagePointId: { $in: usagePoints.map((p) => p.id) },
        })
      ).map((e) => e.usagePointId),
    );

    let usagePointsImported = 0;
    let exercisesImported = 0;
    for (const [key, exercises] of Object.entries(seed)) {
      const usagePoint = usagePointByEgpIndex.get(Number(key));
      if (!usagePoint || alreadySeeded.has(usagePoint.id)) {
        continue;
      }

      for (const seeded of exercises) {
        const exercise = new GrammarUsagePointExercise();
        exercise.usagePointId = usagePoint.id;
        exercise.type = seeded.type;
        exercise.payload = seeded.payload;
        em.persist(exercise);
        exercisesImported += 1;
      }
      usagePointsImported += 1;
    }

    await em.flush();

    this.logger.log(
      {
        egpIndexesInSeed: egpIndexes.length,
        usagePointsAlreadySeeded: alreadySeeded.size,
        usagePointsImported,
        exercisesImported,
      },
      'Usage-point exercise bank imported',
    );
  }
}
