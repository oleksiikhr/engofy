import { DECK_KEY } from './guest-deck';
import { EXPLORED_KEY } from './guest-progress';

// Guest state that lives in localStorage and changes the page layout, put on
// <html> before first paint so the server-rendered markup never reflows once
// scripts run. Layout.astro inlines `guestBootScript()` in <head> for guests;
// CSS reacts to the attributes:
//   data-guest-nudge="saved|explored"  the sign-up nudge is due (lib/guest-header.ts)
//   data-guest-explored                the explored-words count has a value (lib/reader-guest.ts)

export const NUDGE_DISMISSED_KEY = 'guest-nudge-dismissed';
// Saved cards or explored words at which the sign-up nudge appears.
export const NUDGE_SAVED_AT = 3;
export const NUDGE_EXPLORED_AT = 10;

export type NudgeVariant = 'saved' | 'explored';

// Which nudge the guest's progress calls for, or null while none is due.
export function nudgeVariant(
  saved: number,
  explored: number,
): NudgeVariant | null {
  if (saved >= NUDGE_SAVED_AT) {
    return 'saved';
  }
  return explored >= NUDGE_EXPLORED_AT ? 'explored' : null;
}

// Self-contained JS for the inline <head> script; it repeats `nudgeVariant`
// and the storage validation because it can't import module code. A value it
// reads slightly differently is corrected when the page scripts run.
export function guestBootScript(): string {
  const spec = {
    explored: EXPLORED_KEY,
    deck: DECK_KEY,
    dismissed: NUDGE_DISMISSED_KEY,
    savedAt: NUDGE_SAVED_AT,
    exploredAt: NUDGE_EXPLORED_AT,
  };
  return `try{var d=document.documentElement.dataset,s=${JSON.stringify(spec)},a=function(k){try{var v=JSON.parse(localStorage.getItem(k));return Array.isArray(v)?v:[]}catch(e){return[]}},
n=new Set(a(s.explored).filter(function(x){return typeof x==="string"&&x})).size,
c=a(s.deck).filter(function(x){return x&&typeof x.id==="string"&&x.id}).length;
if(n)d.guestExplored="";
if(localStorage.getItem(s.dismissed)!=="1"){var v=c>=s.savedAt?"saved":n>=s.exploredAt?"explored":"";if(v)d.guestNudge=v}}catch(e){}`;
}
