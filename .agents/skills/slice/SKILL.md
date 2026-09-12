---
name: slice
description: Execute exactly one unfinished slice of a plan at `.claude/plans/<slug>.md` — prepare git state, implement the slice with tests, run the narrowest relevant checks for whichever area(s) the diff actually touches, commit, hand off to `git-workflow` for the PR, and update the plan file, then stop. The slug is optional — it's auto-detected from the current branch (works from inside a plan's worktree too) or the sole plan present when omitted. This is what `task`'s Step 4 delegates to when resuming a multi-slice plan; invoke it directly to skip re-running task's triage. Triggers regardless of language — e.g. "run the next slice" / "виконай наступний зріз", "next slice of <slug>" / "наступний зріз плану <slug>", "continue the plan" / "продовж план".
---

# Slice Skill

Implements **exactly one** unfinished slice of an existing plan and stops. Continuing means
re-invoking this skill (or `task`) with the same slug — same session or a new one, whichever the
developer prefers. What matters is one slice per *invocation*, not a fresh session; never chain into
the next slice within the same run.

This skill does not create plans, decide slice count, or write the initial plan file — that's `task`'s
job (Steps 2-3b). It does not draft PR titles/bodies, push, or open PRs itself — that's
`git-workflow`'s job (Steps 4-7), invoked here with its normal confirmation gate, not skipped.

## Step 1 — Find the plan file

**Slug given explicitly** → validate against `^[a-z0-9]+(-[a-z0-9]+)*$`; stop rather than substituting
an invalid raw value into any path/command. Then skip to the lookup below.

**No slug given** → auto-detect, trying each of these in order and stopping at the first that
resolves:

1. `git branch --show-current` matches a slice's `Branch:` field in some `.claude/plans/*.md` **and
   that slice is still `[ ]`** — use that plan, and that *exact* slice (this is a resume of known work
   in progress, not "take the first unchecked one"). This also covers the worktree case with no extra
   work: a worktree's checked-out branch is local to it, so running this from inside any slice's
   worktree resolves correctly regardless of how that worktree's directory happens to be named. If the
   matched slice is already `[x]`, it's a closed slice, not work in progress — don't stop here; fall
   through to the next rule instead. This is the common case right after finishing a slice: the
   developer is still sitting on its branch and says "continue" meaning the *next* slice, not a redo of
   this one.
2. Exactly one file exists under `.claude/plans/*.md` — use it, and say so plainly in the final report
   (Step 7, "Report and stop") so the developer can correct course if the guess was wrong.
3. Anything else (zero or multiple plans, no branch match) — list every plan found (slug, title, next
   unchecked slice) and ask which one, or report there are none.

**Lookup** (once a slug is known, from either path above): look for `.claude/plans/<slug>.md` at the
repo root (`git rev-parse --show-toplevel`). If it's not there but a `git worktree list --porcelain`
entry has it, tell the developer the exact path and ask them to switch there — don't execute from a
directory that isn't tracking this plan.

Not found anywhere *and the slug was given explicitly* (auto-detect already ruled out "no plans exist"
above): it may belong to an already-completed plan whose file was removed by Step 6 (a finished plan
has no file left, by design). Before concluding it never existed, check `git branch -a --list
'*<slug>*'` and `gh pr list --search "<slug>" --state merged`. A match means the plan is done — report
that and stop. No match at all means the plan genuinely doesn't exist — say so and stop. Either way,
never fall through to creating a new plan under this slug; that's `task`'s new-task path, not this
skill's.

## Step 2 — Read plan state

Frontmatter: `slug`, `title`, `base_branch`, `created`, `status`. Slices are `### [ ]`/`### [x]` blocks
with `Branch`, `Base`, `PR` fields.

- Every slice already `[x]` — a legacy plan from before Step 6 deleted-on-completion existed. If
  `status` isn't `done`, set it, commit (`mark plan <slug> as done`, lowercase, no prefix), push. If
  already `done`, don't commit an empty diff. Report every PR in the stack in merge order and **stop**.
- Step 1's branch-match already pinned an exact slice (always unchecked, per Step 1's own filter) →
  that's the one to implement.
- Otherwise take the **first** `[ ]` slice — that's the one to implement now.

## Step 3 — Prepare git state

- `git status`: uncommitted changes unrelated to this slice → stop and ask, don't silently discard or
  carry them onto the slice branch.
- The slice's `Branch:` already exists locally → this is a resumed session: `git checkout <branch>`
  and continue from the existing diff against `Base:`.
- Branch doesn't exist yet:
  - Check `git worktree list --porcelain` for an existing worktree already on a branch of this plan
    (branch name starts with `<slug>-`) — that's a worktree an earlier slice created. Worktrees are
    per-*plan*, not per-slice: reuse it rather than creating a new one, since a fresh worktree per
    slice throws away build caches, `node_modules`, and IDE state for no reason. Reuse means checking
    out this slice's branch inside that same directory: `git -C <existing-path> checkout -b <branch>
    <base>`.
  - No existing worktree for this plan found: ask whether to use a `git worktree` for this plan (asked
    once, on its first slice only — later slices of the same plan reuse whatever was decided here, per
    the rule above). If yes: `git worktree add -b <branch> <path> <base>`, `<path>` =
    `../<repo-dirname>-<slug>` — named after the plan slug, not the branch, since every later slice
    reuses this same directory. If no: `git checkout -b <branch> <base>` in place.
  - If `Base:` doesn't exist locally or on origin (typical when the previous slice's PR merged and
    GitHub deleted its branch), its content is already in `main`: branch from `base_branch` instead,
    and update this slice's `Base:` field in memory — it lands in the plan-file commit in Step 6, no
    separate PR needed for that correction.

## Step 4 — Implement the slice

- Read the root `CLAUDE.md` and the `engofy` skill (for `src/`/`test/` conventions) before writing
  code, and use whatever project-specific scaffolding exists rather than freehand.
- Implement the slice completely: code + tests, per the plan's description and this repo's own
  testing conventions.
- **Before considering the slice done, check whether it's safe to deploy on its own, right now, ahead
  of any later slice.** This is exactly what `task`'s contract-change rule (Step 2) exists to prevent
  slipping through: if this slice changes something another already-deployed consumer depends on — the
  `apps/web` ↔ backend HTTP contract, a DB column, a backend ↔ `nlp-service` HTTP contract, or a
  pg-boss queue payload key — ask "what breaks if only this slice ships and the next one doesn't land
  for a day or a week?" If the answer is "something breaks or silently writes wrong data," that's
  expand-contract territory: add the backward-compatible form *within this slice*, don't defer it. If
  backward compatibility genuinely isn't feasible, stop and ask the developer rather than shipping a
  breaking change silently.
- **This slice is the "remove the deprecated form" step of an expand-contract sequence** (`task`'s
  contract-change rule, item 3) → before implementing, ask the developer to confirm the prior slice is
  actually deployed. This repo's deploy is a `v*` git tag push, not a PR merge — a merged PR only means
  the code is on `main`/the base branch, not that the tag has been pushed and the deploy actually ran.
- Run the relevant checks for whichever area(s) the diff actually touches — determine this from `git
  diff --stat <base>..HEAD` path prefixes, not from a fixed list, since a slice can touch more than one
  area. Each area's own CI job (`.github/workflows/app.yaml`) is the source of truth for *what* must
  pass — mirror it locally so a check that would fail in CI doesn't first surface there; re-check that
  file if this list and CI ever disagree:
  - `src/`/`test/` touched → `pnpm type` (also type-checks `test/`, which `pnpm build` alone doesn't),
    `pnpm lint:check`, scoped `pnpm test` (or `pnpm test:cov` before finalizing). If the change touches
    entities/DTOs/decorated classes, also `pnpm build` and `git diff --exit-code src/metadata.ts` —
    CI fails on stale generated metadata that a scoped test run won't catch. If the change adds/alters
    a migration, also `pnpm migration:up && pnpm migration:check`.
  - `apps/web` touched → `pnpm --dir apps/web run type` (astro check), `pnpm --dir apps/web run
    lint:check`, `pnpm --dir apps/web run build`. Playwright e2e (`pnpm --dir apps/web run test:e2e`)
    runs locally only, not in CI — run it yourself when the change touches a flow it covers.
  - `nlp-service` touched → `pytest -q` from `nlp-service/` (matching the `nlp-service` CI job).
  - Don't run a full-repo test suite when a filtered/scoped run covers the change. Don't skip a whole
    area's checks just because another one was also touched.
- Slice adds/changes a user-facing `apps/web` flow → invoke the `run` skill to launch the app and
  capture screenshot(s) of the changed flow, saved following `git-workflow`'s screenshot convention
  (`.claude/output/`, branch-prefixed filenames) for the PR body in Step 5.
- Slice turns out to be exploratory/investigative (an audit, a dependency analysis) whose downstream
  scope wasn't knowable when the plan was written: finish the analysis, ask the developer clarifying
  questions (`AskUserQuestion` or plain text), wait for answers. Draft the new `### [ ]` slices (first
  new slice's `Base:` = this slice's branch) and show them for a short confirmation, same as `task`'s
  Step 3b decomposition prompt. Once confirmed, commit the plan update. The current slice still closes
  normally via its own PR.

## Step 5 — Commit and push

Logical commits as you go, not one giant commit at the end. `git push -u origin <branch>`.

## Step 6 — Open the Pull Request

Hand off to `git-workflow`'s Steps 4-7 exactly — same drafting rules, same confirmation gate (don't
skip it; this is a deliberate difference from throwaway one-off automation elsewhere). One addition
specific to a plan slice:

- Base the PR against this slice's `Base:` field, not `main`, unless this is slice 1 — the plan is a
  stack, not independent PRs.
- Mention in the body which slice this is (`N/<total>` of plan `<slug>`).

## Step 7 — Update the plan file

- `### [ ] N.` → `### [x] N.`, fill in `PR:`. If Step 3 retargeted `Base:` to `main`, include that
  correction in the same diff.
- Slices remain unchecked → commit on the slice branch: `git add .claude/plans/<slug>.md && git commit
  -m "update plan <slug> after slice N" && git push`.
- This was the **last** slice (all now `[x]`) → the plan file is no longer needed for future sessions;
  delete it in this same PR rather than setting `status: done` and leaving it behind — every slice's
  content already lives in its own branch/PR history: `git rm .claude/plans/<slug>.md && git commit -m
  "remove plan <slug>, all slices done" && git push`. Leave branch/worktree cleanup to the `cleanup`
  skill once the whole stack is merged — don't automate that here.

## Step 8 — Report and stop

State: which slice completed, its PR URL, how many slices remain, and the concrete next action —
don't leave the developer guessing whether you're waiting on the PR merge or something else. Slices
stack (Step 3's `Base:` chaining), so the sequence is always: merge this PR, then get off its branch
(`git checkout <base_branch> && git pull`) before saying "continue" — staying on the just-finished
slice's branch would otherwise make Step 1's auto-detect re-resolve to this same completed slice
instead of the next one (Step 1's branch-match rule only fires on a still-`[ ]` slice, but leaving the
developer to discover that by trial and error defeats the point — say it up front). Continuing itself
means re-invoking `task` or this skill with the same slug (same session or a new one — either is
fine). Never start the next slice in this run.

## Boundaries

This skill does **not**:
- Create a plan, decide slice count, or write `.claude/plans/<slug>.md` from scratch — `task`'s job.
- Draft PR titles/bodies, push, or open PRs directly — always delegates to `git-workflow`, confirmation
  gate included.
- Auto-continue past one slice per invocation.
- Delete branches or worktrees — the `cleanup` skill's job, after the whole stack merges.
- Invent a check, e2e step, or contract exception that isn't backed by the plan, the diff, or this
  repo's own documented conventions.
