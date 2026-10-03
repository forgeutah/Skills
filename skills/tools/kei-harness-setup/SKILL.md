---
name: kei-harness-setup
description: Connect a coding-agent harness — Claude Code, Codex, OpenCode, Pi, or Cursor — to Kei governance. Install the Haikei skills into the right skills directory, pair the harness with a runtime installation and kei-proxy, pass agent identity to each governed call, and prove that unbound calls are denied. Use whenever someone wants to "set up Kei in Claude Code/Codex/OpenCode/Pi/Cursor", install or update the Haikei skills, onboard a harness or adapter, or asks which harnesses Kei supports. Also covers the product harnesses Assistant, PDE, and Discord at the routing level.
---

# Set up a harness with Kei

Kei governs a harness through this chain:

`harness adapter → kei-proxy (kei-connector-runtime) → kei-policy-catalog`

The harness asks `kei-proxy` before each governed operation. `kei-proxy`
decides locally against the workspace policy bundle and runs allowed work
inside the tenant runtime. The catalog holds policy, connector metadata, and
redacted audit metadata only. Setting up a harness means installing the skills
that teach the agent this contract, then wiring the harness to a runtime.

## Concepts

- **Harness** — software that lets an LLM act as an agent (for example Claude
  Code, OpenCode, or a custom bot).
- **Kei-enabled harness** — a harness governed by Kei through a **runtime
  installation**.
- **Runtime installation** — Kei's record for the one runtime deployed beside
  that harness (one harness : one runtime installation : one credential,
  `KEI_RUNTIME_TOKEN`). The console page is called **Runtime installations**.
- **Agent** — an LLM configuration the harness runs (model, system prompt,
  tools).

This is a workflow skill. Keep the two Kei executables straight: **`kei`** is
the platform admin CLI a person runs once to set things up (`kei-cli` skill);
**`kei-proxy`** is the runtime the harness calls on every governed tool call
(`kei-proxy` skill). The agent itself only ever talks to `kei-proxy`. Load
**`kei-runtime-setup`** for the runtime half of the setup.

## Retrieval sources

| Source | How to retrieve | Use for |
| --- | --- | --- |
| Console: Agent setup | `https://app.haikeilabs.com/#/docs/agent-setup` | Supported harnesses, the harness → runtime → catalog flow, DENY rules |
| Console: Get started | `https://app.haikeilabs.com/#/docs/getting-started` | Per-harness skill install commands |
| Console: Agents page | **Agents →** a harness card → **Copy setup prompt** | The canonical per-harness setup prompt |
| Skills repo | `https://github.com/HaikeiLabs/skills#installing` | Current skill-directory table |
| The harness's own docs | Its skills documentation | Where that harness version discovers skills |

## Supported harnesses

| Harness | Kind | Notes |
| --- | --- | --- |
| Claude Code, Codex, OpenCode, Pi | Kei-enabled local coding harness | This skill's main path |
| Cursor | Kei-enabled local coding harness (skills only) | The skills repo ships a Cursor plugin; the console does not list a Cursor runtime adapter yet, so confirm before promising governed calls |
| Assistant, PDE | Kei product harness | Adapter is built into the product; register its tools against an installation |
| Discord | Haikei-internal product harness | Not a customer onboarding path |

Any other harness is unsupported and is denied until an adapter is explicitly
registered. Do not improvise one.

## FIRST: find out which harness you are running in

Check the environment rather than assuming — the skills directory differs per
harness, and installing into the wrong one silently does nothing. Then check
whether the skills are already there (for example a `kei-cli` folder in the
harness's skills directory, or the harness's skill list) before installing
again.

## 1. Install the Haikei skills

The repo is `https://github.com/HaikeiLabs/skills`. Skills are portable
`SKILL.md` folders, so every harness gets the same content.

**Plugin install (preferred where available):**

```text
# Claude Code
/plugin marketplace add HaikeiLabs/skills
/plugin install haikei@haikei

# Codex
codex plugin marketplace add HaikeiLabs/skills
codex plugin add haikei@haikei
```

Cursor: **Settings → Rules → Add Rule → Remote Rule (GitHub)** with
`HaikeiLabs/skills`.

**Clone and link (OpenCode, Pi, or any harness without a plugin flow):**

```sh
git clone https://github.com/HaikeiLabs/skills.git ~/src/haikei-skills
for d in ~/src/haikei-skills/skills/*/; do
  name=$(basename "$d")
  dest="$SKILLS_DIR/$name"                 # pick SKILLS_DIR from the table below
  if [ -e "$dest" ]; then echo "exists, skipping: $name"; continue; fi
  ln -s "$d" "$dest"
done
```

Symlinks keep the skills current with `git pull`; copy instead if the harness
does not follow symlinks. Either way: keep existing skills, never overwrite a
same-named skill without asking, and never copy `.git`.

| Harness | User directory | Project directory |
| --- | --- | --- |
| Claude Code | `~/.claude/skills/` | `.claude/skills/` |
| Codex | `~/.agents/skills/` (older: `~/.codex/skills/`) | `.agents/skills/` |
| OpenCode | `~/.config/opencode/skills/` (or `$OPENCODE_CONFIG_DIR/skills/`) | `.opencode/skills/` |
| Pi | `~/.pi/agent/skills/` or `~/.agents/skills/` | `.pi/skills/` or `.agents/skills/` |
| Cursor | `~/.cursor/skills/` | — |

OpenCode also reads `~/.claude/skills/` and `~/.agents/skills/`, and Pi reads
`~/.agents/skills/`. So one copy in `~/.agents/skills/` serves Codex, OpenCode,
and Pi. Avoid installing the same skill name in two directories that one
harness reads, or it may load a stale copy.

**Verify discovery.** Each `SKILL.md` must start with `---` frontmatter holding
`name` and `description`; a file that begins with anything else (even a
comment) is skipped. Then confirm the harness actually sees the skills.
OpenCode can list them:

```sh
opencode debug skill | jq -r '.[].name' | grep '^kei'
```

For the other harnesses, restart the session and check the skill list. A new
skill is not picked up by a session that is already running.

## 2. Pair the harness with a runtime

Governed calls need a runtime installation and `kei-proxy` on the same host or
container as the harness. Follow **`kei-runtime-setup`** — it starts with
`kei login`, which a person must approve in the browser. For a local coding
harness, create the installation with `--platform cli`.

For a Kei-enabled coding harness on a workstation, the current path is:

```sh
kei login                                       # admin, once; a person approves in the browser
kei bot init --platform cli --name "my laptop"
kei workspaces list                               # discover workspace name or ID
kei bot credential --installation ID --workspace WS | <secret-manager import>
<secret-manager read> | kei setup --control-plane-url https://app.haikeilabs.com   # token via pipe → ~/.config/kei.yaml
kei runtime bootstrap     # runs the bundled kei-proxy to verify + heartbeat
kei bot bind --installation ID
```

At run time the harness process needs `KEI_RUNTIME_TOKEN` and
`KEI_RUNTIME_CONTROL_PLANE_URL` in its environment so the `kei-proxy` it
spawns for each call inherits them. Load them from the secret manager; do not
put the token in a harness config file in a repo.

## 3. Pass identity on every governed call

A tool call is **governed** when it touches tenant data, external systems, or
credentials: it goes through `kei-proxy authorize` (or the agentware
`KeiProxyEvaluator` — see the `agentware-sdk` skill), Kei policy decides, the
decision is audited, and enrollment or approval can apply. A call that is
**non-governed** runs locally and never reaches Kei. When unsure, treat the
tool as governed. The full distinction is in the `kei-proxy` skill.

The adapter calls `kei-proxy authorize` before a governed tool runs and obeys
the result: exit code `0` means allowed; any non-zero exit (a deny, or an
error such as an unreachable control plane) means do not run the tool. The
full flag and env reference is in the `kei-proxy` skill. Identity and
delegation come from flags or environment:

```text
KEI_PROXY_FRAMEWORK=claude|codex|opencode|pi   # which harness
# Agent identity is auto-discovered from the runtime identity event
# (kei-proxy >= 0.1.11, agentware >= 0.4.0). No agent-ID env var needed.
KEI_PROXY_INVOKING_SUBJECT=<the human who started the task>
KEI_PROXY_PARENT_SPAN / KEI_PROXY_DELEGATION_DEPTH   # when a subagent delegates
KEI_PROXY_REGISTRY=<tool → service registry path>
```

Keep the human who started the task as the invoking subject through every
subagent hop; it is what the audit trail attributes the call to. Never put a
tenant, org, or workspace ID in agent-controlled tool parameters — scope comes
from the runtime token.

To read the assigned agent ID at runtime, use the agentware SDK's
`link.identity()` (see `agentware-sdk` skill). If identity is not available,
deny governed calls — never guess a fallback agent ID.

### 3a. Use KeiProxyEvaluator instead of hand-rolling authorize

If your harness imports the agentware SDK (any of the three ports), use
`KeiProxyEvaluator` instead of calling `kei-proxy authorize` directly. It
handles spawn, timeout, env filtering, decision parsing, enrollment
extraction, and all fail-closed invariants. See the `agentware-sdk` skill for
per-language construction, the decision table, and testing with shared
fixtures.

Do **not** keep a local allow list in the harness. The workspace policy bundle
(`kei-proxy` + `kei-policy-catalog`) is the single source of truth for what
is allowed. A local allow list is stale on deploy and invisible to audit.

> **Future (HAI-124):** Catalog-distributed policy bundles will let the
> control plane push policy updates to runtimes without a deploy. Until then,
> the runtime boots with the bundle it fetched at bootstrap. `KeiProxyEvaluator`
> works the same way either way — it asks `kei-proxy` every time.

## 4. Register tools and bind connectors (console)

Registering the harness's skills and tool IDs against the installation, and
binding connectors and capabilities to an agent, happen in the web app today
(**Agents → Bindings**). There is no `kei` command for them and no
resource-oriented API yet. A tool is not allowed just because the adapter
exposes it; baseline tools like `search_wiki` and `web_search` are
policy-governed too.

## 5. Prove it fails closed

Run one permitted, disposable call and one deliberately unbound call:

```sh
kei-proxy authorize --user TEST_USER_ID --tool github.create_pr \
  --action github:write --resource repo:acme/widgets; echo "exit=$?"
```

The unbound call must be denied without any provider call and produce only
redacted audit metadata. Missing bindings, an unregistered harness, invalid
installation scope, stale policy, and no matching policy must all be **DENY**.
The harness is not set up until you have seen a denial.

`KEI_PROXY_DISABLED=true` is a valid setting, but it turns permits off: a
disabled, missing, or misconfigured kei-proxy denies **every** governed call
(fail-closed, HAI-249) — it never permits a tool call. Tests that need an allow
inject a fake evaluator instead (see the `agentware-sdk` skill); a production
harness should not run with kei-proxy disabled.

## 6. Enrolling chat users (claim links)

When a chat-platform user (Teams, Slack, or Discord) is not yet linked to a
Kei user, the authorize endpoint returns `decision: "enrollment_required"`
with an `enrollment` block instead of `deny`:

```json
{
  "decision": "enrollment_required",
  "reason": "provider identity is not linked to a kei user",
  "identity_status": "unlinked",
  "org_id": "...",
  "workspace_id": "...",
  "provider_user_id": "...",
  "enrollment": {
    "provider": "teams|slack",
    "provider_user_id": "...",
    "org_id": "...",
    "workspace_id": "...",
    "url": "https://...",
    "expires_at": "2026-09-28T12:00:00Z"
  }
}
```

The harness must:

1. **Show the claim link privately.** The `url` is a one-time link that enrols
   the user as a workspace member with default group access; treat it as
   sensitive — show it only to the user who needs it, never log it or echo it
   to a shared channel.
2. **Honour the expiry.** `expires_at` is ~15 minutes from issuance; after that
   the url is unredeemable and the user must be re-prompted to authorize again.
3. **Re-authorize after enrollment.** Once the user visits the link and
   completes the self-enroll flow, their provider identity is linked and the
   next authorize call returns `allow` or policy-driven `deny` instead of
   `enrollment_required`.
4. **Do not auto-retry enrollment.** If the url is expired or the user declines,
   the next authorize call from the same provider identity re-issues a fresh
   enrollment. Do not loop; let the user drive re-authorization.
5. **Self-enroll grants member + default group.** Redeeming the claim link
   creates a Kei user (if new) and links the provider identity with member-level
   access and the workspace's default group. Approval-based elevation
   (managed access-request flow) is for non-default groups or elevated roles.

The `enrollment` object may be absent (no url/expires_at) when the control
plane cannot issue a claim — for example when the runtime installation has no
workspace scope or `KEI_WEB_BASE_URL` is unset. In that case fall back to
`guest_requires_signup`.

**Always show the newest link.** Every `enrollment_required` response mints a
new claim and invalidates the previous live claim for that identity. A resent
old link fails with `claim_used` (409). Do not mint extra links yourself —
each authorize call already does that. If the user has not acted on a link and
you re-prompt, show the link from the latest response, not a cached one.

The claim-link lifecycle is documented in detail at the canonical API contract:
`kei-policy-catalog docs/chat-identity-claims.md`.

## Validation commands

```sh
ls "$SKILLS_DIR" | grep '^kei'                          # skills installed
head -3 "$SKILLS_DIR/kei-cli/SKILL.md"                  # frontmatter starts with ---
kei-proxy runtime bootstrap | jq '.workspace_id'        # runtime scoped to a workspace
kei-proxy authorize --user U --tool T --action A --resource R; echo $?
```

## Realistic usage boundaries

- Do not paste runtime tokens into harness config
  files in a repo, or into the conversation.
- Installing skills changes what the agent knows, not what it may do. Policy in
  the workspace decides that.
- Agents are created in the console; there is no CLI command for that yet.
- The explicit Harness resource and short-lived runtime identity in the ADRs
  are planned. Do not present them as available.
- The installation-claim handshake (HAI-155) IS available for chat-platform
  identities via the claim-link enrollment flow (see section 6 above), but is
  NOT available for generic harness-to-installation linking.

## Related skills

- `kei-openai-backends` — model format support for the five verified model
  families (OpenAI, Anthropic, Qwen, DeepSeek, GLM) and their tool-call,
  prompt, and reasoning format differences.
