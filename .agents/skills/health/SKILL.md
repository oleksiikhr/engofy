---
name: health
description: Report on Sentry (and, once connected, Axiom) health for this repo — either a periodic snapshot (last N hours, read-only) or a post-deploy check anchored to a specific commit/tag/time. Always loads the `observability` skill first for the current project/dataset slugs — never hardcodes them. When anchored to a deploy and an anomaly clearly points at a bug in the just-shipped code, proposes a diagnosis and fix and waits for explicit confirmation before touching anything; otherwise offers to note it in a plan file. Triggers regardless of language — e.g. "check for errors after the deploy" / "перевір помилки після деплою", "how's everything looking, last 3 hours" / "як там справи за останні 3 години", "post-deploy check for abc1234" / "перевір деплой abc1234", "any anomalies today" / "чи є аномалії сьогодні".
---

# Health Skill

Reports Sentry (and Axiom, once it's connected) health for this repo, either as a periodic snapshot
or anchored to a deploy. Always loads `observability` (Skill tool) first — that skill is the source
of truth for project/dataset slugs; this file never hardcodes one.

## Two forms

- **Periodic report** (no deploy argument): a period like `3h`, `24h`, `30m` — default `3h` if
  nothing is given. Read-only — never touches code or a Sentry issue.
- **Post-deploy check** (deploy argument: a git SHA/tag, or an explicit time): window runs from that
  commit's/deploy's time to now. This repo deploys by pushing a `v*` tag
  (`.github/workflows/deploy.yaml`) — merging a PR to `main` does not deploy on its own, so "the
  deploy" means the tag push, not the merge. May end in proposing a fix — see Step 7.

## Step 1 — Load observability context

Skill tool → `observability`. Pull its Entity Map: the Sentry project slug for the backend (ask the
developer if it isn't filled in yet — see that skill's Prerequisites) and whether Axiom has been
connected. As of writing, Axiom is not connected at all — treat every Axiom-shaped step below as a
no-op and say so explicitly in the report, don't silently skip it.

## Step 2 — Determine the window and mode

- Argument matches a period (`\d+[hm]`, e.g. `3h`, `24h`, `30m`) → periodic report, that period.
- No argument at all → periodic report, default `3h`.
- Argument looks like a git ref or an explicit timestamp → post-deploy check. Resolve the commit/tag
  time with `git log -1 --format=%cI <ref>`; window = that time → now.
- Argument doesn't parse as either → ask the user rather than guessing which mode is meant.

## Step 3 — Determine which area is in scope

- Argument names an area explicitly (`backend`, `apps/web`, `nlp-service`) → use that.
- Else infer from what actually changed recently: `git log --oneline -10` and/or a diff of the
  current branch against `main` — which of `src/`/`test/` (backend), `apps/web`, or `nlp-service` the
  recent commits touch.
- Else default to whatever `observability` says has any monitoring at all — today that's only the
  backend (Sentry); `apps/web` and `nlp-service` have no error-tracking SDK, so there's nothing to
  check for them beyond CI results and manual reproduction.

## Step 4 — Sentry

If the backend is in scope and a real Sentry project slug is known (per `observability`):
`mcp__sentry__search_issues` over the window. Flag separately: issues that are new within the window
(not seen before it), and existing unresolved issues with a sharp jump in event count.

If no real Sentry project slug is known yet, say so plainly in the report (Step 6) and skip this step
rather than guessing at a slug.

## Step 5 — Axiom

Not connected for this project (see `observability`). Report this explicitly — "no Axiom coverage,
not connected yet" — rather than omitting the section or reporting "no anomalies found."

## Step 6 — Report

Compact table or list: new/escalated Sentry issues (or "Sentry not configured yet" if that's the
state), explicit note that Axiom isn't connected. If nothing stands out, say so in one line instead of
expanding empty sections.

## Step 7 — Post-deploy follow-up (post-deploy check mode only)

- **Anomaly clearly traces to a specific bug in the just-deployed code**: if the anomaly is (or
  includes) a Sentry issue, hand off to the `sentry-debug-issue` skill for the actual
  root-cause-and-fix work — it already knows how to pull full issue context, run Seer, verify against
  the code, and ship the fix via `git-workflow`; don't reimplement a shorter version of that flow
  here. Never push or redeploy on your own initiative.
- **Cause isn't obvious, or the fix is non-trivial**: ask whether to write (or add to) a plan file at
  `.claude/plans/<slug>.md` for it — this repo tracks follow-up work as plan files, not an external
  issue tracker. Don't invent a separate issue-creation path here; hand off to the `task` skill if a
  new plan is warranted.
- Periodic-report mode never reaches this step — it stops at Step 6.

## Boundaries

This skill does not:
- Hardcode a Sentry project slug or claim Axiom coverage that doesn't exist — always sourced live
  from `observability` at Step 1.
- Push code, redeploy, or resolve a Sentry issue without explicit confirmation.
- Report "no anomalies" when the underlying check couldn't actually run (no configured slug, no
  Axiom, an auth failure).
