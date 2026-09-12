---
name: review
description: Process PR review comments — from a human reviewer, an automated reviewer bot, or the PR author's own self-review — decide fix/skip per thread with a reason, apply the fixes, and reply in every thread on GitHub. Never resolves threads itself, regardless of author — that decision is always left to a human. Triggers regardless of language — e.g. "process the PR review" / "опрацюй ревʼю на PR", "handle the review comments" / "розбери коментарі ревʼю", "respond to review comments" / "дай відповідь на ревʼю", "address review feedback".
---

# Review Skill

Works through every open review thread on a PR — regardless of who opened it — decides what to do
about each, applies the fixes, and replies **in the comment's own thread** on GitHub, never as one
summary comment.

## Step 1 — Find the PR

- Resolve the PR number: an argument that's a number is the number directly; an argument that's a
  branch name → `gh pr view <branch> --json number,url`; no argument → current branch (`git branch
  --show-current`).
- `gh repo view --json owner,name` for `{owner}/{repo}`, used in every `gh api` call below.

## Step 2 — Fetch every review thread with its author

```bash
gh api repos/{owner}/{repo}/pulls/{number}/comments --paginate
```

Each comment carries `user.login`, `id` (the `databaseId`), `in_reply_to_id`, `path`, `line`, and
`body`. A thread's **author** is whoever posted its first comment (the one with no `in_reply_to_id`) —
later replies from someone else don't change who opened it.

Cross-reference against thread state via GraphQL, since the REST endpoint doesn't expose
`isResolved`:

```bash
gh api graphql -f query='
query($owner:String!,$repo:String!,$number:Int!){
  repository(owner:$owner,name:$repo){
    pullRequest(number:$number){
      reviewThreads(first:100){
        nodes{ isResolved comments(first:1){ nodes{ databaseId } } }
      }
    }
  }
}' -f owner={owner} -f repo={repo} -F number={number}
```

Match each thread's `comments.nodes[0].databaseId` to the REST comment's `id` to get that thread's
`isResolved` flag. Skip threads already `isResolved: true` — nothing to do there; resolving is a human
decision, never this skill's.

If a bot-authored thread's body suggests it's still mid-review (e.g. explicitly says
"reviewing"/"in progress") — say so and stop rather than treating silence as "nothing to do." Human
threads have no such ambiguity — what's posted is what's posted.

## Step 3 — Categorize each unresolved thread

For every thread, pick one verdict and state the reason (brief, goes in the final report):

| Category | Action |
|---|---|
| Real bug / security issue | Fix in code |
| Reasonable nitpick (style, naming, small simplification), cheap to apply | Fix |
| Reasonable but out of scope for this PR (larger refactor, separate task) | Skip, explain why, suggest a follow-up (a new plan file via `task` if it's worth tracking) |
| False positive / already intentional (context the reviewer didn't have) | Skip, explain specifically why it's a false positive |
| Duplicate / already covered by another thread's fix | Skip, reference the other thread |

Never fix or skip silently — every thread gets a reply in Step 5 regardless of verdict.

## Step 4 — Apply fixes

- Determine which area(s) the PR touches: `git diff --name-only <base>...HEAD` (or `gh pr diff
  --name-only`), bucketed by top-level path (`src/`/`test/`, `apps/web`, `nlp-service`).
- Read the root `CLAUDE.md` and the `engofy` skill before editing if you haven't already this session.
- Group related fixes into logical commits — not one giant commit, not one commit per comment. Commit
  messages: lowercase, imperative, no prefix — same convention as `git-workflow`, don't invent a
  different style.
- Run the relevant checks for whichever areas were touched, not a fixed one-size command:

| Area | Checks |
|---|---|
| `src/`+`test/` (NestJS backend) | `pnpm type`; `pnpm lint:check` (or `pnpm lint` to auto-fix); `pnpm test` / `pnpm test:cov` as relevant |
| `apps/web` (Astro) | `pnpm --dir apps/web run type`; `pnpm --dir apps/web run lint:check`; `pnpm --dir apps/web run build` |
| `nlp-service` (Python) | `pytest -q` from `nlp-service/` |

- `git push` to the PR's existing branch (never force-push here — that's `git-workflow`'s boundary
  too).

## Step 5 — Reply in every thread

For each thread — reply into it, never as a new top-level PR comment:

```bash
gh api repos/{owner}/{repo}/pulls/{number}/comments/{comment_id}/replies -f body="<reply>"
```

`{comment_id}` is the thread's first comment's `id` (its `databaseId`). Keep the reply short: what was
done (reference the commit if useful) or why it was skipped.

This skill never calls `resolveReviewThread` — replying is the full extent of its action on a thread,
regardless of who opened it. Resolving is always left to a human.

## Step 6 — Final report

Per thread: fixed / skipped (+ reason). Don't repeat the full text of every comment — the developer
can open the PR themselves and resolve threads there once satisfied.
