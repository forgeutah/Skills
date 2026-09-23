# Contributing

Thank you for contributing a skill to the community repo!

## Fork first — this is the normal flow

Nobody pushes branches directly to this repository, maintainers included.
`main` is protected, and the only way in is a fork plus a pull request. This
isn't a special hoop for outside contributors to jump through — it's how
every change lands here.

```bash
gh repo fork ForgeUtah/Skills --clone --remote
cd Skills
git checkout -b my-skill-name
# make your changes
git add <files>
git commit -m "add my-skill-name"
git push -u origin my-skill-name
gh pr create --fill --base main
```

`gh repo fork` clones the fork, sets it as your `origin` remote, and adds the
original repo as `upstream`. For a full walkthrough — including checking PR
status and pushing follow-up commits after review — see the
[`contribute-via-gh-cli`](skills/skills/contribute-via-gh-cli/) skill.

### PR title and description

Prefix the PR title with the type of change: `feat:`, `fix:`, `docs:`,
`cicd:`, `chore:`, `refactor:`, or `test:`. The description follows the
template in `.github/PULL_REQUEST_TEMPLATE.md`: a short **Description**, an
**Implementation** section explaining what changed and why, and a
**Testing** section showing how you verified it (for a skill change, the
output of the verification suite below).

## Ground rules

- **Skills document existing behavior.** If a skill names a command, endpoint,
  flag, or type that does not exist, the code wins. Update the skill.
- **Prefer retrieval over pre-training.** Point agents at the authoritative
  source (docs, READMEs, code) rather than duplicating details that can drift.
- **No absolute local paths.** This repo is public. Never reference a personal
  or machine-specific path. Use repo-relative paths and product names only.
- **No screenshots.** Reference a live resource instead.
- **Every skill carries two sections** in its `SKILL.md`:
  `## Validation commands` (how a user verifies the guidance) and
  `## Realistic usage boundaries` (what the skill does not cover).
- **Every skill needs eval cases** in `evals/evals.json` — at least two
  prompt-only, portable cases with expectations.

## Adding or changing a skill

1. Read the source of truth for the subject matter. Verify every command,
   endpoint, and flag against the code.
2. Place your skill in the right category under `skills/`:
   - `skills/skills/` — meta-skills, skill development
   - `skills/devops/` — CI/CD, infrastructure, deployment
   - `skills/design/` — UI/UX, design systems, frontend
   - `skills/db/` — SQL, NoSQL, data modeling
   - `skills/tools/` — general-purpose development tools
   - If none of these fit, add a new top-level directory under `skills/`.
3. Create `SKILL.md` with `name` (lowercase-hyphen, matching folder name) and
   `description` frontmatter. Keep it roughly 130-340 lines.
4. Add at least two portable eval cases in `evals/evals.json`.
5. Add a row to the Skills table in `README.md`.
6. Run the verification suite before committing:

   ```bash
   node scripts/verify-skills.mjs
   node scripts/verify-manifests.mjs
   node scripts/check-internal-links.mjs
   node scripts/verify-evals.mjs
   ```

## Licensing

This repository is **MIT** licensed. Do not add third-party code or content
that is not MIT-compatible.

`main` is protected — no direct pushes. Every change lands through a pull
request approved by a code owner (see `CODEOWNERS`).
