# README — Automations mockups (Task B)

Files in this folder from Task B: `02-automations-list.html`, `03-automation-editor.html`, `04-automation-detail-runs.html`. They depend on Task A's `t3-tokens.css` (linked) and reuse the `t3-shell.html` sidebar + SVG sprite verbatim, with the Automations nav item in its active state (from `01-sidebar-automations-tab.html:288-291`). Light by default (`<html class="light">`); the sun button in the top bar toggles `.dark`. No JS beyond that toggle, no network requests (the only `https://` strings are the example webhook URL in the editor's copy), no continuous animations (the only keyframe is T3's duty-cycled `t3-status-pulse` on running dots, reduced-motion aware).

Content is grounded in the 3.8.20/3.10.31 decompilation (`DEVIN_AUTOMATIONS_DECOMPILED_SPEC.md`, cited as "spec §n") and structured after the v1 proposal in `../automations/B-t3-code-mapping-proposal.md` (cited as "mapping §n"): triggers are schedule / webhook / manual only, one project per automation, and **a run is the thread it created**.

## 1. Mapping: mockup → Devin screen

| Mockup | Devin screen (spec) | What was kept | What changed for T3 |
|---|---|---|---|
| `02` header + toolbar | `AutomationsPage` (§6.1): "Automations" / "Bring Devin into your recurring and event-driven workflows"; tabs `All <n>` / `Created by you <n>`; ⌘F search; metadata filter; `Create automation` split → Generate with Devin / Manual / Template | Title, subtitle wording (product name dropped), split button, three creation paths | "Created by you" is meaningless in a single-user environment → tabs are All / Enabled / Disabled. Metadata filter → project + trigger selects. "Generate with agent" shown disabled ("later") |
| `02` table | `AutomationListTable` (§6.4): Name (icon, name, badges, subtitle) · Last 30 days (91×20 sparkline) · Last triggered; `Disabled` badge; main page hides actions | Column names, sparkline size and flat-centerline rule, `Disabled` badge, em dash for never, relative time | Added Trigger, Project, Enabled switch, Last run status badge, row overflow (Devin has the menu on the detail page only, §17.5) |
| `02` empty variant | §6.5 entry cards: Generate with Devin ("Most popular") / Manual / Template ("Less common"), plus Suggested templates (§7) with All + 4 categories; `No automations yet` | Three-card grid, template strip with category tabs, "No automations yet" | Manual is the highlighted card; Generate is a disabled stub |
| `02` right slot | — | — | Environment panel: scheduler live, next fire, webhook base path, offline warning (mapping §4.3) |
| `03` frame | `AutomationEditorPage` (§8.1-8.2): centered max-w 800, sticky Cancel + Create/Update, order Name → Triggers → Agent definition → Notifications → Advanced; 38px/17px name input; "Discard unsaved changes?" guard (§8.3) | All of the above | Sticky bar shows dirty state text; right slot holds a live summary + validation list |
| `03` trigger | §9.1 Add-trigger picker with many sources; §9.4 schedule presets hourly/daily/weekly/custom/one-time, 5-minute steps, IANA tz list, RRULE popover Visual/RRULE with placeholder `FREQ=WEEKLY;BYDAY=MO;BYHOUR=9;BYMINUTE=0` + UTC hint + Apply; §9.5 webhook minted credentials, plaintext secret once, `X-Webhook-Secret` / `Authorization: Bearer` / `secret` query, cURL template, `Payload filter` regex | Presets, hour/minute/tz controls, RRULE textarea and copy, webhook secret/URL/curl/regex, "shown once" | Picker → segmented Schedule / Webhook / Manual (v1 has exactly one trigger). Manual is a first-class kind (Devin: run-now endpoint only). URL becomes `/api/automations/webhooks/:token` |
| `03` conditions | §9.3 OR-of-ANDs `Condition{field,operator,value}` groups per trigger card | Group / AND / OR structure, add condition / add group | Marked "deferred in v1" (mapping §6) |
| `03` action | §10 Agent definition: `start_session{prompt, repos, playbook_id}`, prompt editor with mention hydration (§10.3); §13.1 Child sessions switch with exact copy | Prompt textarea with `@repo` / `@playbook` mentions, child-sessions row copy verbatim | Repos → single Target project; added Provider & model, Workspace (worktree per run), Approval policy (mapping §7 Q7) |
| `03` notifications | §12: "Alert when the automation run completes", Add notification, email `when` ∈ Always / On failure / On success + Remove; Slack destination "Post agent response to <channel>" / "Post session updates" | Header copy, timing select, Remove, Slack wording | Added Desktop/mobile push (T3 turn-completion path); Slack marked "needs Connections" |
| `03` advanced | §13.5 Preflight code step (runtime Python/Node/Bash, timeout 1..300 default 60, env Minimal/snapshot, `$EVENT_FILE $STATE_FILE $LAST_RUN_FILE $OUTPUT_FILE`, `{run:true}` / `{run:false,reason}` / `{items}`, 64KB state, 10/50 items, Clear State); §13.7 Limits (rate count + window 15m…7d, ACU spend); §13.8 Queueing (Concurrent runs, Queue depth, help text) | Runtime/timeout/env controls, contract copy, Clear State, rate window list, concurrency/queue fields and help | ACU spend → "not applicable" line; v1 note that queue → skipped |
| `04` header | `AutomationViewPage` (§17.2): Edit · Improve with Devin · Run automation · overflow; status icon + Active/Inactive; "Created by / Last updated by" line; §17.5 overflow View sessions / View errors / Disable / Duplicate / Delete | Button order and variants, status badge, origin line, overflow items | "Improve" disabled (needs agent-driven creation, non-goal); "View sessions" → "View threads" |
| `04` summary cards | §17.6 read-only Triggers + Instructions (prompt verbatim, whitespace preserved, no markdown) | Both cards | Added four KPI tiles (trigger, next run, 4-week count/rate, limits) |
| `04` history | §18.1 tabs Events / Consumption, range Last week / Last 4 weeks / Custom; §18.2 stacked chart, "27 events · 93% success rate"; §18.3 events table, status menu Queued Running Succeeded Failed Skipped Canceled, current-page search, `{from}–{to} of {total}` | Range menu, status list, chart summary line, pagination copy, legend merge (Skipped, In progress) | Consumption tab dropped (no metering) → Runs / Errors. Rows link to the thread; Skipped rows show the preflight reason |
| `04` right slot | §18.4 Preflight run modal; `/error-logs` route | Preflight output block | Selected run in the `t3-details` slot: thread link card, worktree, turn state, log tail, Re-run |
| `04` dialog | §17.4 Run dialog: "Manually run automation now. Please provide context that will be included as additional context for this run." / placeholder "i.e. provide context for this run" / Cancel · Run; success "Automation triggered" | Copy verbatim | Success copy says "run history" instead of "events history" |

## 2. T3 components mirrored

All classes come from `t3-tokens.css` (see `README-tokens.md` for the `apps/web/src` file:line map). Page-local styles live in each file's `<style>` block under an `am-` prefix and only compose tokens.

| Used in mockups | T3 class | T3 source (via README-tokens) |
|---|---|---|
| Sidebar, active Automations item, badge | `.t3-sidebar…`, `.t3-nav-item.is-active`, `.t3-nav-badge` | AppSidebarLayout / SidebarChrome / new nav item |
| Top bar with breadcrumb | `.t3-topbar .crumb` | `--workspace-topbar-height`, toolbar tokens |
| Buttons (primary/secondary/ghost/icon/sm, disabled) | `.t3-btn` | ui/button.tsx |
| Status badges (Succeeded/Running/Failed/Skipped/Canceled/Queued, Disabled, Active) | `.t3-badge` + `.t3-dot` | ui/badge.tsx, `animate-status-pulse` |
| Enabled switches, Preflight/Limits/Queueing/Child-sessions toggles | `.t3-switch(.on)` | ui/switch.tsx |
| All / Enabled / Disabled, Schedule / Webhook / Manual, Visual / RRULE, Runs / Errors | `.t3-tabs .t3-tab` | toggle-group / RightPanelTabs segmented pattern |
| Inputs, selects, textareas, labels, help | `.t3-input .t3-select .t3-textarea .t3-field .t3-label .t3-help` | ui/input, select, textarea |
| List and runs tables | `.t3-table` (+`tr.is-selected`) | ui/table.tsx |
| Cards (trigger, action, notifications, advanced, entry, template), KPI panels | `.t3-card > .head/.body`, `.t3-panel` | dialog-styles / select popup |
| Split-button and row overflow menus, run dialog | `.t3-popup .t3-menu-item(.destructive) .t3-separator` | ui/menu.tsx item h-7 |
| Empty state | `.t3-empty` | ui/empty.tsx |
| Project chips | `.t3-favicon` | Sidebar ProjectFavicon |
| Right slot | `.t3-details` with `dl` | Task A mockup convention |

Deliberate deviations from Devin's visuals: no 31-bucket gradient sparkline colors (uses `--info` stroke), no rounded-16px prompt panel (uses `.t3-card`), no Recharts — the activity chart is static stacked divs with T3 semantic colors.

## 3. Open design questions

1. **Segmented trigger vs. trigger list.** v1 has one trigger per automation, so a segmented control is the smallest model. If GitHub/Slack triggers arrive later (mapping §6) this becomes Devin's "Add trigger" card list; decide now whether to reserve the card-list layout to avoid a second redesign.
2. **Where the editor lives.** Full page (as mocked, Devin-like) vs. right-panel pane over the list (mapping §4.1 suggests either). The full page fits the 800px form; the pane fits "UI stays dumb" and keeps the list visible while editing.
3. **Runs = threads: which surface owns the run row?** The mockup opens the run in the `t3-details` slot with a link to the thread. Alternative: clicking a run navigates straight to the thread (no pane) and the thread header carries a "Started by automation" badge (mapping §4.1, Q2). Fewer surfaces, but loses preflight/skip visibility for runs that never created a thread.
4. **Queued state.** Devin has `queued`; the v1 proposal skips instead of queueing (mapping §3.6). The runs table shows both so the decision is visible; one must go.
5. **Manual as a trigger kind.** Devin models run-now as an endpoint, not a trigger. Making Manual a first-class kind means an automation can exist with no schedule and no webhook; is that desirable, or should "run manually" simply be always available and the segmented control have two options?
6. **Approval policy default for unattended runs** (mapping §7 Q7). The editor defaults to "Never ask" with a warning under interactive choices. Needs a maintainer call on whether a headless run may ever pause on approvals.
7. **Preflight fidelity.** Mocked with Devin's full contract (runtime, timeout, `$*_FILE`, Clear State). The mapping proposal maps Preflight to the project setup script, which has none of this. Either cut the card to a "run setup script" toggle for v1 or accept a small sandboxed step runner.
8. **Webhook URL through T3 Connect** (mapping §4.3 / Q4). The mocked URL uses a `connect.t3.codes` host; whether the tunnel forwards unauthenticated POSTs is unresolved. Until then the editor should show the LAN/tailnet URL and explain reachability.
9. **Notifications rows.** Push reuses turn-completion notifications; email and Slack need infrastructure T3 doesn't have (Slack depends on the Connections track). Decide whether v1 ships push only.
10. **Templates.** Mocked as a static strip; the proposal lists templates as a non-goal. Cheap if they are static JSON, but each template is also a copy-maintenance burden.
11. **Mobile.** Read-only list + toggles + run-now (mapping §4.2). None of these mockups render a mobile layout; the list table would need a card layout below ~720px.

## 4. Verification

- Tag balance: `python3 html.parser` walk with void/SVG elements accounted for — all three files OK.
- Rendered with headless Chrome at 1600×1000 and inspected once each (`_work/mockups/0{2,3,4}-*.png`); no overflow or clipped regions after fixing toolbar select widths and menu wrapping.
- Nothing under `apps/`, `packages/`, `docs/` was edited; no commits.
