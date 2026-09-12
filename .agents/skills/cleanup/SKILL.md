---
name: cleanup
description: Repo-wide cleanup of local branches and git worktrees whose PR has already merged — lists every candidate and waits for explicit confirmation before deleting anything. Closes the gap `git-workflow` deliberately leaves open ("no cleanup step here — that's a separate concern if it's ever built"). Triggers regardless of language — e.g. "clean up merged branches" / "прибери гілки", "clean up worktrees" / "почисти worktree", "remove stale branches" / "видали змерджені гілки".
---

# Cleanup Skill

Removes local branches and git worktrees whose work is done (PR merged) so the checkout doesn't
accumulate stale state. Deletion is destructive — the repo-wide confirmation rule from the root
`CLAUDE.md` already covers this, so this skill doesn't restate it, just follows it: show the full list
before deleting anything, wait for explicit confirmation.

## Boundary with `git-workflow`

`git-workflow` explicitly does not delete branches or worktrees (see its Boundaries section) — this
skill is that separate concern. `git-workflow` creates and pushes; `cleanup` is the only place that
removes. Don't add deletion logic to `git-workflow`, and don't duplicate branch/PR-title conventions
here — read them from `git-workflow` if ever needed for context, but classification below only
depends on PR state, not naming.

Note: deleting a completed plan file (`.claude/plans/<slug>.md` once `status: done`) is a related gap
the `task` skill also calls out as "cleanup, not-yet-built" — this skill does not cover that either.
It's still open; mention it to the developer if a fully-done plan file is spotted during a cleanup
run, but don't delete it.

## Step 1 — Collect candidates

```bash
git fetch --prune                                   # sync remote-tracking state first
git worktree list --porcelain                        # every worktree except the current one and the main checkout
git branch --list                                     # every local branch except the current one and main
```

This repo has no other long-lived integration branch beyond `main` (no `develop`/`staging`/etc.
convention exists here) — don't invent one to protect.

## Step 2 — Classify each branch

For each candidate branch:

```bash
gh pr list --head <branch> --state all --json number,state,mergedAt,url --limit 1
```

| PR state | Action |
|---|---|
| `MERGED` | Candidate for deletion (branch + its worktree, if any) |
| `OPEN` | Skip — work still in progress |
| `CLOSED` (not merged) | Skip by default — list it separately and ask explicitly whether to delete (could be an abandoned attempt or something paused deliberately) |
| No PR found | Skip — local experiment, or a branch not yet pushed as a PR |

Each slice from a multi-slice plan is its own independent PR: a plan slice branches as
`<parent-slug>-<NN>-<slice-slug>` (no shared prefix tying it to the parent plan or to the other
slices). Per `task` Step 4, once a slice's PR merges, the *next* slice rebases onto `main` rather than
staying stacked on the merged branch — so a merged slice branch has no further role and is safe to
delete purely from its own PR state. Don't build stack-awareness or plan-file-completeness checks into
this step; the per-branch `MERGED` check above is sufficient on its own.

## Step 3 — Show the list and confirm

```
Branches to delete (PR merged):
- <branch> (PR #<n>, worktree: <path or "none">)
...

Branches with an unmerged/closed PR (skipped, needs a decision):
- <branch> (PR #<n>, CLOSED, not merged)
...
```

**Don't delete anything without an explicit "yes" on the full list or on specific items.**

## Step 4 — Delete

This repo squash-merges (see `git-workflow`) — a squash-merged PR creates a brand-new commit on
`main`, so the branch's original commits are never `main`'s ancestors. `git branch -d`'s ancestry
check will therefore refuse **every** branch here, even ones `gh pr` correctly reports as `MERGED` —
that refusal is not a signal Step 2 misclassified anything. `gh pr --json state,mergedAt` (Step 2), not
git ancestry, is this repo's source of truth for "merged."

For each confirmed branch:
- If it has a worktree: check `git -C <path> status --porcelain` first. Clean → `git worktree remove
  <path>`. Dirty → stop and tell the developer, don't remove silently or force it.
- `git branch -D <branch>` — force is correct and expected here specifically because Step 2 already
  confirmed `MERGED` via `gh pr`, not because ancestry was skipped. If `gh pr` did *not* report
  `MERGED` for a branch reaching this step, stop — that's a real classification gap, don't force
  through it.
- `git worktree prune` at the end, once all confirmed removals are done.

## Step 5 — Report

What was deleted (branches + worktrees), what was skipped and why, and how many branches/worktrees
still need a developer decision (the `CLOSED`-but-unmerged list from Step 3).
