---
name: pde-gcp-runtime
description: Install and validate a PDE runtime on GCP Cloud Run — control-plane registration via kei CLI, tenant-side kei-connector-runtime binary, identity enrollment, credential-free Cloud Run config, heartbeat, wiki/web tool routing, and redacted audit verification.
---

# PDE GCP Runtime Installation

This skill teaches a harness to install and exercise the PDE (provider
execution environment) runtime on GCP Cloud Run. The runtime comprises two
distinct binaries with separate responsibilities:

| Binary | Role | Installed by |
|--------|------|-------------|
| `kei` | Administrator CLI — control-plane installation, credential minting, identity registration, dry-run validation | DevOps engineer |
| `kei-connector-runtime` | Tenant-side daemon — provider execution, heartbeat, tool routing, audit delivery | Runtime bootstrap |

Neither binary calls providers, applies Terraform, or deploys GCP
infrastructure. Those responsibilities are preconditions.

## Prerequisites

- GCP project with Cloud Run enabled and a service account
  (`run.googleapis.com`).
- Terraform-applied infrastructure: Cloud Run service, IAM bindings, VPC
  connector, Artifact Registry, Secret Manager.
- `kei` CLI binary on `$PATH` — authenticated to the control plane
  (`KEI_CONTROL_PLANE_URL`, default `https://app.haikeilabs.com`).
- `kei-connector-runtime` binary available for sidecar or multi-container
  deployment (pulled from Artifact Registry or Cloud Storage).
- Network egress to the control-plane URL on port 443.
- A registered organization and workspace in the control plane.

## Workflow

### 1. Register control-plane identity

Every runtime installation belongs to exactly one workspace and carries
exactly one active installation-scoped credential. Register the identity
before provisioning infrastructure.

```bash
# Log in as an administrator
kei auth login

# Create the org if it does not exist
kei orgs create --name "acme-corp" --display-name "Acme Corp"

# Create the workspace
kei workspaces create \
  --org acme-corp \
  --name "production" \
  --display-name "Production"

# Verify
kei whoami --org acme-corp --workspace production
```

### 2. Create runtime installation and mint credential

The control plane creates the installation and its single credential in one
idempotent transaction. The credential is exposed to the runtime as
`KEI_RUNTIME_TOKEN`. `KEI_HARNESS_TOKEN` is a deprecated alias; new
installations use `KEI_RUNTIME_TOKEN` only.

```bash
# Dry run first — validates org, workspace, and token without mutating state
kei installations create \
  --org acme-corp \
  --workspace production \
  --dry-run

# Create the installation (idempotent)
INSTALL=$(kei installations create \
  --org acme-corp \
  --workspace production \
  --agent-name "gcp-pde-runtime-1" \
  --output json)

INSTALLATION_ID=$(echo "$INSTALL" | jq -r '.installation_id')
RUNTIME_TOKEN=$(echo "$INSTALL" | jq -r '.credential.token')

# Store token in Secret Manager (never in a file or command line)
echo -n "$RUNTIME_TOKEN" | gcloud secrets versions add kei-runtime-token --data-file=-
```

Never pass `KEI_RUNTIME_TOKEN` as a CLI flag. The
`kei-connector-runtime` binary reads it from the environment variable
`KEI_RUNTIME_TOKEN` or from a mounted secret file at
`/etc/kei/runtime-token`.

### 3. Wait for default-tool policy bootstrap

Installation creation does not authorize tools by itself. The control plane
must complete an idempotent default-tool policy bootstrap that publishes a
valid policy bundle. The proxy is fail-closed; it denies every tool call
until the bundle is valid and ready.

```bash
# Check policy-bundle readiness
kei installations status \
  --org acme-corp \
  --workspace production \
  --installation-id "$INSTALLATION_ID"
# Expected: policy_bundle_ready: true
# Baseline tools: wiki_search, web_search

# If stuck at false, trigger the bootstrap
kei installations bootstrap-policies \
  --org acme-corp \
  --workspace production \
  --installation-id "$INSTALLATION_ID" \
  --dry-run

kei installations bootstrap-policies \
  --org acme-corp \
  --workspace production \
  --installation-id "$INSTALLATION_ID"
```

The bootstrap creates the workspace default user group, registers the harness
tool definitions, and creates explicit permit policies for the baseline tools.
The control plane owns policy rows and the distributed policy bundle; the
proxy only fetches and enforces it.

### 4. Configure Cloud Run without embedding credentials

Deploy the `kei-connector-runtime` as a sidecar or second container in the
Cloud Run service. The runtime resolves its credential from Secret Manager at
startup, never from an embedded token or CLI argument.

```yaml
# cloud-run-service.yaml (illustrative — apply via Terraform)
apiVersion: serving.knative.dev/v1
kind: Service
metadata:
  name: kei-connector-runtime
spec:
  template:
    spec:
      containers:
        - image: us-central1-docker.pkg.dev/acme-corp/kei/kei-connector-runtime:latest
          name: runtime
          ports:
            - containerPort: 8080
          env:
            - name: KEI_RUNTIME_CONTROL_PLANE_URL
              value: "https://app.haikeilabs.com"
            - name: KEI_ORG_ID
              value: "acme-corp"
            - name: KEI_WORKSPACE_ID
              value: "production"
            - name: KEI_INSTALLATION_ID
              value: "INSTALLATION_ID_PLACEHOLDER"
            - name: KEI_RUNTIME_TOKEN
              valueFrom:
                secretKeyRef:
                  name: kei-runtime-token
                  key: latest
          startupProbe:
            httpGet:
              path: /healthz
              port: 8080
```

The runtime uses the credential at startup to call
`/api/v1/runtime/whoami` and resolve its identity (org, workspace,
installation, agent). It never writes the token to disk.

### 5. Register the harness identity

After the runtime starts, register the harness that will invoke the runtime
for tool execution.

```bash
# Register the harness (e.g., kei-chat-harness, discord-harness)
kei harnesses register \
  --org acme-corp \
  --workspace production \
  --installation-id "$INSTALLATION_ID" \
  --name "discord-production" \
  --kind discord

# Link the harness to the runtime agent
kei installations assign-agent \
  --org acme-corp \
  --workspace production \
  --installation-id "$INSTALLATION_ID" \
  --agent-id "$AGENT_ID"
```

### 6. Send heartbeats and verify health

The runtime sends heartbeats to the control plane at a configurable interval
(default 30 s). The heartbeat proves the runtime is alive and its credential
is still valid.

```bash
# Manually trigger a heartbeat (for testing)
kei-connector-runtime heartbeat \
  --control-plane-url "https://app.haikeilabs.com"

# Verify heartbeat receipt
kei installations status \
  --org acme-corp \
  --workspace production \
  --installation-id "$INSTALLATION_ID" \
  --show-heartbeat

# Expected output example:
#   last_heartbeat: "2026-09-23T14:30:00Z"
#   credential_valid: true
#   policy_bundle_ready: true
```

The heartbeat response includes the `rows_affected` count: zero means the
installation token is invalid and the runtime must refuse all tool calls
(response 401, not 500).

### 7. Route wiki and web tool calls through the runtime

The runtime exposes a tool-call endpoint at `/api/v1/runtime/tools/invoke`.
The harness sends tool invocation requests here; the runtime enforces policy
and proxies approved calls to external services.

```bash
# Tool invocation via the runtime (from the harness)
curl -X POST "http://localhost:8080/api/v1/runtime/tools/invoke" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $KEI_RUNTIME_TOKEN" \
  -d '{
    "tool": "wiki_search",
    "arguments": {"query": "runtime installation contract"}
  }'

# Expected: 200 with search results (policy allows wiki_search)
# Expected: 403 if tool is not in the policy bundle
```

Baseline tools permitted by the default policy bundle:

- `wiki_search` — search the shared knowledge wiki
- `web_search` — perform a web search

The runtime routes approved tool calls to the configured backend and returns
the response to the harness. Policy enforcement happens before the external
call; the runtime never bypasses the bundle.

### 8. Verify redacted audit delivery

Every tool invocation is audited. The audit record is redacted — the runtime
removes credential material, secrets, and PII before sending the record to
the control plane. Verify delivery with the administrator CLI.

```bash
# List audit records for the installation
kei audits list \
  --org acme-corp \
  --workspace production \
  --installation-id "$INSTALLATION_ID" \
  --limit 10

# Inspect a specific audit record
kei audits get \
  --org acme-corp \
  --workspace production \
  --audit-id "$AUDIT_ID" \
  --output json | jq 'del(.credential_fields, .secret_fields, .pii_fields)'

# Verify no bearer tokens or secrets appear in the record
# The record must NOT contain: KEI_RUNTIME_TOKEN, Authorization header value,
# credential injection values, or any field bearing the runtime credential.
```

A redacted audit record should look like this (note the `[REDACTED]`
placeholders for sensitive fields):

```json
{
  "audit_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "installation_id": "inst-abc123",
  "tool": "wiki_search",
  "invoked_at": "2026-09-23T14:30:00Z",
  "arguments": {"query": "[REDACTED]"},
  "result_summary": "2 results returned",
  "credential_bearer": "[REDACTED]",
  "duration_ms": 342,
  "policy_evaluation": "allowed"
}
```

## Negative checks

These checks must pass before the installation is considered production-ready.

### Missing workspace

```bash
kei installations create \
  --org acme-corp \
  --workspace nonexistent \
  --dry-run
# Expected: exit code 1, error "workspace not found"
```

### Missing policy or binding

```bash
kei installations invoke-tool \
  --org acme-corp \
  --workspace production \
  --installation-id "$INSTALLATION_ID" \
  --tool "database_query" \
  --dry-run
# Expected: exit code 1, error "tool database_query: no matching policy"
```

### Stale or revoked installation

```bash
# After revoking the installation credential
kei installations status \
  --org acme-corp \
  --workspace production \
  --installation-id "$INSTALLATION_ID"
# Expected: credential_valid: false

# Heartbeat returns 401
kei-connector-runtime heartbeat
# Expected: exit code 1, rows_affected = 0
```

### Unknown tool

```bash
kei installations invoke-tool \
  --org acme-corp \
  --workspace production \
  --installation-id "$INSTALLATION_ID" \
  --tool "this_tool_does_not_exist" \
  --dry-run
# Expected: exit code 1, error "unknown tool"
```

### Credential-bearing heartbeat

```bash
# Heartbeat request must never echo the credential back
kei audits list \
  --org acme-corp \
  --workspace production \
  --installation-id "$INSTALLATION_ID" \
  --filter "tool=heartbeat" \
  --limit 1 | grep -i "KEI_RUNTIME_TOKEN\|Bearer.*eyJ"
# Expected: no matches (credential fully redacted)
```

## Local validation (no GCP, no Terraform)

Run the full validation suite against a local control-plane mock or the
staging environment:

```bash
# 1. Dry-run installation creation
kei installations create --org acme-corp --workspace staging --dry-run

# 2. Dry-run policy bootstrap
kei installations bootstrap-policies --org acme-corp --workspace staging --dry-run

# 3. Validate runtime startup (local binary)
KEI_RUNTIME_TOKEN=$(cat /tmp/test-token) \
KEI_ORG_ID=acme-corp \
KEI_WORKSPACE_ID=staging \
KEI_INSTALLATION_ID=test-inst-001 \
KEI_RUNTIME_CONTROL_PLANE_URL=http://localhost:9099 \
kei-connector-runtime validate-config

# 4. Dry-run tool invocation
kei installations invoke-tool \
  --org acme-corp \
  --workspace staging \
  --installation-id test-inst-001 \
  --tool wiki_search \
  --dry-run

# 5. Verify redaction locally
kei-connector-runtime audit verify-redaction \
  --audit-file /tmp/sample-audit.json

# 6. Run all negative checks above against staging
```

If all steps succeed, the installation is ready for GCP Cloud Run deployment.
The Terraform apply and `gcloud run deploy` are out of scope for this skill.

## Validation commands

```bash
# 1. Verify SKILL.md frontmatter matches folder name
head -5 SKILL.md | grep -q 'name: pde-gcp-runtime'

# 2. Confirm binary names are distinct and explicit
grep -q 'kei ' SKILL.md
grep -q 'kei-connector-runtime' SKILL.md

# 3. Confirm no Terraform, provider, or secret-inline patterns
! grep -i 'terraform apply\|provider.*call\|secret.*=' SKILL.md | grep -v 'valueFrom\|secretKeyRef'

# 4. Confirm every negative check has an expected error assertion
grep -c 'Expected:' SKILL.md

# 5. Confirm eval fixture exists
test -f evals/evals.json
```

## Realistic usage boundaries

- This skill does **not** deploy GCP infrastructure, apply Terraform, or call
  providers. Those responsibilities live in a separate Terraform module.
- The skill does **not** cover secret rotation, credential expiry monitoring,
  or multi-region failover.
- Tool policy authoring (beyond the default bootstrap) is a separate skill.
- The `kei` CLI `--key` / `--harness-key` flags are deprecated in favor of
  `KEI_RUNTIME_TOKEN`; this skill uses only the environment-variable form.
- Audit retention, export, and compliance reporting are out of scope.
- The runtime is fail-closed; if the control plane is unreachable, the runtime
  denies all tool calls until connectivity is restored.
