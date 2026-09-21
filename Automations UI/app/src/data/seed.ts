import type { Automation, AutomationTemplate, McpServer, OrgUser, SecurityProfile, SlackChannel, GitConnection, Repo } from "@/model/types";
import { presetRule } from "@/model/rrule";

export const CURRENT_USER_ID = "user_tk";
export const ORG_ID = "org_diddletime_6";
export const ORG_NAME = "diddletime-6";

export const USERS: OrgUser[] = [
  { id: "user_tk", name: "Tyler Kim" },
  { id: "user_ml", name: "Maya Lindqvist" },
  { id: "user_rs", name: "Ravi Subramanian" },
];

export const SLACK_CHANNELS: SlackChannel[] = [
  { workspace_id: "T0AC", workspace_name: "Diddletime", channel_id: "C01ENG", name: "engineering", is_private: false },
  { workspace_id: "T0AC", workspace_name: "Diddletime", channel_id: "C02SUP", name: "support-escalations", is_private: false },
  { workspace_id: "T0AC", workspace_name: "Diddletime", channel_id: "C03ONC", name: "oncall", is_private: true },
  { workspace_id: "T0AC", workspace_name: "Diddletime", channel_id: "C04REL", name: "releases", is_private: false },
];

export const MCP_CATALOG: McpServer[] = [
  { slug: "sentry", name: "Sentry", is_installed: false, is_enabled: false, auth_type: "oauth", scope: "org" },
  { slug: "datadog", name: "Datadog", is_installed: true, is_enabled: true, auth_type: "api_key", scope: "org", url: "https://mcp.datadoghq.com", executes_on_session_machine: true, installation_id: "inst_dd" },
  { slug: "linear", name: "Linear", is_installed: true, is_enabled: true, auth_type: "oauth", has_tokens: true, scope: "org", installation_id: "inst_lin" },
  { slug: "notion", name: "Notion", is_installed: true, is_enabled: true, auth_type: "oauth", has_tokens: true, scope: "user", installation_id: "inst_notion" },
  { slug: "stripe", name: "Stripe", is_installed: true, is_enabled: true, auth_type: "api_key", scope: "org", url: "https://mcp.stripe.com", executes_on_session_machine: true, installation_id: "inst_stripe" },
  { slug: "figma", name: "Figma", is_installed: true, is_enabled: false, auth_type: "oauth", scope: "org" },
  { slug: "atlassian", name: "Jira", is_installed: true, is_enabled: true, auth_type: "oauth", has_tokens: true, scope: "org", installation_id: "inst_jira" },
  { slug: "circleci", name: "CircleCI", is_installed: false, is_enabled: false, auth_type: "api_key", scope: "org" },
];

const SENTRY_PROMPT = `Use the Sentry MCP to pull unresolved errors from the past 24 hours, sorted by frequency.

For the top 5 errors:
1. Pull the stack trace and breadcrumbs
2. Find the relevant source code
3. Open a fix PR with a regression test, linking the Sentry issue

Skip errors tagged 'wontfix' or 'expected-behavior'.
Post a summary of all errors and fix PRs when done.`;

export const TEMPLATES: AutomationTemplate[] = [
  {
    template_id: "sentry-remediation", name: "Fix Sentry Errors Daily", category: "Monitoring & Triage", icon: "bug",
    description: "Every morning, pull the top unresolved Sentry errors, find the root cause, and open fix PRs with regression tests.",
    tags: ["sentry", "errors", "bugfix"],
    triggers: [{ event_type: "schedule:recurring", conditions: [[{ field: "rrule", operator: "matches", value: "FREQ=DAILY;BYHOUR=2;BYMINUTE=0;TZID=America/Toronto" }]] }],
    actions: [{ type: "start_session", prompt: SENTRY_PROMPT, bypass_approval: false }, { type: "notify", when: "always" }],
    required_integrations: [], required_mcps: ["sentry"],
    suggested_limits: { max_acu_limit: null, invocation_limit: 50, invocation_limit_window_seconds: 3600 },
  },
  {
    template_id: "pr-review", name: "Review every pull request", category: "CI/CD & Release", icon: "ci",
    description: "When a PR opens, review the diff for bugs, missing tests, and style issues, then leave a summary comment.",
    tags: ["github", "review", "pull request"],
    triggers: [{ event_type: "github:pull_request", conditions: [[{ field: "action", operator: "eq", value: "opened" }]], replies: [{ type: "post_response" }] }],
    actions: [{ type: "start_session", prompt: "Review this pull request. Look for correctness bugs, missing test coverage, and deviations from the repository's conventions. Post a concise review comment with prioritized findings.", bypass_approval: true }],
    required_integrations: ["github"], required_mcps: [],
  },
  {
    template_id: "flaky-tests", name: "Fix failing CI checks", category: "CI/CD & Release", icon: "test",
    description: "When a check run fails on the default branch, investigate the failure and push a fix or open an issue.",
    tags: ["ci", "tests", "github"],
    triggers: [{ event_type: "github:check_run", conditions: [[{ field: "action", operator: "eq", value: "completed" }, { field: "check_run.conclusion", operator: "eq", value: "failure" }]] }],
    actions: [{ type: "start_session", prompt: "A CI check failed. Pull the logs, reproduce the failure locally, and open a PR that fixes the root cause. If the failure is flaky, quarantine the test and file an issue.", bypass_approval: true }],
    required_integrations: ["github"], required_mcps: [],
  },
  {
    template_id: "slack-triage", name: "Triage support escalations", category: "Monitoring & Triage", icon: "support",
    description: "Watch a Slack channel and investigate each new report, grouping duplicates into tracked issues.",
    tags: ["slack", "triage", "support"],
    triggers: [{ event_type: "slack:message", conditions: [] }],
    actions: [{ type: "triage_session", setup_prompt: "Investigate each report in this channel. Reproduce the issue, identify the owning service, and reply in-thread with findings and next steps.", slack_config: { source_channel_id: "" } }],
    required_integrations: ["slack"], required_mcps: [],
  },
  {
    template_id: "dependency-updates", name: "Weekly dependency updates", category: "Maintenance", icon: "package",
    description: "Once a week, upgrade outdated dependencies, run the test suite, and open a PR summarizing the changes.",
    tags: ["dependencies", "maintenance"],
    triggers: [{ event_type: "schedule:recurring", conditions: [[{ field: "rrule", operator: "matches", value: presetRule("weekly", 5) }]] }],
    actions: [{ type: "start_session", prompt: "Upgrade all outdated dependencies to their latest compatible versions. Run the full test suite and open one PR per package manager with the changelog highlights.", bypass_approval: true }],
    required_integrations: ["github"], required_mcps: [],
  },
  {
    template_id: "datadog-incident", name: "Investigate Datadog alerts", category: "Monitoring & Triage", icon: "alert",
    description: "When a webhook fires from a Datadog monitor, pull the relevant logs and traces and post a root-cause summary.",
    tags: ["datadog", "alerts", "webhook"],
    triggers: [{ event_type: "webhook:incoming", conditions: [] }],
    actions: [{ type: "start_session", prompt: "A Datadog monitor fired. Use the Datadog MCP to pull the alerting metric, related logs, and traces for the last 30 minutes, then post a root-cause summary with a proposed fix.", bypass_approval: false }],
    required_integrations: [], required_mcps: ["datadog"],
  },
  {
    template_id: "security-findings", name: "Remediate critical findings", category: "Security", icon: "security",
    description: "For each critical or high security scan finding, investigate and open a remediation PR.",
    tags: ["security", "scan"],
    triggers: [{ event_type: "code_scan:finding", conditions: [[{ field: "severity", operator: "in", value: ["critical", "high"] }]] }],
    actions: [{ type: "remediate_finding" }],
    required_integrations: ["github"], required_mcps: [],
  },
  {
    template_id: "linear-grooming", name: "Groom the Linear backlog", category: "Project Management", icon: "document",
    description: "When tickets are created in Linear, enrich them with reproduction steps, estimates, and suggested owners.",
    tags: ["linear", "backlog"],
    triggers: [{ event_type: "linear:create", conditions: [] }],
    actions: [{ type: "start_session", prompt: "A new Linear ticket was created. Read it, search the codebase for the relevant area, and add reproduction steps, an estimate, and a suggested owner as a comment.", bypass_approval: true }],
    required_integrations: ["linear"], required_mcps: [],
  },
  {
    template_id: "release-notes", name: "Draft release notes", category: "CI/CD & Release", icon: "document",
    description: "After a snapshot build completes, summarize the merged changes into user-facing release notes.",
    tags: ["release", "notes"],
    triggers: [{ event_type: "snapshot_build:completed", conditions: [[{ field: "status", operator: "eq", value: "succeeded" }]] }],
    actions: [{ type: "start_session", prompt: "A snapshot build completed. Collect the commits since the previous build and draft user-facing release notes grouped by feature, fix, and breaking change.", bypass_approval: true }],
    required_integrations: ["github"], required_mcps: [],
  },
  {
    template_id: "health-check", name: "Nightly health check", category: "Monitoring", icon: "health",
    description: "Every night, run the smoke tests against staging and open an issue for anything that regressed.",
    tags: ["health", "smoke tests"],
    triggers: [{ event_type: "schedule:recurring", conditions: [[{ field: "rrule", operator: "matches", value: presetRule("daily", 20) }]] }],
    actions: [{ type: "start_session", prompt: "Run the smoke test suite against staging. For any failure, bisect to the offending commit and open a GitHub issue with the failing test, the commit, and a proposed fix.", bypass_approval: true }],
    required_integrations: ["github"], required_mcps: [],
  },
];

const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();
const daysAgo = (d: number) => hoursAgo(d * 24);

export const AUTOMATIONS: Automation[] = [
  {
    automation_id: "auto_01", name: "Review every pull request", enabled: true,
    triggers: [{ trigger_id: "trg_01", event_type: "github:pull_request", conditions: [[{ field: "repository", operator: "eq", value: "diddletime/web" }, { field: "action", operator: "eq", value: "opened" }]], replies: [{ type: "post_response" }] }],
    actions: [{ type: "start_session", prompt: "Review this pull request. Look for correctness bugs, missing test coverage, and deviations from the repository's conventions. Post a concise review comment with prioritized findings.", bypass_approval: true, repos: ["diddletime/web"] }],
    created_at: daysAgo(41), updated_at: daysAgo(3), last_invocation_at: hoursAgo(2), created_by: "user_tk", updated_by: "user_ml",
    template_id: "pr-review", creation_method: "template", recommended_mcps: [], linear_tools_enabled: true, scratchpad_enabled: true,
    max_acu_limit: 10, invocation_limit: 50, invocation_limit_window_seconds: 3600, max_concurrent_runs: null, max_queue_depth: null,
    devin_mode: null, run_as_user: false, tags: { team: "platform", env: "prod" }, slack_dm_scope: "disabled",
  },
  {
    automation_id: "auto_02", name: "Fix Sentry Errors Daily", enabled: true,
    triggers: [{ trigger_id: "trg_02", event_type: "schedule:recurring", conditions: [[{ field: "rrule", operator: "matches", value: "FREQ=DAILY;BYHOUR=2;BYMINUTE=0;TZID=America/Toronto" }]] }],
    actions: [{ type: "start_session", prompt: SENTRY_PROMPT, bypass_approval: false }, { type: "notify", when: "always" }],
    created_at: daysAgo(18), updated_at: daysAgo(18), last_invocation_at: hoursAgo(9), created_by: "user_tk",
    template_id: "sentry-remediation", creation_method: "template", recommended_mcps: ["sentry"], linear_tools_enabled: true, scratchpad_enabled: true,
    max_acu_limit: null, invocation_limit: 50, invocation_limit_window_seconds: 3600, max_concurrent_runs: null, max_queue_depth: null,
    devin_mode: null, run_as_user: false, tags: { team: "platform" }, slack_dm_scope: "disabled",
    net_policy: { allow: [{ type: "hostname", value: "git-manager.devin.ai", enabled: true }] },
  },
  {
    automation_id: "auto_03", name: "Triage #support-escalations", enabled: true,
    triggers: [{ trigger_id: "trg_03", event_type: "slack:message", conditions: [[{ field: "channel", operator: "eq", value: "C02SUP" }]] }],
    actions: [{ type: "triage_session", setup_prompt: "Investigate each report in this channel. Reproduce the issue, identify the owning service, and reply in-thread with findings and next steps.", slack_config: { source_channel_id: "C02SUP" } }],
    created_at: daysAgo(60), updated_at: daysAgo(7), last_invocation_at: hoursAgo(0.4), created_by: "user_ml",
    template_id: "slack-triage", creation_method: "template", recommended_mcps: [], slack_tool_channels: [["T0AC", "C02SUP"]], slack_dm_scope: "disabled",
    linear_tools_enabled: true, scratchpad_enabled: true, max_acu_limit: 5, invocation_limit: 150, invocation_limit_window_seconds: 3600,
    max_concurrent_runs: 2, max_queue_depth: 20, devin_mode: "lite", run_as_user: false, tags: { team: "support", env: "prod" },
  },
  {
    automation_id: "auto_04", name: "Weekly dependency updates", enabled: true,
    triggers: [{ trigger_id: "trg_04", event_type: "schedule:recurring", conditions: [[{ field: "rrule", operator: "matches", value: "FREQ=WEEKLY;BYDAY=MO;BYHOUR=9;BYMINUTE=5;TZID=America/Toronto" }]] }],
    actions: [{ type: "start_session", prompt: "Upgrade all outdated dependencies to their latest compatible versions. Run the full test suite and open one PR per package manager with the changelog highlights.", bypass_approval: true }],
    created_at: daysAgo(90), updated_at: daysAgo(30), last_invocation_at: daysAgo(2), created_by: "user_rs",
    template_id: "dependency-updates", creation_method: "template", recommended_mcps: [], linear_tools_enabled: true, scratchpad_enabled: true,
    max_acu_limit: 20, invocation_limit: 50, invocation_limit_window_seconds: 3600, devin_mode: null, run_as_user: true, tags: { team: "platform", env: "staging" },
    slack_dm_scope: "disabled", max_concurrent_runs: null, max_queue_depth: null,
  },
  {
    automation_id: "auto_05", name: "Investigate Datadog alerts", enabled: true,
    triggers: [{ trigger_id: "trg_05", event_type: "webhook:incoming", conditions: [[{ field: "_webhook_secret_hash", operator: "matches", value: "sha256:9f2c…" }, { field: "_webhook_body_regex", operator: "matches", value: "alert_type\":\\s*\"error" }]] }],
    actions: [{ type: "start_session", prompt: "A Datadog monitor fired. Use the Datadog MCP to pull the alerting metric, related logs, and traces for the last 30 minutes, then post a root-cause summary with a proposed fix.", bypass_approval: false, slack_channel_id: "C03ONC", slack_thread_mode: "post_response" }, { type: "notify", when: "failure" }],
    created_at: daysAgo(12), updated_at: daysAgo(1), last_invocation_at: hoursAgo(30), created_by: "user_tk",
    template_id: "datadog-incident", creation_method: "template", recommended_mcps: ["datadog"], linear_tools_enabled: false, scratchpad_enabled: true,
    max_acu_limit: null, invocation_limit: null, invocation_limit_window_seconds: null, max_concurrent_runs: 1, max_queue_depth: 10,
    devin_mode: "fast", run_as_user: false, tags: { team: "sre", env: "prod" }, slack_dm_scope: "disabled",
    net_policy: { allow: [{ type: "hostname", value: "git-manager.devin.ai", enabled: true }, { type: "hostname", value: "*.datadoghq.com", enabled: true }] },
  },
  {
    automation_id: "auto_06", name: "Draft release notes", enabled: false,
    triggers: [{ trigger_id: "trg_06", event_type: "snapshot_build:completed", conditions: [[{ field: "status", operator: "eq", value: "succeeded" }]] }],
    actions: [{ type: "start_session", prompt: "A snapshot build completed. Collect the commits since the previous build and draft user-facing release notes grouped by feature, fix, and breaking change.", bypass_approval: true }],
    created_at: daysAgo(25), updated_at: daysAgo(4), last_invocation_at: daysAgo(6), created_by: "user_ml",
    template_id: "release-notes", creation_method: "template", recommended_mcps: [], linear_tools_enabled: true, scratchpad_enabled: false,
    max_acu_limit: null, invocation_limit: 50, invocation_limit_window_seconds: 3600, devin_mode: null, run_as_user: false, tags: { team: "platform" },
    slack_dm_scope: "disabled", max_concurrent_runs: null, max_queue_depth: null,
  },
  {
    automation_id: "auto_07", name: "Fix failing CI checks", enabled: true,
    triggers: [{ trigger_id: "trg_07", event_type: "github:check_run", conditions: [[{ field: "repository", operator: "eq", value: "diddletime/api" }, { field: "action", operator: "eq", value: "completed" }, { field: "check_run.conclusion", operator: "eq", value: "failure" }]] }],
    actions: [{ type: "start_session", prompt: "A CI check failed. Pull the logs, reproduce the failure locally, and open a PR that fixes the root cause. If the failure is flaky, quarantine the test and file an issue.", bypass_approval: true, repos: ["diddletime/api"] }],
    created_at: daysAgo(33), updated_at: daysAgo(33), last_invocation_at: null, created_by: "user_rs",
    template_id: "flaky-tests", creation_method: "template", recommended_mcps: [], linear_tools_enabled: true, scratchpad_enabled: true,
    max_acu_limit: 8, invocation_limit: 50, invocation_limit_window_seconds: 3600, devin_mode: null, run_as_user: false, tags: {},
    slack_dm_scope: "disabled", max_concurrent_runs: null, max_queue_depth: null,
  },
  {
    automation_id: "auto_08", name: "Nightly health check", enabled: false,
    triggers: [{ trigger_id: "trg_08", event_type: "schedule:recurring", conditions: [[{ field: "rrule", operator: "matches", value: "FREQ=DAILY;BYHOUR=3;BYMINUTE=20;TZID=America/Toronto" }]] }],
    actions: [{ type: "start_session", prompt: "Run the smoke test suite against staging. For any failure, bisect to the offending commit and open a GitHub issue with the failing test, the commit, and a proposed fix.", bypass_approval: true }],
    created_at: daysAgo(70), updated_at: daysAgo(70), last_invocation_at: daysAgo(40), created_by: "user_tk",
    template_id: "health-check", creation_method: "manual", recommended_mcps: [], linear_tools_enabled: true, scratchpad_enabled: true,
    max_acu_limit: null, invocation_limit: null, invocation_limit_window_seconds: null, devin_mode: null, run_as_user: false, tags: { env: "staging" },
    slack_dm_scope: "disabled", max_concurrent_runs: null, max_queue_depth: null,
  },
];

/** Security profile catalog (spec §13.3): one enterprise-scoped and two org-scoped profiles; `default-restricted` is the org default. */
export const SECURITY_PROFILES: SecurityProfile[] = [
  { secure_mode_profile_id: "prof_ent_baseline", name: "Enterprise baseline", scope: "enterprise", is_default: false, has_net_policy: true, net_policy: { allow: [{ hostname: "github.com" }, { hostname: "api.github.com" }, { hostname: "pypi.org" }, { hostname: "registry.npmjs.org" }] }, mcp_server_ids: ["github", "linear", "sentry"] },
  { secure_mode_profile_id: "prof_org_default", name: "Default (restricted network)", scope: "org", is_default: true, has_net_policy: true, net_policy: { allow: [{ hostname: "github.com" }, { hostname: "api.github.com" }, { hostname: "git-manager.devin.ai" }, { hostname: "sentry.io" }, { hostname: "api.datadoghq.com" }] }, mcp_server_ids: null },
  { secure_mode_profile_id: "prof_org_open", name: "Open network", scope: "org", is_default: false, has_net_policy: false, net_policy: null, mcp_server_ids: null },
];

/** One GitHub App connection without a PAT and with public-repo automations disallowed (the org default). */
export const GIT_CONNECTIONS: GitConnection[] = [
  { git_connection_id: "gc_github_1", connection_type: "github", has_pat: false, allow_owned_public_repos_in_automations: false },
];
export const REPOS: Repo[] = [
  { full_name: "diddletime/web", full_name_display: "diddletime/web", visibility: "private", connection_id: "gc_github_1", connection_type: "github" },
  { full_name: "diddletime/api", full_name_display: "diddletime/api", visibility: "private", connection_id: "gc_github_1", connection_type: "github" },
  { full_name: "diddletime/infra", full_name_display: "diddletime/infra", visibility: "private", connection_id: "gc_github_1", connection_type: "github" },
  { full_name: "diddletime/mobile", full_name_display: "diddletime/mobile", visibility: "private", connection_id: "gc_github_1", connection_type: "github" },
  { full_name: "diddletime/docs", full_name_display: "diddletime/docs", visibility: "public", connection_id: "gc_github_1", connection_type: "github" },
  { full_name: "diddletime/website", full_name_display: "diddletime/website", visibility: "public", connection_id: "gc_github_1", connection_type: "github" },
];
