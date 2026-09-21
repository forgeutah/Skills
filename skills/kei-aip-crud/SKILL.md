---
name: kei-aip-crud
description: Internal Haikei engineering guidance for resource-oriented CRUD, AIP endpoints, Kei CLI/API clients, and kei-policy-catalog handlers, repositories, migrations, and tests. Use only for work in github.com/HaikeiLabs/kei, github.com/HaikeiLabs/kei-policy-catalog, or their governed API/CLI contracts; not for public operational runbooks.
metadata:
  short-description: Internal Kei AIP/CRUD development
  audience: Haikei internal engineering
  repositories: HaikeiLabs/kei, HaikeiLabs/kei-policy-catalog
---

# Internal Kei AIP/CRUD development

Use this skill for changes spanning the Kei CLI, Kei API clients, and
`kei-policy-catalog`: resource-oriented CRUD, route and CLI conventions,
pagination, field masks, errors, resource names, repositories, migrations, and
policy-catalog integration. This is internal development guidance. It is not a
public API guide, an operator runbook, or permission to apply production
changes.

## First: establish scope and authority

1. Identify the target repository and service (`kei`/CLI or
   `kei-policy-catalog`) and read its local `AGENTS.md`, README, contribution
   instructions, and relevant package instructions before editing.
2. Read ADR-019, the `kei-api-conventions` contract if present, the relevant
   service/repository and database-boundary ADRs, and the tool-definition
   contract. Treat repository-local documents as authoritative when they are
   more specific or newer.
3. Search before adding anything: route registration, existing handlers and
   middleware, AIP helpers/checkers, CLI commands and client methods, resource
   types/names, repository interfaces and implementations, migrations, and
   focused tests. Reuse an existing contract, handler, repository method, or
   migration owner when one already exists.
4. Decide whether the request is plan/audit-only or implementation. A plan or
   audit may inspect and report but must not edit, migrate, deploy, or call a
   provider. An implementation requires an explicit change scope, validation
   evidence, and a reviewable handoff.

## Non-negotiable boundaries

- Use the governed Kei CLI and repository APIs/contracts. Do not teach or use
  raw HTTP, hand-written `curl`, guessed endpoints, private bypasses, or
  duplicated client contracts when a Kei CLI/client path exists.
- All SQL belongs in `pkg/database` (or the repository's documented equivalent)
  behind a domain-specific repository interface. Handlers, `main.go`, and
  unrelated `cmd/*` packages must not issue SQL. Keep handlers focused on
  validation, authorization, mapping, and response behavior.
- Every read and mutation is scoped to the authorized organization and
  workspace where a workspace exists. Never silently widen scope because an
  `org_id` or workspace identifier is omitted. Preserve audit identity and
  authorization checks through the entire call path.
- `kei-policy-catalog` stores policy and connector/tool metadata only. Never
  put provider payloads, customer data, credentials, indexes, or provider
  results in the catalog. The catalog does not directly execute providers;
  provider execution and credential resolution remain in the governed
  tenant-side runtime/proxy.
- Do not duplicate migrations, schemas, tool-definition contracts, or other
  cross-repository contracts. Find the single owner and integrate with it.

## Map resources, APIs, and CLI commands

Model nouns as resources and collections as plural kebab-case names. For each
resource, prefer this mapping:

| Operation | API shape | CLI shape |
| --- | --- | --- |
| List | `GET /api/v1/<resources>` | `kei <resource> list` |
| Get | `GET /api/v1/<resources>/{id}` | `kei <resource> get <id>` |
| Create | `POST /api/v1/<resources>` | `kei <resource> create ...` |
| Update | `PATCH /api/v1/<resources>/{id}` + `update_mask` | `kei <resource> update <id> ...` |
| Delete | `DELETE /api/v1/<resources>/{id}` | `kei <resource> delete <id>` |

Use canonical resource names and parent/workspace paths from the existing
contract. List must use opaque `page_token` pagination and return
`next_page_token`; do not introduce offset pagination for new work. Update is
PATCH and must validate an explicit update mask, including allowed fields and
immutable fields. Return stable machine-readable error reasons alongside
human-readable messages.

Use an explicit `POST .../{id}:verb` custom method only for a deliberate
non-CRUD state transition that cannot be represented as a field update (for
example `:approve` or `:start`). Do not turn ordinary CRUD into action routes.
Keep CLI commands as a governed client of the same API; do not create a
CLI-only endpoint or bypass server authorization and audit attribution.

When renaming or conforming an existing route, add the new route and retain
the legacy route temporarily, both pointing to one shared handler. Move known
callers, mark the old route deprecated, validate route parity/aipcheck, and
remove the old route only in a separately reviewable cleanup. Middleware
migration and handler mapping are separate follow-up steps: use dual routes
and one shared handler, never duplicate business logic or bypass governance.

## Repository and test wiring

Define a narrow repository interface around the domain operations, with a
Postgres implementation and constructor in the database boundary. Inject it
into handlers/services. Wire the repository in production setup and in
`main_test.go` or equivalent test setup; a nil test dependency can compile and
then panic. Return rows affected from mutations when needed so handlers can
distinguish not-found from database failure. Reuse existing scope/authorization
helpers and repository methods rather than adding a second query for the same
boundary check.

Tests should cover authorization, org/workspace isolation, audit identity,
validation and stable errors, pagination token behavior, update-mask behavior,
not-found handling, route aliases during migration, and CLI-to-client request
mapping. Prefer focused unit/integration tests with test doubles or an
isolated database. Never use production credentials, provider calls, or
production data in skill evaluations.

## Migrations and database work

Before creating a migration, inspect `origin/main` in the owning repository
and verify the next free numeric prefix; branch-local inspection is
insufficient. Do not renumber an applied migration or duplicate a migration
owned by another repository. Every goose migration needs both sections:

```sql
-- +goose Up
...

-- +goose Down
...
```

Run the repository's migration-number and schema checks plus an isolated
throwaway database migration test when available. Never apply a migration to
production from this workflow. A migration plan must state owner, dependency,
approval gate, rollout order, compatibility window, rollback/down strategy,
and the risk if the migration is partially applied.

## Plan, validation, and PR handoff

An implementation plan or PR description must state:

- design and contract/resource mapping;
- affected services, dependencies, repository and handler boundaries;
- authorization, audit identity, and organization/workspace scope;
- migration and compatibility/rollout conditions;
- blast radius, required approvals, rollback path, and explicit production
  safety boundaries.

Run the narrowest relevant tests first, then formatting, lint/build, route
parity/aipcheck, and migration checks required by the target repository. Report
exact commands and results, including known failures unrelated to the change.
Review the diff for secrets, provider payloads/results, credentials, duplicate
contracts/migrations, raw HTTP, SQL outside the database boundary, and
unrelated edits. The PR handoff should identify changed files, tests,
contracts/ADRs consulted, rollout or follow-up work, and any blocker; do not
claim deployment or production migration unless separately authorized and
verified.
