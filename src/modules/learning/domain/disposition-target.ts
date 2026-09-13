import { InvalidCardTargetError } from '../errors/invalid-card-target.error.js';

export type DispositionTargetType = 'wordDefinition' | 'phrase' | 'grammar';

export interface DispositionTarget {
  type: DispositionTargetType;
  id: string;
}

export interface DispositionTargetInput {
  wordDefinitionId?: string | null;
  phraseId?: string | null;
  grammarUsagePointId?: string | null;
}

// A disposition points at exactly one of word definition / phrase / grammar
// usage point, mirroring `card-target.ts`'s target resolution but keyed by
// `wordDefinitionId` (one word sense), not `wordId` (see the entity comment
// on `LearningDisposition`).
export function resolveDispositionTarget(
  input: DispositionTargetInput,
): DispositionTarget {
  const targets: DispositionTarget[] = [];
  if (input.wordDefinitionId) {
    targets.push({ type: 'wordDefinition', id: input.wordDefinitionId });
  }
  if (input.phraseId) {
    targets.push({ type: 'phrase', id: input.phraseId });
  }
  if (input.grammarUsagePointId) {
    targets.push({ type: 'grammar', id: input.grammarUsagePointId });
  }

  if (targets.length !== 1) {
    throw new InvalidCardTargetError(
      'Provide exactly one of wordDefinitionId, phraseId or grammarUsagePointId.',
    );
  }

  return targets[0];
}
