# Skills

Community built skills. See [CONTRIBUTING.md](CONTRIBUTING.md) and the
category directories under [`skills/`](skills/) to get started.

A collection of [Agent Skills](https://github.com/agentskills/agentskills) contributed by the
community. These skills are portable across Claude Code, Cursor, opencode, Pi,
and Codex — write once, use in any coding agent that supports the Agent Skills
format.

Skills are organized by category:

| Category | Directory | What you'll find |
|----------|-----------|------------------|
| Skills | [`skills/skills/`](skills/skills/) | Meta-skills, skill development, and agent skill tooling |
| DevOps | [`skills/devops/`](skills/devops/) | CI/CD, infrastructure, deployment, platform tooling |
| Design | [`skills/design/`](skills/design/) | UI/UX, design systems, frontend architecture |
| Databases | [`skills/db/`](skills/db/) | SQL, NoSQL, data modeling, migrations |
| Tools | [`skills/tools/`](skills/tools/) | General-purpose development tools and utilities |

## Installing

### Copyable setup prompt

Paste this prompt into the coding agent you want to configure:

```text
Install the Community Skills from https://github.com/ForgeUtah/Skills.git.
First inspect which harness you are running (Claude Code, Cursor, OpenCode,
Pi, or Codex) and its documented user/project skill directory. Clone the
repository to a temporary directory, review the skills/ folders, then copy or
symlink each folder containing SKILL.md into that harness's skill directory.
Preserve existing skills, do not overwrite a same-named skill without asking,
and do not copy .git metadata. After installation, verify that all SKILL.md
files have name and description frontmatter and report the destination and
the installed skill names. Do not print secrets or modify project files
outside the selected skill directory.
```

### Claude Code

Install from the plugin marketplace:

```text
/plugin marketplace add ForgeUtah/Skills
/plugin install community-skills@community-skills
```

### Codex

```text
codex plugin marketplace add ForgeUtah/Skills
codex plugin add community-skills@community-skills
```

### opencode

Clone this repo and symlink or copy the skill folders into
`~/.config/opencode/skills/` (or the project's `.opencode/skills/`).

### Pi

Pi loads the same Agent Skills directories. Clone this repo and either add
the repository's `skills/` directory to `~/.pi/agent/skills/`, or configure
the clone in Pi's settings:

```json
{
  "skills": ["/path/to/community-skills/skills"]
}
```

For a project-local install, use `.pi/skills/` or configure the repository's
`skills/` directory in `.pi/settings.json`. Pi also discovers the skills
through `~/.agents/skills/` and project `.agents/skills/` directories.

### Cursor

Add via **Settings > Rules > Add Rule > Remote Rule (GitHub)** with
`ForgeUtah/Skills`, or copy the skill folders into `~/.cursor/skills/`.

### Clone / Copy

Clone this repo and copy the skill folders into the appropriate directory for
your agent:

| Agent | Skill Directory | Docs |
|-------|-----------------|------|
| Claude Code | `~/.claude/skills/` | [docs](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview) |
| Cursor | `~/.cursor/skills/` | [docs](https://cursor.com/docs/context/skills) |
| opencode | `~/.config/opencode/skills/` | [docs](https://opencode.ai/docs/skills/) |
| Pi | `~/.pi/agent/skills/` or `~/.agents/skills/` | [docs](https://pi.dev/docs/latest/skills) |
| Codex | `~/.codex/skills/` | [docs](https://developers.openai.com/codex/skills/) |

## Contributing a skill

See [CONTRIBUTING.md](CONTRIBUTING.md). I use the
[OpenAI Skill Creator](https://developers.openai.com/plugins/build/skills) to
scaffold new skills — it generates the correct frontmatter, sections, and eval
fixtures. Short version:

1. Skills document existing behavior — they never invent APIs.
2. Place your skill in the matching category under `skills/`.
3. Every skill needs a `SKILL.md` with `name` and `description` frontmatter.
4. Add at least two eval cases in `evals/evals.json`.
5. Run the verification suite before opening a PR.
6. If no existing category fits, add a new top-level directory under `skills/`.

## What makes a good skill

- **Focused scope** — one skill should cover one product, tool, or domain.
- **Retrieval-first** — point agents at authoritative docs rather than
  duplicating details that can drift.
- **No absolute paths** — reference repos by product name and relative paths.
- **Portable** — work in any harness that supports Agent Skills.
- **Tested** — each skill carries eval cases so contributors can validate changes.

## Validation

The suite is self-checking and enforced by CI (`.github/workflows/ci.yml`)
on every pull request and push to `main`. Run before opening a PR:

```bash
node scripts/verify-skills.mjs          # frontmatter, name=dir, required sections
node scripts/verify-manifests.mjs       # every plugin manifest parses as JSON
node scripts/check-internal-links.mjs   # every internal markdown link resolves
node scripts/verify-evals.mjs           # every skill has eval cases
```

## License

MIT. See [LICENSE](LICENSE).
