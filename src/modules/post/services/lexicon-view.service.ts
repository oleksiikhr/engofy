import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import {
  EffectiveState,
  resolveEffectiveState,
} from '../../learning/domain/resolve-effective-state.js';
import { LearningCard } from '../../learning/entities/learning-card.entity.js';
import { LearningDisposition } from '../../learning/entities/learning-disposition.entity.js';
import { readLexiconTranslations } from '../domain/content-translations.js';
import { Phrase } from '../entities/phrase.entity.js';
import { Word } from '../entities/word.entity.js';
import { WordDefinition } from '../entities/word-definition.entity.js';
import type { CefrLevel } from '../enums/cefr-level.enum.js';
import type {
  PhraseAnnotationView,
  WordAnnotationView,
} from '../queries/get-post-detail/post-detail-view.js';

export interface Viewer {
  userId: string;
  userCefrLevel: CefrLevel;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

// The popup data for clickable words/phrases with the viewer's effective
// state — shared by a post's reader and a handcrafted grammar page.
@Injectable()
export class LexiconViewService {
  constructor(private readonly em: EntityManager) {}

  async resolveWords(
    wordDefinitionIds: string[],
    viewer: Viewer | null,
  ): Promise<Record<string, WordAnnotationView>> {
    if (wordDefinitionIds.length === 0) {
      return {};
    }
    const definitions = await this.em.find(
      WordDefinition,
      { id: { $in: wordDefinitionIds } },
      { disableIdentityMap: true },
    );
    const words = await this.em.find(
      Word,
      { id: { $in: unique(definitions.map((d) => d.wordId)) } },
      { disableIdentityMap: true },
    );
    const wordById = new Map(words.map((word) => [word.id, word]));
    const states = await this.resolveStates(
      viewer,
      'wordDefinitionId',
      definitions.map((d) => ({ id: d.id, cefrLevel: d.cefrLevel ?? null })),
    );

    const out: Record<string, WordAnnotationView> = {};
    for (const definition of definitions) {
      const word = wordById.get(definition.wordId);
      out[definition.id] = {
        wordDefinitionId: definition.id,
        wordId: definition.wordId,
        lemma: word?.lemma ?? '',
        pos: definition.pos,
        definition: definition.definition ?? null,
        phonetic: definition.phonetic ?? null,
        example: definition.exampleSentence ?? null,
        translations: readLexiconTranslations(definition.translations),
        cefrLevel: definition.cefrLevel ?? null,
        frequencyRank: word?.frequencyRank ?? null,
        state: states.get(definition.id) ?? EffectiveState.New,
      };
    }
    return out;
  }

  async resolvePhrases(
    phraseIds: string[],
    viewer: Viewer | null,
  ): Promise<Record<string, PhraseAnnotationView>> {
    if (phraseIds.length === 0) {
      return {};
    }
    const phrases = await this.em.find(
      Phrase,
      { id: { $in: phraseIds } },
      { disableIdentityMap: true },
    );
    const states = await this.resolveStates(
      viewer,
      'phraseId',
      phrases.map((p) => ({ id: p.id, cefrLevel: p.cefrLevel ?? null })),
    );

    const out: Record<string, PhraseAnnotationView> = {};
    for (const phrase of phrases) {
      out[phrase.id] = {
        phraseId: phrase.id,
        text: phrase.phraseText,
        type: phrase.type ?? null,
        definition: phrase.definition ?? null,
        example: phrase.exampleSentence ?? null,
        translations: readLexiconTranslations(phrase.translations),
        cefrLevel: phrase.cefrLevel ?? null,
        state: states.get(phrase.id) ?? EffectiveState.New,
      };
    }
    return out;
  }

  // Effective state per target id for a logged-in viewer (active card ->
  // disposition -> CEFR default -> New). An empty map means "all New".
  async resolveStates(
    viewer: Viewer | null,
    targetKey: 'wordDefinitionId' | 'phraseId' | 'grammarUsagePointId',
    targets: { id: string; cefrLevel: CefrLevel | null }[],
  ): Promise<Map<string, EffectiveState>> {
    const states = new Map<string, EffectiveState>();
    if (!viewer || targets.length === 0) {
      return states;
    }

    const ids = targets.map((t) => t.id);
    const [cards, dispositions] = await Promise.all([
      this.em.find(
        LearningCard,
        { userId: viewer.userId, [targetKey]: { $in: ids }, archivedAt: null },
        { disableIdentityMap: true },
      ),
      this.em.find(
        LearningDisposition,
        { userId: viewer.userId, [targetKey]: { $in: ids } },
        { disableIdentityMap: true },
      ),
    ]);
    const cardById = new Map(
      cards.map((card) => [card[targetKey] as string, card]),
    );
    const dispositionById = new Map(
      dispositions.map((d) => [d[targetKey] as string, d.disposition]),
    );

    for (const target of targets) {
      const card = cardById.get(target.id);
      states.set(
        target.id,
        resolveEffectiveState({
          card: card
            ? { state: card.state, scheduledDays: card.scheduledDays }
            : null,
          disposition: dispositionById.get(target.id) ?? null,
          targetCefrLevel: target.cefrLevel,
          userCefrLevel: viewer.userCefrLevel,
        }),
      );
    }
    return states;
  }
}
