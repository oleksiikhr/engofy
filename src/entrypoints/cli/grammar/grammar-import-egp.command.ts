import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Logger } from '@nestjs/common';
import { SubCommand } from 'nest-commander';
import {
  buildCheatSheet,
  classifyEgpRecord,
  type EgpRecord,
  grammarConstructionSlug,
  parseEgpRecords,
} from '../../../modules/post/domain/egp.js';
import { GrammarCategory } from '../../../modules/post/entities/grammar-category.entity.js';
import { GrammarConstruction } from '../../../modules/post/entities/grammar-construction.entity.js';
import { GrammarUsagePoint } from '../../../modules/post/entities/grammar-usage-point.entity.js';
import { CliCommandRunner } from '../cli-command.runner.js';

const ASSET_PATH = join(process.cwd(), 'assets', 'egp.json');

// Seeds grammar_categories / grammar_constructions / grammar_usage_points from
// the Cambridge English Grammar Profile (assets/egp.json). Only USE and
// FORM/USE records become usage points; FORM: records feed each construction's
// cheat sheet (PLAN.md §3.4, §12). Idempotent — categories match on name,
// constructions on slug, usage points on egpIndex.
@SubCommand({
  name: 'import-egp',
  description: `Seed grammar reference data from ${ASSET_PATH}`,
})
export class GrammarImportEgpCommand extends CliCommandRunner {
  private readonly logger = new Logger(this.constructor.name);

  protected async execute(): Promise<void> {
    const records = parseEgpRecords(
      JSON.parse(await readFile(ASSET_PATH, 'utf-8')),
    );
    const em = this.orm.em;

    const categoryByName = new Map(
      (await em.find(GrammarCategory, {})).map((c) => [c.name, c]),
    );
    const constructionBySlug = new Map(
      (await em.find(GrammarConstruction, {})).map((c) => [c.slug, c]),
    );
    const usagePointByEgpIndex = new Map(
      (await em.find(GrammarUsagePoint, { egpIndex: { $ne: null } })).map(
        (p) => [p.egpIndex, p],
      ),
    );

    let categoryOrder = 0;
    const constructionOrderByCategory = new Map<string, number>();
    const recordsByConstruction = new Map<string, EgpRecord[]>();
    for (const record of records) {
      const slug = grammarConstructionSlug(record.category, record.subcategory);
      const bucket = recordsByConstruction.get(slug) ?? [];
      bucket.push(record);
      recordsByConstruction.set(slug, bucket);
    }

    let usagePoints = 0;
    for (const record of records) {
      let category = categoryByName.get(record.category);
      if (!category) {
        category = new GrammarCategory();
        category.name = record.category;
        category.sortOrder = categoryOrder;
        em.persist(category);
        categoryByName.set(record.category, category);
      }
      categoryOrder = Math.max(categoryOrder, category.sortOrder + 1);

      const slug = grammarConstructionSlug(record.category, record.subcategory);
      let construction = constructionBySlug.get(slug);
      if (!construction) {
        construction = new GrammarConstruction();
        construction.slug = slug;
        const next = constructionOrderByCategory.get(record.category) ?? 0;
        construction.sortOrder = next;
        constructionOrderByCategory.set(record.category, next + 1);
        em.persist(construction);
        constructionBySlug.set(slug, construction);
      }
      construction.categoryId = category.id;
      construction.name = record.subcategory;
      construction.cheatSheetContent = buildCheatSheet(
        recordsByConstruction.get(slug) ?? [],
      );

      if (classifyEgpRecord(record) !== 'use') {
        continue;
      }
      if (!record.can_do.trim()) {
        throw new Error(
          `EGP record #${record.index} is USE but has no can-do statement`,
        );
      }

      let point = usagePointByEgpIndex.get(record.index);
      if (!point) {
        point = new GrammarUsagePoint();
        point.egpIndex = record.index;
        em.persist(point);
        usagePointByEgpIndex.set(record.index, point);
      }
      point.constructionId = construction.id;
      point.cefrLevel = record.level;
      point.guideword = record.guideword;
      point.canDoStatement = record.can_do;
      point.exampleText = record.example;
      usagePoints += 1;
    }

    await em.flush();

    this.logger.log(
      {
        records: records.length,
        categories: categoryByName.size,
        constructions: constructionBySlug.size,
        usagePoints,
        skipped: records.length - usagePoints,
      },
      'EGP imported',
    );
  }
}
