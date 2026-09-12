---
name: sync-dashboard
description: Propose and (once confirmed) apply Axiom dashboard chart updates tied to a feature's new log fields/events. Loads `observability` first and checks whether Axiom is connected at all — as of writing it isn't, so this skill currently stops at that check every time. Kept here, ready to work unchanged, for whenever Axiom does get wired up. Triggers regardless of language — e.g. "update the dashboard for the new endpoint" / "онови dashboard під новий ендпоінт", "add a chart for this feature's logs" / "додай чарт під логи цієї фічі", "sync the Axiom dashboard" / "синхронізуй Axiom dashboard".
---

# Sync-dashboard Skill

Keeps this project's Axiom dashboard in step with a feature's new logging — proposes concrete,
feature-scoped charts and applies them only after confirmation. This is shared, team-visible
infrastructure once it exists; nothing here writes to it without an explicit go-ahead.

**Axiom is not connected to this project yet** (see `observability`'s Entity Map — no workspace, no
dataset, no dashboard). Until that changes, this skill will always stop at Step 2 below. It's kept as
a real, working skill rather than deleted so that the moment Axiom is added, this flow works without
needing to be rewritten — check `observability`'s Entity Map live rather than trusting this note to
still be accurate.

## Step 1 — Determine the feature and its area

- Argument given → use it as the feature description, and identify which of `src/`/`test/` (backend),
  `apps/web`, or `nlp-service` it belongs to.
- Else infer from the current branch: `git log --oneline -10` and a diff against the base branch —
  what actually changed, and where.

## Step 2 — Load observability context, confirm Axiom is connected

Skill tool → `observability`. Check whether Axiom has a workspace/dataset at all for this project:
- Not connected (today's state) → say so and stop. There's nothing to sync yet.
- Connected → pull the dataset id and dashboard id from the Entity Map rather than hardcoding them
  here; if they ever drift, `observability` is the source of truth.

## Step 3 — Find the new signal in logs

- `mcp__axiom__getDatasetFields` on the dataset — current field schema.
- `mcp__axiom__queryDataset` (APL) over recent logs (last few hours) — check whether the feature is
  already emitting new fields, event types, or statuses tied to its logic.
- If the feature hasn't deployed yet and there's nothing new in the logs — say so and stop. Nothing to
  sync yet.

## Step 4 — Show the current dashboard

`mcp__axiom__getDashboard({dashboardId: "<from observability>"})` — list existing charts so the
proposal in Step 5 doesn't duplicate one that's already there.

## Step 5 — Propose changes

1-3 concrete new/updated charts (name, APL query, chart type), each tied specifically to this
feature's logs — not a general dashboard tidy-up. Show the proposal and **wait for explicit
confirmation** — this dashboard is shared infrastructure everyone who opens it sees.

## Step 6 — Apply

Once confirmed: `mcp__axiom__updateDashboard` / `updateDashboardChart` (or `createDashboard` only if
the developer explicitly wants a first dashboard created — not the normal case, since Step 2 already
stops if Axiom isn't connected at all). Report the dashboard link after applying.

## Boundaries

This skill does not:
- Assume Axiom is connected — always checked live against `observability`'s Entity Map at Step 2.
- Hardcode a dataset/dashboard id — always sourced from `observability`.
- Apply any dashboard change without explicit confirmation.
