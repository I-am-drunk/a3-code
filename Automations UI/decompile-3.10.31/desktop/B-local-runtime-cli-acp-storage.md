# Devin Desktop 3.10.31 — Task B: what runs locally (Rust `devin` CLI, ACP, local storage)

Track: Desktop shell, Task B of 2. Static analysis only. Evidence paths are relative to `Automations UI/` unless absolute. `devin-strings.txt` / `ls-strings.txt` are `strings -n 8` dumps in `_work/desktop/`; `DOCS` = `reference/Devin.app/Contents/Resources/app/extensions/windsurf/devin/share/devin/docs`.

Labels: **PROVEN** (literal string/line cited), **PROJECTED** (shape implied by what the client reads), **DERIVED** (follows from proven control flow), **REMOTE/UNKNOWN** (server side; not invented).

## What this proves

"A lot of Devin is local" is true in a specific, bounded way. Devin Desktop ships a 163 MB Rust binary (`devin`, internal codename **chisel**, version string `devin 3000.10.31 (b98cc431)`) that is a complete local coding-agent harness: the agent control loop, tool registry (exec/pty, edit, apply_patch, read/write/grep/glob, web fetch/search, MCP client with OAuth, subagents, todo/plan, notebook), session SQLite store, conversation compaction, hooks, skills/plugins/rules loading, an OS-level sandbox (macOS Seatbelt / Linux bubblewrap+seccomp) with a loopback network proxy, and an ACP server (`devin acp`) that the Desktop spawns as a subprocess over stdio (PROVEN: `extension.js:47143` `args: ["acp"]`, `:47306` `ACP_BACKEND: "windsurf"`). What is **not** local: model inference (default backend is Cognition's Windsurf API server — `server.codeium.com` / `api.devin.ai`; a hidden `ACP_BACKEND=openai|anthropic` BYOK path exists in strings but is not exposed by Desktop), the model catalog and routing (Adaptive/Fusion/SWE-1.6 resolved server-side), auth/billing (ACUs, org RBAC), team-settings enforcement, Knowledge/Playbooks/Secrets, cloud VMs (handoff, `devin cloud drs`, Outposts), Automations, Integrations, Voice, and the Devin Cloud sessions whose transcripts the Desktop only *mirrors* into a local LRU SQLite cache (`~/Library/Application Support/Devin/User/acp-messages/<uuid>.db`, 50 sessions max). The Desktop presents two ACP "connectors" side-by-side — `devin-cli` ("Devin Local", `location.kind: "local"`) and `devin-cloud` (`location.kind: "cloud"`) — and the same ACP transcript renderer and `cognition.ai/*` `_meta` vocabulary (396 keys known to the CLI) covers both. In T3 terms: the Devin CLI is a provider CLI exactly like Codex/Claude Code, already speaks the ACP that T3's `apps/server/src/provider/acp/*` adapters consume, and the Desktop shell is a thin ACP client plus a cache; everything the user's question is really about (Automations, Integrations, Voice) is cloud-only.

## 1. The local CLI: capability matrix

Source: docs (PROVEN, mdx) and binary strings (PROVEN, `devin-strings.txt`).

| Capability | Local? | Evidence |
|---|---|---|
| Interactive terminal agent on local files | **Local** | `DOCS/index.mdx:4,52-56` "local coding agent that runs directly in your terminal" |
| Agent control loop, tool execution, conversation history, compaction | **Local** | crates `chisel-agent`, `toolbox`, `local-agent`, `agent-ext`; modules `agent/control_loop`, `conversation_history`, `session_db`, `DEVIN_COMPACTION_THRESHOLDS` |
| Tools: exec/pty shell, edit, apply_patch, read/write, grep/glob, fast_context, webfetch, web_search, view_image, notebook, todo, write_plan, user_question, tool_search | **Local** | `toolbox/src/tools/*` paths (see §7) |
| Subagents (`run_subagent`/`read_subagent`; explore/general/custom profiles; fg/bg; nesting) | **Local** orchestration, remote inference | `DOCS/subagents.mdx`; `toolbox/src/tools/subagent.rs`, `persistent_subagent.rs` |
| Local Fusion (lead + sidekick model pairing) | **Local** orchestration | `chisel-agent/src/local_fusion/{mod,sidekick_tool,guidance}.rs`; `DEVIN_HARNESS_LEAD_ONLY/_SIDEKICK_ONLY` |
| MCP client: stdio + Streamable HTTP (SSE fallback), OAuth login, prompts, resources, registry | **Local** | `toolbox/src/tools/mcp/{call_tool,oauth,sse_transport,registry,read_resource,prompts}.rs`; `DOCS/extensibility/mcp/configuration.mdx:24-32,111-127` |
| Skills / rules / AGENTS.md / hooks (Claude-Code-compatible) / plugins | **Local** files | `DOCS/extensibility/index.mdx` (`.devin/{config.json,hooks.v1.json,skills,agents}`); `hooks/overview.mdx:206-209` also reads `~/.claude.json`, `~/.claude/settings*.json` |
| Config import from Windsurf/Claude/Copilot/OpenCode/Zed | **Local** | `DOCS/reference/configuration/read-config-from.mdx:33-81`; crate `config-importers` (`importers/mcp.rs:276` reads `/Library/Application Support/Windsurf`) |
| OS sandbox (`--sandbox`): Seatbelt / bwrap+seccomp, writable-path derivation, deny-read, domain proxy, excluded commands | **Local** | `DOCS/sandbox.mdx`; strings "[Research Preview] Sandbox exec-tool processes (macOS seatbelt / Linux bwrap+seccomp)", "orphan-bwrap detection", proxy env injection (`HTTP_PROXY`, `DOCKER_HTTP_PROXY`, `PIP_PROXY`); crate `sandbox-runtime` |
| Permission modes normal/accept-edits/smart/dangerous/autonomous | **Local** | `DOCS/reference/commands.mdx:22`; strings `NORMAL ACCEPT EDITS SMART ASK BYPASS AUTONOMOUS`; `agent-ext/.../smart_permission` |
| Session persistence, `devin list`, `-c/-r` resume, `--export` (ATIF) | **Local** SQLite | `DOCS/reference/commands.mdx:24-28,226-235`; `chisel-agent/src/session_db.rs`, `session_export.rs`; string "ACP: session store not configured" |
| Revert / checkpoints of agent edits | **Local** | `chisel-agent/src/revert/{engine,steps}.rs`, `acp_server/revert_handlers.rs` |
| Browser preview tool | **Local** | crate `browser-preview`; `chisel-agent/src/browser_preview/tool.rs` |
| ACP server over stdio (`devin acp`) | **Local** | `DOCS/reference/commands.mdx:295`; `chisel-agent/src/acp_server/*` (18 modules) |
| Model inference | **REMOTE** | string "Unset it to use the default (windsurf) backend…"; `WINDSURF_API_SERVER_URL`; `user_settings.pb` contains `https://server.codeium.com`; catalog enums from `windsurf-proto … exa.codeium_common_pb.rs` |
| BYOK inference (`ACP_BACKEND=openai\|anthropic`, `OPENAI_API_BASE`, `OPENAI_API_KEY`, `USE_COMPLETIONS`) | **Local path exists, hidden** | string "Valid options: windsurf, openai, anthropic, mock"; Desktop hard-sets `ACP_BACKEND: "windsurf"` (`extension.js:47306`) |
| Air-gapped mode (`DEVIN_MODELS_FILE=/etc/devin/models.json`, custom `XDG_CONFIG_HOME`) | **Local-ish (enterprise)** | `extension.js:47311-47316`; `isWindsurfAirgap()` registry with `cmd: "devin", args: ["acp"]` (`:47138-47143`) |
| Auth (`devin auth login`, PKCE browser flow, enterprise subdomain `*.devinenterprise.com`) | **REMOTE** | `DOCS/enterprise/devin-auth.mdx`; strings "What domain do you use Devin on?", "Call the `authenticate` ACP method with `meta.api_key` … PKCE"; `credentials.toml` (`chisel-api/src/auth/credentials.rs`) |
| Team settings (sandbox enforcement, plugin disable, `custom_acp_enabled`, `cli_allowed_version_constraint`, `disable_cascade`) | **REMOTE** policy, cached locally | `chisel-agent/src/team_settings/{mod,cache}.rs`; string "Devin CLI plugins are disabled by your organization" |
| `/handoff` to cloud Devin (ships context + branch + diff) | **REMOTE** target | `DOCS/handoff.mdx`; `chisel/src/repl/commands/handoff.rs`; "[handoff] acp_session_new: sent session/new"; "No git remote found. Handoff only works from git repos with a remote configured." |
| `devin cloud drs …` (blueprints, sandbox sessions, builds, org secrets) | **REMOTE** API client | `DOCS/reference/commands.mdx:236-284`; `DRS_API_KEY`, `struct CreateSessionResponse` |
| `devin worker` (Outposts: run CLI as remote worker; downloads `devin-remote`) | **Hybrid** (local machine as cloud-attached executor) | `commands.mdx:385`; `DEVIN_OUTPOSTS_TOKEN`, `DEVIN_OUTPOST_GATEWAY_URL`, `https://static.devin.ai/devin-rs/remote`, `~/.devin/worker/cache` |
| Knowledge, Playbooks, Secrets | **REMOTE, not available in CLI** | `DOCS/index.mdx:58-60` |
| Self-update, feature flags, crash reporting | **REMOTE** | `static.devin.ai/cli/current/manifest.json`, `unleash.codeium.com`, `codeium-i5.sentry.io` |

Global flags (PROVEN `commands.mdx:19-30`): `--model` (`DEVIN_MODEL`), `--permission-mode` (`DEVIN_PERMISSION_MODE`), `--sandbox` (`DEVIN_SANDBOX`), `-c/--continue`, `-r/--resume <id>`, `-p/--print`, `--prompt-file`, `--config`, `--export [path]`, `--respect-workspace-trust`. Subcommands: `auth mcp models rules skills plugins migrate list cloud version acp update sandbox setup doctor worker uninstall`. Slash: `/model /fusion /handoff /loop /btw /cloud-sessions`.

## 2. Local vs remote, by concern

| Concern | Where | Label | Evidence |
|---|---|---|---|
| Model inference | Cognition/Windsurf API server (`server.codeium.com`, `api.devin.ai`; enterprise `*.devinenterprise.com`) | PROVEN remote | strings: default backend "windsurf"; `WINDSURF_API_SERVER_URL`, `DEVIN_API_URL`; `~/.codeium/windsurf/user_settings.pb` contains `https://server.codeium.com` and model id `claude-opus-5-medium` |
| Model catalog / routing (Adaptive, Fusion, SWE-1.6 subagent router) | Remote | PROVEN remote | `DOCS/adaptive.mdx`, `fusion.mdx`, `subagents.mdx` ("resolves through a router at spawn time, and an admin can override it") |
| Sandbox / command execution (CLI sessions) | **Local** machine, optionally Seatbelt/bwrap | PROVEN local | §1; `sandbox-runtime` crate |
| Sandbox / execution (Devin Cloud sessions) | Cloud VM (`/home/ubuntu`) | PROVEN remote | ACP cache row 12: `Read /home/ubuntu/.devin-files/devin-remote-overflows-1000/…/content.txt` (`_work/desktop/acp/a7f0ef34….db`) |
| Session state (CLI) | Local SQLite via `session_db` (path under `~/.config/devin/` / XDG; exact file REMOTE/UNKNOWN — not present on this machine: `~/.config/devin/` holds only `config.json` `{"version":1}` and empty `cli/`) | PROVEN local (module), UNKNOWN (path) | `chisel-agent/src/session_db.rs`; `DOCS/commands.mdx:226` "List sessions in the current directory" |
| Session state (Cloud) | `app.devin.ai/sessions/<id>`; Desktop keeps per-session info in `state.vscdb` | PROVEN remote | `windsurf.acp.sessioninfo.session.acp/devin-cloud/devin-75ca…` value has `cognition.ai/url: https://app.devin.ai/sessions/…`, `orgId`, `sessionStatus: "suspended"`, `creatorUserId` |
| Transcripts (ACP stream) | Local **cache** (`User/acp-messages/*.db`, LRU 50) for both CLI and cloud sessions; source of truth = CLI process (local) or cloud API (remote) | PROVEN | `workbench.desktop.main.js:788387-788392`; `beginReplay/endReplay` repopulate; `mintedForReplay` entries deleted on failed replay |
| Integrations (GitHub/Slack/Linear/Jira…) | Remote; CLI exposes only `_cognition.ai/integrations` ACP method as a passthrough | PROVEN remote | strings `_cognition.ai/integrations`; no OAuth/webhook code paths for these services in CLI strings beyond MCP OAuth |
| Automations | Remote; appear in transcripts as MCP tool `devin_automation_manage` on server `devin_mcp` | PROVEN remote | ACP cache: tool title "MCP call devin_automation_manage (devin_mcp)", `cognition.ai/server`, `serverDisplayName` |
| Voice call | Remote (not in CLI) | DERIVED | zero `voice`/`webrtc` hits are not claimed; the CLI's ACP `_meta` list has `cleanVideoUrl` but no voice keys; voice is Task A / sessions-bundle territory |
| Memories / brain (Cascade) | Local dirs `~/.codeium/windsurf/{memories,brain}`; empty here because `devin.cascade.enabled: false` | PROVEN local dir, content empty | `User/settings.json`; `ls`: `memories/global_rules.md` only |
| Auth tokens | Local: VS Code secret storage keys `windsurf_auth.sessions` (1290 B), `windsurf_auth.apiServerUrl` (145 B); `windsurfAuthStatus.apiKey` = `devin-session-token$<JWT>` (redacted) | PROVEN local storage, remote issuer | `state.vscdb` ItemTable keys |
| Team settings / feature flags | Remote, cached | PROVEN | `team_settings/cache.rs`; `unleash.codeium.com/api/unleash_definitions.bin` |

```mermaid
flowchart LR
  subgraph Local["Local machine"]
    WB[Desktop workbench<br/>ACP client + acp-messages cache]
    EXT[windsurf extension host<br/>spawns connectors]
    CLI["devin acp (Rust chisel)<br/>agent loop, tools, sandbox, MCP, session_db"]
    LS[language_server_macos_arm (Go)<br/>Cascade/cortex, indexing, MCP host, auth broker]
    FS[(~/.config/devin, .devin/, ~/.codeium/windsurf, User/acp-messages, state.vscdb)]
  end
  subgraph Cloud["Cognition cloud"]
    API[Windsurf API server / api.devin.ai<br/>inference, auth, team settings]
    DC[Devin Cloud sessions (VMs)<br/>Automations, Integrations, Voice, Knowledge, Playbooks]
  end
  WB <-->|ACP JSON-RPC stdio| EXT
  EXT -->|"args: [acp], ACP_BACKEND=windsurf"| CLI
  CLI -->|inference, auth, team settings| API
  CLI -->|/handoff: session/new| DC
  WB <-->|devin-cloud connector: ACP over network| DC
  EXT <--> LS
  LS --> API
  CLI --- FS
  WB --- FS
```

## 3. Language server (Go) — characterization

PROVEN from `ls-strings.txt` (370,732 strings, 175 MB Mach-O). Go module `github.com/Exafunction/Exafunction` (174k refs). Internal packages are the Windsurf **Cascade** runtime, codenamed `cortex`: `exa/cortex/{tools,managers,handlers,executors,implicit,memories,config,state,proto_saver}`, plus IDE services `exa/language_server/{context_module,api_server_client,completion_provider,supercomplete,documentindex,code_tracker,commit_graph,chat,mquery,session,lsp}`, `exa/fs/workspace_manager`, `exa/tree_sitter`, `exa/browser_preview/proxy`. It is an **MCP host** via `github.com/mark3labs/mcp-go` (types `cortex_pb.McpServerSpec/McpToolConfig/McpResource`, `GetMcpPrompt`, `ListResourceTemplates`, `URLElicitationRequiredError`) — this is what reads `~/.codeium/windsurf/mcp_config.json` for Cascade, separate from the Rust CLI's own MCP client (`DOCS/mcp/overview.mdx:112`: tokens "are not shared with Devin CLI"). Devin touchpoints are auth brokerage and metadata only: `ExchangeDevinCLIPKCECodeResponse`, `GetSelfDevinSessionTokenResponse`, `GetDevinInfo`, `DevinPlanInfo`, JSON flag `devin_terminal_acp_enabled`, `API_PROVIDER_GOOGLE_GEMINI_DEVIN`. It also embeds `sashabaranov/go-openai`, `cel-go`, `goja` (JS), `go-git`, `libghostty`/`midterm` (terminal). Conclusion (DERIVED): the language server runs Cascade (Windsurf's editor agent, disabled on this install via `devin.cascade.enabled: false`), autocomplete, and code indexing; Devin agent sessions do **not** run in it — they run in the Rust CLI (`devin acp`) or in the cloud.

## 4. ACP: protocol surface and cached message shape

**Transport / spawn (PROVEN).** The Windsurf extension's `AcpRegistry` describes the bundled agent as `{cmd: "devin" | "devin.exe", args: ["acp"]}` (`_work/formatted-desktop/extension.js:47138-47143`). The connector class (`extension.js:47296-47320`) builds the child env: bundled connectors get `ACP_BACKEND: "windsurf"`, `WINDSURF_IDE_TYPE`, proxy env, and (air-gap only) `DEVIN_MODELS_FILE` + `XDG_CONFIG_HOME`; user overrides come from the `acp.agentEnv` setting (workspace-trust gated). `supportsSessionExport()` is true only for bundled connectors. Registry cache in `state.vscdb` key `windsurf.acp.connectorRegistryCache`: `devin-cli` = "Devin Local", `location.kind: "local"`; `devin-cloud` = "Devin Cloud", `location.kind: "cloud"`; both `bundled: true, featured: true, license: "proprietary"`. Current preference (`User/settings.json`): `devin.acp.preferredAgent: "devin-cli"`, `devin.acp.enabledAgents: {devin-cloud: true, devin-cli: true}`, `devin.cascade.enabled: false`.

**Methods the CLI implements (PROVEN, strings).** Standard ACP: `session/new`, `session/prompt`, `session/load`, `session/list`, `session/delete`, `session/rename`, `session/end`, `session/share`, `session/set_mode`, `session/set_config_option`, `session/update`, `fs/rename`, `terminal/*` (`acp_tools/terminal.rs`, `kill_terminal.rs`), `authenticate` (with `meta.api_key` or browser PKCE). Cognition extensions: `_cognition.ai/integrations`, `_cognition.ai/snapshot-setup`, `_cognition.ai/wiki`, `_cognition.ai/taillimit` (tail replay: `startRowId`/`endRowId`, `acp_server/tail_replay.rs`), plus "ACP subagents/list", "ACP rules/list", and handler groups `plugins_handlers`, `revert_handlers`, `customizations_handlers`, `local_tools_handlers`, `ext_handlers`, `editor_context`, `terminal_context`, `user_edits_context` (`DEVIN_USER_EDIT_CADENCE`), `image_loader`, `share`. Debug: `CHISEL_PURE_ACP_STDERR`, `CHISEL_PURE_ACP_WIRE_LOG`.

**Cache store (PROVEN).** `~/Library/Application Support/Devin/User/acp-messages/<uuid>.db` — 13 sessions × (`.db`, `-wal`, `-shm`), 23 MB. Written by the workbench class at `workbench.desktop.main.js:788370-788480`: `DIR = "acp-messages"`, `MAX_CACHED_SESSIONS = 50`, `ENTRY_KEY_PREFIX = "windsurf.acp.messageStore.session."` (the `state.vscdb` entry maps ACP session id → `{uuid, lastUpdated}`), methods `ingest / flush / beginReplay / endReplay / readMessages({limit}) / unloadSession / deleteSession`, log tag `[ACP][messageCache]`. It is a cache: a store minted for a replay that fails is deleted (`mintedForReplay`).

Schema (`_work/desktop/acp/a7f0ef34-40b7-41fa-9e39-0db7dfb331c3.db`, copy of a `devin-cloud` session "Generate New Automation"):

```sql
CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);      -- schema_version=6, info={configOptions:[], availableCommands:[{name,description,_meta:{cognition.ai/category,cognition.ai/icon}}]}, message_count=30, truncated=0
CREATE TABLE messages (position INTEGER PRIMARY KEY, kind TEXT NOT NULL, payload TEXT NOT NULL);
-- kinds seen: user_message(1) agent_message(3) agent_thought(8) tool_call(17) progress_marker(1)
```

Payload shapes (PROVEN, rows 2, 3, 12 — secrets none; paths are the cloud VM's):

```jsonc
// agent_message / agent_thought: an array of ACP session/update chunks
{"kind":"agent_message","id":"agent_message:event-…","turnId":"event-…",
 "content":[{"sessionUpdate":"agent_message_chunk","content":{"type":"text","text":"What should the automation do…"},
   "_meta":{"cognition.ai/eventType":"devin_message","cognition.ai/eventId":"event-…","cognition.ai/timestamp":"2026-09-19T17:23:06.032000Z",
            "cognition.ai/streamingMessageId":"event-…","cognition.ai/priority":400}}]}
// tool_call: ACP ToolCall + source-event envelope
{"id":"tool:event-…","kind":"tool_call","sourceEventId":"event-…","sourceEventTimestampMs":1789838582615,"sourceEventIsStart":true,"sourceEventType":"multi_edit_result",
 "content":{"toolCallId":"event-…","title":"Read /home/ubuntu/.devin-files/…/content.txt","kind":"read","status":"completed",
   "_meta":{"cognition.ai/eventType":"multi_edit_result","cognition.ai/isMajorAction":true,"cognition.ai/acuConsumption":0.48645403,
            "cognition.ai/fileUpdates":[{"file_path":"…","start_line":80,"end_line":341,"action_type":"open","total_lines":369,"contents_key":"editor_files/devin-75ca…/…"}]}}}
```

`sourceEventType` values in this DB: `acu_consumption_at_last_user_interaction`, `devin_thoughts`, `devin_message`, `multi_edit_result`, `mcp_tool_call_started` (title "MCP call devin_automation_manage (devin_mcp)"; `_meta` carries `cognition.ai/toolName`, `toolArgs`, `server`, `serverDisplayName`), `context_growth_update` (`cognition.ai/contextGrowth`), `session_analysis` (`sessionAnalysisId`, `sessionAnalysisData`). User-question tool: `cognition.ai/userQuestion`, `questions`, `originalQuestions`, `answers`. Devin's native event log is thus re-encoded into ACP `session/update`s with the original event type preserved in `_meta` (DERIVED). 40 distinct `cognition.ai/*` keys appear in this DB; the CLI binary knows **396** (`_work/desktop/cli-cognition-keys.txt`), including `acuUsed`, `agentId`, `archivedStatus`, `backgroundShellId`, `baseBranchName`, `botUsername`, `browserPreview`, `cachedReadTokens`, `canManageMcpServers`, `childSessionId`, `codeScan*`, `codemap`, `compaction`, `contextUsage`, `conversationExports`, `cwd`, `editableCommand(s)`, `ephemeralState`, `externalHistorySkeleton`, `fastContext`, `finishedOutcome`.

Session info rows in `state.vscdb` (`windsurf.acp.sessioninfo.session.<id>`, PROVEN, redacted): CLI session `acp/devin-cli/viridian-glider` → `{providerId:"devin-cli", info:{sessionId, updatedAt, cwd:"/Users/irene", _meta:{cognition.ai/createdAt, userMessageCount, requestingTabId, isLocked}}}`; cloud session → `{providerId:"devin-cloud", location:{kind:"cloud"}, info:{sessionId:"acp/devin-cloud/devin-<hex>", title, updatedAt, cwd:"", _meta:{userMessageCount, createdAt, creatorUserId:"google-oauth2|…", url:"https://app.devin.ai/sessions/<hex>", orgId:"org-…", sessionStatus:"suspended", sessionLifecycle:"suspended", isArchived, archivedAt}}}`. CLI session ids are word-pair slugs (`amused-fascinator`, `cord-snap`); cloud ids are `devin-<32 hex>`. Companion keys: `windsurf.acp.session/session_start_time/<id>`, `windsurf.acp.session/userMessageCount/<id>`.

## 5. Local storage layout

All PROVEN by `ls`/`head` on this machine (2026-09-20). Content not read beyond what is shown; secrets redacted.

| Path | What it is | Observed |
|---|---|---|
| `~/Library/Application Support/Devin/` | Electron/VS Code user-data dir for bundle `com.exafunction.windsurf` (Cache, Code Cache, IndexedDB, Local Storage, Cookies, Crashpad, `1.12-main.sock`, Workspaces, Backups, `User/`) | 38 entries |
| `…/Devin/User/settings.json` | VS Code user settings | 219 B: `devin.cascade.enabled:false`, `devin.acp.preferredAgent:"devin-cli"`, `devin.acp.enabledAgents:{devin-cloud:true,devin-cli:true}` |
| `…/Devin/User/acp-messages/` | ACP transcript LRU cache, one SQLite per session (§4) | 39 files, 23 MB |
| `…/Devin/User/globalStorage/state.vscdb` (+`.backup`, `storage.json` 75 KB) | VS Code global KV (`ItemTable`) | 1.1 MB. Devin-relevant keys: `windsurf.acp.connectorRegistryCache`, `windsurf.acp.messageStore.session.*` (17 sessions: 9 `devin-cli`, 8 `devin-cloud`), `windsurf.acp.sessioninfo.session.*`, `windsurf.acp.session/{session_start_time,userMessageCount}/*`, `windsurfAuthStatus` (`apiKey: "devin-session-token$<JWT>"` — redacted), `secret://{"extensionId":"codeium.windsurf","key":"windsurf_auth.sessions"}` (1290 B, encrypted), `…windsurf_auth.apiServerUrl` (145 B), `windsurf_auth-<name>` / `-usages`, `devin.desktopShell.flagEnabled:false`, `windsurf.devin.settingsMigrationComplete`, `windsurf.desktopNav.manifest`, `windsurfSpace.*`, `windsurfConfigurations`, `windsurfOnboarding`, `chat.ChatSessionStore.index` |
| `…/Devin/User/workspaceStorage/<hash>/{state.vscdb,workspace.json}` | Per-workspace KV | 2 workspaces |
| `…/Devin/User/History/` | VS Code local file history | 6 entries |
| `~/.codeium/windsurf/` | Windsurf language-server (Cascade) state root; channel `windsurf` | `brain/` (0 files), `cascade/` (0), `context_state/` (0), `implicit/` (0), `database/<32hex>/` (0 files), `code_tracker/{active/no_repo,history}` (1 json), `memories/global_rules.md` (1 md), `installation_id` (36 B uuid), `user_settings.pb` (334 KB protobuf; visible strings: `Claude Opus 5 Medium`, `claude-opus-5-medium`, `https://server.codeium.com`), `native_storage_migrations.lock`. **No `mcp_config.json` exists** on this machine, so its shape is not observable here (schema: `reference/…/windsurf/schemas/`, Task-A/MCP track) |
| `~/.config/devin/` | Devin CLI user config (XDG) | `config.json` (18 B: `{"version":1}`), empty `cli/` dir. No `credentials.toml`, no `mcp_config.json` — CLI auth on this machine flows through the Desktop's ACP `authenticate`, not `devin auth login` (DERIVED) |
| `~/.devin/` | Electron app-level dir | `argv.json` (798 B), `.devin-argv-precopy`, `extensions/extensions.json`. Docs additionally place `~/.devin/plans/` (plan files) and `~/.devin/worker/cache` (Outposts) here — absent on this machine |
| Project-level (docs) | `.devin/{config.json,config.local.json,mcp_config.json,mcp_config.local.json,hooks.v1.json,skills/*/SKILL.md,agents/*.md}`, `AGENTS.md`, `.devinignore` | `DOCS/extensibility/index.mdx:60-75`; strings `.devinignore/.windsurfignore/.codeiumignore` |

Empty `brain/cascade/context_state/implicit/database` dirs are consistent with `devin.cascade.enabled:false`: Cascade (the Go language server's agent) is switched off in Devin Desktop and the Rust CLI holds the Devin sessions (DERIVED).

## 6. T3 Code mapping (proposals)

T3 already *is* the local half of this picture: a local server (`apps/server`) that spawns provider CLIs as subprocesses, translates their protocols through adapters, persists threads/turns event-sourced in SQLite, and checkpoints each turn as a hidden git ref (`docs/internals/glossary.md`: environment / project / thread / turn / checkpoint / adapter / reactor). Mapping of Devin's local pieces:

| Devin local piece | T3 equivalent | Notes |
|---|---|---|
| `devin acp` subprocess speaking ACP over stdio | `apps/server/src/provider/acp/{AcpSessionRuntime,AcpJsonRpcConnection,AcpRuntimeModel,AcpCoreRuntimeEvents}.ts` (already used for Cursor, Antigravity, xAI) | **Proposal:** a `DevinAcpExtension.ts` adapter would be a peer of `CursorAcpExtension.ts`; spawn `devin acp` with `ACP_BACKEND=windsurf`, handle `authenticate` (api_key / PKCE), map `cognition.ai/*` `_meta` (eventType, acuConsumption, thinkingDurationMs, fileUpdates, userQuestion) onto T3 activities. Custom methods (`_cognition.ai/integrations`, `/wiki`, `/snapshot-setup`, `/taillimit`, `subagents/list`, `rules/list`) are optional. |
| Devin Desktop workbench + `acp-messages` cache | T3 web/desktop/mobile clients + server projector/read model | T3's server owns the durable transcript (events), so no client-side LRU cache is needed; Devin's cache exists because its Desktop has no server tier. |
| `session_db` (CLI-side session store), `-c/-r` resume, `session/load` | Thread + provider session id persistence; T3 resumes provider sessions per adapter | Equivalent concept. |
| `revert/engine`, `revert_handlers` | Turn checkpoints (hidden git refs) + diff/restore | T3's is git-based and provider-agnostic; Devin's is CLI-internal. |
| `--sandbox` (Seatbelt / bwrap) and permission modes | T3 has permission/approval flow per adapter; **no OS-level sandbox** | Gap, but provider-owned in Devin too — it would come for free by passing `--sandbox`/`DEVIN_SANDBOX` to the CLI. |
| MCP client (stdio/HTTP, OAuth) in CLI; Cascade MCP host in Go LS | `apps/server/src/mcp/` | T3 already hosts MCP config server-side; Devin CLI would additionally read `.devin/mcp_config*.json`. |
| Skills / rules / hooks / plugins / subagents / Fusion | Provider-owned in both; T3 passes through | No T3 work; these live inside the provider process. |
| `/handoff`, `devin cloud drs`, Outposts worker | **No T3 equivalent — cloud-only** | T3 Connect is a tunnel to the user's own server, not a hosted VM. |
| Model inference, catalog, Adaptive/Fusion routing, ACUs | Provider credential + provider's backend (same as Codex/Claude subscriptions) | "Bring-your-own-subscription" fits: Devin CLI auth = the subscription. |
| Auth tokens in VS Code secret storage | Provider credentials on the environment (`apps/server/src/auth`, `cliAuthFormat.ts`) | Equivalent. |

Cloud-only Devin pieces with **no local counterpart** in either product: Automations (scheduled/event triggers, `devin_automation_manage` via the remote `devin_mcp` server), Integrations/Connections (GitHub/Slack/Linear/Jira OAuth and webhooks), Voice call, Knowledge, Playbooks, Secrets, session sharing (`session/share`), org/team settings, code scans (`codeScan*` meta). Reimplementing them in T3 means building the server side (reactors + persisted triggers) — the Desktop client gives us only the ACP-rendered *results* of those features, never their execution. Local candidates that T3 could own instead: scheduled thread starts (a reactor over the existing turn pipeline), webhook-to-thread ingress on the local server, and per-provider MCP passthrough — all proposals, none observed in Devin's local code.

## 7. Evidence appendix

Working files: `_work/desktop/NOTES-B-local.md` (running notes), `devin-strings.txt` (39,991 lines), `ls-strings.txt` (370,732 lines), `cli-cognition-keys.txt` (396 keys), `acp/*.db` (copies), `state.vscdb` (copy).

**Binary identity (PROVEN, `devin-strings.txt`).** `devin 3000.10.31 (b98cc431)`; build path `/Users/runner/work/devin-webapp/devin-webapp/apps/chisel/target/aarch64-apple-darwin/release/build/windsurf-proto-…/out/exa.codeium_common_pb.rs` (CLI lives in Cognition's `devin-webapp` monorepo as `apps/chisel`, shares protobufs with Windsurf). Mach-O arm64, 163,559,152 B.

**Rust workspace crates (by `<crate>/src/*.rs` occurrence).** chisel-agent 747, toolbox 343, chisel 264, agent-ext 210, affogato 178, chisel-cloud-bridge 167, windsurf-api-client 162, config-importers 139, plugin 136, chisel-api 89, chisel-server 68, local-agent 54, plugin-host 46, chisel-acp-relay 40, user-config 32, local-tools-client 27, barista 27, chisel-ui 25, browser-preview 25, toolbox-core 24, chisel-mcp 17, chisel-commands 17, inference 16, chisel-acp-client 11, connect-rpc 6, sandbox-runtime 5, message-forest 5, hands 6, wezterm-{escape-parser,surface,cell,blob-leases}. Third-party: tokio, hyper, h2, rustls, reqwest, axum, tungstenite, rmcp (Rust MCP SDK), rusqlite, clap, serde_json, moka, similar, image/png/jpeg/webp, html5ever/cssparser/selectors/stylo/taffy/parley/harfrust (embedded HTML/CSS layout engine — explains the `-webkit-*` CSS property strings), pest, chrono, tiny_http, pulldown-cmark.

**chisel-agent modules.** `acp_server/{agent_impl,auth,command_prompt,customizations_handlers,editor_context,ext_handlers,image_loader,local_tools_handlers,mod,plugins_handlers,plugins_host,revert_handlers,share,slash_commands,tail_replay,terminal_context,user_edit_tracker,user_edits_context}`, `acp_tools/{apply_patch,edit,kill_terminal,read,terminal,terminal_output,write}`, `agent_builder`, `analytics`, `attribution`, `browser_preview/{sink,tool}`, `client_methods`, `conversation_history`, `deferred_fields`, `local_fusion/{guidance,mod,sidekick_inheritable,sidekick_tool}`, `mcp_prompts`, `megaplan`, `model_defaults/{codex,shell_command,subagent_tools}`, `process_memory`, `revert/{engine,steps}`, `session_db`, `session_export`, `skills_loading`, `team_settings/{cache,mod}`, `user_status`, `wiki`.

**toolbox tools.** `tools/{apply_patch,edit,exec/{background_emitter,login_shell_env,native_terminal_host,pty,raw_exec,session_manager,shell_processor,shell_session_manager},exec_output,exec_tool,exit_plan_mode,fast_context,glob_tool,grep,instant_context,kill_shell,mcp/{call_tool,config,list_servers,list_tools,oauth,prompts,read_resource,registry,service,sse_transport},notebook_edit,notebook_read,persistent_subagent,powershell_parser,read,readonly_path_extractor,request_scope,subagent,todo,tool_search,user_question,view_image,web_search,webfetch,write,write_plan}`.

**Environment variables (PROVEN).** `DEVIN_MODEL`, `DEVIN_SANDBOX`, `DEVIN_PERMISSION_MODE` (docs), `DEVIN_ID`, `DEVIN_HARNESS`, `DEVIN_HARNESS_LEAD_ONLY`, `DEVIN_HARNESS_SIDEKICK_ONLY`, `DEVIN_OUTPOSTS_TOKEN`, `DEVIN_OUTPOST_GATEWAY_URL`, `DEVIN_WORKER_CACHE_DIR`, `DEVIN_WORKER_STATIC_BASE_URL`, `DEVIN_REMOTE_SESSION_TOKEN`, `DEVIN_API_URL`, `DEVIN_WEBAPP_URL`, `DEVIN_PLUGIN_DISCOVERY`, `DEVIN_PREFER_EXEC_TOOL`, `DEVIN_SIDEKICK_PREFER_EXEC_TOOL`, `DEVIN_COMPACTION_THRESHOLDS`, `DEVIN_SIDEKICK_COMPACTION_THRESHOLDS`, `DEVIN_REFUSAL_FALLBACK`, `DEVIN_USER_EDIT_CADENCE`, `DEVIN_CLI_DANGEROUSLY_FOLLOW_SYMLINKS`, `DEVIN_DISABLE_HISTEXPAND`, `DEVIN_MODELS_FILE` (extension.js:47312); `CHISEL_PURE_ACP_STDERR`, `CHISEL_PURE_ACP_WIRE_LOG`; `ACP_BACKEND`, `OPENAI_API_BASE`, `OPENAI_API_KEY`, `USE_COMPLETIONS`; `WINDSURF_API_KEY`, `WINDSURF_API_SERVER_URL`, `WINDSURF_IDE_TYPE`, `WINDSURF_EXT_HOST_PID`, `WINDSURF_CASCADE_TERMINAL`, `WINDSURF_WEBSITE_URL`; `DRS_ORG_ID`, `DRS_API_KEY`, `DRS_DEVIN_API_URL`.

**Remote endpoints in CLI (PROVEN).** `https://static.devin.ai/cli/current/manifest.json`, `https://static.windsurf.com/cli/current/manifest-windsurfcom.json`, `https://static.devinenterprise.com/cli/current/manifest-enterprise.json` (updater); `https://static.devin.ai/devin-rs/remote` (Outposts `devin-remote`); `https://app.devin.ai/settings/environment?tab=outposts`; `https://unleash.codeium.com/api/unleash_definitions.bin`; `https://codeium-i5.sentry.io`; `https://cascadeplayground.watchdevinwork.com/cascade_query/`; `https://staging.watchdevinwork.com/load-chisel-local`; `https://devin.ai/support`; loopback `http://127.0.0.1`, `http://localhost` (sandbox proxy, OAuth callback `windsurf.ai/localhost/callback`).

**Model catalog strings (PROVEN, resolved server-side).** Aliases `opus sonnet swe codex gemini gpt adaptive`; ids include `claude-opus-4-6/4-7/4-8`, `claude-opus-5-{low,medium,high,max}[-fast]`, `claude-sonnet-4-5/4-6/5`, `claude-haiku-4-5-thinking`, `claude-fable-5-{low,medium,high,xhigh}`, `gpt-5.4-mini*`, `gpt-5.5-pro`, `gpt-5.6-{sol,terra,luna}-*`, `gpt-6-*`, `gemini-3-flash-preview-*`, `gemini-3.1-pro-preview-*`, `gemini-3.5-flash*`, `swe-1-6-fast` ("SWE 1.6 Fast"), internal `metis4`, `hera-2`, `yeti3-june29`, `opal/solstice/ultima/vega-alpha`; proto enums `MODEL_CLAUDE_*_BYOK`, `*_OPEN_ROUTER_BYOK`, `MODEL_OPENAI_COMPATIBLE`, `MODEL_ANTHROPIC_COMPATIBLE`, `MODEL_VERTEX_COMPATIBLE`. Summarizer default "Claude Opus 4.6".

**Docs cited.** `DOCS/index.mdx:4,52-60`; `handoff.mdx:1-50`; `sandbox.mdx:7-30,34-70,164`; `subagents.mdx:50-140,214-260`; `extensibility/index.mdx:60-75`; `extensibility/mcp/configuration.mdx:24-32,52,111-127,292-296`; `extensibility/mcp/overview.mdx:112-120`; `extensibility/hooks/overview.mdx:206-209`; `reference/configuration/read-config-from.mdx:33-81`; `reference/configuration/global-vs-local.mdx:21-26,178-190`; `reference/commands.mdx:19-33,55-390,450-498`; `enterprise/devin-auth.mdx`; `acp/zed.mdx`; `changelog/stable.mdx:88,269-271` (Outposts); `models.mdx:41-93`; `shell-integration.mdx` (removed v3000.4.16).

**Bundles cited.** `_work/formatted-desktop/extension.js:47138-47143` (air-gap `AcpRegistry.fetch`: `cmd:"devin", args:["acp"]`), `:47296-47320` (connector env: `ACP_BACKEND:"windsurf"`, `WINDSURF_IDE_TYPE`, `getProxyEnv`, `DEVIN_MODELS_FILE`, `XDG_CONFIG_HOME`, `acp.agentEnv` setting), `:47754` (acp-host bootstrap shell script); `_work/formatted-desktop/workbench.desktop.main.js:788370-788480` (acp-messages store).

**Live data cited (read-only).** `~/Library/Application Support/Devin/User/{settings.json,acp-messages/,globalStorage/state.vscdb,workspaceStorage/}`; `~/.codeium/windsurf/*`; `~/.config/devin/config.json`; `~/.devin/`.

**Not found / UNKNOWN.** Exact on-disk path of the CLI `session_db` SQLite (none present — sessions on this machine are Desktop-driven); `~/.codeium/windsurf/mcp_config.json` shape (file absent); wire format of `devin-cloud` connector (network, Task A); any voice-call code in the CLI (none in strings); whether `ACP_BACKEND=anthropic` is reachable in a release build without feature flags.
