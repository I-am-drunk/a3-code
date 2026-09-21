# Devin Automations — 3.8.20 → 3.10.31 changelog and updated data model

Track: Automations, Task A. Static analysis of the captured `app.devin.ai` web bundle (2026-09-20) against the 3.8.20 spec (`DEVIN_AUTOMATIONS_DECOMPILED_SPEC.md`). Citations are `chunk.js:line` in `_work/formatted/` (or `_work/automations/formatted/` for `TriggerEditor`, `triggerMode`, etc.). Evidence labels: **PROVEN** (literal in client), **PROJECTED** (shape implied by properties read), **DERIVED** (follows from control flow), **REMOTE** (server-side; not in client).

## What this proves

The 3.8.20 model is still the core: all 22 endpoints, all 29 `Automation` fields, the `Trigger`/`Condition`/`Reply` structure, the OR-of-ANDs condition groups, and the `start_session` / `message_session` / `monitor_session` / `triage_session` actions are present unchanged in 3.10.31 (`app-initial-CHtLS52L.js:1441-1601`, `AutomationEditorPage-aTs05MdH.js:4868-4909`). What changed is additive: (1) an **embedded Preflight code step** is now saved on the automation itself (`code_step` in POST/PUT) with a runtime/environment/secrets/source config, test-run and sample-event endpoints, and a run detail model; (2) **Slack identity/access** fields (`slack_bot_name`, `slack_bot_icon_url`, `slack_reply_access`, org-level `slack_default_access`); (3) **On-call** is a first-class feature: "responders" are automations tagged `oncall_responder` with `runbook`/`platform`/`source` and a `/oncall/*` API family, plus org incident settings; (4) an **AI-guided creation preview** computes client-side diff annotations (`added`/`removed`/`changed`) over triggers/actions — there is no server annotation field; (5) `AutomationScopeRow` is a *Settings > Connections* control (`allowOwnedPublicReposInAutomations`), not an automation field; (6) new event types `slack:usergroup_mentioned`, `pagerduty:incident_updated`, editor pseudo-types `slack:monitor`, `schedule:hourly|daily|weekly|custom`, and a `start_code_scan` action with `scan_type`; (7) new routes `/automations/$id/error-logs`, `/security/automations/*`, `/oncall/*`, `/settings/schedules/*`, `/settings/webhooks`; (8) the event schema catalogue is fetched (`GET /automations/schemas`, `GET {org}/automations/schemas`) and filtered by connection state. Nothing in 3.8.20 was removed from the wire contract; some list/detail read-model fields were added (`last_edited_by*`, `first_invocation_at`).

## 1. Changelog

| Kind | Item | Evidence |
|---|---|---|
| Added | `code_step` object in create/update payload; "code-step-only" save mode sends `PUT {code_step}` alone | PROVEN `AutomationEditorPage-aTs05MdH.js:3778-3786` (create), `:4841,4871` (update), `:4823,4921-4930` (code-step-only) |
| Added | `CodeStepConfig` = `{enabled, runtime, timeout_seconds, environment, secret_names, source}`; config query returns `{config, version, updated_at}` | PROVEN `AutomationEditorPage-aTs05MdH.js:1275-1284`, `:1256,1323,1190` |
| Added | Code-step runtimes `python` (default) and `node`/`javascript` | PROVEN `AutomationEditorPage-aTs05MdH.js:1172,2008-2012,2160` |
| Added | Code-step environment `{kind:'minimal'}` or `{kind:'snapshot', snapshot_id}` | PROVEN `AutomationEditorPage-aTs05MdH.js:1175,1196` |
| Added | Endpoints: `GET .../{id}/code-step/recent-events`, `GET .../{id}/code-step/sample-events`, `POST .../{id}/code-step/test-runs`, `GET /automations/code-step/sample-events?event_type=…`, `POST /automations/code-step/test-runs`, `GET /automations/code-step/runs/{runId}` (draft, no automation id) | PROVEN `app-initial-CHtLS52L.js:1590-1601` |
| Added | Test-run target discriminator `{kind:'draft',…}` / `{kind:'automation', automationId}`; sample-event source `{kind:'recent'|'sample'}` | PROVEN `AutomationEditorPage-aTs05MdH.js:1308-1313`, `:886-888` |
| Added | `CodeStepRun` detail model with `envelope` (`skip`/`items`), `preview` counts, `logs`, `error_class`, `exit_code`, `wall_seconds` | PROVEN `CodeStepRunDetail-kBCiEcEW.js:54-66,87-116,135-170,214-279` |
| Added | `POST /automations/discovery-session` (AI-guided creation bootstrap) | PROVEN `app-initial-CHtLS52L.js:1467` |
| Added | `POST /automations/slack-bot-icon` multipart `file` + optional `avatar_key` → `{url}` | PROVEN `app-initial-CHtLS52L.js:1514-1522` |
| Added | `slack_bot_name`, `slack_bot_icon_url`, `clear_slack_bot_name`, `clear_slack_bot_icon_url` on create/update | PROVEN `app-initial-CHtLS52L.js:2660-2669` (helper `Pc`), `AutomationEditorPage-aTs05MdH.js:3809-3815,4896` |
| Added | `slack_reply_access` on Automation (default `slack_users`), sent only when Slack triggers present | PROVEN `AutomationEditorPage-aTs05MdH.js:3311,3821,4900`; `ResponderEditorPage-xwC4wC-m.js:599,634` |
| Added | Org Slack `slack_default_access` `{mode:'all_public'|'specific', channels:[ws,ch][]}` seeds `slack_tool_channels` | PROVEN `AutomationEditorPage-aTs05MdH.js:2741-2750` |
| Added | `GET /automations/schemas` and `GET {org}/automations/schemas` event-schema catalogue; sources filtered by connection state (pylon needs connected; `incident_io`/`pagerduty` gated by flags; `disconnected` hidden) | PROVEN `AutomationItemAnnotation-C8dyCrqb.js:14-47,56-77` |
| Added | Event types `slack:usergroup_mentioned`, `pagerduty:incident_updated` (default condition `change eq`) | PROVEN `TriggerEditor-b_UutUte.js:183,318-321`; `ResponderEditorPage-xwC4wC-m.js:197` |
| Added | Editor pseudo-types `slack:monitor` (Watch channel), `schedule:hourly|daily|weekly|custom`, `schedule:one_time` | PROVEN `TriggerEditor-b_UutUte.js:2486-2500` |
| Added | Action `start_code_scan` `{profile_id?, scan_type?:'security'|'secrets', repos}` with validation `scanRequired`/`repositoryRequired`/`profileRequiredTitle` | PROVEN `AutomationEditorPage-aTs05MdH.js:2857-2861,2517` |
| Added | On-call feature: responders (automations tagged `oncall_responder`), incidents settings, reports, stats; `/oncall/*` API | PROVEN `app-initial-DVNuq5ff.js:2167-2178`, `OncallPage-Day6NVe5.js:1912` |
| Added | Responder fields `runbook`, `platform`/`clear_platform`, `source:'pagerduty'|'slack'`, `pagerduty_connection_id`, `session_tags` | PROVEN `ResponderEditorPage-xwC4wC-m.js:559-563,578-600,617-636` |
| Added | Query key `responderDetail` `['automations', org, 'oncall-responder', id]`; `oncall-org-stats` | PROVEN `app-initial-CHtLS52L.js:1389,1683` |
| Added | Client-side diff annotations for AI mutation preview (`kind: added|removed|changed`, `rowIds`, `details`, `promptSlot`) passed to `TriggerEditor` `itemAnnotations`/`itemDiffs` | PROVEN `SessionPanes-DVXGQT13.js:14062-14096,14434-14449`; `TriggerEditor-b_UutUte.js:2225,2269-2271`; `AutomationItemAnnotation-C8dyCrqb.js:106-145` |
| Added | Settings row `AutomationScopeRow`: per git connection `allowOwnedPublicReposInAutomations` (`private` vs `all`) | PROVEN `AutomationScopeRow-FmpR9wby.js:13-70` |
| Added | Routes `/automations/$id/error-logs`, `/security/automations[/create|/$id[/edit]]`, `/oncall[/create|/$id[/edit]|/reporting/$id]`, `/settings/schedules[/create|/$id]`, `/settings/webhooks` | PROVEN route strings in `app-initial-*.js` (see §5) |
| Added | Read-model fields `last_edited_by`, `last_edited_by_service_user_id`, `last_edited_by_service_user_name`; invocation `first_invocation_at` | PROVEN `AutomationViewPage-gJdoaFXK.js:1170-1175,693,2862` |
| Added | Pre-save gates: `sessionTagRepairBlockedByChannelAccess`, `channelAlreadyMonitored`; confirm dialogs when a `monitor_session` with `target_devin_id` exists and identity (`run_as_user`/`devin_mode`) or tooling (`net_policy`/`recommended_mcps`/security) changes | PROVEN `AutomationEditorPage-aTs05MdH.js:4932-4967` |
| Changed | Security-profile selection UI state uses `null|'none'|'profile'` and maps to wire `inherit|disabled|profile` (same wire enum as 3.8.20) | PROVEN `AutomationEditorPage-aTs05MdH.js:2390-2424` |
| Changed | `scratchpad_enabled` on create defaults to `true` unless template says `false` | PROVEN `AutomationEditorPage-aTs05MdH.js:3817` |
| Changed | Webhook triggers: conditions rewritten with the minted secret hash before save (`Fi(conditions, hash)`) | PROVEN `AutomationEditorPage-aTs05MdH.js:4862-4866,3773-3776` |
| Removed | Nothing from the 3.8.20 wire contract. All 22 endpoints, all fields, and all 3.8.20 event types remain referenced. | DERIVED from §5/§6 tables |

## 2. Updated data model (TypeScript, from proven fields)

Wire names are exact. `//` notes give the evidence label where it is not PROVEN.

```ts
// Automation read model. Unchanged 3.8.20 fields kept; NEW marked.
type Automation = {
  automation_id: string
  name: string
  enabled: boolean
  triggers: Trigger[]
  actions: Action[]
  code_step?: CodeStepConfig | null                    // NEW (PROJECTED on read; PROVEN on write)
  created_at?: string | null
  last_invocation_at?: string | null
  created_by?: string | null
  created_by_service_user_id?: string | null
  created_by_service_user_name?: string | null
  updated_by?: string | null
  last_edited_by?: string | null                       // NEW AutomationViewPage:1170
  last_edited_by_service_user_id?: string | null       // NEW AutomationViewPage:1174
  last_edited_by_service_user_name?: string | null     // NEW AutomationViewPage:1172
  run_as_user?: boolean
  template_id?: string | null
  creation_method?: 'manual' | 'duplicate' | string
  recommended_mcps?: string[]
  slack_tool_channels?: [workspaceId: string, channelId: string][]   // ['*','*'] = all public
  slack_dm_scope?: 'disabled' | 'org_members' | 'workspace'
  slack_reply_access?: 'slack_users' | string          // NEW; default 'slack_users' (Editor:3311). Other enum values REMOTE
  slack_bot_name?: string | null                       // NEW app-initial-CHtLS52L:2664
  slack_bot_icon_url?: string | null                   // NEW app-initial-CHtLS52L:2665
  linear_tools_enabled?: boolean
  scratchpad_enabled?: boolean
  max_acu_limit?: number | null
  invocation_limit?: number | null
  invocation_limit_window_seconds?: number | null
  max_concurrent_runs?: number | null
  max_queue_depth?: number | null
  devin_mode?: string | null
  net_policy?: unknown | null
  tags?: Record<string, string>                        // 'oncall_responder' key marks a responder (OncallPage:1912)
  secure_mode_selection?: 'inherit' | 'disabled' | 'profile' | null
  secure_mode_profile_id?: string | null
}

// Update payload extras (PUT /automations/{id}) — Editor:4868-4909
type AutomationUpdateExtras = {
  clear_max_acu_limit?: boolean; clear_invocation_limit?: boolean
  clear_max_concurrent_runs?: boolean; clear_max_queue_depth?: boolean
  clear_devin_mode?: boolean; clear_net_policy?: boolean
  clear_slack_bot_name?: boolean; clear_slack_bot_icon_url?: boolean   // NEW
}

type Trigger = {
  event_type: string                     // see §6 catalogue
  conditions: Condition[][]              // OR of ANDs (unchanged)
  replies: Reply[]
  [serverField: string]: unknown
}
type Condition = { field: string; operator: string; value?: unknown }   // 'eq' default; 'globs', 'is_empty', '_webhook_*' preserved
type Reply = { type: 'post_response' | 'attach_thread' | 'notify_thread' | string; to?: { channel_id?: string } }

// Actions — 3.8.20 shapes unchanged, one addition.
type StartSessionAction = {
  type: 'start_session'; prompt: string; bypass_approval?: boolean; tags?: string[]
  playbook_id?: string; repos?: string[]; slack_channel_id?: string
  slack_thread_mode?: 'notify' | 'attach' | 'forward' | 'post_response' | null
}
type MessageSessionAction = { type: 'message_session'; prompt: string; target_devin_id?: string; auto_create?: boolean }
type MonitorSessionAction = {
  type: 'monitor_session'; setup_prompt: string; playbook_id?: string; repos?: string[]
  target_devin_id?: string                                  // set once monitor is live; cleared by reset-monitor (Editor:4804-4814)
  slack_monitor_config: { source_channel_id: string; team_id?: string }
}
type TriageSessionAction = {
  type: 'triage_session'; setup_prompt: string; repos?: string[]
  slack_config: { source_channel_id: string }
  platform?: string | null                                  // NEW (responders) ResponderEditorPage:401-404; enum REMOTE
}
type StartCodeScanAction = {                                // NEW Editor:2857-2861
  type: 'start_code_scan'; profile_id?: string; scan_type?: 'security' | 'secrets'; repos?: string[]
}
type OtherVisibleAction =
  | { type: 'remediate_finding' }
  | { type: 'scan_new_commits'; scan_id: string }
  | { type: 'notify'; when: 'always' | 'failure' | 'success' }
  | { type: 'incident_session'; [k: string]: unknown }
type Action = StartSessionAction | MessageSessionAction | MonitorSessionAction | TriageSessionAction | StartCodeScanAction | OtherVisibleAction

// Preflight code step — Editor:1275-1284
type CodeStepConfig = {
  enabled: boolean
  runtime: 'python' | 'node'
  timeout_seconds: number
  environment: { kind: 'minimal' } | { kind: 'snapshot'; snapshot_id: string }
  secret_names: string[]
  source: string                                            // program text
}
type CodeStepConfigResponse = { config: CodeStepConfig | null; version: string; updated_at?: string | null }  // Editor:1256,1323,1190
type CodeStepTestRunTarget = { kind: 'draft'; [draftFields: string]: unknown } | { kind: 'automation'; automationId: string }
type CodeStepSampleEventSource = { kind: 'recent' } | { kind: 'sample' }

// CodeStepRunDetail-kBCiEcEW.js:54-66,87-116,135-170,214-279
type CodeStepRun = {
  id: string | number
  status: 'running' | 'succeeded' | 'failed' | 'cancelled' | 'awaiting_user_input'
  error_class?: 'validation' | string | null
  exit_code?: number | null
  wall_seconds?: number | null
  created_at: string
  logs?: string | null
  envelope?: { kind: 'skip' } | { kind: 'items'; items?: unknown[] }
  preview?: { dispatch_count: number; duplicate_count: number; deferred_count: number; dropped_count: number }
}

// Settings > Connections scope row (NOT an Automation field) — AutomationScopeRow:13-70
type GitConnectionAutomationScope = { allowOwnedPublicReposInAutomations: boolean }  // UI: 'private' | 'all'

// Client-side diff annotation for AI mutation preview — SessionPanes:14062-14096; AutomationItemAnnotation:106-145
type DiffRow = { id: string; field: string; kind: 'added' | 'removed' | 'changed'; oldValue?: unknown; newValue?: unknown; multiline?: boolean }
type ItemAnnotation = { kind: 'added' | 'removed' | 'changed' | 'none'; label: string; rowIds?: string[]; inlineBadge?: boolean; promptSlot?: ReactNode; details?: ReactNode }

// On-call — ResponderEditorPage:559-636; OncallPage:667-682,984
type Responder = Automation & {
  runbook?: string
  platform?: string | null
  source?: 'pagerduty' | 'slack'
  pagerduty_connection_id?: string
  session_tags?: string[]
  tags: { oncall_responder: string; [k: string]: string }
}
type ResponderCreate = Pick<Responder, 'name' | 'runbook' | 'source' | 'pagerduty_connection_id' | 'triggers' | 'max_acu_limit' | 'invocation_limit' | 'invocation_limit_window_seconds' | 'devin_mode' | 'platform' | 'tags' | 'recommended_mcps' | 'slack_tool_channels' | 'linear_tools_enabled' | 'net_policy' | 'run_as_user' | 'slack_reply_access' | 'session_tags'> & { enabled: true }
type ResponderUpdate = Partial<ResponderCreate> & { clear_platform?: boolean; clear_max_acu_limit?: boolean; clear_invocation_limit?: boolean; clear_net_policy?: boolean }
type OncallIncidentSettings = {
  enabled: boolean; run_as_user?: boolean; slack_channel_prefix: string | null; session_tag: string | null
  auto_join_enabled: boolean; allow_non_org_mentions: boolean; devin_mode: string | null
  response_mode: 'proactive' | 'one_shot_rca'
  initial_investigation_mode?: string; thread_session_mode?: string   // enums REMOTE
  slack_team_id: string | null; recommended_mcps: string[]; slack_tool_channels: [string, string][]
  linear_tools_enabled: boolean; net_policy: unknown | null
  target_devin_id?: string; initial_investigation?: boolean           // read-only (OncallPage:984)
}
```

## 3. Endpoint table (org-scoped base `{org}` unless noted)

All PROVEN from `app-initial-CHtLS52L.js` (automations client, lines 1441-1601) and `app-initial-DVNuq5ff.js:2167-2178` (on-call). "New" = not in the 3.8.20 spec §5.

| New | Method/path | Notes | Line |
|---|---|---|---|
| | `GET /automations/sparklines?days=N` | default 30 | 1441 |
| | `GET /automations/tags[?scope=]` | | 1446 |
| | `GET /automations/templates` | | 1450 |
| | `GET /automations[?creator_id&search&event_type…]` | repeated `event_type` | 1451 |
| | `GET /automations/{id}` | | 1459 |
| | `POST /automations` | create body §2 | 1463 |
| NEW | `POST /automations/discovery-session` | no body; AI-guided create | 1467 |
| | `PUT /automations/{id}` | update body §2 + clear flags | 1468 |
| | `DELETE /automations/{id}` | | 1472 |
| | `GET /automations/{id}/issues` | | 1476 |
| | `GET /automations/{id}/consumption[?since&until]` | | 1480 |
| | `GET /automations/{id}/scratch/bundle` | 204 empty; 413 tooLarge; `X-Scratch-Version-Id` | 1487 |
| | `PUT /automations/{id}/scratch/bundle[?parent_version_id]` | multipart `bundle`, `context.json` | 1502 |
| NEW | `POST /automations/slack-bot-icon` | multipart `file`, `avatar_key?` → `{url}` | 1514 |
| | `POST /automations/{id}/reset-monitor` | | 1524 |
| | `POST /automations/{id}/webhook/regenerate-secret` | | 1528 |
| | `POST /automations/webhook/mint-credentials[?automation_id]` | | 1532 |
| | `POST /automations/{id}/trigger` | `{prompt}` or no body | 1536 |
| | `GET /automations/{id}/invocations?limit&offset[&since&until&status…&include_message&issue_id]` | | 1541 |
| | `GET /automations/{id}/events?limit&offset[&since&until&status…&include_message]` | | 1571 |
| | `GET /automations/{id}/code-step/config` | → `{config, version, updated_at}` | 1587 |
| | `DELETE /automations/{id}/code-step/state` | | 1588 |
| | `GET /automations/{id}/code-step/runs/{runId}` | | 1589 |
| NEW | `GET /automations/{id}/code-step/recent-events` | | 1590 |
| NEW | `GET /automations/{id}/code-step/sample-events` | | 1591 |
| NEW | `POST /automations/{id}/code-step/test-runs` | body: code-step test request (REMOTE shape) | 1592 |
| NEW | `GET /automations/code-step/sample-events?event_type=…` | draft; repeated `event_type` | 1594 |
| NEW | `POST /automations/code-step/test-runs` | draft | 1600 |
| NEW | `GET /automations/code-step/runs/{runId}` | draft | 1601 |
| NEW | `GET automations/schemas` (user) / `GET {org}/automations/schemas` | event schema catalogue keyed by source | `AutomationItemAnnotation:56,67` |
| | `POST sessions` (non-org) | `{devin_id, user_message, username, snapshot_id:null, additional_args:{planning_mode:'automatic', planner_type:'fast'}}` — used to message a session from the automation UI | 1540-1551 |
| NEW | `GET /oncall/setup`, `POST /oncall/setup/start` | | DVNuq5ff 2167-2168 |
| NEW | `GET /oncall/responders`, `POST /oncall/responders` | | 2169,2171 |
| NEW | `GET|PATCH|DELETE /oncall/responders/{id}` | PATCH body §2 ResponderUpdate | 2170,2172,2175 |
| NEW | `PUT /oncall/responders/{id}/session-tags` | `{session_tags: string[]}` | 2174 |
| NEW | `GET|PUT /oncall/incidents/settings` | §2 OncallIncidentSettings | 2176-2177 |
| NEW | `GET /oncall/incidents`, `GET /oncall/incidents/{id}`, `POST …/{id}/stop`, `POST …/{id}/unstop` | | 2178+ (string grep) |
| NEW | `GET /oncall/reports`, `GET /oncall/reports/{id}`, `…/runs`, `…/digest`, `…/digest/session-tags`, `GET /oncall/stats` | | string grep, `app-initial-DVNuq5ff.js` |
| NEW | `GET|POST {org}/schedules`, `GET {org}/schedules/{id}`, `GET {org}/schedules?…` | Settings > Schedules (adjacent track; listed for completeness) | `schedules-C-5abl-U.js` |
| NEW | `{host}/api/webhooks/automations/{orgId}/{automationId}` | inbound webhook URL shown in `WebhookConfigModal` | `WebhookConfigModal-CKjtxtUP.js:82,92` |

## 4. Query-key table

Source: `V` registry `app-initial-CHtLS52L.js:1385-1402` plus inline keys.

| New | Key | Line |
|---|---|---|
| | `['automations', orgId]` (`V.all`; list keys extend this) | 1386 |
| | `['automation', orgId, id]` / `['automation', orgId]` (`detail`, `detailAll`) | 1387-1388 |
| NEW | `['automations', orgId, 'oncall-responder', id]` (`responderDetail`) | 1389 |
| | `['automation-tags', orgId]`, `[...tags, scope]` | 1390-1391 |
| | `['automation-code-step/config', orgId, id]` | 1392 |
| NEW | `['automation-code-step/recent-events', orgId, id]` | 1393 |
| NEW | `['automation-code-step/sample-events', orgId, ...eventTypes]` | 1394 |
| Changed | `['automation-code-step-run', orgId, automationId \| null, runId]` (null for draft runs) | 1395-1400 |
| | `['resolved-automations-security-profile']` prefix | 1401 |
| | `['automation-toggle-enabled', id]` (mutation key) | 1605 |
| | `['automation-invocations', orgId, id, …params]` | 1678, 1899 |
| | `['automation-events', orgId, id, …params]` | 1679, 1942 |
| | `['automation-sparklines', orgId, days]` | 1682, 1979 |
| NEW | `['oncall-org-stats', orgId]` | 1683 |
| | `['automation-templates', orgId]` | 2021 |
| | `['automation-issues', orgId, id]` | `AutomationViewPage-gJdoaFXK.js:213` |
| | `['automation-consumption', orgId, id, since, until]` | `AutomationViewPage-gJdoaFXK.js:1266` |
| NEW | `['automation-event-schemas']`, `['org-automation-event-schemas', orgId]` | `AutomationItemAnnotation-C8dyCrqb.js:59,72` |
| NEW | `[statusQueryKeyRoot, orgId]` invalidated by scope-row mutation | `AutomationScopeRow-FmpR9wby.js:25` |

Toggle-enabled consistency (cancel exact detail + responderDetail + all list queries, optimistic update, restore on error) is unchanged in spirit but now also covers the responder detail key (`app-initial-CHtLS52L.js:1608-1620`).

## 5. Routes (PROVEN string literals, `app-initial-*.js` route table)

`/automations`, `/automations/create`, `/automations/templates`, `/automations/$id`, `/automations/$id/edit`, **`/automations/$id/error-logs`**, **`/security/automations`**, **`/security/automations/create`**, **`/security/automations/$id`**, **`/security/automations/$id/edit`** (editor navigates here when `Nt` security flag set, `AutomationEditorPage:4819-4821`), **`/oncall`**, **`/oncall/create`**, **`/oncall/$id`**, **`/oncall/$id/edit`**, **`/oncall/reporting/$id`**, **`/settings/schedules`**, **`/settings/schedules/create`**, **`/settings/schedules/$id`**, **`/settings/webhooks`**. Bold = new since 3.8.20.

## 6. Trigger `event_type` catalogue

Static source label map is unchanged (`github, gitlab, slack, linear, jira, pylon, incident_io, schedule, webhook, code_scan, snapshot_build`) plus **`pagerduty`** (PROVEN filter branch `AutomationItemAnnotation-C8dyCrqb.js:40`, default condition `TriggerEditor-b_UutUte.js:318-321`). The real event/field/operator schema is runtime data from `GET /automations/schemas` (REMOTE content); the following are literal strings referenced by 3.10.31 automations chunks.

| Source | event_type | Status | Evidence |
|---|---|---|---|
| github | `push`, `pull_request`, `pull_request_review`, `pull_request_review_comment`, `check_run`, `issues`, `issue_comment` | unchanged | TriggerEditor literal grep; `issues`/`issue_comment` via schema |
| gitlab | `push`, `pipeline`, `merge_request`, `note`, `issue` | unchanged | TriggerEditor literal grep |
| slack | `message`, `reaction_added`, **`usergroup_mentioned`** | added | `TriggerEditor-b_UutUte.js:183`, `ResponderEditorPage:197` (responder Slack source; first condition group is the mention, subsequent groups are extra filters) |
| slack (editor pseudo) | **`monitor`** ("Watch channel", maps to `monitor_session` mode) | added | `TriggerEditor-b_UutUte.js:496,2486-2488` |
| linear | `assigned`, `create`, `label_added`, `moved`, `priority_changed`, `status_changed` | unchanged (schema-driven) | 3.8.20 §9.1; no contrary evidence |
| jira | `assigned`, `issue_created`, `issue_updated`, `label_added`, `status_changed` | unchanged | `jira:status_changed` literal; rest schema-driven |
| pylon | `issue_created`, `issue_tag_added`, `issue_status_changed` | unchanged; hidden unless Pylon connected (`usePylonDisabledTriggers`) | `AutomationItemAnnotation:36-37` |
| incident_io | `status_changed` (default cond `new_status eq`), `severity_changed` (`new_severity eq`) | unchanged | `TriggerEditor:314-317` |
| pagerduty | **`incident_updated`** (default cond `change eq`); other `pagerduty:*` get an empty condition | added | `TriggerEditor:318-321` |
| schedule | `recurring` (persisted), `one_time` (picker), **`hourly`/`daily`/`weekly`/`custom`** (picker presets → RRULE) | presets added | `TriggerEditor:565,2490-2500` |
| webhook | `incoming` (conditions rewritten with secret hash on save) | unchanged | `AutomationEditorPage:4862-4866` |
| code_scan | `finding` | unchanged | list filter key `'code_scan:finding'` |
| snapshot_build | `completed` | unchanged | 3.8.20; still in source map |

Default-condition rules for other sources (3.8.20 §9.2) were not re-derived; no diff found in the `TriggerEditor` default-condition function beyond the pagerduty branch above.

## 7. Notes on new features (copy and schema, brief)

- **Preflight code step (editor)**: copy keys `automations.codeStep.*` (`secretsPermissionRequired`, `requestError`, `runMetaRan`, `previewBreakdownDropped`, `wouldStart`, `runExitCodeInline`). 403 containing "requires the manage org secrets permission" is surfaced as a specific message (`AutomationEditorPage:1290-1298`). Run states rendered: `validationFailed`, `failed`, `skipped` (envelope `skip`), `ran`, `stale` (running past cutoff), `running` (`CodeStepRunDetail:54-66`).
- **Webhook config modal**: displays `{host}/api/webhooks/automations/{orgId}/{automationId}` and the secret; example URL `https://example.com/webhooks/devin` (`WebhookConfigModal-CKjtxtUP.js:82,92`). Settings page `/settings/webhooks` is a separate list (adjacent; not analysed further).
- **AI-guided preview** (`automation-request-preview`, `SessionPanes-DVXGQT13.js:14571`): copy `automations.changes_one/other`, `automations.noChanges`, `automations.added/removed/changed`, `automations.changedCount_one/other`. Slack-destination fields (`start_session.slack_channel_id`, `start_session.slack_thread_mode`) are grouped into one annotation (`:14434-14449`).
- **Scope row**: copy `settings.automationScope`, `settings.automationScopeDescription`, `settings.automationScopePrivateReposOnly`, `settings.automationScopeAllConnectedRepos`, `settings.automationScopePublicRepoWarning`, `settings.automationScopeUpdateFailed` (`AutomationScopeRow:28-48`).
- **On-call**: response-mode copy `oncall.incidentResponseModeProactive[Description]`, `oncall.incidentResponseModeOneShot[Description]` (`OncallPage:556-570`). Responder editor rejects saving `run_as_user` responders whose session tag changed until `PUT …/session-tags` succeeds (`ResponderEditorPage:565-575`).

## 8. REMOTE / UNKNOWN boundary

- Full `slack_reply_access` enum (only `slack_users` literal is proven); `platform` enum for responders; `initial_investigation_mode` / `thread_session_mode` enums.
- Body schema of `code-step/test-runs` and the server-side event envelope the code step receives (only `envelope.kind` `skip|items` and `preview` counters are read).
- Content of `GET /automations/schemas` (fields/operators per event type).
- `net_policy` internal shape (unchanged from 3.8.20 §13.4; not re-derived).
- Whether `code_step` is returned inline on `GET /automations/{id}` or only via `/code-step/config` — the editor reads config from the dedicated query (`AutomationEditorPage:1169`), so treat inline presence as PROJECTED at best.

## 9. Evidence appendix (working files)

- Notes with per-step citations: `_work/automations/NOTES-A-changelog.md`.
- Field universe (270 snake_case tokens across automations chunks): `_work/automations/_fields_31031.txt`; candidates not in 3.8.20 model: `_work/automations/_new_candidates.txt`.
- Formatted chunks cited: `_work/formatted/{AutomationEditorPage-aTs05MdH, AutomationViewPage-gJdoaFXK, AutomationsPage-DqY8LhBk, AutomationItemAnnotation-C8dyCrqb, AutomationScopeRow-FmpR9wby, CodeStepRunDetail-kBCiEcEW, WebhookConfigModal-CKjtxtUP, OncallPage-Day6NVe5, ResponderEditorPage-xwC4wC-m, SessionPanes-DVXGQT13, app-initial-CHtLS52L, app-initial-DVNuq5ff}.js`; `_work/automations/formatted/{TriggerEditor-b_UutUte, triggerMode-epfBa6xz}.js`.
- Method: 3.8.20 spec read only at §4 (200-300), §5 (320-366), §9.1 (584-637); 3.10.31 verified by targeted `rg` on literals and ≤120-line `sed` windows. No network, no execution.
