---
name: observability
description: Apply this skill whenever checking, monitoring, or reporting on errors, logs, metrics, dashboards, or alerts for this repo — e.g. after a deploy, after shipping a feature, when asked to check for anomalies/errors/regressions, or when asked what's tracked where and how to look it up. Triggers regardless of language — e.g. "check for errors after the deploy" / "перевір, чи є помилки після деплою", "is everything OK with the backend?" / "глянь чи все ок з бекендом", "any anomalies today?" / "чи є аномалії/сплески сьогодні". This repo is a single project with three areas (`src/`+`test/` NestJS backend, `apps/web` Astro frontend, `nlp-service` Python NLP service) — identify which area the task concerns first. Documents the Sentry project and (once it exists) any Axiom dataset/dashboard/monitor, and which MCP tool to use for each.
---

# Observability & Issue Tracking (engofy)

External systems used to monitor this repo, and which MCP tool touches each. Load this before
querying Sentry/Axiom so the org/project/dataset slugs don't need rediscovering each time.

**Neither Sentry nor Axiom has real values configured yet.** `SENTRY_DSN` in
`.env.production.example` is a placeholder, and there's no Axiom workspace at all for this project.
Don't invent an org slug, project slug, or dataset — if a task actually needs one of these tools, ask
the developer for the real values first, then update the Entity Map below so future runs don't need
to ask again.

## Entity Map

| Area | Sentry project slug (id) | Axiom log dataset | Axiom dashboard | Axiom monitors |
|---|---|---|---|---|
| `src/`+`test/` (NestJS backend — `web`/`worker`/`cron`/`cli` entrypoints) | not configured — ask the developer | none (Axiom not connected to this project) | none | none |
| `apps/web` (Astro) | no Sentry integration | none | none | none |
| `nlp-service` (Python) | no Sentry integration | none | none | none |

Only the NestJS backend emits Sentry events at all (`@sentry/nestjs`, initialized in
`src/core/observability/sentry.ts`), tagged by `entrypoint` (`web`/`worker`/`cron`/`cli`) rather than
split across separate Sentry projects — there is exactly one project to search once it's configured.
`apps/web` and `nlp-service` have no error-tracking SDK at all right now.

Pipeline-stage job failures (worker, `JobWorkerHost`) are captured on every attempt with tags
`postId`, `stage` and `exhausted` (`true` on the last pg-boss attempt — search `exhausted:true` for
stages that gave up). `AiSchemaMismatchError` has a fingerprint of `ai-schema-mismatch` + tool name +
stage, so each tool/stage pair is its own issue.

**Axiom is not connected to this project at all** — there is no workspace, no dataset, no dashboard,
no monitor. The `health` and `sync-dashboard` skills still document the Axiom-shaped steps they'd
perform if that ever changes; until then, treat any Axiom step in either skill as a no-op and say so
explicitly rather than fabricating results.

This repo tracks work via plan files at `.claude/plans/<slug>.md` (see the `task` skill), not an
external issue tracker — there's no Linear/Jira equivalent to file a follow-up issue in. When a
health check or debugging session surfaces something that needs its own tracked follow-up, that means
writing (or updating) a plan file, not opening a ticket elsewhere.

## Which Tool for Which Task

### `src/`+`test/` (NestJS backend) — Sentry only, once configured

| Task | Tool(s) |
|---|---|
| Search/list recent Sentry errors | `mcp__sentry__search_issues` / `search_events` with the org/project slug from the Entity Map above |
| Investigate one Sentry issue, get an AI root-cause suggestion | `mcp__sentry__analyze_issue_with_seer` |
| Resolve/assign/comment on a Sentry issue | `mcp__sentry__update_issue` |
| Query raw logs | not available — no Axiom dataset exists for this project |

### `apps/web` (Astro) and `nlp-service` (Python)

No error-tracking or log-query tooling exists for either yet. Any check here is limited to what's
directly observable — CI results, local logs, manual reproduction.

## Conventions

- These are read/monitoring lookups by default — don't push code, resolve a Sentry issue, or touch
  any future Axiom dashboard without confirming with the developer first (see the repo-wide
  risk-confirmation rule in the root `CLAUDE.md`/system instructions).
- Sentry auth expires independently of the Claude session. If any `mcp__sentry__*` call fails with an
  auth error, tell the developer to reconnect the Sentry MCP server rather than guessing at data or
  reporting "no anomalies found."

## Keeping This Skill Current

Once Sentry is actually wired up with real org/project slugs, or Axiom gets connected, fill in the
Entity Map above with the real values — small diff, not a rewrite. Same if `apps/web` or
`nlp-service` ever gain their own error tracking.
