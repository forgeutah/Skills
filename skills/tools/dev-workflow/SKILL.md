---
name: dev-workflow
description: Ticket-to-PR development loop with an approval gate — read a ticket or bug, write a subtask plan with a proof command per subtask, wait for approval, implement one subtask at a time, test, and raise a pull request whose description maps every acceptance criterion to evidence. Resumable across sessions through a per-ticket task file. Use this whenever the user says "work on PROJ-123", "pick up this ticket", "fix this bug end to end", "plan this feature then build it", "resume PROJ-123", "where was I on that ticket", or asks to go from an issue to a PR, even if they never say "workflow".
---

# Dev Workflow

A disciplined loop for taking one unit of work from ticket to pull request without
losing track across sessions. It exists because the same things go wrong repeatedly
when an agent works a ticket freehand: it starts coding before the plan is agreed,
ticks work off by reading the code instead of running it, forgets acceptance criteria
that were never numbered, and loses all context when the session ends.

The loop answers each of those with one mechanism:

| Failure | Mechanism |
|---|---|
| Coding before agreement | The plan is shown and the agent stops until it is approved |
| "Looks done" without proof | Every subtask carries a command that proves it works |
| Criteria silently dropped | Every numbered criterion must be covered by a subtask and reported in the PR |
| Context lost between sessions | A task file in the repo holds subtasks, decisions, and the next action |

## Entry points

| The user says | Start at |
|---|---|
| "Work on / pick up PROJ-123" | Understand (ticket) |
| "Fix this bug" (with or without a ticket) | Understand (bug) |
| "I have an idea, plan it and build it" | Understand (idea) |
| "Resume PROJ-123" / "where was I" | Resume |
| "PROJ-123 merged" / "close PROJ-123" | Close |

`PROJ-123` stands for whatever key format the team's tracker uses (Jira, Linear,
GitHub Issues, and so on). Use the tracker tool the agent actually has — a connector,
or a CLI such as `gh issue view`. Read the ticket through that tool rather than asking
the user to paste it; pasted tickets lose comments and linked issues.

## Stores

The loop keeps state in two places, each with one job:

| Store | Holds | Lifetime |
|---|---|---|
| `.agents/tasks/<KEY>.md` in the repo | subtasks, decisions, next action | until the ticket merges |
| Work log (optional, user-chosen folder) | one line per finished ticket, learnings | permanent |

The task file must never be committed. Before creating it, check that `.agents/tasks/`
is ignored (`git check-ignore .agents/tasks/x.md`); if not, tell the user and suggest
adding it to their global gitignore rather than editing the project's `.gitignore`
uninvited.

Ask once whether the user wants a work log and where it lives. If they decline, skip
every work-log step silently.

## Step 1 — Understand

**Ticket:** fetch it and read the description, acceptance criteria, comments, and
linked issues. Look for numbered acceptance criteria. If they are missing or written
as prose, say so and offer to number them. Planning against unnumbered criteria is
how a PR ends up claiming "done" while one criterion was never built — the later
steps rely on the numbers. If the user declines to update the ticket, number the
criteria in the task file and say the ticket itself was left unchanged.

**Bug:** fetch the ticket if one exists. Reproduce the failure or locate it in the
code, then summarise what is broken, why, and where. If no ticket exists, offer to
create one after the research, when there is something concrete to write.

**Idea:** ask for the goal in two or three sentences, the target repo, and any
constraints. Read the relevant code before proposing scope.

End the step with a short summary of what needs to change and why.

## Step 2 — Plan (stop for approval)

Present the plan in this shape:

```text
Ticket: PROJ-123 — Short description
Branch: PROJ-123-short-kebab-desc
Repo:   <repo>
Type:   fix | feat | refactor | research

Subtasks:
  1. <what changes> — path/to/file
     covers: AC 1, AC 3
     test:   <command that proves this subtask works>
  2. <what changes> — path/to/other
     covers: AC 2
     test:   <command>

Registration: <entry point a new handler/route/command must be added to, or "none">
Config keys:  <new env/config keys and every environment that needs them, or "none">
Deploy order: <cross-repo merge order, or "single repo, none">

Approve and post plan to ticket / approve locally / changes?
```

How to split:

- Aim for 2–6 subtasks, each finishable in one sitting.
- One subtask is one concern, not one file. Two files changed for the same reason are
  one subtask.
- Every subtask names the command that proves it. If none exists, write that
  explicitly instead of inventing one.
- Every numbered criterion appears in some `covers:` line. An uncovered criterion is
  a gap in the plan, and it is far cheaper to catch here than in review.
- The three trailing lines exist because they are what reviews most often catch late:
  a handler that was written but never registered, a config key set in one
  environment only, and repos merged in the wrong order.

Then stop and wait. Do not branch or edit until the user approves. If they ask for
changes, revise and show the whole plan again. If they approve with posting, add the
plan to the ticket as a comment headed `Plan` so a reviewer can later compare intent,
plan, and diff.

### On approval, write the task file immediately

```markdown
# PROJ-123 — <short description>
Repo: <repo> · Branch: <branch> · Type: <type> · Stage: implementing

## Subtasks
- [ ] 1 <what changes> — path/to/file
      test: <command>
- [ ] 2 <what changes> — path/to/other
      test: <command>

## Decisions

## Next
Start subtask 1.
```

States: `[ ]` not started · `[>]` in progress · `[x]` done · `[!]` blocked (reason inline).

Writing it now, not later, is what makes the work resumable if the session ends
mid-subtask.

## Step 3 — Branch

```bash
git switch <base-branch>
git pull
git switch -c PROJ-123-short-kebab-desc
```

Use the repo's documented base branch and branch naming convention (check
`CONTRIBUTING.md`, the README, or recent branch names). If it is not documented, ask.

## Step 4 — Implement, one subtask at a time

For each subtask:

1. Mark it `[>]` and update `## Next`.
2. Read the files before changing them.
3. Make the change the plan describes — nothing more.
4. Run its `test:` command.
5. Mark it `[x]` with the evidence (commit sha or "tests pass").

A subtask is done only when its command passes. If it had no command, record what was
checked instead. Ticking a box on inspection alone is the exact failure this loop
exists to prevent.

Record any non-obvious choice under `## Decisions` as one line with the reason. That
section is the only part of the file worth keeping after merge.

**Gating:** for plans touching three or more files, or of type `feat`/`refactor`,
pause after each subtask with a one-line summary and offer continue / pause / revise.
On pause, write the exact stopping point into `## Next` — the command to run or the
file and line to open, not "continue subtask 2". Small `fix` plans run straight
through; the plan approval already covered them.

**If the plan turns out wrong:** stop, explain what changed and why, and show the
revised plan for approval. If the change affects what ships — a criterion dropped,
replaced, or deferred — update the ticket first and add a `## Decisions` line. The PR
description is built from the ticket, so the ticket must change before the code does
or the two will contradict each other.

Do not add unrequested refactors, features, or comment cleanups.

## Step 5 — Test

Run the full test command from the plan. On failure, show the shortest decisive line
of output, fix, and re-run. If the fix needs work beyond the approved plan, get a
brief re-approval first.

## Step 6 — Explain

Before raising the PR, tell the user in plain language:

- what the change does (one sentence)
- why it was needed
- what was non-obvious or tricky

No approval gate here. The third point becomes the work-log learning entry.

## Step 7 — Raise the PR

Push the branch and open the PR with whatever the agent has for the host (for
example `gh pr create`, or the host's connector). Put the criteria table first,
because it is what a reviewer reads first:

```markdown
<link to PROJ-123>

## Acceptance criteria

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | <criterion text from the ticket> | delivered | `tests/test_x.py::test_y` |
| 2 | <criterion text> | deferred — <reason, follow-up ticket> | — |
| 3 | <criterion text> | skipped — <reason recorded on the ticket> | — |

## Deploy order
<from the plan, or "Single repo, no ordering.">

## Summary
<Step 6: what, why, what was tricky>

## Test results
<command and one-line result per subtask>
```

Table rules: every numbered criterion gets a row, in ticket order. `Status` is exactly
`delivered`, `deferred`, or `skipped`. A `deferred` or `skipped` row carries a reason
that already exists on the ticket. `Evidence` names the test, file, or command that
proves a `delivered` row. A blank status or an unexplained `skipped` means the PR is
not ready.

Follow the repo's PR title and commit message conventions. Pushing is outward-facing:
confirm with the user before the push if they have not already approved it.

If a work log is in use, append:

```markdown
## PROJ-123 — YYYY-MM-DD
Repo: <repo> · Type: <type> · PR: <link>
What: <one line from Step 6>
Hard part: <what was non-obvious>
Pattern: <reusable insight, or "none">
```

If the user has a PR-review skill available, offer to run it on the new PR.

## Resume

1. Find the task file: `.agents/tasks/<KEY>.md` in the current repo. With no key,
   list every file in that folder with its Stage and progress and ask which.
2. If none exists, say so and offer to start from Understand. Do not reconstruct one
   from memory.
3. Check the file against the repo before trusting it:

   ```bash
   git branch --show-current     # on the branch it names?
   git status --short            # uncommitted work present?
   git log --oneline -5          # do the [x] commits exist?
   ```

4. Report, then continue from `## Next`:

   ```text
   PROJ-123 — <description>   (<repo>, branch <branch>)
   Done:    1, 2
   Current: 3 — <title>  [>]
   Blocked: 4 — <reason>
   Next:    <the Next line, verbatim>
   ```

If the file and the repo disagree — branch missing, commits absent, changes no subtask
claims — say so and ask before continuing. A stale task file that looks authoritative
is worse than none.

## Close

When the user says the PR merged:

1. Show the `## Decisions` lines and ask which, if any, should outlive the ticket.
2. Move kept decisions to wherever the project keeps durable notes — its agent
   instructions file (`AGENTS.md`, `CLAUDE.md`, or equivalent) or its docs.
3. Only then delete the task file.

Never delete it without showing the decisions first; once it is gone the reasoning
cannot be recovered.

## Validation commands

Check the loop is working as intended at any point:

```bash
git check-ignore -v .agents/tasks/PROJ-123.md   # task file is ignored, never committed
cat .agents/tasks/PROJ-123.md                   # every [x] has evidence, Next is concrete
git log --oneline <base-branch>..HEAD            # commits match the ticked subtasks
```

Before raising the PR, confirm by reading the draft description that every numbered
criterion on the ticket has exactly one row with a status from the allowed three.

## Realistic usage boundaries

- One ticket in one working session at a time. Parallel tickets each get their own
  task file, but the skill does not coordinate between them.
- It does not choose a tracker, PR host, or test framework. It uses whatever the agent
  can already reach and whatever the repo already runs.
- It does not replace code review. The criteria table makes review faster; it does not
  make it unnecessary.
- Cross-repo work is only tracked as a deploy-order line. Each repo's changes are
  planned and raised separately.
- Research-only tickets end at Step 6 with findings written to the ticket; there is no
  PR.
