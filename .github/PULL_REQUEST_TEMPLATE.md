<!--
Title: prefix it with the type of change, e.g.
  feat: add postgres-migrations skill
  fix: correct verify-evals.mjs id uniqueness check
  docs: clarify fork workflow in CONTRIBUTING.md
  cicd: add markdownlint to the verify workflow
  chore: bump dependabot schedule
-->

## Description

<!-- What does this PR do and why? One or two sentences. -->

## Implementation

<!-- What changed, and why this approach. Call out any tradeoffs or files
     a reviewer should look at first. -->

## Testing

<!-- How you verified this works. For a skill change, include the output of:
       node scripts/verify-skills.mjs
       node scripts/verify-manifests.mjs
       node scripts/check-internal-links.mjs
       node scripts/verify-evals.mjs
-->

## Checklist

- [ ] PR title is prefixed with a change type (`feat:`, `fix:`, `docs:`, `cicd:`, `chore:`, `refactor:`, `test:`)
- [ ] `SKILL.md` documents existing behavior only — no invented commands, endpoints, or flags
- [ ] New/changed skill has both `## Validation commands` and `## Realistic usage boundaries` sections
- [ ] `evals/evals.json` has at least two cases (new or changed skills)
- [ ] README updated with a row for the skill (new skills)
- [ ] Verification suite passes locally (see Testing above)
