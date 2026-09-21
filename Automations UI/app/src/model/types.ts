/**
 * Client-visible Automation domain model (spec §4, §7.1, Appendix B §12).
 * Fields are the properties the shipped UI reads or writes.
 */
export type Condition = { field: string; operator: string; value?: unknown };

export type Reply = {
  type: "post_response" | "attach_thread" | "notify_thread" | string;
  to?: { channel_id?: string };
};

export type Trigger = {
  event_type: string;
  conditions: Condition[][];
  replies?: Reply[];
  trigger_id?: string;
};

export type SlackThreadMode = "notify" | "attach" | "forward" | "post_response" | null;

export type StartSessionAction = {
  /** Slack workspace bound to the built-in Slack tools selection (cleared on identity change). */
  slack_team_id?: string | null;
  type: "start_session";
  prompt: string;
  bypass_approval?: boolean;
  tags?: string[];
  playbook_id?: string;
  repos?: string[];
  slack_channel_id?: string | null;
  slack_thread_mode?: SlackThreadMode;
};
export type MessageSessionAction = {
  type: "message_session";
  prompt: string;
  target_devin_id?: string;
  auto_create?: boolean;
};
export type MonitorSessionAction = {
  type: "monitor_session";
  setup_prompt: string;
  repos?: string[];
  slack_monitor_config: { source_channel_id: string; team_id?: string };
};
export type TriageSessionAction = {
  type: "triage_session";
  setup_prompt: string;
  repos?: string[];
  slack_config: { source_channel_id: string };
};
export type NotifyAction = { type: "notify"; when: "always" | "failure" | "success" };
export type RemediateAction = { type: "remediate_finding" };
export type ScanAction = { type: "scan_new_commits"; scan_id: string };
export type IncidentAction = { type: "incident_session"; [k: string]: unknown };

export type Action =
  | StartSessionAction
  | MessageSessionAction
  | MonitorSessionAction
  | TriageSessionAction
  | NotifyAction
  | RemediateAction
  | ScanAction
  | IncidentAction;

export type NetPolicyEntry =
  | { type: "hostname"; value: string; enabled: boolean }
  | { type: "ipv4"; value: string; enabled: boolean }
  | { type: "ipv6"; value: string; enabled: boolean };

export type Automation = {
  automation_id: string;
  name: string;
  enabled: boolean;
  triggers: Trigger[];
  actions: Action[];
  created_at?: string | null;
  updated_at?: string | null;
  last_invocation_at?: string | null;
  created_by?: string | null;
  created_by_service_user_id?: string | null;
  created_by_service_user_name?: string | null;
  updated_by?: string | null;
  run_as_user?: boolean;
  template_id?: string | null;
  creation_method?: "manual" | "duplicate" | "template" | string;
  recommended_mcps?: string[];
  slack_tool_channels?: [string, string][];
  slack_dm_scope?: "disabled" | "org_members" | "workspace";
  linear_tools_enabled?: boolean;
  scratchpad_enabled?: boolean;
  max_acu_limit?: number | null;
  invocation_limit?: number | null;
  invocation_limit_window_seconds?: number | null;
  max_concurrent_runs?: number | null;
  max_queue_depth?: number | null;
  devin_mode?: string | null;
  net_policy?: { allow: NetPolicyEntry[] } | null;
  tags?: Record<string, string>;
  secure_mode_selection?: "inherit" | "disabled" | "profile" | null;
  secure_mode_profile_id?: string | null;
};

export type AutomationTemplate = {
  template_id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  icon: string;
  triggers: Trigger[];
  actions: Action[];
  required_integrations: string[];
  required_mcps: string[];
  suggested_limits?: {
    max_acu_limit?: number | null;
    invocation_limit?: number | null;
    invocation_limit_window_seconds?: number | null;
  };
};

export type EventStatus = "queued" | "running" | "succeeded" | "failed" | "skipped" | "canceled";

export type AutomationEvent = {
  event_id: string;
  status: EventStatus;
  created_at: string;
  event_type?: string | null;
  trigger_id?: string | null;
  event_message?: string | null;
  event_message_parts?: Array<{ text: string; resource_url?: string | null }>;
  event_resource_url?: string | null;
  error_message?: string | null;
  investigation_devin_id?: string | null;
  devin_session_id?: string | null;
  code_step_run_id?: string | null;
};

export type AutomationIssue = {
  issue_id: string;
  title?: string | null;
  short_description?: string | null;
  first_invocation_at?: string | null;
  last_invocation_at?: string | null;
  occurrence_count?: number | null;
};

export type ConsumptionRow = { created_at: string; acu_used: number };

export type McpServer = {
  /** Optional bundle fields surfaced by the MCP catalog (App. A MCP contracts). */
  marketplace_server_id?: string | null;
  server_id?: string | null;
  oauth_refresh_invalid?: boolean;
  slug: string;
  name: string;
  is_installed: boolean;
  is_enabled: boolean;
  auth_type: "oauth" | "none" | "api_key";
  has_tokens?: boolean;
  scope: "org" | "user";
  url?: string;
  executes_on_session_machine?: boolean;
  installation_id?: string;
};

export type SlackChannel = {
  workspace_id: string;
  workspace_name: string;
  channel_id: string;
  name: string;
  is_private: boolean;
};

export type OrgUser = { id: string; name: string };

/** Linked invocation record shown in the issue side sheet (spec §18.5; `GET …/invocations?issue_id=`). */
export type Invocation = {
  invocation_id: string;
  created_at: string;
  status?: EventStatus;
  event_message?: string | null;
  investigation_devin_id?: string | null;
  devin_session_id?: string | null;
  grouped?: boolean;
  issue_id?: string | null;
};

/** Security profile catalog entry (spec §13.3, Appendix F §4.5). */
export type SecurityProfile = {
  secure_mode_profile_id: string;
  name: string;
  scope: "enterprise" | "org";
  is_default?: boolean;
  has_net_policy?: boolean;
  net_policy?: { allow: Array<{ hostname: string } | { ipv4: string } | { ipv6: string }> } | null;
  mcp_server_ids?: string[] | null;
};

/** Validated minimum `resolved security` response (spec §13.3). */
export type ResolvedSecurity = {
  resolved_default: { secure_mode_profile_id: string; name: string; is_default: boolean } | null;
  governing_profile_name?: string | null;
  governing_scope?: "enterprise" | "org" | "automations_default" | "automation" | null;
  governing_profile_scope?: "enterprise" | "org" | null;
  governing_has_net_policy: boolean;
  governing_net_policy?: { allow: Array<{ hostname: string } | { ipv4: string } | { ipv6: string }> } | null;
  governing_mcp_server_ids?: string[] | null;
  governing_unresolved: boolean;
};

export type ConnectionState = "connected" | "disconnected" | "unknown";

/** Git connection projection used by the trigger editor's public-repository gate (TriggerEditor-D8VGRxC1.js module lines 1605-1626). */
export type GitConnection = { git_connection_id: string; connection_type: "github" | "gitlab"; has_pat: boolean; allow_owned_public_repos_in_automations: boolean };
/** Repository projection (`full_name`, `full_name_display`, `visibility`, `connection_id`) consumed by the same gate and by RepoSelect. */
export type Repo = { full_name: string; full_name_display: string; visibility: "public" | "private" | null; connection_id: string; connection_type: "github" | "gitlab" };
