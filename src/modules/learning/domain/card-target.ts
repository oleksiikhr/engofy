import { InvalidCardTargetError } from '../errors/invalid-card-target.error.js';

export type CardTargetType = 'word' | 'phrase' | 'grammar';

export interface CardTarget {
  type: CardTargetType;
  id: string;
}

export interface CardTargetInput {
  wordId?: string | null;
  phraseId?: string | null;
  grammarUsagePointId?: string | null;
}

// A learning card points at exactly one of word / phrase / grammar usage
// point (PLAN.md §3.5, mirrored by the learning_cards_exactly_one_target
// check constraint). Normalises the three nullable ids into one tagged
// target, rejecting zero or multiple.
export function resolveCardTarget(input: CardTargetInput): CardTarget {
  const targets: CardTarget[] = [];
  if (input.wordId) {
    targets.push({ type: 'word', id: input.wordId });
  }
  if (input.phraseId) {
    targets.push({ type: 'phrase', id: input.phraseId });
  }
  if (input.grammarUsagePointId) {
    targets.push({ type: 'grammar', id: input.grammarUsagePointId });
  }

  if (targets.length !== 1) {
    throw new InvalidCardTargetError(
      'Provide exactly one of wordId, phraseId or grammarUsagePointId.',
    );
  }

  return targets[0];
}
