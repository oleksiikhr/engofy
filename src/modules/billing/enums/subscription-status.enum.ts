// Only `active` exists as a stored state — a lapsed subscription is derived at
// read time from `currentPeriodEnd <= now()`, never written back (PLAN.md §8).
export enum SubscriptionStatus {
  Active = 'active',
}
