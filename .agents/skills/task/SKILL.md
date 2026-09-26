---
name: task
description: Entry point for starting a piece of work from a file or free text. Triages complexity first — a task simple enough for one PR is branched and implemented immediately (no plan file); a task that needs 2+ independently reviewable slices gets a plan file at root `.claude/plans/<slug>.md` first, and stops there for confirmation before any code is written. This repo has no external ticket tracker — the plan file is the only place multi-slice work is tracked. A plan can span `src/`+`test/` (backend), `apps/web` (Astro), and `nlp-service` (Python). Triggers regardless of language — e.g. "plan this out" / "розбий на кроки", "let's tackle this" / "візьмемось за це", "continue the <slug> plan" / "продовж план <slug>", "what's next on <slug>".
---

# Task Skill

Entry point for starting a task. Triages complexity first, then either executes directly or writes a
plan file and stops.

This skill owns: triage, slug/slice decomposition, the plan file, and (for a simple, unsliced task)
driving implementation directly. It does **not** own PR title/body drafting or the actual
push/`gh pr create` — every execution path below ends by handing off to the `git-workflow` skill for
that, confirmation gate included. It does not own branch/commit/PR naming either — that table lives in
`git-workflow`; this skill only decides *how many* branches a task needs. And once a multi-slice plan
exists, it does not own implementing a slice — that's the `slice` skill's job (Step 4 below just
delegates to it).

## Step 1 — Read the input, decide new vs. resume

- **File**: `@file.md` content is the task description (merged with any other text given).
- **Free text**: otherwise, the whole input is the task description.
- **Slug**: explicit only if the last line of the input is a standalone kebab-case token
  (`^[a-z0-9]+(-[a-z0-9]+)*$`). Otherwise generate one: kebab-case, 3–5 words, English.
- **Resume check**: look for `.claude/plans/<slug>.md` at the repo root. If it exists:
  - Read it. If `status: done` or every slice is checked, say so and stop — nothing to resume.
  - Otherwise this is **resume mode** — skip to Step 4.
- **Bare-slug continuation with no plan file found**: if the input is essentially just a slug
  ("continue `<slug>`", "what's next on `<slug>`") and no plan file matches, don't assume it's a new
  task — a finished plan's file is deleted on its last slice (Step 4/`slice` Step 7), so "no file" can
  mean "already done," not "never existed." Check `git branch -a --list '*<slug>*'` and `gh pr list
  --search "<slug>" --state merged` before deciding; a match means the plan already completed — report
  that and stop. Only fall through to new-task mode below when nothing matches the slug at all.
- No match → **new-task mode** — continue to Step 2.

```bash
ls "$(git rev-parse --show-toplevel)"/.claude/plans/*.md 2>/dev/null
```

## Step 2 — New task: triage complexity

Default to **single PR, no plan file** unless one of these is true:

- The task description already breaks into multiple independent subpoints.
- The task changes a contract that must stay live mid-rollout — see the contract-change rule below.
- It's large/ambiguous enough that one diff would be unreviewable as a block.
- The task is driven by a design mockup for `apps/web` with UI components to build — treat as complex
  by default even if it looks self-contained. Claude does not reliably port a design 1:1; slice it so a
  design-fidelity checkpoint (screenshot vs. mockup, reviewed before moving on) happens early rather
  than surfacing as a large rework at the end.

When in doubt about whether to write a plan file, don't — a plan file that turns out to be unnecessary
costs more than a slightly large PR. That's independent of PR size: keep every PR small regardless of
path, single-PR or sliced. If a single-PR task's diff is growing large while you implement it, that's
a signal to stop and re-run this triage, not to keep going.

**Contract-change rule.** A contract change is anything another part of the system depends on: the
HTTP contract between `apps/web` and the backend, a DB column/schema (MikroORM migration), a pg-boss
queue/worker payload key, or the HTTP contract between the backend and `nlp-service`. Check every
contract the task touches against this rule before finalizing the decomposition — do it as one
deliberate pass, not incidentally while writing slice descriptions.

Any contract change ships as 3+ slices, never one:
1. Add the new field/column/payload key; the producer emits (or accepts) both the old and new form.
2. Migrate every consumer to the new form.
3. Remove the deprecated field/column/payload key — its own slice, only after slice 2 is confirmed
   deployed and all consumers are on the new form.

Each slice is a separate PR, merged independently of the others (Step 3b) — slice 1 must be
backward-compatible standing alone, not on the assumption that slice 2 lands right after it. If
backward compatibility is genuinely impractical for a specific change, flag that exception explicitly
when showing the decomposition (Step 3b) — don't skip it silently.

Deploys in this repo happen by pushing a `v*` git tag (`.github/workflows/deploy.yaml`) — merging a PR
to `main` does not deploy it. "Slice 2 is confirmed deployed" (item 3 above) means the developer has
confirmed that tag was actually pushed and the deploy ran, not just that its PR merged — ask before
starting the removal slice rather than inferring it from PR/merge state.

## Step 3a — Simple task: execute directly, no plan file

Show a short summary before any side effect and wait for confirmation:

```
Slug: <slug>
Base branch: <base_branch, зазвичай main>
Worktree: <так/ні — питання нижче>

Задача: <2-4 речення, що плануєш зробити>
```

Ask whether to use a `git worktree` for this task (see the worktree note in Step 3b — same tradeoffs
apply). Do not default this either way; ask every time.

**Не переходь далі без явного "так".**

Once confirmed:
- Branch/commit naming, and creating the branch itself, follow the `git-workflow` skill exactly
  (hotfix or ad-hoc) — don't duplicate those rules here, just invoke that skill's Step 1.
- If a worktree was requested: `git worktree add -b <branch> <path> <base>` where `<path>` is a
  sibling directory (`../<repo-dirname>-<slug>`). The repo's local dev stack (`make up`/`docker
  compose`) is a single shared instance, not per-worktree — but the backend/`apps/web` ports and the
  dev/test Postgres DB name and Redis DB index can be offset per worktree: count existing worktrees via
  `git worktree list --porcelain` to pick a free `OFFSET` (0-7), then run `make ports OFFSET=<N>`
  inside the new worktree before `pnpm i`/`make sync`.
- Implement the task fully — code + tests — following whichever area(s) it touches: read the root
  `CLAUDE.md` and the `engofy` skill (for `src/`/`test/` conventions) before writing code rather than
  freehand.
- Task adds/changes a user-facing `apps/web` flow → invoke the `run` skill to launch the app and
  capture screenshot(s), saved following `git-workflow`'s screenshot convention, for the PR body.
- Hand off to `git-workflow` for the PR (title/body draft, confirmation, push, `gh pr create`).

No `.claude/plans/` file is ever created for this path.

## Step 3b — Multi-slice task: decompose, write the plan, stop

Decompose into sequential, independently-reviewable slices (roughly 2–10, each ≈ one PR). Each slice:
a short title, 2–5 sentences of scope, and what it depends on from earlier slices.

Show the decomposition before any side effect:

```
Slug: <slug>
Base branch: <base_branch, зазвичай main>
Worktree (for slice 1): <так/ні — питання нижче>

Зрізи:
1. <title>
   <опис, включно з залежністю від попередніх зрізів якщо є>
2. ...
```

Ask about worktree the same way as Step 3a, scoped to slice 1's branch — but unlike Step 3a's
single-branch task, a plan reuses the same slug across every slice's worktree, so name the sibling
directory after the **branch**, not the slug: `../<repo-dirname>-<branch>`. This is what keeps slice
2's worktree from colliding with slice 1's.

**Не переходь до наступного кроку без явного "так".** If the developer wants a different split,
update and show again.

### Branch naming per slice

Branch is `<parent-slug>-<NN>-<slice-slug>` (e.g. `migrate-node-version-01-shared-utils`), PR title
the plain form (`<Verb noun>`, no brackets — see `git-workflow`).

- **Base for slice 1**: `base_branch` (`main` unless told otherwise).
- **Base for slice N (N>1)**: slice N-1's branch — slices stack. When slice N is actually started (the
  `slice` skill's Step 3), check whether slice N-1's PR has merged (`gh pr view <slice N-1 branch>
  --json state`); if merged, rebase slice N onto the now-updated `base_branch` instead of the stale
  branch; if still open, branch from it as-is.

### Write the plan file

Create `.claude/plans/<slug>.md` at the repo root:

```markdown
---
slug: <slug>
title: <людська назва плану>
base_branch: <base_branch>
created: <YYYY-MM-DD>
status: in-progress
---

# <title>

## Зрізи

### [ ] 1. <title зрізу>
- Branch: `<branch>`
- Base: `<base_branch>`
- PR: —

<опис зрізу, 2-5 речень>

### [ ] 2. <title зрізу>
- Branch: `<branch>`
- Base: `<slice-1-branch>`
- PR: —

<опис зрізу>
```

Body text (titles, descriptions) in Ukrainian, matching the git-workflow PR-body language rule;
identifiers (branches, file paths) stay English.

- Create slice 1's branch (or worktree per the confirmed choice above, `../<repo-dirname>-<branch>` if
  so) from `base_branch`, per `git-workflow`'s Step 1 — don't create the branch by hand and skip that.
  Worktree paths are local to whoever creates them and are never written into the plan file — each
  slice decides independently (the `slice` skill's Step 3).
- Commit the plan file as the first commit there: `git add .claude/plans/<slug>.md && git commit -m
  "add plan for <title>"` (lowercase, no prefix — matches `git-workflow`'s commit convention). If
  `<title>` contains quotes/backticks, use `git commit -F <scratch-file>` instead of `-m`.

### Report and stop

State: the plan file path; slug; worktree path if used. **Do not implement any slice now** — the next
step is re-invoking this skill with the same slug (or just "continue `<slug>`") to implement slice 1.

## Step 4 — Resume: delegate to `slice`

Invoke the `slice` skill with this slug (or no slug at all — it auto-detects from the current branch,
the worktree, or the sole plan present). It owns everything from here: finding the first unchecked
slice, determining its base (rebasing onto `base_branch` if the previous slice's PR merged and its
branch is gone), the per-slice worktree question, implementation, the narrowest relevant checks for
whichever area(s) the diff touches, the PR handoff to `git-workflow`, and the plan-file update
(including deleting the plan file instead of setting `status: done` when this was the last slice).

Report whatever `slice` reports and **stop** — one slice per invocation, even if more remain.
Re-invoke for the next one.

## Boundaries

This skill does **not**:
- Implement a slice once a plan exists — delegates entirely to the `slice` skill.
- Draft PR titles/bodies, push, or open PRs — always delegates to `git-workflow` (directly, or via
  `slice`).
- Define branch/commit/PR naming rules — reuses `git-workflow`'s table, only decides slice count and
  per-slice base.
- Auto-continue past one slice per invocation.
- Delete branches or worktrees — that's the `cleanup` skill's job, after the whole stack merges. (A
  completed plan's file *is* deleted, but by `slice` on the last slice, as part of that slice's own
  PR — not by this skill, and not as a separate cleanup pass.)
- Invent port-offset or per-worktree environment isolation beyond `make ports OFFSET=<N>` — that's the
  one mechanism this repo provides for running multiple worktrees concurrently; use it, don't build an
  alternative.
