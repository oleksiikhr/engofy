// Mirrors ts-fsrs State (New=0, Learning=1, Review=2, Relearning=3); stored as
// text, mapped to/from the numeric enum in the SRS service (Slice 6).
export enum LearningCardState {
  New = 'new',
  Learning = 'learning',
  Review = 'review',
  Relearning = 'relearning',
}
