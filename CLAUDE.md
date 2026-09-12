# engofy — Project Conventions

NestJS backend (fastify, MikroORM/Postgres, pg-boss for queues). These rules are
project-wide and override generic defaults.

## Skills

Every skill's real file lives in `.agents/skills/<name>/SKILL.md`; `.claude/skills/<name>` is always
a symlink to it (`ln -s ../../.agents/skills/<name> .claude/skills/<name>`) — that symlink is how
Claude Code actually discovers and loads it. When adding a new skill, write the real `SKILL.md` under
`.agents/skills/`, never directly under `.claude/skills/`.

**Writing a SKILL.md: facts only, no fluff.** This content loads into context every time the skill
runs. Write only what an agent needs to act — what to do, in what order, under what condition. Cut:
- Comparisons to other tools/repos, and any "this mirrors X" / "used to be Y" / "no longer Z" / "just
  like W" narration — state the current rule, not its history against a prior version.
- Rationale already stated once elsewhere (a cross-reference is enough — don't re-explain it).
- Anything useful to a human reviewer reading the file but that doesn't change what the agent does
  next.

If a sentence doesn't change the agent's next action, delete it.

This repo has no external ticket tracker (no Linear/Jira). Work is tracked either directly (a task
small enough for one PR, no artifact left behind) or as a plan file at root `.claude/plans/<slug>.md`
when it needs multiple independently reviewable slices — see the `task` skill.

The root `.claude/skills/` holds skills shared across the whole repo (`src/`+`test/` NestJS backend,
`apps/web` Astro frontend, `nlp-service` Python NLP service):

- `git-workflow` — branch/commit naming, PR title/description drafting, and pushing/opening the PR
  itself when asked.
- `pr` — thin entry point that just triggers `git-workflow`'s PR flow (gather context → draft →
  confirm → push → open) for the current branch.
- `task` — the entry point for starting work from a file or free text. Triages complexity: a
  single-PR task is branched and implemented directly; a task needing 2+ independently reviewable
  slices gets a plan file at root `.claude/plans/<slug>.md` first (can span backend, `apps/web`, and
  `nlp-service`), and stops for confirmation before writing code. Delegates all naming/PR mechanics to
  `git-workflow`.
- `slice` — implements exactly one unfinished slice of an existing plan; `task` delegates to it when
  resuming a multi-slice plan.
- `cleanup` — deletes local branches/worktrees whose PR has already merged, after explicit
  confirmation.
- `review` — processes PR review comments (human, bot, or self-review): decide fix/skip per thread,
  apply fixes, reply in every thread; never resolves a thread itself.
- `observability` — documents the Sentry project (and, once connected, any Axiom dataset/dashboard)
  and which MCP tool to use for each; other skills load it rather than hardcoding a slug.
- `health` — periodic or post-deploy Sentry/Axiom health report.
- `sync-dashboard` — proposes and applies Axiom dashboard chart updates for a feature's new logging
  (currently a no-op: Axiom isn't connected to this project yet).
- `sentry-debug-issue` — debug and fix a single Sentry issue end to end, through `git-workflow`'s
  normal commit/PR flow.
