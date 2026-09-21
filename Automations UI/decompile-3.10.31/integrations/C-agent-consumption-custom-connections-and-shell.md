# Integrations, Task C — How the agent consumes integrations, Custom Connections, and the desktop shell

Devin 3.10.31 (desktop) + app.devin.ai web bundle captured 2026-09-20. Static analysis only. Evidence labels: **PROVEN** (cited literal), **PROJECTED** (shape implied by properties read), **DERIVED** (follows from proven control flow), **REMOTE/UNKNOWN** (server side). Citations are `chunk.js:line` in the prettier-formatted copies under `_work/formatted/`, `_work/integrations/formatted/`, `_work/formatted-desktop/`.

## What this proves

**An "integration" is not exposed to the model as an MCP server. Devin has two disjoint tool-supply channels and the client wires them differently.** (1) *Native integrations* — Slack and Linear (plus Pylon) — are built-in tools gated by an org-level connection plus per-Devin flags that travel on the automation record as `linear_tools_enabled` and `slack_tool_channels` (PROVEN, `prefill-iaMbQj5W.js:19-23`). (2) *Everything else the agent can call* is an MCP server, selected per-Devin via `recommended_mcps` (an array of `config_key ?? slug`; PROVEN, `ConnectionsSection-nv--b3JI.js:70-72`, `_id_.tools-BGK2ngli.js:141-147`). The UI names both channels "tools"/"apps" on the per-Devin **Tool access** page (`bots.toolAccess`, `bots.toolAccessSubtitle` = "Choose which apps {{name}} can use."). The two channels overlap on Linear and Slack: marketplace MCP slugs `linear`, `slack`, `slack-remote` are hidden with "Use the built-in Linear/Slack integration instead" (PROVEN, `ConnectionsSection-nv--b3JI.js:986-990`). SCM integrations (GitHub, GitLab, Bitbucket, Azure DevOps, Perforce) never appear in the tools list; they are repo-access plumbing, not model tools. No `integration_id`, `enabled_integrations`, `available_integrations`, or `integrations_enabled` field exists anywhere in the 2,168-chunk bundle (PROVEN by census). **"Custom connections" are a red herring for this question:** they are natural-language *readiness health checks* ("Describe systems Devin should be able to reach… Devin verifies it read-only with your organization's secrets, MCP servers, and integrations") stored as `readiness/custom-checks?kind=connection`, carrying only `title`/`description`/`connect_hint` and **no** auth type, base URL, headers, or host allowlist (PROVEN, `CustomConnectionsPage-7VldPHAb.js`, `queries-DslOFrcV.js:104-131`). The desktop shell contributes nothing to integration consumption beyond deep links to `/settings/connections/*`; the Devin CLI consumes MCP servers from `mcp_config.json` with its own OAuth client and calls GitHub via `/integrations/github/connect-pat` for repo access only.

## 1. Custom connections contract

### 1.1 What it is (PROVEN)

| Aspect | Value | Evidence |
|---|---|---|
| Routes | `/_user/settings/_org/insights/custom-connections` (scope `org`) ; `/_user/settings/_org/enterprise-insights/custom-connections` (scope `account`, `enterpriseId`) | `custom-connections-Su3LZTFL.js:11,17`; `custom-connections-JzqGrFh6.js:11,20` |
| Page definition | `{ kind: "connection", Card, InheritedCard, keys: readiness.customConnections* }` rendered by the shared `CustomProfileEditor` | `CustomConnectionsPage-7VldPHAb.js:155-172` |
| Sibling | Same editor with `kind: "repo"` is "Custom checks" for repo readiness | `CustomProfileEditor-73QUsAfP.js:107` |
| Not to confuse with | `custom-DleglJ_d.js` = `/_user/settings/_org/mcp-marketplace/setup/custom` → redirects to `/settings/connections/custom-mcp` (Custom **MCP**, a different feature) | `custom-DleglJ_d.js:9,21` |

### 1.2 Form schema (PROVEN)

| Field | Type | Required | Max | Notes | Evidence |
|---|---|---|---|---|---|
| `title` | string | yes | 120 | label `readiness.customChecksTitle` = "Title" | `CustomConnectionsPage:46-53`, limits `CustomProfileEditor:114` |
| `description` | string (textarea rows 5) | yes | 2000 | label "What Devin should reach"; placeholder "e.g. Call GET https://sonarqube.example.com/api/authentication/validate with the SONARQUBE_TOKEN org secret and confirm it returns valid: true" | `CustomConnectionsPage:70-84` |
| `connect_hint` | string \| null | no | 220 | label "How to connect"; empty string → `null`; shown on Connections when not connected | `CustomConnectionsPage:112-120` |
| `kind` | `"connection"` | implicit | | set when a draft is created | `CustomProfileEditor:290` |

There is **no** auth type, credential, base URL, header, or host field. Auth is delegated: "Devin verifies it read-only with your organization's secrets, MCP servers, and integrations" (`readiness.customConnectionsDescriptionHelp`).

Cap: 15 checks total across `repo` + `connection` kinds (`CustomProfileEditor:202`, `x = 15 - (total - thisKind)`); count copy "{{count}} of {{max}} connections".

### 1.3 Endpoints (PROVEN, `queries-DslOFrcV.js`)

| Method | Path | Body / params | Line |
|---|---|---|---|
| GET | `${orgBase}/readiness/custom-checks` | → `{ profile: { checks[], revision }, inherited }` (PROJECTED from reads at `CustomProfileEditor:322,455-458`) | 107 |
| PUT | `${orgBase}/readiness/custom-checks?kind=connection` | `{ kind, checks: [{title, description, connect_hint, kind}] }` → `{ revision }`; 422 → `ReadinessCustomProfileValidationError { errors[{msg, loc?}] }` | 109-131 |
| GET / PUT | `enterprises/${id}/readiness/custom-checks` | same, enterprise scope; org pages show enterprise checks as `inherited` (read-only cards) | 104-105, 117-121 |
| GET | `${orgBase}/readiness/connections` | connection status list (also `enterprises/${id}/readiness/connections`) | 74, 87 |
| GET | `${orgBase}/readiness/connections/checks` | latest run per custom check: `status: running\|error`, `finished_at`, `error`, `slug` (PROJECTED from `ReadinessPage-D_9zEPlF.js` reads) | 77 |
| POST | `${orgBase}/readiness/connections/refresh` | starts a check run; copy "Runs each check read-only in a session with this organization's secrets and MCP servers." | 78 |

Query keys: `readiness-connections`, `readiness-connection-checks`, `readiness-custom-profile`, `readiness-org-custom-profiles`, `enterprise-readiness-connections` (`queries-DslOFrcV.js:399-408`).

Save toast: "Saved as revision {{revision}} — applies to the next connection refresh" — DERIVED: checks are versioned server-side and executed asynchronously by a Devin session, not by the client.

### 1.4 Copy catalog (PROVEN, `en-CsbykFSh.js`, prefix `readiness.`)

- customConnections: "Custom connections" · customConnectionsAdd: "Add connection"
- customConnectionsPageDescription: "Systems Devin should be able to reach, such as your SonarQube or Artifactory. They are shown on Connections and verified separately from readiness assessments."
- customConnectionsDescription: "Describe systems Devin should be able to reach, verified from Connections."
- customConnectionsEmptyTitle: "No custom connections yet" · EmptyDescription: "Describe a system Devin should reach, such as your SonarQube or Artifactory, and how to tell that access works. Devin verifies it read-only using your organization's secrets, MCP servers, and integrations."
- customConnectionsConnectHintHelp: "Shown on Connections when the system is not connected — for example who to ask or which secret to enable."
- Status strings: "Checking…", "Not checked yet", "Last checked {{date}}", "Couldn't load check status", "Couldn't start the check", "Last check could not run: {{error}}", "Refresh", "Manage", "Connection {{index}}", "How to connect: {{hint}}".

## 2. How sessions and automations reference integrations

### 2.1 Field census across the whole bundle (PROVEN)

`rg -l` over all 2,168 chunks, chunk names de-hashed:

| Term | Present | Where |
|---|---|---|
| `linear_tools_enabled` | yes | AutomationEditorPage, OncallPage, ResponderEditorPage, `_id_.tools`, prefill, sharedTranscriptHost |
| `slack_tool_channels`, `tool_channels` | yes | same set |
| `recommended_mcps` | yes | same set + `build` |
| `mcpServers` / `mcp_servers` | yes | InputBox, useInputBox, SessionPanes, ReadinessPage, PluginManifestEditor, customize, useSubmitMCPInstallation |
| `mcp_server_ids` | yes | useSecurityProfiles only |
| `connection_id` | yes, but SCM/SSO/trigger repo-connection ids only (github, gitlab, bitbucket, azure, perforce, sso, TriggerEditor, ConditionsBuilder) | — |
| `integration_id`, `enabled_integrations`, `available_integrations`, `integrations_enabled` | **absent** | — |

### 2.2 Automation / Devin record fields that shape the agent's tools (PROVEN, `prefill-iaMbQj5W.js:4-31`)

```
recommended_mcps: string[] | undefined      // MCP keys (config_key ?? slug); omitted when empty
slack_tool_channels: string[] | undefined   // Slack channel ids the bot may read/post
slack_dm_scope, slack_reply_access, slack_bot_name, slack_bot_icon_url
linear_tools_enabled: boolean               // native Linear toolset on/off
net_policy, devin_mode, run_as_user, scratchpad_enabled
```
Templates carry `required_mcps` which prefill maps onto `recommended_mcps` (`prefill:45`). These live on the **automation** (per-Devin) record; nothing analogous exists on a raw session-create payload in the client (REMOTE/UNKNOWN whether the server injects the org's MCP set into ad-hoc sessions — the client never sends one).

### 2.3 Per-Devin "Tool access" page (PROVEN, `_id_.tools-BGK2ngli.js`)

Route `/_user/devins/$id_/tools` (l.263). Title "Tool access"; subtitle "Choose which apps {{name}} can use." Rows built at l.156-197:

| Row key | Shown when | Control | Persists as |
|---|---|---|---|
| `native:slack` | org Slack state is `connected` or `user-not-linked` (l.164) | `connected` (read-only; "Connected for the whole organization. Every Devin can use it; manage it in Settings.") | — (channels edited in AutomationEditorPage) |
| `native:linear` | Linear integration `connected` (l.172) | toggle, default on (`linear_tools_enabled !== false`, l.174) | `{ linear_tools_enabled }` (l.149) |
| one per MCP server | `is_installed && is_enabled && has valid auth && not hidden slug && (run_as_user \|\| not user-scoped/plugin-managed)` (l.50-60) | toggle | `{ recommended_mcps: [...set] }` (l.141-147) |

Save path: automation update mutation `run({ automationId, params })` then `setQueryData(detail(orgId, automationId))` (l.130-134). "Add MCP" links to `/settings/mcp-marketplace` (l.224). Empty state: "No apps connected yet. Add an MCP server to give this Devin more tools." Query keys invalidated on tab focus: `['mcp','servers']`.

DERIVED: the client-side model is *native integrations = fixed, code-shipped toolsets toggled by boolean/channel fields; MCP servers = dynamically discovered toolsets referenced by key*. The UI collapses both into "apps"/"tools" for the user.

## 3. Devin MCP vs Integration boundary

| Dimension | Integration (Connections) | MCP server | Evidence |
|---|---|---|---|
| Settings home | `/settings/connections/{github,slack,linear,jira,…}` | `/settings/connections/custom-mcp`, `/settings/connections/enterprise-mcp/$installationId`, `/settings/mcp-marketplace` (nav entry `mcp-marketplace` also hrefs to `/settings/connections`) | `custom-DleglJ_d.js:9`; `EnterpriseMcpServerEditorPage:*`; sessions.desktop.main.js:659408 |
| Identity | provider slug, org-level connection record | `slug`, `installation_id`, `config_key`, `marketplace_server_id/slug` | `useAutomationMcpCatalog-Dkg2hTpZ.js:4-30` |
| Auth model | provider OAuth / app install / PAT (Task B) | `auth_method: none \| auth_header \| oauth`; `auth_header_key`; `token_scope: org \| user`; OAuth `oauth_client_id/secret`, `oauth_grant_type: authorization_code \| client_credentials`, `oauth_scope`, `oauth_resource`; state `has_oauth_tokens`, `auth_state`, `oauth_refresh_invalid`, `has_static_credentials` | `EnterpriseMcpServerEditorPage:527-543,893-925` |
| Transport | n/a | `HTTP \| STDIO` (editor), `http \| sse \| stdio` (declared manifest, CLI); `url`/`headers` or `command`/`args`/`env_variables`; `execution_location: remote \| auto`; `executes_on_session_machine` | `EnterpriseMcpServerEditorPage:527,580,912-924`; `MCPDeclaredConfiguration-LNl7WA__.js:23,80-86` |
| Per-Devin selection | `linear_tools_enabled`, `slack_tool_channels` | `recommended_mcps[]` | §2.2 |
| Reachable by model | native tools (Slack read mentions/reply, Linear read/update issues — copy `bots.toolSlackDescription`, `bots.toolLinearDescription`) | `mcp_list_servers` / `mcp_list_tools` / `mcp_call_tool` / `mcp_read_resource` (CLI strings) | §4.3 |
| Overlap | Linear, Slack are both | marketplace slugs `linear`, `slack`, `slack-remote` hidden: "Use the built-in Linear/Slack integration instead"; `native:pylon` also special-cased | `ConnectionsSection-nv--b3JI.js:985-990` |
| SCM providers | GitHub/GitLab/Bitbucket/ADO/Perforce = repo access only | never in tool list | `_id_.tools` rows |
| Custom connections | readiness check, neither | — | §1 |

`McpServiceIcons-DxhxAsNS.js` is icon SVG components only (exports single-letter symbols, no slug map); the slug→icon table is in `app-initial-tbOtyZLY.js` (not read, per context rule). Linear/Atlassian/Notion are documented as remote OAuth MCPs in the CLI docs (`mcp/overview.mdx:112`), confirming Linear is available both ways.

## 4. Desktop shell, extension, and CLI

### 4.1 Sessions workbench nav table (PROVEN, `_work/formatted-desktop/sessions.desktop.main.js:659300-659440`)

All integration-related entries are plain deep links into the web app; permission gate is `UseDevinSessions`:

| Nav key | href |
|---|---|
| `personal-connections`, `connections` | `/settings/connections` |
| `mcp-marketplace` | `/settings/connections` (MCP marketplace now lives under Connections) |
| `integrations-github` / `-slack` / `-microsoftTeams` / `-bitbucket` / `-perforce` | `/settings/connections/<provider>` |
| `insights` (readiness, where Custom connections live) | `/settings/insights`, permission `ViewAgentReadiness \| ViewOrgMetrics` |

The shell holds no integration state and no integration API client. DERIVED: the desktop app is a host for the same web routes.

### 4.2 Windsurf extension (PROVEN, `_work/formatted-desktop/extension.js`)

- ACP `session/new` / `session/load` request schemas carry `mcpServers: Array<http | sse | acp | stdio server def>` plus `cwd`, `additionalDirectories` (l.27265-27282). This is the *only* tool-supply field on the local ACP boundary — no integration ids cross it.
- `mcp_config.json` path helper at l.118430; `mcpConfigPath` setting at l.6298; mcpServers arrays are built from config and appended at l.28378-28398.
- The only "connections" hits are `devin.reloadAcpConnections` / `devin.reconnectAcpConnections` commands (l.45979, 45999) — ACP transport connections, unrelated to integrations. 176 hits for "integration" are all VS Code shell/terminal integration.

### 4.3 Devin CLI (Rust) strings (PROVEN via `strings -n 8 bin/devin`)

- Model-facing tools: `mcp_list_servers`, `mcp_list_tools`, `mcp_call_tool`, `mcp_read_resource`; system guidance: "Use `mcp_list_servers` to discover configured integrations, `mcp_list_tools` to inspect their capabilities and schemas… Do not assume an integration or tool is available without discovering it" and "You MUST call `mcp_list_tools` for a server before calling `mcp_call_tool`". **In the CLI's own vocabulary, "integration" = configured MCP server.**
- Full MCP OAuth client: `.well-known/oauth-authorization-server` discovery, DCR, PKCE, refresh ("refresh token present, attempting refresh"), "OAuth login is only supported for HTTP-based servers", "MCP server is blocked by policy", `MCP-Protocol-Version 2024-11-05`, "MCP registries" fetch.
- Cloud integration touchpoints (repo access only): `/integrations`, `/settings/integrations`, `_cognition.ai/integrations/github/connect-pat`, structs `IntegrationStatus { name, is_installed }`, `ConnectPatResponse { github_username }`, "Failed to check integrations, skipping git setup", "Connect GitHub as App". These are onboarding checks for git, not agent tools.
- Shared state note: "shared Devin data/config (e.g. credentials, MCP OAuth, config.json, skills/) is preserved".

### 4.4 CLI docs (PROVEN, `share/devin/docs/extensibility/mcp/configuration.mdx`, 638 lines total across `mcp/`)

Server entry fields (l.118-131): stdio `command`, `args`, `env`, `disabled`; remote `url`, `transport: http | sse`, `headers`, `oauthClientId`, `oauthClientSecret`, `oauthResource`, `disabled`. Commands `devin mcp add/login/logout` (l.41-42, 287-288). Config files `.devin/mcp_config.json` / `.devin/mcp_config.local.json` (`configuration.mdx:132`). "Each MCP client authenticates independently — tokens from Windsurf or Claude Code are not shared" (`overview.mdx:112`). Examples list Notion, Linear, Atlassian as HTTP+OAuth servers (l.153-191).

## 5. Local cache findings

- `~/.codeium/windsurf/mcp_config.json`: **absent** on this machine (only `brain/ cascade/ code_tracker/ context_state/ database/ implicit/ installation_id memories/ user_settings.pb`). PROVEN.
- `state.vscdb` (copied to `_work/integrations/state.vscdb` from `~/Library/Application Support/Devin/User/globalStorage/`): the only key matching `integr|connect|oauth|mcp` is `windsurf.acp.connectorRegistryCache` = `{ "devin-cli": { location: { kind: "local" } }, "devin-cloud": { location: { kind: "cloud" } } }` (ACP agent registry, 525 bytes). Other keys: `devin.desktopShell.flagEnabled`, `windsurf.acp.messageStore.session.acp/devin-{cli,cloud}/<id>` (transcripts), `windsurf.acp.session/session_start_time/*`. **Zero integration, OAuth token, or MCP config material is cached locally**; integration state is REMOTE (org-scoped, fetched per page). PROVEN.

## 6. T3 Code mapping (PROPOSALS)

T3 already has the MCP half of this picture: `packages/contracts/src/providerRuntime.ts` defines `mcp_tool_call`, `mcp_elicitation_approval`, `mcp.status.updated`, `mcp.oauth.completed` (l.109,143,193-194), and `apps/server/src/provider/acp/AcpSessionRuntime.ts` passes `mcpServers` into ACP `session/new` (l.96,736,765,838) — the same wire shape Devin's extension uses (§4.2). Proposals, none implemented:

| Devin concept | Proposed T3 shape | Rationale |
|---|---|---|
| Native integration (Slack/Linear built-in tools) | **Do not build.** T3 has no in-house tool runtime; model these as MCP servers only. | Devin itself steers marketplace `linear`/`slack` to native only because it owns the tool code. T3 providers own theirs. |
| `recommended_mcps` per Devin/automation | Per-**project** (or per-automation, when Automations land) list of MCP server ids in `packages/contracts` → server resolves to `mcpServers[]` for `session/new` in `AcpSessionRuntime`. Key by a stable `config_key`-like id, not display slug. | Mirrors Devin's `config_key ?? slug` and T3's existing `mcpServers` seam; projects are T3's scoping unit. |
| Org-level MCP registry (install/enable, auth_method, token_scope) | Environment-scoped `McpServer` record: `{ id, name, transport: http\|sse\|stdio, url\|command/args/env, headers, authMethod: none\|header\|oauth, oauth{clientId, grantType, scope, resource}, enabled }`. Persist in the environment's sqlite; OAuth tokens in the existing secrets store (see `apps/server/src/persistence/AuthSessions.ts` for the pattern). | Environment = one server + its credentials, matching Devin's org. |
| "Tool access" page | Project settings section listing environment MCP servers with a per-project toggle; surface on web + mobile via `client-runtime`. Reverse state = untoggle; show auth-required state via `mcp.status.updated`. | Hit-every-surface rule; reuse existing status events. |
| SCM integrations (GitHub etc.) | Already covered by T3's VCS/source-control layer (`apps/server/src/vcs`, `sourceControl`). Not a tool. | Devin excludes them from tools too. |
| Custom connections (readiness checks) | **Out of scope.** Requires a server-side agent runner for health checks; nearest T3 analogue would be an automation that runs a prompt. Revisit after Automations. | It is an Insights feature, not an integration. |
| Per-MCP OAuth (DCR/PKCE) | Reuse `mcp.oauth.completed` flow; the OAuth client lives in the provider CLI for ACP providers (Devin does the same in its Rust CLI), so T3 only needs to relay auth-required → browser → completed. Remote/tunnel mode: the callback must land on the environment, not the client. | Keeps orchestration pure; complexity at adapter boundary. |

Open REMOTE/UNKNOWN items that affect the mapping: how Devin's server injects org MCP servers into ad-hoc (non-automation) sessions; whether `recommended_mcps` is a hard allowlist or a hint; the server-side `run_as_user` token resolution.

## 7. Evidence appendix

Formatted files (cite line numbers in these copies):
- `_work/formatted/custom-connections-JzqGrFh6.js`, `custom-connections-Su3LZTFL.js`, `ConnectionsSection-nv--b3JI.js`, `EnterpriseMcpServerEditorPage-D1IaE0UK.js`, `MCPDeclaredConfiguration-LNl7WA__.js`, `McpServiceIcons-DxhxAsNS.js`, `useAutomationMcpCatalog-Dkg2hTpZ.js`
- `_work/integrations/formatted/CustomConnectionsPage-7VldPHAb.js`, `custom-DleglJ_d.js`, `CustomProfileEditor-73QUsAfP.js`, `queries-DslOFrcV.js`, `_id_.tools-BGK2ngli.js`, `prefill-iaMbQj5W.js` (formatted this task)
- `_work/formatted-desktop/sessions.desktop.main.js`, `extension.js`
- Raw: `reference/web-2026-09-20/assets/en-CsbykFSh.js` (i18n; `readiness.*` values are `"`-quoted, `bots.*`/`automations.*` values are backtick-quoted), `reference/Devin.app/Contents/Resources/app/extensions/windsurf/devin/bin/devin` (strings), `…/devin/share/devin/docs/extensibility/mcp/{configuration,overview}.mdx`
- Local: `_work/integrations/state.vscdb` (copy), `_work/integrations/NOTES-C-consumption.md` (working notes)

Key literals:
- `ConnectionsSection-nv--b3JI.js:986-990`: `new Map([["linear","automations.useBuiltInLinearInstead"],["slack","automations.useBuiltInSlackInstead"],["slack-remote","automations.useBuiltInSlackInstead"]])`; l.985 `Ye = "native:pylon"`; l.70-72 `Le = e => new Map(e.map(e => [e, e.config_key ?? e.slug]))`
- `_id_.tools-BGK2ngli.js:149`: `z = e => void F("native:linear", e, { linear_tools_enabled: e })`; l.147 `F(e.key, t, { recommended_mcps: [...n] })`
- `prefill-iaMbQj5W.js:18-23`: `recommended_mcps`, `slack_tool_channels`, `slack_dm_scope`, `linear_tools_enabled`
- `queries-DslOFrcV.js:78`: `e.post(\`${t}/readiness/connections/refresh\`)`; l.126-131 `e.put(\`${t}/readiness/custom-checks\`, { searchParams: { kind: n }, json: r })`
- `extension.js:27274`: `mcpServers: QO(dO(Aq), () => [])` where `Aq = union(http, sse, acp, stdio)` (l.27265-27270)
- CLI: "Use `mcp_list_servers` to discover configured integrations, `mcp_list_tools` to inspect their capabilities and schemas, `mcp_call_tool` to invoke a tool, and `mcp_read_resource` to read a resource."
