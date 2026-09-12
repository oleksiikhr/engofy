---
name: pr
description: Create or update the Pull Request for the current branch, following the repo-wide git-workflow skill exactly — gather context, draft title/body, confirm with the developer, then push and open it. Triggers regardless of language — e.g. "/pr", "create the PR" / "створи PR", "open a PR" / "відкрий PR", "draft the PR body" / "напиши опис PR".
---

# /pr Command

Run `git-workflow`'s **Step 4 through Step 7** for the current branch:

1. Gather context (`git status`, `git log`, `git diff --stat`, check for an already-open PR, check for
   a matching plan file at `.claude/plans/`).
2. Pick the title format from the branch (hotfix or normal).
3. Draft the body per its priority order and language rules (Ukrainian body, English identifiers),
   including screenshots if the change touches `apps/web`.
4. **Show the drafted title + body and wait for explicit confirmation** before pushing or creating
   anything.
5. Once confirmed: push and `gh pr create`, then report the URL.

If the current branch matches a slice entry in a plan at `.claude/plans/<slug>.md`, update that
slice's `PR` field with the resulting URL after creation.
