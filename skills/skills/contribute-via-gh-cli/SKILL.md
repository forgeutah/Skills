---
name: contribute-via-gh-cli
description: Walks a contributor through forking a GitHub repository and opening a pull request entirely with the gh CLI, for repos where the contributor has no direct push access (protected main branch, PR-only workflow, e.g. ForgeUtah/Skills). Use whenever the user wants to contribute a change but doesn't have write access, asks "how do I submit a PR to this repo", mentions forking a repo, or hits a push rejection like "Permission to X denied" or "protected branch" on a repo they don't own. Also use when a maintainer asks how outside contributors should submit changes.
---

# Contribute via gh CLI (fork + pull request)

## Why this is the normal flow, not a workaround

On a repo you don't have write access to — including this one,
`ForgeUtah/Skills` — there is no setting that grants the public direct push
access to branches. GitHub's permission model only ever grants push access to
specific people or teams. The standard, expected path for everyone who isn't
a collaborator is: fork the repo, push commits to your fork, open a pull
request from the fork back to the original. Maintainers use the same path.

Treat "I don't have push access" as the normal starting state, not an error
to route around. Never suggest disabling branch protection, adding the user
as a collaborator, or any other workaround — those are decisions only a repo
admin can make, and the fork workflow below is the actual intended path.

## Prerequisites

Confirm the `gh` CLI is installed and authenticated before starting:

```bash
gh auth status
```

If this reports no authenticated account, stop and tell the user to run
`gh auth login` themselves — do not attempt to authenticate on their behalf.

## Step 1 — Fork the repository

If you don't have a local clone yet, fork and clone in one step:

```bash
gh repo fork OWNER/REPO --clone --remote
cd REPO
```

If you already have a local clone of the upstream repo, run `gh repo fork`
with no arguments from inside it:

```bash
gh repo fork --remote
```

In both cases, `gh repo fork`:

- Creates the fork under your GitHub account (or an org, with `--org NAME`).
- Sets the new fork as your `origin` remote.
- Renames any existing `origin` remote to `upstream` and sets it as the
  default remote repository.

Verify the remotes landed the way you expect:

```bash
git remote -v
```

`origin` should point at `github.com/<your-username>/REPO`, and `upstream`
(if you started from an existing clone) at the original repo.

## Step 2 — Branch, make changes, commit

Work on a feature branch, never directly on `main` — a PR from `main` on your
fork works, but a dedicated branch keeps your fork's `main` clean for future
contributions.

```bash
git checkout -b descriptive-branch-name
# edit files
git add <specific files>
git commit -m "concise summary of the change"
```

Follow this repository's own contribution rules (see `CONTRIBUTING.md`) for
what the change itself needs to contain and which verification scripts to
run before committing — this skill only covers the git/GitHub mechanics of
getting the change up for review, not the content requirements.

## Step 3 — Push to your fork

```bash
git push -u origin descriptive-branch-name
```

This pushes to your fork (`origin`), not the upstream repo — you don't have
push access to upstream, and that's expected. Pushing to `origin` cannot fail
with a permission or protected-branch error, since it's your own fork.

## Step 4 — Open the pull request

From inside the branch, with the fork's `origin` remote already set:

```bash
gh pr create --title "type: short summary" --body-file - --base main <<'EOF'
## Description

...

## Implementation

...

## Testing

...
EOF
```

- `--title` should start with the change type the target repo asks for —
  check its `CONTRIBUTING.md` and `.github/PULL_REQUEST_TEMPLATE.md` if it
  has one; this repo (`ForgeUtah/Skills`) uses `feat:`, `fix:`, `docs:`,
  `cicd:`, `chore:`, `refactor:`, `test:`.
- `--body-file -` reads the body from stdin so you can fill in a structured
  template (Description / Implementation / Testing, or whatever the repo's
  own template specifies) instead of a single free-text blurb. If the repo
  has no template, `--fill` (pull title/body from the commit message) is a
  reasonable default instead.
- `--base main` targets the upstream repo's default branch explicitly; omit
  it to fall back to the repo's configured default branch.
- `gh pr create` detects that your branch lives on a fork and automatically
  opens the PR against the upstream repo — no need to pass `--repo` or spell
  out the `user:branch` head syntax unless you're targeting a different base
  repo than the one `upstream` points to.

Add `--draft` to open it as a draft, or `--web` to finish the flow in the
browser instead of the terminal.

## Step 5 — Track the PR and push follow-up commits

Check status and CI without leaving the terminal:

```bash
gh pr status
gh pr view --web
gh pr checks
```

After review feedback, keep committing on the same branch and push again —
no need to re-run `gh pr create`, the existing PR updates automatically:

```bash
git add <files>
git commit -m "address review feedback"
git push
```

## Keeping your fork in sync

Before starting a new contribution, or if `upstream` has moved on since you
forked, sync your fork's default branch:

```bash
git fetch upstream
git checkout main
git merge upstream/main
git push origin main
```

## Validation commands

Confirm each step actually worked rather than assuming success from a lack
of error output:

```bash
gh auth status                       # confirms you're authenticated before starting
git remote -v                        # confirms origin = your fork, upstream = original repo
gh repo view --json parent --jq .parent.nameWithOwner   # confirms this clone is a fork, and of what
gh pr view --json url,state,baseRefName,headRepositoryOwner  # confirms the PR opened against the right base/head
```

## Realistic usage boundaries

This skill covers the git/GitHub mechanics of forking and opening a PR. It
does not cover:

- What content the change itself should contain, which verification scripts
  to run, or where files belong in the target repo — that's the target
  repo's own `CONTRIBUTING.md`.
- Resolving merge conflicts beyond a simple `git merge upstream/main`.
- Getting the PR approved or merged — that's up to the target repo's code
  owners/reviewers (see that repo's `CODEOWNERS`), not something `gh` or this
  skill can do for the contributor.
- Repos that genuinely do grant broad write access (internal/trusted-team
  repos) — for those, a simple branch-and-push on the original repo is
  correct and forking is unnecessary overhead.
- Non-GitHub remotes (GitLab, Bitbucket, self-hosted Git) — the concepts
  transfer but the CLI commands here are `gh`-specific.
