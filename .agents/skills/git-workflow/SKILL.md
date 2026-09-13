---
name: git-workflow
description: Repo-wide git workflow — branch/commit naming, PR title and description drafting, and (when explicitly asked) actually creating the branch, committing, pushing, and opening the PR via `gh`. This repo has no external ticket tracker — work is tracked either directly (small task, no plan file) or via a plan file at `.claude/plans/<slug>.md` (see the `task` skill). Triggers regardless of language — e.g. "create a branch for this" / "створи гілку", "commit this" / "закомить це", "draft a PR" / "напиши опис PR" / "створи PR", "open a PR" / "відкрий PR", "what's the PR title" / "яка назва PR".
---

# Git Workflow Skill

Covers a task end to end: branch → commits → PR. This is the operational, repo-wide layer: naming,
drafting, and execution.

## Plan-driven work

There's no external ticket system here — every task is either small enough to branch and implement
directly (no plan file), or gets a plan file at `.claude/plans/<slug>.md` first (the `task` skill
decides which). Two exceptions to the normal flow:

- **Hotfix**: a live production issue, no time to write a plan first. Branch from `main` directly.
- **Ad-hoc**: everything else that isn't a hotfix — a small self-contained tweak (dependency bump,
  config change) all the way up to a larger initiative, single-PR or sliced via a plan file. This is
  the default path; size doesn't change the naming, only whether a plan file exists.

## Naming conventions

| What | Format | Example |
|---|---|---|
| Branch (single task or plan slice) | `<slug>` (single task) or `<parent-slug>-<NN>-<slice-slug>` (a slice within a multi-slice plan) | `add-word-frequency-filter`, `reader-annotations-01-schema` |
| Branch (hotfix) | `hotfix-<slug>` | `hotfix-exclude-sentry-tunnel-from-proxy` |
| Commit (while working) | lowercase, short, imperative — no prefix | `add frequency filter to reader` |
| PR title (normal) | `<Verb noun>` — Title Case | `Add frequency filter to reader` |
| PR title (hotfix) | `[HOTFIX] <Verb noun>` — literal `HOTFIX`, uppercase, in brackets | `[HOTFIX] Exclude Sentry tunnel from proxy matcher` |

Nothing here is CI-enforced (no CodeRabbit or similar title check in this repo) — it's a convention to
keep history and PR history scannable, not a hard gate. Still follow it consistently rather than
inventing a new shape per PR.

Commit messages carry no prefix. This repo squash-merges (confirmed: `squashMergeAllowed`, no merge
or rebase merges) — `git log` on `main` shows one commit per PR (`<PR title> (#<PR number>)`), so
individual commits get absorbed into the PR title at merge time anyway; keep them short and lowercase
for readability while the branch is open, don't block on perfecting each one.

## Step 1 — Start work: create the branch

- `git status` first — uncommitted changes unrelated to this task must not be silently discarded or
  carried onto the new branch; stop and ask.
- `git checkout -b <branch> <base>` — `base` is `main` unless the developer says otherwise.

## Step 2 — Commit as you go

Logical commits per unit of work, not one giant commit at the end. Lowercase, short, imperative — e.g.
`add frequency filter to reader`.

**Pushing to a branch that already has an open PR — keep the description in sync.** This applies to
*any* push after the PR exists, not just a request to "update the PR" or "draft a description": a
plain "commit and push", "push this", or "push these changes" is still a push onto a branch GitHub is
showing a description for. Before or right after pushing:

```bash
gh pr view <branch> --state open --json number,body 2>/dev/null
```

If an open PR exists, compare its current `body` against what the new commit actually changed. A
description that describes the old diff — something that's since been renamed, removed, or changed —
is actively misleading once it's live on GitHub, even if nobody asked for an update. Fix it (`gh pr
edit <number> --body-file <scratch-file>`) as part of the same push, don't wait to be asked. A small,
purely-additive change that the existing body still accurately covers doesn't need an edit — this is
about correctness, not refreshing on every push.

## Step 3 — Plan file (read it if one exists; this skill doesn't own it)

Larger tasks may have a plan file at the repo root (`.claude/plans/<slug>.md`) covering the whole
task, potentially split into slices spanning more than one of `src/`/`test/` (backend), `apps/web`, or
`nlp-service`. The `task` skill owns that structure and decides when to create one; all this skill
does with a plan file is read it in Step 4 for the *why* behind the PR.

## Step 4 — Gather context before drafting the PR

```bash
git branch --show-current
git status                              # uncommitted work not meant for this PR?
gh repo view --json defaultBranchRef -q .defaultBranchRef.name
git log --oneline --no-merges <base>..HEAD
git diff --stat <base>..HEAD
git diff <base>...HEAD                  # skim for content, never paste wholesale into the body
gh pr list --head <branch> --state open --json number,url,title
ls "$(git rev-parse --show-toplevel)"/.claude/plans/*.md 2>/dev/null
```

- No commits ahead of `<base>` → stop, tell the developer, don't fabricate a PR.
- An open PR already exists for this branch → show it, ask whether to update its description (`gh pr
  edit`) instead of creating a new one.
- A plan file matching the slug exists → read its context section first. It's the most reliable
  source of *why*, ahead of guessing from the diff.

## Step 5 — Title

Pick the format from the naming table above based on the branch:
- `hotfix-*` → `[HOTFIX] <Verb noun>`
- anything else → `<Verb noun>`, no prefix

`<Verb noun>` is a real summary of the change (`Add frequency filter to reader`), not the first commit
message restated.

## Step 6 — Body

Nobody reads paragraphs. Reviewers skim — so the body's job is to surface the handful of things that
actually need attention, in a shape that scans in seconds, not to narrate the diff.

**Priority order, most valuable first:**

1. **Contract changes** — anything another part of the system depends on: the HTTP contract between
   `apps/web` and the backend, a DB schema/migration (MikroORM), a pg-boss queue/worker payload key,
   or the HTTP contract between the backend and `nlp-service`. These are the hardest thing to catch
   from a raw diff and the most expensive to get wrong, so they earn a diagram or a table even when
   everything else in the PR gets one line.
2. **UI changes** (`apps/web`) — a screenshot beats any description of what something looks like.
3. Everything else — one sentence, if that. Don't enumerate which files, classes, or commands
   changed; the diff and the Files tab already show that. Only add a line here for something those two
   categories don't cover but still needs calling out (a deliberate tradeoff, an edge case explicitly
   left out of scope).

Open with a `## Зміни` heading, then a short paragraph (1–3 sentences) under it: what changed **and
why**. The *why* is what reviewers actually miss — the diff already shows *what*. Source it from, in
priority order: the plan file's context section → the developer's invocation message → earlier
conversation. If none of these give a why, leave `<!-- TODO: чому? -->` rather than inventing one from
the diff.

The tables below normally sit right under that same `## Зміни` heading. Beyond it, no fixed sections,
no checkboxes — add another heading only when a specific change is substantial enough to deserve its
own (e.g. `## API contract`), pick whatever shape fits:

| Change | Good shape |
|---|---|
| API endpoint added/changed (`apps/web` ↔ backend, or backend ↔ `nlp-service`) | Table: `Ендпоінт \| Було \| Стало`, or a short sequence diagram if request/response ordering matters |
| DB schema / migration (tables, columns, indexes) | Table: `Таблиця/Колонка/Індекс \| Було \| Стало`; note explicitly if it's expand-only, contract, or breaking |
| Queue/worker payload change (pg-boss) | Table: `Job/Черга \| Було payload \| Стало payload` |
| Multi-step decision logic (e.g. which of several failure reasons wins) | Mermaid flowchart — worth it exactly when a table would need a "depends on" column |

A 4–6 line prose wall describing what changed is the failure mode to avoid — if you catch yourself
writing one, there's a table hiding inside it.

### Screenshots (UI changes)

- Store under `.claude/output/`, committed to the PR branch (`.gitkeep` keeps the empty directory
  tracked; add screenshots with a normal `git add`).
- Filename: `<branch>-<NN>-<slug>.png` — always prefixed with the full current branch name. This is
  what keeps two concurrently open PRs from ever colliding on a filename (and therefore from ever
  merge-conflicting on a binary file): each branch only ever writes files under its own name.
- Before adding new screenshots, `git rm` any **tracked** file already in `.claude/output/` that is
  not prefixed with the current branch name — those are leftovers from a different, already-merged PR
  that this branch inherited from `main`, safe to remove because they're recoverable from history.
  Never delete an **untracked** file there, even if its name doesn't match the current branch — leave
  it and tell the developer. Never touch a file, tracked or not, that *is* prefixed with the current
  branch — that's this PR's own history.
- Reference each screenshot inline where it's relevant, not dumped in a pile at the end.
- The directory can also hold non-PR scratch files that aren't meant to ship. Stage screenshots
  individually by filename — never `git add .claude/output` or a broad `git add -A` — so a stray
  scratch file never rides along into the PR.

### Deploy (only when the merge itself isn't enough)

Skip this section when a plain merge covers it — most PRs don't need it. This repo's deploy is
**not** triggered by merging to `main`: it's a `v*` git tag push, which fires
`.github/workflows/deploy.yaml`. Add this section, as the last part of the body, when the change needs
a human to do something at or after that tag push:

| Change | What to write |
|---|---|
| New/changed environment variable | Table: `Змінна \| Призначення/тип значення \| Де` (which env — staging/prod — and which service, per `infra/stack.prod.yaml`/`.env.production.example`). **Never the actual secret value** — describe what it is or its format, not the value itself |
| Gitops/infra change (`infra/`, `Dockerfile`, `docker-entrypoint.sh`) | What changed and why, one line per file |
| Required post-deploy command | The exact command and when to run it, e.g. a migration or a one-off CLI command — before or after the tag push |
| A DB migration is included | Note that `pnpm migration:up` runs as part of `infra/deploy.sh`'s rollout — flag anything that needs manual attention beyond that (a data backfill, a step that can't be idempotent) |

### Language

Write the body in Ukrainian. Keep English: the PR title, and every identifier — file paths,
component/function names, branch names, CLI commands, env vars — plus any UI copy quoted exactly as
it renders on screen.

## Step 7 — Confirm, then execute

Opening a PR is visible history — **always** show the drafted title + body first and wait for an
explicit go-ahead before running anything below, even when the developer's request already said
"create a PR" or "open a PR". Generating the draft is not the same turn as submitting it — those are
always two separate steps, no exception for an unambiguous ask.

Once confirmed:

```bash
git push -u origin <branch>
```

If this fails with `Permission denied (publickey)`, that's a headless/sandboxed session with no
ssh-agent identity loaded, not a repo problem — don't keep retrying SSH. Check `gh auth status`: if
logged in, switch the remote to HTTPS and use `gh`'s own credentials instead — `gh auth setup-git &&
git remote set-url origin https://github.com/oleksiikhr/engofy.git` — then retry the push. If `gh auth
status` also shows not logged in, that needs an interactive `gh auth login` only the developer can
complete (browser/device code) — ask, don't attempt it yourself.

Write the body to a scratch file first — text can contain quotes, backticks, or `$()` that must never
be interpolated directly into a shell string:

```bash
gh pr create --base <base> --head <branch> --title "<title>" --body-file <scratch-file>
```

Report the PR URL back to the developer.

## Boundaries

This skill does **not**:
- Force-push or rewrite already-pushed history.
- Delete branches or worktrees — that's the `cleanup` skill's job.
- Invent a *why* the diff, commits, plan file, and conversation don't actually support.
