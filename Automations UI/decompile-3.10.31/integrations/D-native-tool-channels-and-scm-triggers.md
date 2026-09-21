# D — Native tool channels (Slack / Linear / Pylon) and SCM triggers — Devin 3.10.31

Companion to `A-provider-registry-and-api.md` (registry, endpoint families), `B-oauth-and-connection-lifecycle.md` (OAuth/connect/disconnect), and `C-agent-consumption-custom-connections-and-shell.md` (per-Devin tool-access fields `slack_tool_channels`, `slack_dm_scope`, `slack_reply_access`, `slack_bot_name`, `slack_bot_icon_url`, `linear_tools_enabled`, trigger event lists, bot-icon upload). This document covers only what those do not: the **org-level Slack channel policy** (default access, thread mode, channel→org mapping), the **Linear and Pylon native-tool/trigger settings pages**, the **SCM (GitHub) PR-review OAuth hop**, and the internal **GitHub rate-limits admin page**.

Citations are `chunk.js:line` into `_work/integrations/formatted/` (oxfmt-formatted copies of the captured `app.devin.ai` chunks from 2026-09-20). `app-initial-*` citations are to the minified chunk (single line; symbol quoted instead).

## What this proves (summary)

**PROVEN.** Slack has an org-wide `slack_default_access` policy `{mode: none|all_public|specific, channels: string[], dm_scope: disabled|org_members|workspace}` and a `slack_thread_mode {enabled, dedicated_channel_id|null}` policy, both mutated from the Slack settings page and both overridable per-automation ("Individual automations can override this setting"). Security profiles can lock `channel_access` and `dm_scope`, in which case the selects render read-only with a "set by security profile" tooltip. Slack channels can be mapped to Devin organizations via `GET/POST {org}/integrations/slack/channel-preferences`. Linear's settings page exposes a trigger-option select (`all_new_issues` | status name | `direct_mentions`), a `bot_allowlist`, and a banner stating that the Linear connection provides **native Linear tools so no Linear MCP is needed**. Pylon exposes `email_matching_enabled`, `ask_only_fallback_enabled`, a security-profile selection, and mandatory organization routing. GitHub PR review has a dedicated OAuth bounce route that calls `GET integrations/github/pr-review-start-oauth` and redirects to the returned `url`. The GitHub rate-limits page is an **internal admin dashboard** (`/admin/system-metrics/github-rate-limits`) fed by Datadog, not a user feature.

**REMOTE/UNKNOWN.** How `slack_default_access` is enforced against the Slack API at runtime, how thread mode chooses between "in-thread" and "dedicated channel" per message, the Linear trigger-evaluation engine, Pylon webhook ingestion, and the GitHub OAuth app scopes all live on the server.

## 1. Slack — org-level channel policy

### 1.1 Default Access (`slack_default_access`)

| Field      | Values                                     | Default                         | UI label / options                                                                                                                                       | Evidence                                  |
| ---------- | ------------------------------------------ | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| `mode`     | `none` \| `all_public` \| `specific`       | `none`                          | "Channel access": Off / All public channels; when server-set to `specific` the select shows only the locked `settings.slackChannelAccessSpecific` option | PROVEN slack-C0jqZMpp.js:1689, :1746-1760 |
| `channels` | `string[]` (Slack channel IDs)             | `[]` on any mode change from UI | not editable from this page (UI always writes `channels: []`)                                                                                            | PROVEN :1707-1712                         |
| `dm_scope` | `disabled` \| `org_members` \| `workspace` | `disabled`                      | "Direct messages": Off / Organization members (enterprise, `isEnterprise` flag `r`) / Anyone in workspace (non-enterprise)                               | PROVEN :1691, :1781-1792                  |

- The mutation writes the whole object at once (`{mode, channels, dm_scope}`) to the org store field `slack_default_access` (PROVEN :440-452, :1707-1716).
- **DERIVED.** `specific` is never selectable from the UI; it is displayed read-only when the org already has that mode — so the specific-channel list is set elsewhere (server/security profile), REMOTE.
- Security profile overlay: if the org's effective profile (`l`) has `channel_access {mode}` or `dm_scope` non-null, the corresponding select is disabled and its tooltip is `settings.slackSetBySecurityProfile {name: channel_profile_name | dm_profile_name | profile_name}` (PROVEN :1692-1704, :1750, :1795). Notice copy keys `settings.slackSetBySecurityProfileNotice/Description` (:1815, :1820).
- Permission gate: `ManageChatIntegrations` (PROVEN :1736, :1777).
- Copy (PROVEN :1730-1739, :1773-1774):
  - "Default Access" (section title)
  - "Whether new Devin sessions can read and post in public Slack channels Devin has joined" — enterprise variant appends "that are mapped to their organization"
  - Tooltip: "Individual automations can override this setting"
  - "Who new Devin sessions can send direct messages to" — enterprise variant appends ". Enterprise sessions can only message members of their organization"

**Relation to per-Devin fields (doc C).** `slack_tool_channels` / `slack_dm_scope` on an automation are the per-automation override of this org default. PROJECTED: the effective policy for a session is `automation.slack_tool_channels ?? org.slack_default_access` (the tooltip proves override exists; the merge rule is REMOTE).

### 1.2 Thread mode (`slack_thread_mode`)

| Field                  | Values                     | UI                                                                                                                            | Evidence                             |
| ---------------------- | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| `enabled`              | boolean                    | select "Thread mode": `new` → "Create new thread" (`enabled=false`), `in_thread` → "In-thread" (`enabled=true`)               | PROVEN :1608-1618, mutation :456-482 |
| `dedicated_channel_id` | Slack channel id \| `null` | Shown **only when `enabled=false`** ("Create new thread"). Combobox "Select Slack channel", value `use_same_channel` ⇔ `null` | PROVEN :1591, :1620-1640             |

Dedicated-channel picker option groups (PROVEN :1560-1585):

1. "The channel it was tagged" → `use_same_channel` / "Same channel as tag"
2. "Recommended" → channels whose name contains `devin` (filter at :1526-1560, query key `['slack-channels', orgId]`)
3. One group per workspace (`workspace_name` label, omitted when only one workspace), channels sorted by name, excluding already-listed ids, rendered as `#name`.
4. If the stored `dedicated_channel_id` is not in the loaded list it is appended as a raw id (label "Loading…" while fetching) (PROVEN :1586-1590).

**DERIVED semantics.** "In-thread" = Devin replies inside the thread it was tagged in. "Create new thread" = Devin opens a new thread, either in the tagging channel (`null`) or in a fixed dedicated channel. Section title i18n key `settings.threads` (:1595).

### 1.3 Channel → organization mapping (enterprise)

- Endpoints inline in the chunk: `GET {org}/integrations/slack/channel-preferences`, `POST {org}/integrations/slack/channel-preferences` (PROVEN :578-590; only HTTP calls made directly by this chunk).
- Copy (PROVEN :800-1080): "Map Slack channels to Devin organizations", "Sessions started from a channel run in its mapped organization, using that organization's settings and connections.", table headers "Slack channel" / "Devin organization", "New mapping", "Remove mapping", "Save channel mappings", empty state 'No channel mappings defined. Click "New mapping" to add one.', fallback "Use channel ID " (manual id entry when channel resolve fails :765-772, :983).
- Save toasts: "Channel preferences saved successfully" / "…saved with join warnings" / "Failed to save channel preferences" (PROVEN :619-638). PROJECTED: POST response carries a join-warnings list (bot could not join some channels).

### 1.4 Other Slack page sections (pointers only)

| Section                     | Copy / behaviour                                                                                                                                                                                                                                                                                                 | Evidence                                |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| GitHub notification channel | "Notifications", "Select GitHub notification channel"; toast "Failed to update GitHub notification channel"                                                                                                                                                                                                      | PROVEN :239-300                         |
| Enterprise Grid             | "Connect Slack Enterprise Grid" / "A Slack Org Owner must install to the entire organization"; migrate confirm "Migrate to Slack Enterprise Grid? … enable multi-workspace support"; `GET slack/can-migrate`, `POST slack/complete-migration`, `POST slack/workspaces/refresh` (endpoint-methods.txt:62,119,120) | PROVEN :1176-1179, :1421-1449, :490-563 |
| Workspace authorization     | "Workspace not authorized" / "Authorize now"; `GET slack/workspaces/{id}/authorization`                                                                                                                                                                                                                          | PROVEN :1371-1388                       |
| Health banners              | "Slack connection is broken. Devin can no longer receive Slack messages. Re-authorize to restore mentions and automations." and "Permissions update required." → "Re-authorize"                                                                                                                                  | PROVEN :1471-1518                       |
| Disconnect                  | "Are you sure you want to disconnect your Slack integration? This will remove all Slack functionality from Devin."                                                                                                                                                                                               | PROVEN :416-417                         |

Bot identity (`slack_bot_name`, `slack_bot_icon_url`, reply access `slack_reply_access`) is **not** configured on this page; it is per-Devin (doc C). Nothing in slack-C0jqZMpp sets those fields (PROVEN by absence: no matches for `bot_name|bot_icon|reply_access` in the chunk).

## 2. Linear — native tools and trigger settings

### 2.1 Native tool enablement

- PROVEN linear-SXExP7cj.js:2634-2645: once connected (`g`), an info callout titled **"MCP access included"** reads: "This integration gives Devin native Linear tools, so you don't need to install the Linear MCP separately." with a link "Learn more about Linear MCP capabilities" → `https://linear.app/docs/mcp`.
- **DERIVED.** There is no per-org on/off toggle for Linear tools on this page; enablement is implied by the connection existing. The per-Devin `linear_tools_enabled` flag (doc C) is the only client-side switch.
- Org config read via `GET {org}/integrations/linear/config`; mappings via `PUT linear/mappings` and `PUT linear/team-mappings` (endpoint-methods.txt:66,132,133). Config payload shape is PROJECTED from the fields the page writes: `{ default_playbook_id, bot_allowlist: [{id,name}], ... }` (:1442-1455).

### 2.2 Trigger option select (`In` component)

PROVEN :200-220. Options built from `workflow_states` (`GET linear/workflow_states`, endpoint-methods.txt:49`):

| value             | label                  | note                                                                    |
| ----------------- | ---------------------- | ----------------------------------------------------------------------- |
| `all_new_issues`  | "All new issues"       |                                                                         |
| `<state name>`    | `On Status "<name>"`   | one per distinct state name whose `type ∈ {backlog, unstarted, triage}` |
| `direct_mentions` | "Direct mentions only" |                                                                         |

Placeholder "Select Trigger Option", aria "Select trigger option". PROJECTED: the value is stored in the team-mapping row (`PUT linear/team-mappings`), since the select is rendered per mapping. "Enable Default Mapping" toggle at :799.

### 2.3 Scoping triggers and allowed bots

- "Devin scoping triggers" / "Devin always triggers when you mention @Devin" (PROVEN :992-998, :1316-1320); option "Posts a scoping summary in the Linear agent session" (:1409). DERIVED: scoping = Devin's Linear Agent Session integration, distinct from the create-session triggers above.
- "Allowed bots" — "Choose which Linear bots can start Devin sessions"; add/remove writes `bot_allowlist: [{id, name}]` in the config payload (PROVEN :1440-1470). Bot list from `GET linear/bot-users` (endpoint-methods.txt:41). Empty states "No bots currently allowed." / "No bots available" (:1467, :1537).
- Playbook triggers: "Trigger a playbook when team, label, and status conditions are matched." (:2239) — the automations-side rule set is covered in doc C / the automations track.

## 3. Pylon — native trigger settings

Page pylon-DskKqLNF.js. Connect copy: "Connect Pylon to automate support workflows with Devin." (PROVEN :188). Disconnect confirm: "…This will remove all Pylon automation triggers from Devin." (:255-256). Status via `GET {org}/integrations/pylon/status`; config via `PUT pylon/config`; profile via `PUT pylon/security-profile`; user-link via `GET pylon/user-link-url` / `DELETE pylon/user-link` (endpoint-methods.txt:67,135,136,59,8).

Config (`PUT pylon/config`, partial-merge `G({...})`), PROVEN :286-305:

| Field                       | Label                                                                                   | enabled label                   | disabled label               |
| --------------------------- | --------------------------------------------------------------------------------------- | ------------------------------- | ---------------------------- |
| `email_matching_enabled`    | "User matching" — "How Pylon senders are recognized as Devin users"                     | "Email or Pylon-connected user" | "Pylon-connected users only" |
| `ask_only_fallback_enabled` | "Ask without a Devin account" — "What happens when a Pylon sender has no Devin account" | "Can ask questions (read-only)" | "Rejected"                   |
| (automation triggers)       | i18n `pylon.automationTriggersLabel` (:305+)                                            |                                 |                              |

Security profile (PROVEN :399-430): "Control what sessions created from Pylon are allowed to do." — "Default security profile", "Applied to Pylon-delegated sessions. Pick a profile that limits network and tool access. Edit profiles in Security profiles"; payload `{security_profile_selection, security_profile_id}` with options "Use enterprise defaults" / "Use organization defaults" (:424-429).

Session routing (PROVEN :443-454): "Choose which organization Pylon sessions are created in." — "Required for accounts with multiple organizations; Pylon events are rejected until one is selected". DERIVED: Pylon is an account-level connection routed into one org, unlike Slack's per-channel mapping.

Pylon status page also lists issue statuses and tags (`GET pylon/issue-statuses`, `GET pylon/tags`) used by automation trigger conditions (REMOTE evaluation).

## 4. SCM (GitHub / GitLab) — trigger sources and PR-review OAuth

### 4.1 Trigger sources

The GitHub settings chunk (github-BiwNk-eu.js) contains **no trigger configuration**; SCM triggers (PR opened, review requested, mention, etc.) are automation trigger sources enumerated in doc C. What the GitHub page does own, in its "General" section (PROVEN :1752-1780):

- `github-repo-permissions` item (repo-level permission grants; `GET/POST/PATCH/DELETE {org}/integrations/git-permissions[/id]`, endpoint-methods.txt:22,95,87,1); copy "Allow users or roles to manage repository permissions for this connection." (:1197)
- `github-org-member-whitelist` item (enterprise-only, `Xe`)
- Link "Configure PR author" → `/settings/devin` (org) or `/settings/enterprise-devin` (enterprise) — i.e. PR-author identity is a Devin-settings concern, not a connection setting.
- GHES: "Register enterprise app" (`POST integrations/github/ghes/start-app-registration`, `GET ghes/app-configs`, `GET ghes/user-oauth-hosts`); PAT path: "Connect using a GitHub PAT. This will connect to all repositories accessible by the PAT…" (:206, `POST/PUT {org}/integrations/github/enterprise-pat`).
- GitLab mirrors: `GET gitlab/installation-url`, `POST gitlab/self-hosted/app-configs`, `PATCH gitlab/{id}/token/auto-rotation`, `POST gitlab/{id}/token/rotate`, `GET gitlab/webhook/{id}/token`, `POST gitlab/webhook/{id}/token/regenerate` (endpoint-methods.txt:25,125,88,98,26,99). DERIVED: GitLab (and Bitbucket/Azure DevOps) triggers arrive via a per-connection webhook token the client can view/regenerate; GitHub uses App installation webhooks (no token endpoint exists for GitHub).

### 4.2 PR-review OAuth bounce

Route `/_default/integrations/github/pr-review-oauth/` with search params `{owner, repo, pr_page_path, require_app_installation?}` (PROVEN pr-review-oauth-Csx51DC-.js:10-13). On mount (once, ref-guarded):

```
GET integrations/github/pr-review-start-oauth
  ?return_to=<pr_page_path>&pr_review_owner=<owner>&pr_review_repo=<repo>&require_app_installation=<bool>
→ { url }            → window.location.assign(url)
on error             → navigate({ to: pr_page_path })
```

(PROVEN :14-24; client fn `lr` in app-initial-CMo_DJKv.js, minified.) Sibling user-OAuth flow (`start-user-oauth`, `git/user-oauth/{provider}/start|status|complete`) is in doc B. DERIVED: this flow exists so a user landing on a PR-review page without personal GitHub auth is sent through OAuth and returned to the same PR page; `require_app_installation` additionally forces the Devin GitHub App to be installed on the repo owner. Scopes requested are REMOTE.

### 4.3 GitHub rate-limits page (internal admin)

Route `/admin/system-metrics/github-rate-limits` (PROVEN github-rate-limits-yrN3GL9s.js:103); query key `['github-rate-limits', window, lookup, …]` (:44). Copy: "GitHub API rate limits", "Rate limit metrics from Datadog enriched with account/org info from the database", "Open DD dashboard ↗", "Time window", "Filter visible rows…", lookup placeholder "Installation, account, organization ID or name", "No rate limit data found for this time window" (:101-257). Columns: Installation ID, GitHub account, Enterprise, Organizations, Remaining, Utilization % (:272-334); row fields `installation_id`, `resource`, `remaining`, `limit` (:75-90, :388). **DERIVED:** Cognition-staff tooling, not user-facing; irrelevant to a T3 reimplementation beyond noting that GitHub App installation rate limits are tracked per installation.

## 5. Endpoint table (this document's scope only)

All PROVEN from `_work/integrations/endpoint-methods.txt` (extracted from app-initial chunks) unless noted. `{org}` = organization id prefix.

| Method                | Path                                                                                                                                                   | Used by                     | Notes                                                                                         |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------- | --------------------------------------------------------------------------------------------- |
| GET                   | `{org}/integrations/slack/status`                                                                                                                      | Slack page                  | connection + `slack_default_access`, `slack_thread_mode` live in org store (PROJECTED source) |
| GET / POST            | `{org}/integrations/slack/channel-preferences`                                                                                                         | Slack channel→org mapping   | inline in slack chunk :578-590                                                                |
| GET                   | `{org}/integrations/slack/usergroups`                                                                                                                  | Slack                       | usergroup picker (reply access / mentions; consumer not in this chunk)                        |
| GET                   | `{org}/integrations/slack/can-migrate` · POST `slack/complete-migration` · POST `slack/workspaces/refresh` · GET `slack/workspaces/{id}/authorization` | Enterprise Grid             |                                                                                               |
| GET                   | `{org}/integrations/slack/authorize` · `slack/admin-authorize`                                                                                         | OAuth (doc B)               |                                                                                               |
| (react-query)         | `['slack-channels', orgId]`                                                                                                                            | dedicated-channel picker    | fetch fn resolved in app-initial; path REMOTE-side name unknown                               |
| GET                   | `{org}/integrations/linear/config` · `workflow_states` · `teams` · `labels` · `projects` · `members` · `bot-users` · `check-label-permissions`         | Linear page                 |                                                                                               |
| PUT                   | `{org}/integrations/linear/mappings` · `linear/team-mappings`                                                                                          | Linear trigger/mapping save | PROJECTED payload includes trigger option + `bot_allowlist`                                   |
| POST                  | `{org}/integrations/linear/disconnect`                                                                                                                 | Linear                      |                                                                                               |
| GET                   | `{org}/integrations/pylon/status` · `issue-statuses` · `tags` · `user-link-url` · `installation-url`                                                   | Pylon                       |                                                                                               |
| PUT                   | `{org}/integrations/pylon/config` · `pylon/security-profile`                                                                                           | Pylon settings              | fields §3                                                                                     |
| POST / DELETE         | `{org}/integrations/pylon/disconnect` · `pylon/user-link`                                                                                              | Pylon                       |                                                                                               |
| GET                   | `integrations/github/pr-review-start-oauth?return_to&pr_review_owner&pr_review_repo&require_app_installation`                                          | PR-review bounce            | returns `{url}`                                                                               |
| GET/POST/PATCH/DELETE | `{org}/integrations/git-permissions[/{id}]`                                                                                                            | GitHub repo permissions     |                                                                                               |
| POST / PUT            | `{org}/integrations/github/enterprise-pat`                                                                                                             | GHES PAT                    |                                                                                               |
| GET                   | `{org}/integrations/gitlab/webhook/{id}/token` · POST `…/regenerate` (same for bitbucket, azure-devops)                                                | SCM webhook trigger token   | GitHub has no equivalent (App webhooks)                                                       |
| (react-query)         | `['github-rate-limits', window, lookup]`                                                                                                               | admin page                  | internal                                                                                      |

## 6. T3 mapping (proposals)

Devin's model is org → connection → policy; T3's is environment → project → thread. Proposal, minimal:

| Devin concept                                                     | T3 proposal                                                                                                                                                                                                                                                                                                |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Org `slack_default_access` / `slack_thread_mode`                  | **Environment-level** connection settings in `packages/contracts` (`SlackConnectionPolicy {mode, channels, dmScope, threadMode: 'in_thread' \| {newThread: channelId \| null}}`), stored in server settings, edited in Settings → Connections → Slack. One environment = one Slack install.                |
| Per-automation override (`slack_tool_channels`, `slack_dm_scope`) | Optional override on the automation record (automations track); resolution `automation ?? environment` done in the automation reactor before spawning the thread.                                                                                                                                          |
| Security-profile lock                                             | Skip. T3 has no security profiles; YAGNI.                                                                                                                                                                                                                                                                  |
| Channel → org mapping                                             | Skip for single-environment. If ever needed, map channel → project (thread is created in that project).                                                                                                                                                                                                    |
| Linear "native tools included"                                    | T3 already speaks MCP per provider; the honest equivalent is "connecting Linear auto-registers the Linear MCP server for every provider adapter" rather than a bespoke native tool set. Needs a per-adapter decision (Claude/Codex/Cursor/OpenCode support MCP config injection; verify Grok/Antigravity). |
| Linear trigger option / `bot_allowlist`, Pylon config             | Automation trigger-source config, owned by the automations track; store as JSON on the trigger, evaluate in a reactor fed by the webhook receiver.                                                                                                                                                         |
| PR-review OAuth bounce                                            | Not needed: T3 uses the user's own `gh` auth on the environment. Personal-vs-app identity is moot locally.                                                                                                                                                                                                 |
| GitHub rate-limits admin page                                     | Not applicable.                                                                                                                                                                                                                                                                                            |

## 7. Gaps / REMOTE-UNKNOWN

- Wire format of `slack_default_access.channels` when `mode=specific` and who sets it.
- The fetch path behind `['slack-channels', orgId]` and whether it includes private channels.
- Runtime semantics of thread mode (per-message decision) and of `slack_reply_access`.
- Linear config full schema (only `default_playbook_id`, `bot_allowlist` observed being written).
- GitHub PR-review OAuth scopes and callback handling (server).
- `pylon.automationTriggersLabel` section body beyond the label key (not expanded; belongs to automations track).

## 8. Evidence appendix

| Claim                                                        | Citation                                                                      |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| slack_default_access mutation                                | slack-C0jqZMpp.js:440-452                                                     |
| slack_thread_mode mutation `{dedicated_channel_id, enabled}` | slack-C0jqZMpp.js:456-482                                                     |
| channel-preferences GET/POST                                 | slack-C0jqZMpp.js:578-590                                                     |
| channel mapping UI + copy                                    | slack-C0jqZMpp.js:800-1080                                                    |
| channels query key, `devin` recommended filter               | slack-C0jqZMpp.js:1526-1560                                                   |
| dedicated channel option groups                              | slack-C0jqZMpp.js:1560-1590                                                   |
| Thread mode select                                           | slack-C0jqZMpp.js:1595-1640                                                   |
| Default Access defaults, profile lock, copy, selects         | slack-C0jqZMpp.js:1689-1796                                                   |
| Slack health banners                                         | slack-C0jqZMpp.js:1471-1518                                                   |
| Linear trigger option select                                 | linear-SXExP7cj.js:200-220                                                    |
| Linear scoping trigger copy                                  | linear-SXExP7cj.js:992-998, 1316-1320, 1409                                   |
| Linear bot_allowlist                                         | linear-SXExP7cj.js:1440-1470                                                  |
| Linear "MCP access included"                                 | linear-SXExP7cj.js:2634-2645                                                  |
| Pylon config toggles                                         | pylon-DskKqLNF.js:286-305                                                     |
| Pylon security profile                                       | pylon-DskKqLNF.js:399-430                                                     |
| Pylon session routing                                        | pylon-DskKqLNF.js:443-454                                                     |
| GitHub General section, Configure PR author                  | github-BiwNk-eu.js:1752-1780                                                  |
| GitHub PAT copy                                              | github-BiwNk-eu.js:206, 214                                                   |
| PR-review OAuth route + call                                 | pr-review-oauth-Csx51DC-.js:10-24; `lr` in app-initial-CMo_DJKv.js (minified) |
| Rate-limits route, copy, columns                             | github-rate-limits-yrN3GL9s.js:44, 75-90, 101-334                             |
| Endpoint catalogue                                           | _work/integrations/endpoint-methods.txt                                       |
