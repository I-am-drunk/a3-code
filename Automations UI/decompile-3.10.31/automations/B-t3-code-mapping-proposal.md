# Devin Automations → T3 Code: architecture mapping (PROPOSAL)

> **Status: PROPOSAL ONLY. Nothing here is implemented, scheduled, or agreed.** This document maps the decompiled Devin Automations feature onto T3 Code's existing environment/project/thread/turn model and proposes the smallest set of additions that would make the behavior unsurprising. Every claim about T3 cites `path:line` in `/Users/irene/a3-code`. Every claim about Devin cites the 3.8.20 spec / audit. Evidence labels: **PROVEN** (cited text), **DERIVED** (follows from cited code), **PROPOSED** (this document's design), **REMOTE/UNKNOWN** (behind Devin's server; not recoverable).

## What this proves (summary)

Devin's Automations are a server-side product: the client is a CRUD/monitoring UI over `GET/POST/PUT/DELETE /automations…` plus `POST /automations/<id>/trigger` (run-now), invocations/events history, and a Preflight "code step" (PROVEN, `DEVIN_AUTOMATIONS_DECOMPILED_SPEC.md:320-345`; `DEVIN_CLIENT_VS_SERVER_FEASIBILITY_AUDIT.md` §0, §2 — scheduler, ingestion, code-step runner and concurrency enforcement are absent from the client). T3 Code already has everything an automation *fires into*: a single command, `thread.turn.start`, whose `bootstrap` block can create the thread, prepare a worktree, run the project setup script, and start the first turn with a user message in one dispatch (PROVEN, `packages/contracts/src/orchestration.ts:1258-1306`). T3 also already has the reactor pattern a scheduler needs (`apps/server/src/orchestration/ThreadSettlementReactor.ts:81,332-360`; `PullRequestSyncReactor.ts:210-224,327`) and no cron/webhook/RRULE code of any kind (PROVEN by search: only Effect `Schedule` retries and one-minute PR sync cadences). So the minimal v1 is: **one new aggregate (`automation`) in the existing event-sourced engine, one reactor (scheduler), one HTTP ingress route (webhook), and a run history that is a projection over existing thread/turn events, not a new store.**

## 1. Concept mapping: Devin → T3 Code

| Devin concept (PROVEN in spec unless noted) | T3 Code concept | Mapping label | Notes / citation |
|---|---|---|---|
| Organization (`orgId` in every query key, spec §5.1) | **Environment** — "one running server and the machine, credentials, workspace access, and state it owns" | DERIVED | `docs/internals/glossary.md:10`. Automations are environment-local, like projects. No cross-environment automations in v1. |
| Repo (`repos[]` on `start_session`, spec :253) | **Project** — "environment-local workspace record rooted at a directory" | DERIVED | `glossary.md:12`; `OrchestrationProjectShell{id,title,workspaceRoot,repositoryIdentity,...}` `orchestration.ts:843-857`. An automation targets exactly one project in v1 (Devin allows several repos per session; T3 threads belong to one project, `orchestration.ts:774`). |
| Session (cloud Devin VM run) | **Thread** (+ its provider **Session**) | DERIVED | Thread = "durable conversation and work history for a project" `glossary.md:14`; Session = "provider runtime attached to a thread" `glossary.md:31`. |
| Invocation (one run of an automation, `GET /automations/<id>/invocations`) | **Thread + first Turn** created by the trigger | PROPOSED | Turn = "one user-to-agent work cycle" `glossary.md:15`. A run *is* the thread it created; its status is `thread.latestTurn.state` (`running\|interrupted\|completed\|error`, `orchestration.ts:652-657`). |
| Event (`GET /automations/<id>/events`; queued/running rows) | **Domain events** on the `automation` aggregate (`automation.fired`, `automation.run-skipped`) | PROPOSED | T3 events are persisted facts with `EventBaseFields` `orchestration.ts:1987-1995`. |
| Automation (`type Automation`, spec :205-235) | **New aggregate kind `automation`** alongside `project`/`thread` | PROPOSED | `OrchestrationAggregateKind = Literals(["project","thread"])` `orchestration.ts:1690` would gain `"automation"`. |
| `enabled` | `Automation.enabled` (+ `automation.enable`/`automation.disable` commands) | PROPOSED | Mirrors `thread.archive`/`thread.unarchive` pairing `orchestration.ts:1117-1123`. |
| Trigger `schedule:recurring` (rrule + tz) | `AutomationTrigger{kind:"schedule", rrule, timeZone}` | PROPOSED | v1. Evaluated by the scheduler reactor (§3). |
| Trigger webhook (secret hash, body regex conditions, `_webhook_*` conditions spec :294) | `AutomationTrigger{kind:"webhook", secretHash, ...}` + `POST /api/automations/webhooks/:token` | PROPOSED | v1. Ingress in `apps/server/src/http.ts` (§3). |
| Run-now (`POST /automations/<id>/trigger`, optional `{prompt}`) | `AutomationTrigger{kind:"manual"}` + command `automation.run` | PROPOSED | v1. |
| Triggers github/slack/linear/jira/pylon/`code_scan:finding` | Later; would need Connections (Integrations track) | PROPOSED (deferred) | Listed in §6 non-goals. |
| Conditions (OR-of-ANDs, `Condition{field,operator,value}` spec :237-246) | Deferred; v1 webhook accepts all deliveries | PROPOSED (deferred) | YAGNI until a second trigger source exists. |
| Action `start_session{prompt,repos,playbook_id,tags}` | `thread.turn.start` with `bootstrap.createThread` + `message.text = prompt` | DERIVED | `orchestration.ts:1286-1306`. Only action in v1. |
| Action `message_session{target_devin_id}` | `thread.turn.start` on an existing `threadId` (no bootstrap) | PROPOSED (later) | Same command, different `threadId`; trivially supportable, but not in v1. |
| Actions `monitor_session`, `triage_session`, `incident_session`, `remediate_finding`, `scan_new_commits` | None | Non-goal | All Slack/code-scan specific; REMOTE semantics. |
| Action `notify{when}` | Later: T3 notification path already exists for turn completion (not audited here) | OPEN | See §7. |
| Playbook (`playbook_id`) | No equivalent; the prompt text is the playbook | PROPOSED | T3 has project `scripts: ProjectScript[]` `orchestration.ts:855` but those are shell scripts, not prompts. |
| Tags `Record<string,string>` | Deferred | Non-goal v1 | |
| Templates (`GET /automations/templates`) | Deferred; could ship as static JSON in web | Non-goal v1 | |
| `max_concurrent_runs`, `max_queue_depth` | `Automation.maxConcurrentRuns` (default 1); no queue — skip and record `automation.run-skipped` | PROPOSED | §3 concurrency. |
| `max_acu_limit`, consumption, sparklines | n/a (BYO subscription; no metering). Sparkline = count of runs/day derived from projection | Non-goal / trivial projection | |
| `invocation_limit(+window)` | Deferred | Non-goal v1 | |
| `run_as_user`, `secure_mode_*`, `net_policy`, `devin_mode` | `runtimeMode` + `modelSelection` + `interactionMode` copied from the automation onto the created thread | DERIVED | Those three fields exist on `ThreadCreateCommand` `orchestration.ts:1098-1102` and `bootstrap.createThread` `:1258-1267`. |
| Preflight "code step" script (config/state/runs endpoints) | `bootstrap.runSetupScript: true` → project setup script | DERIVED | `orchestration.ts:1282`; `apps/server/src/serverRuntimeStartup.worktreeSetup.test.ts` exists (worktree setup script path). Not a separate sandboxed runner. |
| Scratchpad bundle | None | Non-goal | |
| On-call / responders | None | Non-goal | Separate Devin product surface. |
| Issues (`/issues` clustering) | None; failures are visible as threads with `latestTurn.state === "error"` | Non-goal | |
| `devin_automation_manage` tool (agent manages automations) | Later: T3's MCP toolkit (`apps/server/src/mcp/`) could expose `automation.*` commands to agents | OPEN | |

## 2. Proposed contract additions (`packages/contracts`)

All PROPOSED. Placed in a new `packages/contracts/src/automation.ts` (the name `previewAutomation.ts` is already taken by browser-preview automation, `packages/contracts/src/previewAutomation.ts` — avoid the bare word "automation" colliding in exports). IDs follow `makeEntityId` (`packages/contracts/src/baseSchemas.ts:108-114`); wire methods follow `ORCHESTRATION_WS_METHODS` (`orchestration.ts:35-44`); commands are present-tense dotted nouns and events are past-tense (`"thread.turn.start"` → `"thread.turn-start-requested"`, `orchestration.ts:1286,2107`).

### 2.1 Schemas (Effect Schema sketch)

```ts
export const AutomationId = makeEntityId("AutomationId");

// v1 trigger union. Later kinds are listed in §6 and are NOT in the union yet.
export const AutomationTrigger = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal("schedule"),
    rrule: TrimmedNonEmptyString,          // RFC 5545 RRULE, as Devin's editor emits (spec §4)
    timeZone: TrimmedNonEmptyString,       // IANA tz
  }),
  Schema.Struct({
    kind: Schema.Literal("webhook"),
    // Public path token; the secret itself is stored hashed server-side, never returned.
    token: TrimmedNonEmptyString,
    secretHash: TrimmedNonEmptyString,
    rotatedAt: IsoDateTime,
  }),
  Schema.Struct({ kind: Schema.Literal("manual") }),
]);

// v1 has exactly one action shape: start a new thread in a project with a prompt.
export const AutomationAction = Schema.Struct({
  kind: Schema.Literal("start-thread"),
  projectId: ProjectId,
  prompt: Schema.String,                   // supports {{payload}} / {{firedAt}} substitution (§3.3)
  modelSelection: Schema.NullOr(ModelSelection),      // null => project default (:847)
  runtimeMode: RuntimeMode,
  interactionMode: ProviderInteractionMode,
  worktree: Schema.Literals(["per-run", "none"]),     // per-run => bootstrap.prepareWorktree
  runSetupScript: Schema.Boolean,
});

export const Automation = Schema.Struct({
  id: AutomationId,
  name: TrimmedNonEmptyString,
  enabled: Schema.Boolean,
  triggers: Schema.Array(AutomationTrigger),
  action: AutomationAction,
  maxConcurrentRuns: Schema.Int.pipe(Schema.greaterThan(0)),   // default 1
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
  deletedAt: Schema.NullOr(IsoDateTime),  // soft delete → restore (§5)
  lastFiredAt: Schema.NullOr(IsoDateTime),
  nextFireAt: Schema.NullOr(IsoDateTime), // projection convenience for the list view
});

// Run history row — a PROJECTION, not stored separately (§3.4).
export const AutomationRun = Schema.Struct({
  automationId: AutomationId,
  threadId: ThreadId,
  firedAt: IsoDateTime,
  source: Schema.Literals(["schedule", "webhook", "manual"]),
  state: OrchestrationLatestTurnState,    // running|interrupted|completed|error (orchestration.ts:652)
});
```

### 2.2 Commands (client-dispatchable, through `orchestration.dispatchCommand`)

| Command `type` | Payload (besides `commandId`, `automationId`, `createdAt`) | Emits |
|---|---|---|
| `automation.create` | `name, triggers, action, maxConcurrentRuns` | `automation.created` |
| `automation.update` | same fields, partial | `automation.updated` |
| `automation.enable` / `automation.disable` | — | `automation.enabled` / `automation.disabled` |
| `automation.delete` / `automation.restore` | — | `automation.deleted` / `automation.restored` |
| `automation.webhook.rotate-secret` | `triggerIndex` | `automation.webhook-secret-rotated` (secret returned once in the command receipt, like Devin's `regenerate-secret`, spec :338) |
| `automation.run` | `promptOverride?` | `automation.fired {source:"manual"}` then a server-issued `thread.turn.start` |
| `automation.run.cancel` | `threadId` | delegates to existing `thread.turn.interrupt` (`orchestration.ts:1328`) — no new event |

### 2.3 Server-internal commands (like `InternalOrchestrationCommand`, `orchestration.ts:1625-1646`)

| `type` | Purpose |
|---|---|
| `automation.fire` | Scheduler/webhook ingress asks the decider to record `automation.fired` or `automation.run-skipped {reason:"disabled"\|"concurrency"\|"duplicate"}`. Decider is pure and enforces concurrency from projected state. |

### 2.4 Events on aggregate `automation`

`automation.created`, `automation.updated`, `automation.enabled`, `automation.disabled`, `automation.deleted`, `automation.restored`, `automation.webhook-secret-rotated`, `automation.fired {source, threadId, dedupeKey, payloadDigest}`, `automation.run-skipped {source, reason, dedupeKey}`. `EventBaseFields.aggregateId` (`orchestration.ts:1991`) becomes `Union([ProjectId, ThreadId, AutomationId])`.

### 2.5 Receipts

Command receipts already exist for idempotent retries (`glossary.md:26`). `automation.fire` must use a deterministic `commandId` (pattern: `server:automation-fire:${automationId}:${dedupeKey}`, mirroring `server:pr-sync:${thread.id}:${uuid}` in `apps/server/src/orchestration/PullRequestSyncReactor.ts:212,224`) so a scheduler tick replayed after a crash is a no-op. Test-only runtime receipts: `automation.scheduler.tick`, `automation.webhook.received`.

### 2.6 WS methods

Add to a new `AUTOMATION_WS_METHODS`: `automation.list` (shell snapshot includes automations, or a separate subscribe), `automation.runs` (projection query, paged by thread `createdAt`). Everything else rides `orchestration.dispatchCommand` (`orchestration.ts:36`).

## 3. Server design (`apps/server`) — PROPOSED

### 3.1 Where things live

| Piece | Location | Precedent |
|---|---|---|
| Decider cases for `automation.*` commands | `apps/server/src/orchestration/decider.ts` (pure; existing file) | decider is "the pure logic that turns a command and current state into events" `glossary.md:23`; per-concern decider tests already exist (`decider.snoozed.test.ts`, `decider.pullRequests.test.ts`). |
| Projection of `Automation` + `AutomationRun` | `apps/server/src/orchestration/Services/` (read model) | Projector `glossary.md:25`. |
| **Scheduler reactor** `AutomationSchedulerReactor.ts` | `apps/server/src/orchestration/` next to `ThreadSettlementReactor.ts`, `PullRequestSyncReactor.ts` | `export const make = Effect.gen(...)` + `export const layer = Layer.effect(Tag, make)` `ThreadSettlementReactor.ts:81,360`; subscribes via `engine.subscribeDomainEvents` `:334`; dispatches via `engine.dispatch` `:129`. |
| **Webhook HTTP ingress** | `apps/server/src/http.ts` (single-file HTTP layer; already hosts `/api/observability/v1/traces` proxy at `:51` and static serving at `:549`) | Add `POST /api/automations/webhooks/:token`. |
| RRULE evaluation | small dependency (`rrule` npm) inside the scheduler reactor only; contracts store the string | Devin's client only *builds* RRULE strings (audit §2) — no evaluator to copy. |

### 3.2 Scheduler reactor

- One fiber per environment, not per automation: every minute (`Effect.repeat(Schedule.spaced("1 minute"))`, exactly as `PullRequestSyncReactor.ts:327`) it reads the projected list of enabled automations with `schedule` triggers, computes occurrences in `(lastTick, now]` per RRULE+tz, and dispatches an internal `automation.fire` per occurrence.
- Also wakes on `automation.created/updated/enabled` events (via `subscribeDomainEvents`) to recompute `nextFireAt` immediately so the list view never shows a stale "next run".
- **Dedupe key** for schedule = ISO occurrence time truncated to the minute. `commandId = server:automation-fire:${automationId}:${dedupeKey}`. Command receipts make a replayed tick idempotent (§2.5). Missed occurrences while the server was down: fire **at most one** catch-up (the latest missed) and record the rest as `automation.run-skipped {reason:"missed"}` — surprising behavior otherwise (a laptop asleep for a week should not spawn 168 threads on wake).
- Clock: scheduler must use the Effect `Clock` service so tests advance time instead of sleeping (AGENTS.md "Wait on receipts and worker drains, never on sleeps").

### 3.3 Firing → thread + turn

On `automation.fired` (decider accepted; concurrency OK), the reactor dispatches **one** existing command:

```ts
engine.dispatch({
  type: "thread.turn.start",                       // orchestration.ts:1286
  commandId: CommandId.make(`server:automation-turn:${automationId}:${dedupeKey}`),
  threadId,                                        // pre-generated, recorded in automation.fired
  message: { messageId, role: "user", text: renderPrompt(action.prompt, payload), attachments: [] },
  modelSelection: action.modelSelection ?? undefined,
  runtimeMode: action.runtimeMode,
  interactionMode: action.interactionMode,
  titleSeed: `${automation.name} · ${firedAt}`,
  bootstrap: {
    createThread: { projectId, title, modelSelection, runtimeMode, interactionMode, branch: null, worktreePath: null, createdAt },  // :1258-1267
    prepareWorktree: action.worktree === "per-run" ? { projectCwd: project.workspaceRoot, baseBranch, branch: `automation/${slug}/${dedupeKey}`, requireWorktree: true } : undefined,  // :1269-1275
    runSetupScript: action.runSetupScript,          // :1282
  },
  createdAt,
});
```

Everything after that — provider session, checkpoints, turn diff, settlement, PR linking — is the normal thread lifecycle (`ThreadSettlementReactor.ts`, `ThreadPullRequestReactor.ts`) and needs **no automation-specific code**. `renderPrompt` does only `{{payload}}` (raw webhook body, size-capped) and `{{firedAt}}` substitution; no templating language.

Actor attribution: events carry `OrchestrationActorKind = client|server|provider` (`orchestration.ts:1692`); automation-created threads are `server` actor. The thread should carry a back-reference `origin: {automationId, firedAt}` so the chat header can say "Started by automation X" and the run list can be joined without a new table (§3.4). OPEN: add `origin` to `OrchestrationThread` (`orchestration.ts:773`) vs. keep it only in `automation.fired {threadId}`; the latter needs no thread schema change and is preferred for v1.

### 3.4 Run history = projection, not a store

`AutomationRun[]` is derived by joining `automation.fired {threadId}` events with the thread read model's `latestTurn` (`orchestration.ts:660-668`) and `archivedAt`. No invocations table, no events table, no polling — the shell subscription (`orchestration.subscribeShell`, `:41`) already pushes thread state changes. Sparklines (Devin `GET /automations/sparklines`, spec :326) are `count(fired) group by day` over the same events, computed client-side from at most 30 days of `fired` events. Deleting the thread (existing `thread.delete`, `:1111`) leaves a run row with `state: "deleted"` derived from the missing thread.

### 3.5 Webhook ingress

- Route: `POST /api/automations/webhooks/:token`. Token is a random 32-byte URL-safe id stored in the trigger; the **secret** is separate, shown once on create/rotate, stored as a hash. Verify `X-T3-Signature: sha256=HMAC(secret, rawBody)`; also accept `Authorization: Bearer <secret>` for tools that cannot sign. Reject if neither matches; do not reveal whether the token exists.
- Dedupe key = `X-Delivery-Id` header if present, else `sha256(rawBody)` — so GitHub/Linear-style redeliveries collapse.
- Body cap (e.g. 256 KB), stored digest only in `automation.fired {payloadDigest}`; the rendered prompt carries the body text into the user message, which is persisted with the thread anyway (no second copy).
- Auth boundary: this route is **unauthenticated** by design (external callers). T3's HTTP layer authenticates **per route** with a scope (`authenticateRawRouteWithScope(AuthOrchestrationReadScope | AuthOrchestrationOperateScope)`, `apps/server/src/http.ts:275-281`, backed by `auth/EnvironmentAuth.ts`), so the webhook handler simply does not call it — no global guard to carve out. The handler's only capability must be `engine.dispatch(automation.fire)` after HMAC verification. The cloud endpoints show the same per-handler pattern with `requireEnvironmentScope(...)` and a forwarded-authority check (`apps/server/src/cloud/http.ts:427-436`) that the webhook route should reuse to refuse spoofed origins.

### 3.6 Concurrency limit

Pure decider rule: count projected runs for the automation whose thread `latestTurn.state === "running"`; if `>= maxConcurrentRuns` emit `automation.run-skipped {reason:"concurrency"}` instead of `automation.fired`. No queue in v1 (Devin's `max_queue_depth` is a non-goal; a skipped run is visible in the run list, which is the honest behavior).

## 4. Client design — PROPOSED, walked against "Hit every surface" (AGENTS.md)

### 4.1 Web (`apps/web`)

| Surface | Proposal | Precedent (PROVEN) |
|---|---|---|
| Sidebar tab | Add "Automations" next to "Pull Requests" in the sidebar chrome nav | Nav entries are declared in `apps/web/src/components/sidebar/SidebarChrome.tsx:143-161` (`to: "/pull-requests"`, active-state check on `location.pathname`). |
| Routes | TanStack file routes: `_chat.automations.tsx` (list), `_chat.automations.$automationId.tsx` (detail + run history), editor as a right-panel pane or `…/edit` child route | `apps/web/src/routes/_chat.pull-requests.tsx` (`createFileRoute`, list with filters, right-panel open pattern `Sidebar.tsx:1003,1050 openPullRequestsInRightPanel`). |
| Panes | List (name, enabled switch, triggers summary, next run, last run state, 30-day sparkline), Detail (runs = threads; click → existing chat route `_chat.$environmentId.$threadId.tsx`), Editor (name, project picker, prompt composer reusing the existing composer, trigger rows: schedule / webhook / manual) | Runs open the thread the same way any thread opens — no new thread viewer. |
| Command palette | "Go to Automations", "New automation", "Run automation…" (fuzzy over enabled automations) | `apps/web/src/components/CommandPalette.tsx:2016` navigates to `/pull-requests`; same shape. |
| Keybinding | `automations.open` in the keybinding id list; default chord left to maintainers | ids live in `packages/contracts/src/keybindings.ts` (e.g. `:75 "commandPalette.toggle"`); Settings → Keybindings already edits them (`routes/settings.keybindings.tsx`). |
| Settings | **No** dedicated settings page in v1. Automations are data, not settings. Only the per-environment "Automations" toggle (enable scheduler) if remote-admin scoping needs it — OPEN. | Settings nav is `apps/web/src/components/settings/SettingsSidebarNav.tsx`; `settings.integrations.tsx` exists for the Connections/Integrations track. |
| Chat header | Badge "Started by automation <name>" on threads that came from `automation.fired`; links back to the automation detail. | Reverse navigation is the "way to see it" (AGENTS.md reverse states). |
| Desktop | Wraps web; nothing extra. Desktop-as-host is where the scheduler and webhook ingress actually run — the desktop app must keep the server alive (already true when acting as host, AGENTS.md "Multi-surface"). Webhooks to a laptop are only reachable through Connect (§4.3). | |

### 4.2 Mobile (`apps/mobile`) — decision

**Read-only in v1: list + enable/disable + run-now + open run thread. No editor.** `apps/mobile/src/features/` has `threads`, `projects`, `settings`, `review`, `archive`… and **no** pull-requests feature, so a T3 list surface shipping web-first has precedent. Enable/disable and run-now are single commands over the same `orchestration.dispatchCommand`; the editor (RRULE builder, prompt composer, webhook secret display) is deferred. Screen registration goes through `apps/mobile/src/Stack.tsx` (pathname-driven, `:516-521`) — OPEN: exact registration idiom not read in this pass.

### 4.3 Connection modes: local, remote/relay, T3 Connect

- **Local and remote (tailnet/relay) clients**: all automation UI goes over the existing WS (`orchestration.dispatchCommand`, `subscribeShell`), so remote clients get it for free. Nothing runs on the client; a phone toggling an automation works because the *environment* owns the scheduler.
- **Scheduler**: runs wherever the server runs. If the environment is a laptop that sleeps, schedules are missed → catch-up policy §3.2. The list view should show "environment offline" using the existing environment connection state rather than pretending the schedule is live.
- **Webhook ingress through T3 Connect**: the relay must forward an **unauthenticated inbound HTTP POST** to the environment's `/api/automations/webhooks/:token`. What is known: `apps/server/src/relay/` contains only `AgentAwarenessRelay.ts`, and the Connect-side HTTP code in `apps/server/src/cloud/http.ts` handles environment link proofs (`:427-440`, requires `AuthRelayWriteScope` and rejects forwarded-authority headers) — i.e. today's managed endpoint is built around *authenticated* environment traffic; whether the relay forwards arbitrary unauthenticated inbound POSTs was **not established here — OPEN**. Two shapes to decide (OPEN): (a) Connect exposes a public `https://<env>.connect.t3.codes/api/automations/webhooks/:token` and forwards verbatim; (b) Connect receives webhooks itself, stores the last N for offline environments, and replays on reconnect. (a) is the smallest model; (b) is what makes "GitHub → laptop" actually reliable. Recommend (a) for v1 and state the limitation in user docs.
- **Multi-device**: two clients editing the same automation → last write wins via `automation.update` events; the shell subscription pushes the result to both. Same as thread meta today.

## 5. Reverse states (every door has a way out and a way to see it)

| Way in | Way out | Way to see it |
|---|---|---|
| `automation.enable` | `automation.disable` | switch in list + detail; disabled rows dim; scheduler ignores disabled (decider emits `run-skipped {reason:"disabled"}` if a webhook still arrives) |
| `automation.create` | `automation.delete` (soft, `deletedAt`) → `automation.restore` | "Deleted" filter in list, like `settings.archived.tsx` for threads; hard purge deferred |
| `automation.run` / fire | `automation.run.cancel` → existing `thread.turn.interrupt` (`orchestration.ts:1328`), thread remains and can be archived with `thread.archive` (`:1117`) | run row state `interrupted` (`:654`) |
| webhook secret shown once | `automation.webhook.rotate-secret` | `rotatedAt` on the trigger; old secret rejected immediately |
| worktree created per run | existing thread deletion/worktree cleanup path (not audited here — OPEN) | thread `worktreePath` (`:781`) |
| `nextFireAt` shown | recompute on every `automation.*` event and every tick | list column |

## 6. Explicit non-goals for v1

- Triggers other than `schedule`, `webhook`, `manual`: GitHub/Slack/Linear/Jira/Pylon events, `code_scan:finding`. They depend on the Connections/Integrations track (Devin `settings/connections`; T3 `routes/settings.integrations.tsx`, `settings.connections.tsx`) and on inbound event plumbing that is REMOTE/UNKNOWN in Devin. Later they become new `AutomationTrigger` union members; the firing path (§3.3) does not change.
- Conditions (OR-of-ANDs `Condition[][]`), reply modes (`post_response`/`attach_thread`/`notify_thread`), `slack_*`, `linear_tools_enabled`.
- Actions other than `start-thread`: `message_session` (cheap later — same command on an existing thread), `monitor_session`, `triage_session`, `incident_session`, `remediate_finding`, `scan_new_commits`, `notify`.
- Queueing (`max_queue_depth`), rate windows (`invocation_limit_window_seconds`), ACU metering/consumption, issue clustering, scratchpad bundles, templates, tags, on-call/responders, Preflight as a separate sandboxed runner (use the project setup script), an agent-facing `automation.*` MCP tool, multi-project automations, multi-repo threads.
- A REST façade compatible with Devin's `/automations` API. T3 clients speak WS commands; only the webhook ingress is HTTP.

## 7. Open questions

1. **Aggregate placement** — third `OrchestrationAggregateKind` inside the existing engine (one decider, one event log, one shell snapshot; recommended) vs. a separate `automations` engine/table like `pullRequest/` has its own services. The former keeps "run history is a projection" trivial because `automation.fired` and `thread.*` events share a log.
2. **Thread back-reference** — add `origin` to `OrchestrationThread` (`orchestration.ts:773`) or derive from `automation.fired {threadId}` only. Derivation avoids a thread schema migration; the badge in the chat header then needs the automations projection in scope.
3. **Missed-schedule policy** — "at most one catch-up" (§3.2) vs. "skip all missed". Needs a maintainer call; both must be visible in the run list.
4. **T3 Connect inbound HTTP** — does the tunnel forward arbitrary unauthenticated `/api/...` POSTs today? Not audited here (only `relay/AgentAwarenessRelay.ts` exists server-side). This determines whether webhooks work for laptop hosts at all.
5. **Notifications** — should a finished/failed automation run reuse the existing turn-completion notification path? Devin has `notify{when}`; T3's notification wiring was not audited in this pass.
6. **Worktree lifecycle** for `per-run` runs: reuse existing worktree cleanup on thread delete/archive (path not read here) or add an `Automation.keepWorktrees` knob. Default proposal: per-run worktree on, cleanup follows the thread.
7. **Permissions/runtime mode default** — automations run unattended; should `runtimeMode` be forced to a non-interactive policy (approval requests would otherwise stall a headless run until a human opens the thread)? `ProviderApprovalPolicy` includes `"never"` (`orchestration.ts:46-51`). Recommend: editor defaults to the least-interactive mode and warns if an interactive one is chosen.
8. **Mobile editor** — deferred (§4.2); confirm read-only + toggles is acceptable for a first release.
9. **Provider decision per adapter** — AGENTS.md asks for a decision per provider. Proposal: no adapter changes at all, since firing is a normal `thread.turn.start`; the only per-provider question is (7).

## 8. Evidence appendix

### T3 Code (PROVEN by read, `/Users/irene/a3-code`)

| Claim | Citation |
|---|---|
| Glossary definitions Environment/Project/Worktree/Thread/Turn; Command/Event/Decider/Projector/Reactor/Command receipt/Runtime receipt; Session | `docs/internals/glossary.md:7-34` |
| WS method names for orchestration | `packages/contracts/src/orchestration.ts:35-44` |
| `ProviderApprovalPolicy` literals incl. `"never"` | `orchestration.ts:46-51` |
| `OrchestrationLatestTurnState` = running/interrupted/completed/error; `OrchestrationLatestTurn` | `orchestration.ts:652-668` |
| `OrchestrationThread` shape (`projectId`, `worktreePath`, `latestTurn`, `archivedAt`, `settled*`) | `orchestration.ts:773-800` |
| `OrchestrationProjectShell` (`workspaceRoot`, `defaultModelSelection`, `scripts`) | `orchestration.ts:843-857` |
| Command literals `thread.create` / `archive` / `unarchive` / `snooze` / `unsnooze` / `turn.start` / `turn.interrupt` / `session.stop` | `orchestration.ts:1094,1117,1123,1153,1163,1286,1328,1381` |
| `ThreadTurnStartBootstrap{createThread, prepareWorktree, runSetupScript}` and `ThreadTurnStartCommand` | `orchestration.ts:1258-1306` |
| Client vs Internal command unions | `orchestration.ts:1393-1652` |
| `OrchestrationAggregateKind = ["project","thread"]`, `ActorKind = client|server|provider` | `orchestration.ts:1690-1692` |
| `EventBaseFields` and past-tense event literals (`thread.turn-start-requested`, `thread.turn-diff-completed`) | `orchestration.ts:1987-1995, 2107, 2152` |
| Entity ids via `makeEntityId` | `packages/contracts/src/baseSchemas.ts:108-114` |
| `Rpc.make(WS_METHODS.x)` / `RpcGroup` declaration style; `WS_METHODS` | `packages/contracts/src/rpc.ts:3,275,445-518` |
| Existing `previewAutomation.ts` (name clash) | `packages/contracts/src/previewAutomation.ts` |
| Reactor idiom: `make = Effect.gen`, subscribe to domain events, `engine.dispatch`, `layer = Layer.effect` | `apps/server/src/orchestration/ThreadSettlementReactor.ts:81,129,332-334,360` |
| Deterministic server command ids and one-minute cadence | `apps/server/src/orchestration/PullRequestSyncReactor.ts:210-224,327`; `ThreadPullRequestReactor.ts:362` |
| No cron/webhook/RRULE code in server (search `cron|schedule|webhook|setInterval`) | hits only: `sourceControl/SourceControlRepositoryService.ts:375` (retry), `preview/PortScanner.ts:584` (poll), `server.ts:756-760` (backoff), PR reactors above |
| HTTP layer is a single file with `/api/observability/v1/traces` proxy and static serving | `apps/server/src/http.ts:51,549` |
| Relay directory contents | `apps/server/src/relay/AgentAwarenessRelay.ts` (only module) |
| Auth guard, MCP toolkit, OAuth-adjacent modules | `apps/server/src/auth/EnvironmentAuth.ts`, `apps/server/src/mcp/McpDeviceToolkit.test.ts`, `apps/server/src/persistence/AuthSessions.ts`, `apps/server/src/sourceControl/ForgejoCli.ts` |
| Sidebar nav entry for Pull Requests | `apps/web/src/components/sidebar/SidebarChrome.tsx:143-161` |
| Command palette navigation to `/pull-requests` | `apps/web/src/components/CommandPalette.tsx:722,736,2016` |
| File routes incl. `_chat.pull-requests.tsx`, `settings.integrations.tsx`, `settings.connections.tsx`, `settings.keybindings.tsx`, `settings.archived.tsx` | `apps/web/src/routes/` |
| Settings nav component | `apps/web/src/components/settings/SettingsSidebarNav.tsx` |
| Keybinding id list | `packages/contracts/src/keybindings.ts:75` |
| Mobile features (no pull-requests feature) and pathname-driven Stack | `apps/mobile/src/features/`, `apps/mobile/src/Stack.tsx:516-521` |

### Devin (PROVEN in prior decompilation)

| Claim | Citation |
|---|---|
| `Automation`, `Trigger`, `Condition`, `Reply`, action union, limits | `DEVIN_AUTOMATIONS_DECOMPILED_SPEC.md:205-300` |
| Normalization rules (`_webhook_*`, OR-of-ANDs) | `…SPEC.md:283-300` |
| Org API table incl. `/trigger`, `/invocations`, `/events`, `/webhook/regenerate-secret`, code-step | `…SPEC.md:320-345` |
| Query keys keyed by `orgId` | `…SPEC.md:347-362` |
| Automations orchestration server-side; no scheduler/RRULE evaluator/prompts in client | `DEVIN_CLIENT_VS_SERVER_FEASIBILITY_AUDIT.md` §0, §2, §7, §8 |
