import type {
  CefrLevel,
  EffectiveState,
  GrammarRefConstruction,
  GrammarRefGroup,
} from './types';

// /grammar's filter state, carried in the URL: `?cefr=A1&cefr=B1&groupBy=time`.
// Absent params mean the defaults (every level, grouped by category).

export const GRAMMAR_CEFR_LEVELS: CefrLevel[] = [
  'A1',
  'A2',
  'B1',
  'B2',
  'C1',
  'C2',
];

export const GRAMMAR_GROUP_BY = ['category', 'time', 'cefr'] as const;
export type GrammarGroupBy = (typeof GRAMMAR_GROUP_BY)[number];

export const GRAMMAR_GROUP_BY_LABEL: Record<GrammarGroupBy, string> = {
  category: 'Category',
  time: 'Time',
  cefr: 'Level',
};

export const GRAMMAR_STATE_LABEL: Record<EffectiveState, string> = {
  new: 'New',
  learning: 'Learning',
  learned: 'Learned',
  skipped: 'Skipped',
};

// The "Start here" block lists this many constructions.
export const START_HERE_LIMIT = 4;

// The constructions to begin with at `level`: still untouched, easiest level
// equal to `level`, ones with a learner explanation first (list order is kept
// within each half).
export function startHereConstructions(
  groups: GrammarRefGroup[],
  level: CefrLevel,
  limit = START_HERE_LIMIT,
): GrammarRefConstruction[] {
  const seen = new Set<string>();
  const candidates = groups
    .flatMap((group) => group.constructions)
    .filter((con) => {
      if (
        con.cefrLevel !== level ||
        con.state !== 'new' ||
        seen.has(con.slug)
      ) {
        return false;
      }
      seen.add(con.slug);
      return true;
    });
  return [
    ...candidates.filter((con) => con.summary),
    ...candidates.filter((con) => !con.summary),
  ].slice(0, limit);
}

export interface GrammarListQuery {
  cefr: CefrLevel[];
  groupBy: GrammarGroupBy;
}

// The form submits one `cefr` param per checked chip; the API's own
// comma-separated shape (`cefr=A1,B1`) is read the same way. Unknown values
// are dropped.
export function parseGrammarQuery(params: URLSearchParams): GrammarListQuery {
  const requested = new Set(
    params
      .getAll('cefr')
      .flatMap((value) => value.split(','))
      .map((value) => value.trim()),
  );
  const groupBy = params.get('groupBy') ?? '';
  return {
    cefr: GRAMMAR_CEFR_LEVELS.filter((level) => requested.has(level)),
    groupBy: (GRAMMAR_GROUP_BY as readonly string[]).includes(groupBy)
      ? (groupBy as GrammarGroupBy)
      : 'category',
  };
}

// Query string for `GET /content/grammar`.
export function toGrammarApiQuery(query: GrammarListQuery): string {
  const params = new URLSearchParams();
  if (query.cefr.length > 0) {
    params.set('cefr', query.cefr.join(','));
  }
  params.set('groupBy', query.groupBy);
  return params.toString();
}
