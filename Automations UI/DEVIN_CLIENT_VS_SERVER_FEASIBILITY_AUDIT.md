# Devin: What Is in the Desktop App vs. What Is Server-Side — Feasibility Audit

**Question:** Can Devin be "fully decompiled" into an open-source Devin that runs with your own LLM API key, or is the execution / AI-model orchestration mostly server-side? Specifically: is the Wiki or Automations orchestration for the AI *in the app*?

**Scope of evidence:** `Devin.app` 1.126.0 (Windsurf shell 3.8.20, commit 2d902011), the captured Automations web bundle (`evidence/web/assets`), the three project docs (`DEVIN_AUTOMATIONS_DECOMPILED_SPEC.md`, `DEVIN_AUTOMATIONS_FULL_ANNOTATED_DECOMPILE.txt`, `DEVIN_MCP_OAUTH_ARCHITECTURE_GUIDE.md`), string/symbol sweeps of the two native binaries, and **live execution tests** of the bundled Devin CLI. Evidence labels: **PROVEN** = observed directly; **INFERRED** = strongly implied by observed artifacts.

---

## 0. Bottom line

| Surface | Where the *AI orchestration* runs | Where *tool execution* runs | Where *inference* runs | Recoverable from the app? |
|---|---|---|---|---|
| **Automations** (schedule / webhook / Slack / Linear / Jira triggers → sessions) | **Server** | Server (Devin cloud VM) | Server | UI + full API contract only. Scheduler, event ingestion, code-step runner, scratchpad storage, issue clustering, ACU metering: **absent**. |
| **Cloud Devin sessions** (the "Devin" agent in a VM) | **Server** | Server (or your machine via *Outposts*, but the brain stays remote) | Server | Nothing. Only UI + REST/WebSocket contract. |
| **DeepWiki / Wiki** | **Server** (indexing + generation) | — | Server | Nothing beyond `GetDeepWiki` / `wiki/status` / `wiki/contents` fetch + local cache. |
| **Windsurf Cascade** (IDE agent) | **Client** — Go language server contains the full planner/tool loop | Client (local FS, terminal, browser preview, MCP) | **Server only** — Connect-RPC to `server.codeium.com` (`AssignModel` → `GetChatMessage` / `GetStreamingCompletions`) | Behavior yes (prompts, tools, step machine are in the binary); source no; no BYO-key path in the client. |
| **Devin CLI** (`devin`, Rust, a.k.a. `chisel` / `affogato`) | **Client** — system prompt, tool loop, subagents, compaction, permission classifier, hooks/skills/rules, sandbox all local | Client | **Server only** — same Codeium Connect-RPC; the `ACP_BACKEND=openai|anthropic|mock` switch exists as text but is **compiled out** (tested) | Behavior yes; source no; cannot run without a Cognition account. |

So: the two things the user named — **Wiki and Automations orchestration — are not in the app**. The only AI orchestration that lives client-side is the *local coding agents* (Cascade and Devin CLI), and even those cannot call a model without Cognition's API server, because model routing and the inference proxy are server-side and the client-side BYOK code paths are removed from the shipped builds.

"Fully decompile Devin into an open-source Devin with your own API key" is therefore **not possible from these artifacts**. What *is* possible: an exact UI reimplementation (done for the Automations page), a compatible backend written from the recovered API contract, and an agent runtime you bring yourself (e.g., Claude Code / Codex inside a3 code), optionally informed by the recovered CLI/Cascade prompts and tool designs.

---

## 1. Inventory of what actually ships in `Devin.app`

| Artifact | Size | What it is | AI orchestration inside? |
|---|---|---|---|
| `out/vs/workbench/workbench.desktop.main.js` | 44 MB | VS Code/Windsurf workbench (Electron renderer) | No. Small scaffolding prompts only ("You are a helpful assistant that guides users through creating a new hook/skill/agent…"). Embeds `https://app.devin.ai` in an iframe (postMessage bridge v3). |
| `out/vs/sessions/sessions.desktop.main.js` | 42 MB | Second workbench variant (Devin "Sessions" window) sharing Cascade UI code | No. Contains proto *schemas* (`GetChatMessageRequest`, `EnterpriseExternalModelConfig`) for talking to the server, not the agent. |
| `node_modules/@exa/chat-client/index.js` | 24 MB | Cascade chat React UI | No (0 agent prompts; UI strings only). |
| `extensions/windsurf/dist/extension.js` | 9.4 MB | Windsurf VS Code extension: spawns the language server, auth, ACP glue to `devin acp` | No. |
| `extensions/windsurf/bin/language_server_macos_arm` | 168 MB | **Go** binary (`github.com/Exafunction/Exafunction/exa/...`) — Cascade agent runtime + indexer + MCP host + browser preview | **Yes — orchestration.** No inference. |
| `extensions/windsurf/devin/bin/devin` | 144 MB | **Rust** binary — Devin CLI (`chisel`, `affogato`, `toolbox`, `inference`, `windsurf-api-client`, `chisel-cloud-bridge`…) | **Yes — orchestration.** No inference. |
| `extensions/windsurf/devin/share/devin/docs/*.mdx`, `share/man/man1/*` | — | CLI docs / man pages | — |
| Remote: `https://app.devin.ai/automations` bundle (captured separately) | — | Automations React web app | No. |

No `devin-remote`, no Devin VM agent, no scheduler, no wiki indexer, and no LLM SDK with a wired-up direct provider path exists anywhere in the bundle. (The Rust binary's Cargo registry has **no** LLM client crate at all; the Go binary vendors `sashabaranov/go-openai` but the only `api.openai.com/v1` literal is the SDK default constant, and there is no `x-api-key`, `anthropic-version`, `ANTHROPIC_API_KEY`, or `/chat/completions` request path anywhere in either binary.)

---

## 2. Automations — server-side (PROVEN by absence + contract)

**What the client has (PROVEN):** a CRUD/monitoring UI over these endpoints (from the annotated decompile):
`automations`, `automations/templates`, `automations/schemas`, `automations/sparklines`, `automations/tags`, `automations/linear-user-access`, `automations/webhook/mint-credentials`, `automations/{id}`, `automations/{id}/trigger` (the "Run automation" button = `POST …/trigger`), `automations/{id}/events`, `/invocations`, `/issues`, `/consumption`, `/error-logs`, `/reset-monitor`, `/webhook/regenerate-secret`, `/scratch/bundle`, `/code-step/config`, `/code-step/state`, `/code-step/runs/{n}`.

**What the client does not have (PROVEN by sweep of the full decompile):** zero `You are …` prompt strings, zero model/provider strings, no RRULE evaluator (the RRULE editor only *builds* the string), no scheduler loop (the only `setInterval`s are a 30 s clock tick and a UI poll), no webhook verifier, no session spawner beyond the ordinary `POST sessions` used by "Generate with Devin" (`planning_mode:"automatic"`, `planner_type:"fast"`).

Spec §22.1's boundary ledger is confirmed: scheduler/event ingestion, concurrency enforcement, session runtime (hidden prompt stack + planner), sub-agent fan-out, MCP transport/credential injection, security/network enforcement, preflight sandbox, scratchpad storage, issue clustering and ACU metering are all **REMOTE**.

The desktop app additionally ships the `devin_automation_manage` **tool renderer** (labels for `list/get/create/validate_create/update/validate_update/delete/schemas/templates/run`) — i.e., a cloud Devin session can manage automations through a server-side tool; the desktop only renders the tool call.

---

## 3. Cloud Devin sessions, Outposts, Handoff — server-side (PROVEN)

- The CLI's `chisel-cloud-bridge` creates cloud sessions via the Devin REST API (`api.devin.ai`: `/v3/self`, `/v3/organizations/{org}/sessions`, `/sessions?session_ids=`, `/v3/organizations/{org}/integrations`) and then streams the *remote* agent over **ACP-over-WebSocket** (`/acp/live?token=…`, `session/new`, `session/prompt`, `[handoff] HandoffBackgroundFlow::run: starting cloud session streaming`). The agent itself is on the other end of the socket.
- **Outposts** (`devin worker start`, `devin connect`, `/opbeta/outposts`, `/opbeta/outposts/devins`, `?phase=pending|claimed`, `/release`): the worker "polls the queue and claims the first available pending session", downloads a **`devin-remote`** binary at runtime from `https://static.devin.ai/devin-rs/remote` (pinned by git SHA), and connects it to an **Outpost gateway** (`DEVIN_OUTPOST_GATEWAY_URL`, `DEVIN_OUTPOST_CONNECT_TOKEN`, pty-bridge). This moves the *execution environment* onto your machine; the session brain still lives behind Cognition's gateway. `devin-remote` is not in the bundle.
- **DRS** (`devin cloud drs …`): manages cloud sandboxes/blueprints/builds via the API; the CLI even carries a built-in skill prompt ("You can run Declarative Repo Setup (DRS)…") — orchestration of the sandbox is server-side.

---

## 4. DeepWiki / Wiki — server-side (PROVEN)

- Language server: `ApiServerService/GetDeepWiki` (server RPC); team-config flag `disable_deepwiki`; `https://deepwiki.org.windsurf` string; no indexing or summarization code paths named `wiki` beyond fetching.
- Devin CLI: `cognition.ai/wiki/status`, `cognition.ai/wiki/contents`, "Wiki not indexed for repo; skipping download", "Cached Devin wiki for current repo (N bytes) via REPL path", `WikiStatusResult{indexed, branch_name}`, `WikiContentsResult`, `/wiki` REPL command. The client only downloads and caches an already-generated wiki.
- Automations web bundle: only a `plg_setup_deepwiki` onboarding slug.

There is no wiki generator anywhere client-side.

---

## 5. Windsurf Cascade — orchestration local, inference remote (PROVEN)

The Go language server **is** the Cascade agent runtime:
- System prompts embedded: "You are Cascade, a powerful agentic AI coding assistant." (+ variants "…for codebase intelligence", "…acting as a senior pair programmer"), `<workspace_layout>`, `<tool_calling>`, "Present findings first (by severity with file refs)…".
- Local step machine: ~70 `*StringConverter` step types (RunCommand, ViewFile, GrepSearchV2, ProposeCode, ListDir, SearchWeb, ReadUrlContent, Memory/RetrieveMemory/ListMemories, McpTool, TodoList, TaskSubagent, DeployWebApp, CheckDeployStatus, BrowserPreview, ReadKnowledgeBaseItem, Lifeguard*, InformPlanner, PlanInput, ExitPlanMode, …), packages `exa/cortex/{tools,managers,handlers,executors,memories,brain,traj,state,implicit}`, `exa/language_server/{context_module,documentindex,completion_provider,commit_graph,code_tracker}`, `exa/cortex/utils/mcp` (vendored `mark3labs/mcp-go`).
- Local services exposed to the IDE: `LanguageServerService/{BranchCascade, CancelCascadeSteps, GetCascadeTrajectorySteps, GetCascadeMemories, GetAllPlans, GetAllRules, …}`.

But every model call is a server RPC: `ApiServerService/{AssignModel (returns assignment_jwt + model_uid), GetChatMessage, GetChatCompletions, GetStreamingCompletions, GetStreamingExternalChatCompletions, GetStreamingModelAPITextCompletion, GetEmbeddings, GetWebSearchResults, GetImageCaption, GetDevstralStream, CheckChatCapacity, GetCascadeModelConfigs…}` on `https://server.codeium.com` (also `inference.codeium.com`, `southcentral-lb.codeium.com`, `cascadeplayground.watchdevinwork.com/cascade_query/`). "planner model unreachable", "Refreshed expired model assignment JWT, retrying request" confirm the JWT-gated proxy.

**BYOK in Windsurf is server-held, not client-direct:** the enum has `API_PROVIDER_ANTHROPIC_BYOK`, `API_PROVIDER_OPEN_ROUTER_BYOK`, `API_PROVIDER_XAI_BYOK`, `MODEL_CLAUDE_*_BYOK`, `MODEL_PRICING_TYPE_BYOK`, and the chat request carries `GetChatMessageRequest_EnterpriseExternalModelConfig`; external models are managed via `CreateExternalModels/UpdateExternalModels/GetModelProviders`. The key goes to Cognition's server (or an enterprise "hybrid"/self-hosted server: `RegisterHybridDeployment`, `CheckHybridDeploymentStatus`, `airgap_mode`, `remote_mode`, `swe-1-6-self-hosted`, portal URL placeholder `https://your-company.windsurf.com`). That server is a licensed enterprise deployable, not something in the app.

---

## 6. Devin CLI — orchestration local, inference remote, BYOK compiled out (PROVEN, tested)

Local (all recovered from the binary):
- Main system prompt: "You are Devin, a powerful agentic AI coding assistant created by Cognition. You operate in the user's terminal to pair program and complete coding tasks. ## General … ## Editing constraints … ## Plan tool … ## Task execution … ## Frontend tasks …" plus subagent prompts (explore/general/review), summarizer/compactor, side-chat (`/btw`), title generator, and a "security classifier for a coding agent" used by Smart permission mode. Prompt partials are templated (`core/parallel-tool-calls`, `core/subagent_profiles`, `core/model`, …).
- Tools: `shell_command`, `apply_patch`, `edit`, `read`, `write`, `grep`, `glob`, `find_file_by_name`, `update_plan`, `todo_write`, `ask_user_question`, `web_search`, `mcp_call_tool`, `mcp_list_tools`, `mcp_read_resource`, `get_output`, `kill_shell`, `notebook_read/edit`, `run_subagent`, `read_subagent`, `request_scope`, `code_search`, `browser_preview`, `close_browser_preview`, `provide_structured_output`, `exit_plan_mode`.
- Runtime crates: `affogato` (control loop, effects, tool pipeline scheduler, subagents), `toolbox` (exec/pty/shell sessions, edit, patch, grep, glob, MCP), `agent-ext` (compactor, hooks, lints, plugins, rules, skills, smart-permission classifier), `sandbox-runtime` (macOS Seatbelt, Linux bwrap+seccomp, loopback HTTP/SOCKS domain proxy), `browser-preview`, `plugin-host`, `chisel-mcp`.

Remote (the only way it can think):
- `inference/{backend,compat,request,stream,retry}.rs` → `windsurf-api-client` → Connect-RPC `ApiServerService/AssignModel` ("Resolving model router via AssignModel RPC") → `GetChatMessage` ("Starting windsurf stream with N messages"), plus `GetCliModelConfigs`, `GetCliTeamSettings`, `GetUserStatus`, `GetWebSearchResults`, `GetImageCaption`, plugin RPCs, `RecordTrajectorySegmentEvents`, `BatchRecordAnalyticsEvents`.
- Auth is mandatory before any turn: REPL forces `/login` (PKCE via `/auth/cli/continue` + `ExchangeDevinCLIPKCECode`, or legacy Windsurf `ExchangePKCEAuthorizationCode`); the ACP server requires `authenticate` with `meta.api_key` or the `devin-browser` method ("Local CLI credentials are intentionally not used in ACP mode…").

**BYOK test (executed against the bundled binary, isolated `$HOME`):**
```
$ ACP_BACKEND=openai OPENAI_API_BASE=http://127.0.0.1:8765/v1 OPENAI_API_KEY=sk-test USE_COMPLETIONS=true devin acp
ERROR devin: error=Invalid ACP_BACKEND: Unknown backend type: openai. Unset it to use the default (windsurf) backend.
      For OpenRouter-hosted models, use ACP_BACKEND=openai with OPENAI_API_BASE=https://openrouter.ai/api/v1, OPENAI_API_KEY, and USE_COMPLETIONS=true.
```
`anthropic` and `mock` fail the same way; only `windsurf` starts. The fake OpenAI server received **zero** requests. So the "Valid options: windsurf, openai, anthropic, mock" text is a leftover from Cognition's internal dev builds; the alternate backends are not linked into the release. There is no `ANTHROPIC_API_KEY`, `x-api-key`, `api.anthropic.com`, or `chat/completions` string in the binary to patch toward.

---

## 7. So what is re-implementable, and from what?

| Component | Recoverable artifact | Reimplementation reality |
|---|---|---|
| Automations **UI** | Verbatim classes/copy/behaviour (spec §6–§18; our TypeScript replica) | Done/derivable exactly. |
| Automations **API contract** | Spec §15/§22 payloads, endpoints above | Write a compatible backend: RRULE scheduler (the client already emits RRULE strings + tz), webhook ingestion + secret rotation, Slack/Linear/Jira event adapters, event queue with statuses (queued/running/…), invocation/issue/consumption records, code-step config/runs, scratch git-bundle store. None of this exists client-side; all is standard infra. |
| "Generate/Improve with Devin" | `POST sessions` with `planning_mode/planner_type` + fixed user message | Map to *your* agent (a3 code session) — trivially. |
| Session agent (cloud Devin) | Nothing | Substitute: Claude Code / Codex / your harness. |
| Wiki | Nothing | Build (repo indexer + LLM summarizer) or skip. |
| Cascade / Devin CLI **behaviour** | Prompts, tool catalogue, permission model, subagent profiles, compaction strategy, sandbox design — all readable from strings | Useful as a *design reference* for the agent you build; not runnable code. Reusing Cognition's prompt text verbatim is a licensing question, not a technical one. |
| Inference | Proprietary Connect-RPC proxy | Replace with direct provider SDK calls (Anthropic/OpenAI/OpenRouter) in your harness. |

**Net:** an "open-source Devin you can use with an LLM API key" must be *built*, not *decompiled*: UI (recovered) + agent runtime (your own / a3 code + Claude Code/Codex) + a small backend implementing the automation contract. Roughly, the recovered material gives you 100% of the front-end and the wire contract, ~0% of the server, and a detailed behavioural spec of the local agents.

---

## 8. Recommended shape for the a3 code integration (design, not recovered fact)

1. **Frontend:** the `Automations UI/app` replica (list, templates, editor, detail) mounted inside a3 code's TanStack Router tree, with `AutomationRepository`/`AutomationRuntime` ports (spec §22.2) implemented against a3 code's server.
2. **Backend (a3 code server):**
   - `automations` table + `events`/`invocations`/`issues`/`consumption` tables mirroring the client projections.
   - Scheduler: parse the stored RRULE + timezone (`rrule` npm), compute next fire, enqueue events; manual `POST /automations/{id}/trigger`.
   - Webhook ingress with the minted-credential/HMAC model the client already expects; Slack/Linear/Jira adapters as optional.
   - Session spawner: on event → create an a3 code session (Claude Code or Codex) with the automation's instructions, `recommended_mcps`, network/security profile → record invocation → notifications.
   - Code-step runner: sandboxed script execution (the client only shows config/state/run logs).
3. **Agent:** Claude Code / Codex via a3 code; optionally adopt patterns from the recovered CLI (subagent profiles `explore`/`general`/`review`, smart-permission classifier prompt, compaction summarizer, plan tool discipline).
4. **Wiki (optional later):** repo summarizer job producing markdown per branch; expose `wiki/status` + `wiki/contents`-like endpoints so the same UI affordances work.

---

## Appendix A — Key evidence strings

Devin CLI (`strings -n 8 devin`):
- `Invalid ACP_BACKEND: … Valid options: windsurf, openai, anthropic, mock` · `ACP server credential policy: ACP host is the sole source of credentials…`
- `/exa.api_server_pb.ApiServerService/{AssignModel,GetChatMessage,GetCliModelConfigs,GetImageCaption,GetWebSearchResults,GetDevstralStream,AddUserManagedPlugin,RemoveUserManagedPlugin,GetAccountManagedPlugins,SubmitBugReport,RecordTrajectorySegmentEvents}` · `/exa.seat_management_pb.SeatManagementService/{GetUserStatus,GetCliTeamSettings,ExchangePKCEAuthorizationCode,ExchangeDevinCLIPKCECode}`
- `https://server.codeium.com` (`WINDSURF_API_SERVER_URL`), `https://api.devin.ai`, `https://static.devin.ai/devin-rs/remote`, `https://cascadeplayground.watchdevinwork.com/cascade_query/`, `https://unleash.codeium.com/api/unleash_definitions.bin`, Sentry DSN, `https://api.raindrop.ai/v1/`
- `You are Devin, a powerful agentic AI coding assistant created by Cognition…` · `You are a subagent of Devin, Cognition's agentic coding CLI…` · `You are a security classifier for a coding agent…` · `You are a Summarizer…`
- `cognition.ai/wiki/status`, `cognition.ai/wiki/contents`, `Wiki not indexed for repo; skipping download`
- Outposts: `Start the Outposts worker and serve queued sessions`, `Directory to cache downloaded devin-remote binaries in`, `DEVIN_OUTPOST_GATEWAY_URL`, `DEVIN_OUTPOST_CONNECT_TOKEN`, `?phase=claimed&acceptor_id=`
- Cargo registry `pkg.cognition.build`: no LLM SDK crate (only `connectrpc`, `prost`, `reqwest`, `rmcp`, `agent-client-protocol`, …)

Windsurf language server (`strings -n 8 language_server_macos_arm`):
- `You are Cascade, a powerful agentic AI coding assistant.` · 70+ `*StringConverter` step types · `exa/cortex/{tools,managers,handlers,executors,memories,brain}`
- `ApiServerService/{GetDeepWiki,GetChatMessage,GetStreamingCompletions,GetStreamingExternalChatCompletions,GetEmbeddings,GetModelProviders,CreateExternalModels,RegisterHybridDeployment,CheckHybridDeploymentStatus,…}`
- `API_PROVIDER_ANTHROPIC_BYOK`, `API_PROVIDER_OPEN_ROUTER_BYOK`, `API_PROVIDER_XAI_BYOK`, `MODEL_PRICING_TYPE_BYOK`, `disable_deepwiki`, `airgap_mode`, `remote_mode`, `swe-1-6-self-hosted`
- 0 hits: `api.anthropic.com`, `x-api-key`, `anthropic-version`, `ANTHROPIC_API_KEY`

Automations web bundle (annotated decompile): endpoint list in §2; 0 hits for `You are `, `anthropic`, `openai`, `system_prompt`, `RRule(`/`rrulestr`.

## Appendix B — Live tests performed
- `devin --version` → `devin 3000.5.20 (2d902011)`; `devin --help` (commands: auth, mcp, models, doctor, rules, skills, plugins, cloud, desktop, list, rm, update, version, migrate, sandbox, setup, uninstall, acp).
- REPL `--print` in a fresh `$HOME` → immediately `Welcome to Devin CLI!` → login prompt → `Error: Login canceled` (no offline path).
- `devin acp` JSON-RPC `initialize` → `agentInfo: {name:"affogato", title:"Devin Agent"}`, `authMethods:[devin-browser]`, capabilities `cognition.ai/*`; `session/new` without auth → `-32000 ACP host has not authenticated…`; default model id `swe-1-6-fast` with empty options until authenticated.
- `ACP_BACKEND=openai|anthropic|mock` → process exits with `Invalid ACP_BACKEND`; local fake OpenAI server on 127.0.0.1:8765 received no traffic.
