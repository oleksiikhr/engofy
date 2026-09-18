import { LearningCardState } from '../enums/learning-card-state.enum.js';
import { capNewCards, DAILY_NEW_CARD_LIMIT } from './daily-new-card-limit.js';

function newCard(id: number) {
  return { id, state: LearningCardState.New };
}

function reviewCard(id: number) {
  return { id, state: LearningCardState.Review };
}

describe('capNewCards', () => {
  it('passes every card through with no holdbacks under the limit', () => {
    const cards = [newCard(1), reviewCard(2), newCard(3)];

    const { cards: result, heldBackCount } = capNewCards(cards);

    expect(result).toEqual(cards);
    expect(heldBackCount).toBe(0);
  });

  it('drops New cards past the limit but keeps every review/relearning card', () => {
    const newCards = Array.from({ length: DAILY_NEW_CARD_LIMIT + 3 }, (_, i) =>
      newCard(i),
    );
    const cards = [reviewCard(-1), ...newCards, reviewCard(-2)];

    const { cards: result, heldBackCount } = capNewCards(cards);

    expect(
      result.filter((c) => c.state === LearningCardState.New),
    ).toHaveLength(DAILY_NEW_CARD_LIMIT);
    expect(
      result.filter((c) => c.state === LearningCardState.Review),
    ).toHaveLength(2);
    expect(heldBackCount).toBe(3);
  });

  it('preserves input order', () => {
    const cards = Array.from({ length: DAILY_NEW_CARD_LIMIT }, (_, i) =>
      newCard(i),
    );

    const { cards: result } = capNewCards(cards);

    expect(result.map((c) => c.id)).toEqual(cards.map((c) => c.id));
  });
});
