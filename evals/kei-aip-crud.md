# Eval prompts for `kei-aip-crud`

These prompts are safe, non-production evaluations. The evaluator should
provide the skill and a temporary checkout or fixture repository, and should
not supply production credentials.

## 1. Kei CLI CRUD task

> In `github.com/HaikeiLabs/kei`, add CLI support for managing workspace
> policies. First inspect the local instructions, existing policy client,
> commands, resource names, auth/audit behavior, and tests. Propose the
> resource-oriented List/Get/Create/Update/Delete mapping and implement only
> the client/CLI pieces supported by existing governed contracts. Use the
> existing Kei client path, opaque pagination, PATCH update masks, and stable
> error handling. Do not invent an endpoint or use raw HTTP. Wire tests and
> report validation commands, blast radius, and follow-up API work if the
> server contract is incomplete.

## 2. Policy-catalog AIP endpoint task

> In `github.com/HaikeiLabs/kei-policy-catalog`, add a workspace-scoped
> `connector-bindings` AIP endpoint. Inspect AGENTS.md, ADR-019, existing
> routes, middleware, handlers, repositories, scope helpers, audit identity,
> aipcheck, and tests before changing code. Implement List/Get/Create/Update/
> Delete with plural kebab-case paths, opaque page tokens, PATCH plus an
> update mask, stable error reasons, and one repository interface wired in
> production and test setup. Keep SQL in `pkg/database`; the catalog must
> retain metadata only and must not execute providers or store payloads,
> credentials, or results. If conforming an old route, use a dual route and
> one shared handler. Run focused tests, formatting/build checks, and aipcheck.

## 3. Migration/database-boundary task

> Plan a new policy-catalog migration that adds a workspace-scoped metadata
> column needed by an existing CRUD handler. Inspect the canonical contract,
> ADR-016/017/019, repository boundary, current migrations, and `origin/main`
> before editing. Verify the next free migration number against origin/main,
> include goose Up and Down sections, place all SQL behind the repository
> boundary, wire production and test dependencies, and preserve org/workspace
> authorization. This is a plan/audit-only exercise: do not apply migrations,
> contact providers, use production credentials, or mutate production. Return
> the validation, approval, rollout, rollback, and PR handoff conditions.
