---
name: kei-openai-backends
description: OpenAI-compatible LLM backend integration for the Kei chat harness and the pedro-agentware evals. Use when the task mentions LLM_ENDPOINT, LLM_MODEL, OPENAI_BASE_URL, OpenAIChatModel, pydantic-ai, /v1 chat/completions, llama.cpp, vLLM, Ollama, llamafile, the kei local stack (docker-compose.kei-local.yml, scripts/seed-local-kei.sh), abac-engine/oidc-bridge, or wiring any model backend. Use for the harness's model-format tool renderers (OpenAI/Anthropic/Ollama in tool_definitions.py) and the evals ModelBackend. For the DVL Assistant repo there is deliberately NO LLM — do not reach for this skill inside src/.
---

# OpenAI-compatible backends

The chat harness and the eval harnesses talk to **any OpenAI-compatible `/v1` endpoint**
(llama.cpp, vLLM, Ollama-compatible, etc.). There is no hardcoded provider and no `openai`
SDK dependency: the harness uses pydantic-ai's `OpenAIChatModel` and the eval harnesses use a
raw `/chat/completions` POST.

## Supported model families

Agentware ships model-specific tool, prompt, and reasoning formatters for five
verified model families. Each family has a `ToolFormatter` implementation in Go,
Python, and TypeScript that handles the family's unique schema for tool
definitions, tool calls, tool results, and reasoning fields.

| Family | Model prefixes | Tool definitions | Tool calls (response) | Tool result | Reasoning field | Thinking tags |
|--------|---------------|------------------|----------------------|-------------|-----------------|---------------|
| **OpenAI** | `gpt-*`, `o1-*`, `o3-*` | JSON function array (Generic) | JSON array: `{name, arguments}` | JSON | `reasoning_content` | none |
| **Anthropic** | `claude-*`, `anthropic-*` | JSON function array (Generic) | XML: `<invoke tool="name">JSON</invoke>` | XML: `<result tool="name">` | `thinking` (content block) | none |
| **Qwen** | `qwen-*`, `qwq-*` | XML: `<tool_description>` | XML: `<tool_call><tool name="name">JSON</tool>` | XML: `<tool_response>` | `reasoning_content` | `<thinking>...</thinking>` |
| **DeepSeek** | `deepseek-*` | JSON function array (Generic) | JSON array: `{name, arguments}` | JSON | `reasoning_content` | `[THINK]...[/THINK]` |
| **GLM** | `glm-*`, `chatglm-*` | JSON function array (Generic) | JSON array: `{name, arguments}` | JSON | `reasoning_content` | none |

Key differences across families:

- **OpenAI / DeepSeek / GLM** use the same generic JSON function-array format for
  tool definitions and tool calls. The families differ in reasoning-field naming and
  inline thinking tags.
- **Anthropic** uses a structured `thinking` content block (Messages API) and XML
  envelopes for tool calls and results.
- **Qwen** stands apart with XML-based tool definitions (`<tool_description>`),
  XML tool calls, and inline `<thinking>` tags.

The canonical reference for all five formatters, including per-family response
examples and the reasoning adapter, is the Agentware
[model-format-reference.md](https://github.com/HaikeiLabs/agentware/blob/main/docs/model-format-reference.md).

### Tool-definition renderer (chat harness)

The tool-definition renderer in the chat harness (`tool_definitions.py`) produces
model-specific schemas for three of the five formats:

| ModelFormat | Tool schema shape | Used by |
|---|---|---|
| `openai` | OpenAI function-calling format (`type: "function"`, `function.parameters`) | Chat harness `/chat/completions` calls; eval ModelBackend |
| `anthropic` | Anthropic tool-use format (`type: "custom"`, `input_schema`) | Chat harness when using Anthropic-compatible endpoints |
| `ollama` | Ollama tools format (simplified function schema) | Chat harness for local Ollama endpoints |

Each format is rendered by a dedicated function in `render_tools()`. Adding a new format
means adding a new `ModelFormat` enum variant and a new render function; the `FormatAdapter`
class selects the renderer by format name. The adapter is constructed once in `create_agent()`
and reused for the agent's lifetime.

> The chat harness's `tool_definitions.py` renderer currently covers OpenAI,
> Anthropic, and Ollama. The full five-family formatter support lives in the
> Agentware SDK (`pedro-agentware`) — see the `agentware-sdk` skill and the
> model-format-reference.md link above. When the chat harness adopts Agentware's
> `ToolFormatter` for rendering, it will gain Qwen and DeepSeek renderers
> automatically.

### Reasoning adapter

Agentware's reasoning adapter handles the per-family reasoning-field extraction
from model responses. The known field set is:

- `reasoning_content` — all families except Anthropic
- `thinking` — Anthropic (structured content block, not inline)
- `thinking_content` — Anthropic, alternative SDK naming
- `reasoning` — some model-specific naming

Inline thinking tags stripped by the adapter:

- `<thinking>...</thinking>` — stripped from text content (Qwen)
- `[THINK]...[/THINK]` — stripped from text content (DeepSeek)

The guardrails response validator also strips `[THINK]...[/THINK]` as a secondary
rescue mechanism. Both stripping layers are idempotent.

### Chat agent capabilities

The pydantic-ai agent created by `create_agent()` ships these capabilities, all from
`pydantic-ai-harness`:

- `CodeMode()` — runs Python code in a subprocess sandbox
- `FileSystem()` — read/write files within an allowed root
- `Shell(denied_commands=[...])` — shell command execution with a deny list
- `WebSearch(native=False, local="duckduckgo")` — web search via DuckDuckGo
- `Thinking(effort="medium")` — chain-of-thought reasoning with configurable effort

These are registered as tools on the model at construction time and are available to every
chat turn. The harness does not support dynamic tool registration — tools are fixed at
agent construction and recreated on every `POST /message`.

## Chat harness (HaikeiLabs/Kei-Chat-Harness)

- `src/pedro_service/config.py` — `LLM_ENDPOINT` and `LLM_MODEL` must BOTH be non-empty for
  real mode; otherwise `FakePedroAgent` (deterministic fake) is used. Default endpoint
  `http://pedrogpt:8000`, default model `qwen3.6-27b-mtp`.
- `src/pedro_service/agent.py` `create_agent()` — sets up the model and environment:

  ```python
  os.environ["OPENAI_API_KEY"] = config.openai_key or "any-key-works"
  os.environ["OPENAI_BASE_URL"] = f"{config.llm_endpoint}/v1"
  model = OpenAIChatModel(config.llm_model, provider="openai")
  ```

  The API key VALUE is deliberately ignored by most compatible endpoints — only non-emptiness
  matters. Capabilities: `CodeMode()`, `FileSystem()`, `Shell(denied_commands=[...])`,
  `WebSearch(native=False, local="duckduckgo")`, `Thinking(effort="medium")` from
  `pydantic-ai-harness`.
- Tool schemas are model-format aware: `src/pedro_service/tool_definitions.py` renders
  `TOOL_DEFINITIONS` per `ModelFormat` (OpenAI / Anthropic / Ollama) via `render_tools()`.
- Eval client: `testing/evals/models.py` POSTs `{base_url}/chat/completions` directly.

### Discord main integration

The harness also provides a Discord adapter (`src/pedro_service/discord_main.py`) that
uses the same `create_agent()` and the same model configuration. The Discord path uses
`discord.py` for gateway events and reuses the same `OpenAIChatModel` / tool-definition /
KEI-proxy stack. `LLM_ENDPOINT` and `LLM_MODEL` apply identically. This is the default
local-development path as it does not require Azure Bot registration.

### Kei local stack

For local development and contract testing the harness can run against a local Kei stack:

- `docker-compose.kei-local.yml` — postgres, `abac-engine` (port 8080), `oidc-bridge`
  (8081), `credential-admin` (8090), `web`. Built from the sibling `kei` repo
  (`../kei/cmd/...`), so that checkout must exist.
- `scripts/seed-local-kei.sh` + `scripts/seed-local-kei.sql` — seeds org/user/group/policy/
  harness-key fixtures (defaults `LOCAL_KEI_ORG_ID`, `LOCAL_KEI_USER_UUID`, `KEI_RUNTIME_TOKEN=local-dev-token`).
- `docker-compose.local.yml` — the harness's own local compose (LLM + service).

### Env vars that matter

`LLM_ENDPOINT`, `LLM_MODEL`, `OPENAI_API_KEY`/`OPENAI_KEY`, `KEI_RUNTIME_TOKEN`,
`KEI_API_URL` (fallback `ABAC_URL`), `KEI_PROXY_PATH`, `KEI_PROXY_DISABLED` (inverted into
`kei_proxy_enabled`; `true` short-circuits authorization to permit), `INTERNAL_API_KEY`
(guards the `/message` endpoint). See `config.py` `Config.from_env()` for the full set.

### Eval ModelBackend variants

The chat harness `eval_harness.py` supports these backends:

| `ModelBackend` | Endpoint shape | Typical use |
|---|---|---|
| `openai` | OpenAI API (real provider key) | Production-like eval against OpenAI |
| `anthropic` | Anthropic-compatible (via `base_url` override) | Cross-provider comparison |
| `ollama` | Ollama `/v1/chat/completions` | Local, air-gapped, or cost-free |
| `llamafile` | Llama.cpp `/v1/chat/completions` | Single-binary local inference |
| `vllm` | vLLM `/v1/chat/completions` | GPU-accelerated production eval |
| `ollama_direct` | Ollama native API (non-OpenAI) | Direct Ollama integration without `/v1` wrapper |

Each backend sends the same `TestCase` shape (`messages`, `tools`, `tool_choice`) but may
normalize it differently. The `EvalHarness` class selects the backend by name, constructs
the appropriate client, and writes JSONL results under `./eval_results/`.

## pedro-agentware evals (HaikeiLabs/Agentware)

- Python: `python/src/evals/models.py` — model backends incl. Ollama; examples at
  `docs/evals/examples/{ollama_example.py,openai_example.py}`.
- TypeScript: `typescript/src/evals/models.ts`; Go: `go/evals`.
- These choose the backend at CLI time; they do not ship a model or a runner.

## Validation commands

```bash
# chat harness, headless (no LLM, no proxy)
# from the HaikeiLabs/Kei-Chat-Harness repo:
KEI_PROXY_DISABLED=true uv run pytest tests/test_headless_harness.py -q
make test-headless

# chat harness with a real local OpenAI-compatible endpoint
uv run python -m pedro_service.discord_main    # needs LLM_ENDPOINT + LLM_MODEL set

# model-format renderers + eval harness
uv run pytest tests/test_tool_definitions.py tests/test_eval_harness.py -q

# kei local stack
docker compose -f docker-compose.kei-local.yml up -d
./scripts/seed-local-kei.sh

# agentware python evals against ollama
# from HaikeiLabs/Agentware: PYTHONPATH=python/src python3 -m evals.main --models ollama
```

## Providers that are not OpenAI-compatible

The supported answer is to put the provider behind an OpenAI-compatible
`/v1/chat/completions` endpoint and point `LLM_ENDPOINT` at that. Many GPU
serving stacks already expose one (vLLM, llama.cpp/llamafile, Ollama's `/v1`).
Otherwise, use a translating gateway the team runs and owns. The harness,
`tool_definitions.py`, and `eval_harness.py` then need no vendor-specific code.

Adding a native, non-OpenAI adapter (a new `ModelFormat`, `ModelBackend`, or
model class) changes the project boundary. That needs a reviewed design (an
ADR or design doc approved by the harness owners) before any code. Until one
exists, do not write or outline implementation steps for it. Explain the
boundary, offer the compatible-endpoint path, and suggest opening the design
discussion. `ollama_direct` is an existing exception, not a template
for new ones.

## Realistic usage boundaries

- **Do not** add a hardcoded model vendor, a proprietary SDK, or a non-OpenAI-compatible
  endpoint assumption. The `/v1` + `chat/completions` contract is the boundary.
- **Do not** treat `OPENAI_API_KEY` as a real credential for compatible endpoints; it is
  presence-gated. Do not log it, mint it, or send it to hosts you do not trust.
- **Do not** run the model-backed suites as the default CI gate — they are flaky by nature
  and are marked `integration` (each PR-review eval case runs 5x for reliability).
- **Do not** confuse the harness's LLM path with the DVL Assistant repo: the DVL Assistant
  (`DVL-Group/assistant`) is **zero-LLM** — a model must never run inside `src/`.
- `KEI_PROXY_DISABLED=true` is a local/harness escape hatch only. It permits everything; it
  must never be set in a deployed, real-data environment.
- The five-family formatter table above reflects Agentware's verified implementation.
  Do not claim support for a model family whose formatter has not been implemented
  and tested in Agentware (see `pedro-agentware` `toolformat/` for the current set).

## Related skills

- `kei-headless-evals` — the eval harnesses that use these backends.
- `kei-teams-ingress` — the Teams integration that the chat harness provides alongside its
  LLM path.
- `agentware-sdk` — the middleware and KEI auth/proxy modules the harness integrates with,
  including the five-family `ToolFormatter` interface.
