# Contributing

Thank you for contributing a skill to the community repo!

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
