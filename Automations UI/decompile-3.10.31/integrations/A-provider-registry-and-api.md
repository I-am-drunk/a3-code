# Integrations Task A — Provider registry, connection data model, API surface (Devin 3.10.31, app.devin.ai bundle 2026-09-20)

Evidence labels: **PROVEN** (cited `chunk.js:line` in `_work/formatted/` or `_work/integrations/formatted/`), **PROJECTED** (shape implied by fields the client reads), **DERIVED** (follows from proven control flow), **REMOTE/UNKNOWN** (server-side, not in client). `F` = `app-initial-DGau-T9Q.js`.

## What this proves

The web client has two distinct registries. (1) A **git user-identity registry** `z` (F:486-563) covering exactly three providers — `github`, `gitlab`, `azure_devops` — each modelled as a *cloud* identity (public host) plus optional *self-hosted* host identities keyed by an `appConfigId`. It drives per-user OAuth connect/disconnect and query invalidation. (2) A **UI/settings registry** `E` in `integrationsConstants-TrJCyRpV.js:57-157` listing twelve integrations (Azure DevOps, Bitbucket, GitHub, GitLab, Jira, Linear, Slack, Microsoft Teams, Pylon, incident.io, PagerDuty, Perforce) with label, slug, i18n description key, and permission item ids. The REST surface is a ky client with `prefixUrl = https://api.devin.ai` (or `api.devinenterprise.com`), `Authorization: Bearer`, and `x-cog-org-id` header (`app-initial-B08PTpzo.js:519-575`, `app-initial-eW0H4v4q.js:128-135`). Org-scoped routes are `<orgId>/integrations/<service>/...`; user-scoped routes are bare `integrations/...`; enterprise scoping appears only as an `enterpriseId` gate on a few queries. All feature flags for providers evaluate to `true` in production (`Gn = null`, `app-initial-eW0H4v4q.js:332-348`). 139 method+path pairs were extracted (appendix, `_work/integrations/endpoint-methods.txt`).

## 1. Provider table

### 1a. Git user-identity registry `z` (PROVEN F:485-563)

| id | publicHost | cloud status query key | cloud status GET | select → | startCloudOauth (GET) | deleteCloudIdentity (DELETE) | cloudDependentQueryKeys | attributesSessionPrs | self-hosted `hosts` |
|---|---|---|---|---|---|---|---|---|---|
| `github` | `github.com` | `['user-github-integration', userId]` | `integrations/github/user` (F:247) | `{isConnected: is_github_oauth_connected, username: github_username}` | `integrations/github/start-user-oauth?return_to` (F:243) | `integrations/github/user` (F:248) | `[['user-profile', userId]]` | `true` | key `['ghes-user-oauth-hosts']`, GET `integrations/github/ghes/user-oauth-hosts` (F:283) rows `{github_app_config_id, ghes_host, is_connected, username}`; start GET `integrations/github/ghes/start-user-oauth?github_app_config_id&return_to` (F:284); delete DELETE `integrations/github/ghes/user-oauth?github_app_config_id` (F:288) |
| `gitlab` | `gitlab.com` | `['user-gitlab-integration', userId]` | `integrations/git/user-oauth/gitlab/status` (F:457) | `{isConnected: is_connected, username}` | `integrations/git/user-oauth/gitlab/start?return_to` (F:462) | `integrations/git/user-oauth/gitlab` (F:466) | `[]` | `true` | key `['gitlab-self-hosted-user-oauth-hosts', userId, orgId]`, GET `integrations/gitlab/self-hosted/user-oauth-hosts` (F:446) rows `{gitlab_app_config_id, host, is_connected, username}`; start same generic `/start` + `?host&app_config_id` (F:449-451); delete generic DELETE + `?host&app_config_id` |
| `azure_devops` | `dev.azure.com` | `['user-azure-devops-integration', userId, orgId]` | `integrations/git/user-oauth/azure_devops/status` | `{isConnected: is_connected, username, canConnect: can_connect}` | `integrations/git/user-oauth/azure_devops/start?return_to` | `integrations/git/user-oauth/azure_devops` | `[['user-review-connections', userId, orgId ?? null]]` (`app-initial-CMo_DJKv.js:477-479`) | `false` | `null` (no self-hosted) |

`ir = ['github','gitlab', ...(l ? ['azure_devops'] : [])]` (F:485); `l` = `A('azureDevops')` = true in prod (PROVEN `app-initial-eW0H4v4q.js:332-348`). Bitbucket, Perforce have no user-identity entry (DERIVED: absent from `z`).

### 1b. Settings/UI registry `E` (PROVEN `integrationsConstants-TrJCyRpV.js:57-157`)

| key | label | slug | itemId | entItemId | descriptionKey |
|---|---|---|---|---|---|
| azureDevops | Azure DevOps | azure-devops | azure-devops-integration | ent-azure-devops-integration | settings.integrationDescriptionAzureDevops |
| bitbucket | Bitbucket | bitbucket | bitbucket-integration | ent-bitbucket-integration | …Bitbucket |
| github | GitHub | github | github-integration | ent-github-integration | …Github |
| gitlab | GitLab | gitlab | gitlab-integration | ent-gitlab-integration | …Gitlab |
| jira | Jira | jira | jira-integration | ent-jira-integration | …Jira |
| linear | Linear | linear | linear-integration | ent-linear-integration | …Linear |
| slack | Slack | slack | slack-integration | ent-slack-integration | …Slack |
| microsoftTeams | Microsoft Teams | microsoft-teams | microsoft-teams-integration | ent-microsoft-teams-integration | …MicrosoftTeams |
| pylon | Pylon | pylon | pylon-integration | ent-pylon-integration | …Pylon |
| incidentIo | incident.io | incident-io | incident-io-integration | ent-incident-io-integration | …IncidentIo |
| pagerDuty | PagerDuty | pagerduty | pagerduty-integration | ent-pagerduty-integration | …PagerDuty |
| perforce | Perforce | perforce | perforce-integration | ent-perforce-integration | …Perforce |

Feature flags (all `true` in prod, PROVEN `app-initial-eW0H4v4q.js:338-348`): github, gitlab, bitbucket, azureDevops, slack, linear, jira, microsoftTeams, perforce.

Org-level git connection summary hook `useGitIntegrations-Cp3mrSXA.js:20-100` (PROVEN): types `'github'|'gitlab'|'bitbucket'|'azure-devops'` → `{isConnected, connectionCount, hasUserAccountConnected}`; only github exposes `hasUserAccountConnected` (from `is_github_oauth_connected`); azure data shape is `{connections: []}`, others are arrays. `useConnectedIntegrations-CAwE_evr.js:4-11`: `Set<'linear'|'pylon'>` from `.data.connected`.

Automation-trigger integration state (`integrationCheck-SuEwcG-U.js:49-75`, PROVEN, pointer for Task C): per-source state `'connected' | 'user-not-linked' | 'missing-config' | 'needs-reauth'`; sources `schedule|webhook|code_scan|snapshot_build` exempt.

<!-- PART 2: identity model, endpoints, query keys, scoping -->
<!-- PART 3: open questions, evidence appendix -->

## 2. Connection identity model

Built by `fr()` (useGitIdentities, PROVEN F:665-733) and enriched by `Ur()` (F:1247-1281). Types below are DERIVED from the proven field reads.

```ts
type GitIdentityProvider = 'github' | 'gitlab' | 'azure_devops';           // F:485

interface GitIdentity {                                                    // F:690-715
  key: string;              // provider, or `${provider}-${appConfigId}`  (ur, F:660)
  provider: GitIdentityProvider;
  kind: 'cloud' | 'self-hosted';
  host: string;             // publicHost for cloud; ghes_host / gitlab host for self-hosted
  appConfigId: string | null;  // null for cloud
  isConnected: boolean;
  username: string | null;
  canConnect: boolean | null;  // only azure_devops cloud populates (can_connect)
  isReady: boolean;         // query not loading
}

interface GitIdentityItem extends Pick<GitIdentity,'key'|'provider'|'kind'|'username'|'isConnected'> { // F:1264-1277
  host: string | null;      // null for cloud
  isAvailable: boolean;     // cloud only: github→org has github.com connection; gitlab→org has gitlab.com connection || already connected; azure→canConnect || connected
  attributesSessionPrs: boolean;
  isLoading: boolean;       // pendingKey === key, or github cloud linkUser in flight
  isReady: boolean;
  onConnect(): void;        // github cloud uses re('github').linkUser; others registry startCloudOauth/startHostOauth
  onDisconnect(): void;
}

// Provider registry entry shape (F:486-563)
interface ProviderRegistryEntry<S> {
  publicHost: string;
  cloudStatus: { queryKey(ctx: {userId?: string; orgId?: string}): unknown[]; queryFn(signal?: AbortSignal): Promise<S>;
                 select(s: S): {isConnected: boolean; username: string|null; canConnect?: boolean} };
  startCloudOauth(returnTo: string): Promise<{url: string}>;
  deleteCloudIdentity(): Promise<unknown>;
  cloudDependentQueryKeys(ctx): unknown[][];
  attributesSessionPrs: boolean;
  hosts: null | {
    hosts: { queryKey(ctx): unknown[]; queryFn(): Promise<HostRow[]>; select(rows): {appConfigId: string; host: string; isConnected: boolean; username: string|null}[] };
    startHostOauth(appConfigId: string, host: string, returnTo: string): Promise<{url: string}>;
    deleteHostIdentity(appConfigId: string, host: string): Promise<unknown>;
  };
}
```

Behaviour (PROVEN):
- `connect` (F:581-600): `return_to = pathname+search`; cloud → `startCloudOauth`, self-hosted → `startHostOauth`; then `window.location.assign(url)`. Failure toast only for self-hosted (`ar`, F:566-580; strings F:653-658).
- `disconnect` (F:601-643): cloud → `deleteCloudIdentity` then invalidate `cloudStatus.queryKey` + `cloudDependentQueryKeys`; self-hosted → `deleteHostIdentity` then invalidate `hosts.queryKey`. 403 with `detail.code === 'local_dev_blocked'` surfaces `detail.message` (F:369-373).
- Query enablement (F:667-668): cloud statuses need `isAuthenticated && userId`; **self-hosted host lists need `enterpriseId`**.
- `findIdentity(provider, host)` (F:721-730): `host` empty or equal to `publicHost` → cloud identity, else match `host`; prefers connected.

## 3. Endpoint table

Base: `prefixUrl` = `__DEVIN_CONFIG__.API_URL ?? (location.host endsWith '.devinenterprise.com' ? https://api.devinenterprise.com : https://api.devin.ai)` (PROVEN `app-initial-eW0H4v4q.js:128-135`). Headers `Authorization: Bearer <token>`, `x-cog-org-id: <orgId>`; retry 3× on 408/429/502/503/504 (PROVEN `app-initial-B08PTpzo.js:519-546`). `{org}` = orgId path prefix passed by the caller (e.g. F:777-781). All rows PROVEN; full raw list in `_work/integrations/endpoint-methods.txt`. Chunk = `app-initial-DGau-T9Q.js` unless noted.

### 3a. User-scoped (bare `integrations/...`)
| Method | Path | Params / body | Cite |
|---|---|---|---|
| GET | integrations/github/user | signal | F:247 |
| DELETE | integrations/github/user | | F:248 |
| GET | integrations/github/start-user-oauth | ?return_to | F:243 |
| GET | integrations/github/management-url | ?installation_id&gh_org&host | F:226 |
| GET | integrations/github/auto-org-creation-installation-url | ?return_to | F:239 |
| GET | integrations/github/available-installations | | F:249 |
| POST | integrations/github/connect-installation | json | F:251 |
| GET | integrations/github/pr-review-start-oauth | | sweep |
| POST | integrations/github/ghes/start-app-registration | {ghes_host, is_subdomain_isolation_enabled, organization, app_name} | F:264 |
| GET / DELETE | integrations/github/ghes/app-configs[/{id}] | | F:267-268 |
| GET | integrations/github/ghes/installation-url | ?github_app_config_id&return_to (default return `/settings/connections/github`) | F:269-272 |
| GET | integrations/github/ghes/installation-preview | ?github_app_config_id&installation_id | F:273-279 |
| GET | integrations/github/ghes/user-oauth-hosts | | F:283 |
| GET | integrations/github/ghes/start-user-oauth | ?github_app_config_id&return_to | F:284 |
| DELETE | integrations/github/ghes/user-oauth | ?github_app_config_id | F:288 |
| GET | integrations/git/user-oauth/{provider}/status | ?host&app_config_id | F:457 |
| GET | integrations/git/user-oauth/{provider}/start | ?host&app_config_id&return_to | F:462 |
| DELETE | integrations/git/user-oauth/{provider} | ?host&app_config_id | F:466 |
| POST | integrations/git/user-oauth/{provider}/complete | (Task B) | oauth-callback-*.js sweep |
| GET | integrations/git/personal-connection-availability | → {github_com, gitlab_com} | F:1219, 1236-1240 |
| GET / POST | integrations/gitlab/self-hosted/app-configs | POST {host, app_id, app_secret} | F:440-441 |
| DELETE | integrations/gitlab/self-hosted/app-configs/{id} | | F:445 |
| GET | integrations/gitlab/self-hosted/user-oauth-hosts | | F:446 |
| GET | integrations/azure-devops/service-principal/install-url | ?return_to → authorize_url | F:2291 |
| POST | integrations/azure-devops/service-principal/connect | json | F:2298 |
| DELETE | integrations/azure-devops/service-principal/app-config/{id} | | F:2267 |
| POST | integrations/jira-agent/link-info | {token} | F:1299 |
| POST | integrations/jira-agent/link | {token, account_id}; 409 → {detail.site_url} | F:1303-1310 |
| GET / POST | integrations/gh_cli/state, integrations/gh_cli/code | | F:2401, 2424 |
| GET | pr-review/gh/user-orgs | | F:282 |

### 3b. Org-scoped (`{org}/integrations/...`)

**GitHub** (F:218-262): GET `/github` (connections list; F:222), GET `/github/repos` (F:219), GET `/github/installation-url?return_to&auto_create_org&_bypass_org_selection` (F:224), DELETE `/github?name&host` (F:231), DELETE `/github/pat?connection_id` (F:235), POST `/github/connect-existing-installation {installation_id}` (F:254), POST `/github/enterprise-pat {pat, gh_pat_name, host}` (F:258), PUT `/github/enterprise-pat {pat, connection_id}` (F:261).

**GitLab** (F:389-439): GET `/gitlab` (F:400), GET `/gitlab/repos` (F:392), DELETE `/gitlab/{connId}` (F:402), GET `/gitlab/installation-url?return_to → {url}` (F:406), POST `/gitlab/token {access_token, host}` (F:413), GET `/gitlab/webhook/{id}/token` (F:416), POST `/gitlab/webhook/{id}/token/regenerate` (F:418), POST `/gitlab/{id}/token/rotate {access_token}` (F:422), PATCH `/gitlab/{id}/token/auto-rotation {enabled}` (F:428).

**Bitbucket** (F:1718-1745): GET `/bitbucket` (F:1725), GET `/bitbucket/repos`, GET `/bitbucket/connect`, DELETE `/bitbucket/{id}` (F:1727), POST `/bitbucket/token {http_token, username, host}` (F:1745), POST `/bitbucket/{id}/token/rotate` (F:1731), GET/POST `/bitbucket/webhook/{id}/token[/regenerate]` (F:1720-1722).

**Azure DevOps** (F:2261-2296): GET `/azure-devops` (`{connections:[]}`), DELETE `/azure-devops/{id}`, GET `/azure-devops/connect?return_to → authorize_url`, GET `/azure-devops/repos → {repos}`, GET/POST `/azure-devops/webhook/{id}/token[/regenerate]`, POST `/azure-devops/server-token json`.

**Perforce** (sweep + F:2381): GET `/perforce`, POST `/perforce`, PATCH/DELETE `/perforce/{id}`, POST `/perforce/enumerate`.

**Jira** (F:294-360): GET status, GET user-link-url?return_to, GET user-link-availability, DELETE user-link, POST webhook/refresh, GET installation-url?return_to (redirect self with `?tool=jira`, F:316), POST disconnect, GET projects?scope=account (error `{detail:{error_code,message}}` → `JiraProjectsError`, F:322-331), GET labels/statuses/assignable-users/epics, POST notes/regenerate, PUT notes {content}, GET/POST site-selection/{connId} {jira_cloud_id}, POST connect-service-account {client_id, client_secret}, DELETE service-account; PUT mappings, PUT project-mappings (sweep). **Jira agent**: GET `/jira-agent/installations`, POST `/jira-agent/installations/unlink` (F:1315-1318).

**Linear** (`app-initial-BrdCaxWI.js:1148-1182, 1702, 1733`; config `app-initial-B08PTpzo.js:795`): GET installation-url, GET user-installation-url, POST disconnect, GET check-label-permissions, teams, workflow_states, labels, bot-users, members, projects, config; PUT mappings, PUT team-mappings.

**Slack** (`app-initial-tbOtyZLY.js:1120-1181`; status `B08PTpzo:?`, sweep): GET `/slack/status`, GET `/slack/authorize`, GET `/slack/admin-authorize`, GET `/slack/users/sign-in?return_to`, GET `/slack/users/current/channels`, GET `/slack/channels/search?query&limit`, POST `/slack/channels/join {channel_id} → status`, GET `/slack/users → {users}`, GET `/slack/usergroups → {usergroups}`, GET `/slack/channels?workspace_id`, GET `/slack/channels/resolve?workspace_id&channel_id`, DELETE `/slack` (disconnect), DELETE `/slack/member`, POST `/slack/gh-notif-channel[?channel_id]`, PUT `/slack/workspaces/refresh`, GET `/slack/workspaces/{id}/authorization`, GET `/slack/can-migrate`, POST `/slack/complete-migration`, GET/POST `/slack/channel-preferences` (`slack-*.js`).

**Pylon** (`app-initial-CPg8-Ab0.js:209-232`; status `B08PTpzo:848`): GET status, installation-url, user-link-url?return_to, tags, issue-statuses; DELETE user-link; PUT config, PUT security-profile; POST disconnect.

**incident.io** (F:83-97): GET status, POST connect {api_key}, POST signing-secret, POST disconnect, GET condition-options.

**PagerDuty** (sweep, methods PROVEN from `endpoint-methods.txt`): GET status, POST connect, POST disconnect, GET user-link, GET/PUT/DELETE app-registration, POST app-registration/installations/{id}, POST app-registration/oauth/authorize, DELETE app-registration/oauth/token, GET condition-options[/search], GET/POST webhook/subscriptions, POST webhook/subscriptions/manual, DELETE webhook/subscriptions/{id}.

**Cross-provider org resources** (F:2514-2557): GET `/integrations/git-permissions?permission_types=a,b`, POST/PATCH/DELETE `/integrations/git-permissions[/{id}]`; POST `/integrations/add-repo {connection_id, repo_path}`; and a *non-`integrations`* unified connection API: GET `organizations/{org}/git-connections/{id}`, GET `.../account-repos`, GET `.../cache-status`, POST `.../update-repo-cache`, PATCH `.../owned-public-repos-in-automations-settings` (F:2521-2554).

**Microsoft Teams**: no `integrations/microsoft-teams` REST call found in the sweep; only routes `/settings/integrations/microsoftTeams` and disconnect invalidating `member-integrations` (`connections-DF5sXsAG.js:563-564`). Endpoint is REMOTE/UNKNOWN from this pass.

## 4. Query-key table (PROVEN)

| Key | Scope | Source |
|---|---|---|
| `['user-github-integration', userId]` | user | F:490 |
| `['user-gitlab-integration', userId]` | user | F:519 |
| `['user-azure-devops-integration', userId, orgId]` | user+org | F:547 |
| `['ghes-user-oauth-hosts']` | user (enterprise-gated) | F:505 |
| `['gitlab-self-hosted-user-oauth-hosts', userId, orgId]` | user+org (enterprise-gated) | F:533 |
| `['user-review-connections', userId, orgId ?? null]` | user+org | CMo_DJKv:478 |
| `['user-profile', userId]` | user (invalidated on github disconnect) | F:501 |
| `['personal-git-connection-availability', enterpriseId]` | enterprise | F:1218 |
| `['github-integration-status', orgId, userId]` | org | F:781 |
| `['gitlab-integration-status', orgId]` | org | F:1056 |
| `['bitbucket-integration-status', orgId]` | org | F:1786 |
| `['azure-devops-integration-status', orgId]` | org | F:2314 |
| `['perforce-integration-status', orgId]` | org | F:2381 |
| `['linear-integration-config-status', orgId]` | org | BrdCaxWI:1544 |
| `['repos', orgId, 'github'|'gitlab']` | org | F:750, 1075 |
| `['git-connections', org]`, `['git-connections-metadata', org]`, `['git-connection-my-access', org]`, `['git-permissions', org]` | org | F:2616-2618, 1077 |
| `['git-connection', org, id]`, `['git-connection-repo-cache-status', org, id]`, `['git-connection-account-repos', org, id]` | org | ManageConnectionAccessModal:279-303 |
| `['ghes-app-configs']`, `['ghes-installation-preview', cfg, inst]` | user | github-BiwNk-eu:1562, F:2128 |
| `['gh-cli-state', x]` | user | F:2400 |
| `['user-integrations']`, `['member-integrations', org?, ...]` | user / member | BhLdCEaF:1228-1229, connections-DF5sXsAG:564,618 |
| `['auth1-connections', a, b ?? null]` | (Task B) | auth1-oauth-9h-Zi8-D:577 |

## 5. Org / user / enterprise scoping

- **Org-scoped**: paths prefixed with `{orgId}/integrations/...` (the caller passes `orgId` from the auth context: `qt(orgId)` F:777-781, `zn(orgId)` F:1052-1058) *and* every request carries `x-cog-org-id` (PROVEN B08PTpzo:540-542). Org connections are installations/tokens shared by the workspace (GitHub App installations, GitLab/Bitbucket tokens, Jira/Linear/Slack workspaces). Disconnect at org level invalidates `*-integration-status`, `git-connections-metadata`, `git-connection-my-access`, `repos` (F:1074-1078, 1823-1826).
- **User-scoped**: bare `integrations/...` — the caller's own identity (`integrations/github/user`, `integrations/git/user-oauth/{provider}/*`, GHES/GitLab-self-hosted user-oauth hosts, gh_cli, jira-agent link). These are the "personal connections" surfaced in `settings/connections` and the `member-integrations`/`user-integrations` query families.
- **Enterprise (`enterpriseId`)** — three PROVEN branches, no distinct URL prefix: (a) `Vr()` uses `integrations/git/personal-connection-availability → {github_com, gitlab_com}` instead of org status lists (F:1228-1242); (b) self-hosted host identity lists in `fr()` are only enabled when `enterpriseId` exists (F:668, 685); (c) `connections-DF5sXsAG.js:206-214` swaps the personal MCP description copy. Enterprise-level endpoints (if any) are REMOTE/UNKNOWN in this bundle; `entItemId` (`ent-*-integration`) are permission-matrix ids, not routes.
- **Permission matrix items** (PROVEN `connections-DF5sXsAG.js:952-962`): groups `personal-connections` (`personal-windsurf`, `personal-github-link`, `personal-slack-link`, `personal-linear-link`, `personal-atlassian-link`, `personal-microsoft-teams-link`, `personal-pylon-link`) and `connected-accounts` (`connected-accounts-list`, `connected-accounts-mcps`) with `canView`.

## 6. Open questions

**For Task B (OAuth flows)**: `POST integrations/git/user-oauth/{provider}/complete` body and the `/_user/integrations/git/oauth-callback` + `/integrations/mcp/oauth-callback` routes (`oauth-callback-*.js`); `integrations/github/pr-review-start-oauth`; installation-callback URLs `${ee}/integrations/github/installation-callback?state&installation_id` and `.../ghes/installation-callback/{webhook_id}?state` (sweep); `auth1-connections` query (`auth1-oauth-9h-Zi8-D.js:577`); PagerDuty `app-registration/oauth/*`; Slack `authorize` vs `admin-authorize` vs `users/sign-in`; `return_to` semantics.

**For Task C (agent-side consumption)**: `integrationCheck` state machine and i18n keys `automations.missingIntegration{Connect,Link,Configure,Reauthorize}_*`; `attributesSessionPrs` (which providers attribute session PRs to the user identity); `git-permissions` payloads; `owned-public-repos-in-automations-settings`; how `user-review-connections` feeds PR review.

**REMOTE/UNKNOWN**: response schemas beyond the fields read here; Microsoft Teams REST surface; enterprise-only endpoints; server-side token storage/refresh.

## 7. Evidence appendix

- Formatted files: `_work/formatted/app-initial-DGau-T9Q.js` (registry F:485-563; hooks F:566-733, 777-781, 1052-1058, 1215-1290; API fns F:83-97, 218-292, 294-360, 389-466, 1298-1320, 1718-1745, 2257-2300, 2400-2424, 2505-2557), `_work/formatted/app-initial-eW0H4v4q.js:126-140, 332-348`, `_work/formatted/app-initial-B08PTpzo.js:519-575, 795, 848`, `_work/formatted/app-initial-CMo_DJKv.js:150-180, 477-479`, `_work/formatted/app-initial-tbOtyZLY.js:1120-1181`, `_work/formatted/app-initial-BrdCaxWI.js:1148-1182`, `_work/formatted/app-initial-CPg8-Ab0.js:209-232`, `_work/formatted/integrationsConstants-TrJCyRpV.js:57-157`, `_work/formatted/integrationCheck-SuEwcG-U.js:1-136`, `_work/integrations/formatted/useConnectedIntegrations-CAwE_evr.js:4-11`, `_work/integrations/formatted/useGitIntegrations-Cp3mrSXA.js:20-100`, `_work/formatted/connections-DF5sXsAG.js:206-222, 563-564, 618, 948-962`.
- Sweep outputs: `_work/integrations/endpoint-strings-raw.txt` (204 unique `integrations/` strings with chunk), `_work/integrations/endpoint-methods.txt` (139 method+path pairs from the raw 2026-09-20 bundle).
- Working notes: `_work/integrations/NOTES-A-registry.md`.
