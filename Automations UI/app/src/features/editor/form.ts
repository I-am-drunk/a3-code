import type { Action, Automation, AutomationTemplate, MonitorSessionAction, NetPolicyEntry, Reply, SlackThreadMode, Trigger } from "@/model/types";
import { parseRRule, isOneTimeInFuture } from "@/model/rrule";
import { rruleOf, schemaFor } from "@/model/sources";
import { isReservedTagKey } from "@/model/tags";
import { t } from "@/i18n/t";

/* ---------------- Form state (spec §8.1 defaults) ---------------- */
export type MetadataRow = { key: string; value: string };
export type SecuritySelection = { mode: "inherit" | "none" | "profile"; profileId?: string | null };

export type FormState = {
  name: string;
  triggers: Trigger[];
  actions: Action[];
  maxAcuLimit: number | null;
  invocationLimit: number | null;
  invocationLimitWindowSeconds: number | null;
  maxConcurrentRuns: number | null;
  maxQueueDepth: number | null;
  devinMode: string | null;
  runAsUser: boolean;
  recommendedMcps: Set<string>;
  slackToolChannels: [string, string][];
  slackDmEnabled: boolean;
  linearToolsEnabled: boolean;
  scratchpadEnabled: boolean;
  netPolicyEnabled: boolean;
  netPolicyEntries: NetPolicyEntry[];
  metadata: MetadataRow[];
  security: SecuritySelection;
  templateId: string | null;
  creationMethod: "manual" | "template" | "duplicate";
  /** Limits switch (`vt`/`G`): when off, the invocation-limit pair serializes as null (module 3176-3177, 4245-4250). */
  limitsEnabled: boolean;
  /** Slack tools master switch (`wt`/`Rn`): channels/DM scope serialize only while on (module 3188-3211, 4256-4262). */
  slackToolsEnabled: boolean;
  /** Reserved/internal tags retained from the prefill or loaded record and merged back on save (`Ta`, module 2395-2401). */
  reservedTags: Record<string, string>;
};

export const DEFAULT_INVOCATION_LIMIT = 50;

/** Reserved tag keys retained verbatim (`Ta`). */
function reservedTagsOf(tags: Record<string, string> | null | undefined): Record<string, string> {
  return Object.fromEntries(Object.entries(tags ?? {}).filter(([k]) => isReservedTagKey(k)));
}

/** Security create default (module 3566-3585): fixed `code_scan:finding` trigger, `remediate_finding` action. */
export function codeScanForm(): FormState {
  return {
    ...emptyForm(),
    triggers: [{ event_type: "code_scan:finding", conditions: [[{ field: "severity", operator: "in", value: ["critical", "high"] }]] }],
    actions: [{ type: "remediate_finding" }],
  };
}

export function isCodeScanForm(triggers: Trigger[]): boolean {
  return triggers.some((tr) => tr.event_type === "code_scan:finding");
}

export function emptyForm(): FormState {
  return {
    name: "",
    triggers: [{ event_type: "", conditions: [] }],
    actions: [{ type: "start_session", prompt: "", bypass_approval: true }],
    maxAcuLimit: null,
    invocationLimit: DEFAULT_INVOCATION_LIMIT,
    invocationLimitWindowSeconds: 3600,
    maxConcurrentRuns: null,
    maxQueueDepth: null,
    devinMode: null,
    runAsUser: false,
    recommendedMcps: new Set(),
    slackToolChannels: [],
    slackDmEnabled: false,
    linearToolsEnabled: true,
    scratchpadEnabled: true,
    netPolicyEnabled: false,
    netPolicyEntries: [],
    metadata: [],
    security: { mode: "inherit" },
    templateId: null,
    creationMethod: "manual",
    limitsEnabled: true,
    slackToolsEnabled: false,
    reservedTags: {},
  };
}

/** Template prefill (`prefill-Du9dEb4D.js:32-44`): suggested limits, `required_mcps` → recommended, never mutates the template. */
export function formFromTemplate(tpl: AutomationTemplate): FormState {
  const f = emptyForm();
  const maxAcu = tpl.suggested_limits?.max_acu_limit ?? null;
  const inv = tpl.suggested_limits?.invocation_limit ?? null;
  return {
    ...f,
    name: tpl.name,
    triggers: structuredClone(tpl.triggers),
    actions: structuredClone(tpl.actions),
    maxAcuLimit: maxAcu,
    invocationLimit: inv,
    invocationLimitWindowSeconds: tpl.suggested_limits?.invocation_limit_window_seconds ?? null,
    limitsEnabled: maxAcu != null || inv != null,
    recommendedMcps: new Set(tpl.required_mcps),
    templateId: tpl.template_id,
    creationMethod: "template",
  };
}

export function formFromAutomation(a: Automation): FormState {
  const f = emptyForm();
  const meta: MetadataRow[] = Object.entries(a.tags ?? {}).filter(([k]) => !isReservedTagKey(k)).map(([key, value]) => ({ key, value }));
  return {
    ...f,
    name: a.name,
    // `Pa` projection (module 3998-4004): loaded triggers keep only event_type/conditions/replies (`replies ?? []`).
    triggers: a.triggers.map((tr) => ({ event_type: tr.event_type, conditions: structuredClone(tr.conditions), replies: structuredClone(tr.replies ?? []) })),
    actions: structuredClone(a.actions),
    maxAcuLimit: a.max_acu_limit ?? null,
    invocationLimit: a.invocation_limit ?? null,
    invocationLimitWindowSeconds: a.invocation_limit_window_seconds ?? null,
    maxConcurrentRuns: a.max_concurrent_runs ?? null,
    maxQueueDepth: a.max_queue_depth ?? null,
    devinMode: a.devin_mode ?? null,
    runAsUser: !!a.run_as_user,
    recommendedMcps: new Set(a.recommended_mcps ?? []),
    slackToolChannels: a.slack_tool_channels ?? [],
    slackDmEnabled: dmEnabled(a.slack_dm_scope),
    // Edit reset (module 4363-4390): `slack tools` on when channels exist or DMs enabled; linear/scratchpad `!== false`.
    slackToolsEnabled: (a.slack_tool_channels ?? []).length > 0 || dmEnabled(a.slack_dm_scope),
    linearToolsEnabled: a.linear_tools_enabled !== false,
    scratchpadEnabled: a.scratchpad_enabled !== false,
    limitsEnabled: a.max_acu_limit != null || a.invocation_limit != null,
    netPolicyEnabled: !!a.net_policy,
    netPolicyEntries: a.net_policy?.allow ?? [],
    metadata: meta,
    reservedTags: reservedTagsOf(a.tags),
    security: a.secure_mode_selection === "disabled" ? { mode: "none" } : a.secure_mode_selection === "profile" ? { mode: "profile", profileId: a.secure_mode_profile_id } : { mode: "inherit" },
    templateId: a.template_id ?? null,
    creationMethod: (a.creation_method as FormState["creationMethod"]) ?? "manual",
  };
}

/** `ya`: DM scope truthiness (`org_members`/`workspace` → enabled). */
function dmEnabled(scope: string | null | undefined): boolean {
  return !!scope && scope !== "disabled";
}

/** Duplicate/template prefill consumed once from sessionStorage['automation-prefill'] (120 s TTL). */
export function consumePrefill(): Partial<FormState> | null {
  const raw = sessionStorage.getItem("automation-prefill");
  if (!raw) return null;
  sessionStorage.removeItem("automation-prefill");
  try {
    const p = JSON.parse(raw) as Record<string, unknown> & { staged_at?: number };
    if (p.staged_at && Date.now() - p.staged_at > 120_000) return null;
    const f = emptyForm();
    const tags = (p.tags as Record<string, string> | undefined) ?? {};
    const channels = (p.slack_tool_channels as [string, string][] | undefined) ?? [];
    const maxAcu = (p.max_acu_limit as number | null | undefined) ?? null;
    const inv = (p.invocation_limit as number | null | undefined) ?? null;
    return {
      ...f,
      name: String(p.name ?? ""),
      triggers: (p.triggers as Trigger[]) ?? f.triggers,
      actions: (p.actions as Action[]) ?? f.actions,
      maxAcuLimit: maxAcu,
      invocationLimit: inv,
      invocationLimitWindowSeconds: (p.invocation_limit_window_seconds as number | null | undefined) ?? null,
      limitsEnabled: maxAcu != null || inv != null,
      maxConcurrentRuns: (p.max_concurrent_runs as number | null | undefined) ?? null,
      maxQueueDepth: (p.max_queue_depth as number | null | undefined) ?? null,
      recommendedMcps: new Set((p.recommended_mcps as string[] | undefined) ?? []),
      slackToolChannels: channels,
      slackDmEnabled: dmEnabled(p.slack_dm_scope as string | undefined),
      slackToolsEnabled: channels.length > 0 || dmEnabled(p.slack_dm_scope as string | undefined),
      linearToolsEnabled: p.linear_tools_enabled !== false,
      // New automations default scratchpad on unless the prefill explicitly sets false (module 3213).
      scratchpadEnabled: p.scratchpad_enabled !== false,
      devinMode: (p.devin_mode as string | null | undefined) ?? null,
      runAsUser: !!p.run_as_user,
      netPolicyEnabled: !!p.net_policy,
      netPolicyEntries: ((p.net_policy as { allow?: NetPolicyEntry[] } | null)?.allow) ?? [],
      metadata: Object.entries(tags).filter(([k]) => !isReservedTagKey(k)).map(([key, value]) => ({ key, value })),
      reservedTags: reservedTagsOf(tags),
      templateId: (p.template_id as string | undefined) ?? null,
      creationMethod: (p.creation_method as FormState["creationMethod"] | undefined) ?? "duplicate",
    };
  } catch { return null; }
}

/* ---------------- Normalization (spec §4.1/§4.2; module Da 2413-2444, Oa 2446-2466, ka 2468-2508, Aa 2509-2519, ja 2520-2534) ---------------- */
const SLACK_REPLY_EVENTS = new Set(["slack:message", "slack:reaction_added"]);
const NOTIFY_WHEN = new Set(["always", "failure", "success"]);

/** `xa`: blank condition value. */
export function isBlankValue(v: unknown): boolean {
  return v == null || v === "" || (Array.isArray(v) && v.length === 0);
}

/** `Da`: save-time trigger normalization. */
export function normalizeTriggers(triggers: Trigger[], hasStartSession: boolean): Trigger[] {
  return triggers
    .map((tr) => ({
      ...tr,
      replies: hasStartSession ? (tr.replies ?? []) : [],
      conditions: tr.conditions
        .map((group) => group
          .map((c) => (c.operator === "globs" && Array.isArray(c.value) ? { ...c, value: c.value.map((v) => String(v).trim()).filter(Boolean) } : c))
          .filter((c) => (c.field ? (c.field.startsWith("_webhook_") || c.operator === "is_empty" ? true : !isBlankValue(c.value)) : false)))
        .filter((group) => group.length > 0),
    }))
    .filter((tr) => !!tr.event_type);
}

/** `Oa`: dirty-comparison projection (drops `_webhook_secret_hash`, defaults `replies` to `[]`). */
export function compareTriggers(triggers: Trigger[]): Trigger[] {
  return triggers.map((tr) => ({
    event_type: tr.event_type,
    conditions: tr.conditions
      .map((group) => group.filter((c) => (c.field === "_webhook_secret_hash" ? false : c.field.startsWith("_webhook_") || c.operator === "is_empty" ? true : !isBlankValue(c.value))))
      .filter((group) => group.length > 0),
    replies: tr.replies ?? [],
  }));
}

/** `ka`: action normalization (strip `target_devin_id`, reduce Slack configs, defaults). */
export function normalizeActions(actions: Action[]): Action[] {
  return actions.map((a): Action => {
    switch (a.type) {
      case "monitor_session": {
        const m = a as MonitorSessionAction & { playbook_id?: string };
        return { ...m, target_devin_id: undefined, playbook_id: m.playbook_id ?? undefined, repos: m.repos?.length ? m.repos : undefined, slack_monitor_config: { source_channel_id: m.slack_monitor_config.source_channel_id } } as Action;
      }
      case "triage_session":
        return { ...a, target_devin_id: undefined, repos: a.repos?.length ? a.repos : undefined, slack_config: { source_channel_id: a.slack_config.source_channel_id } } as Action;
      case "message_session":
        return { ...a, auto_create: a.auto_create ?? false, target_devin_id: a.auto_create ? undefined : a.target_devin_id || undefined };
      case "start_session":
        return { ...a, playbook_id: a.playbook_id ?? undefined, repos: a.repos?.length ? a.repos : undefined, bypass_approval: a.bypass_approval ?? false, slack_team_id: undefined, slack_channel_id: a.slack_channel_id ?? undefined, slack_thread_mode: a.slack_thread_mode ?? undefined } as Action;
      case "notify":
        return { type: "notify", when: NOTIFY_WHEN.has(a.when) ? a.when : "always" };
      default:
        return a;
    }
  });
}

/** `Aa`: with a Slack-event trigger, a `start_session` without a thread mode drops its stale destination channel. */
export function reconcileSlackDestination(actions: Action[], triggers: Trigger[]): Action[] {
  if (!triggers.some((tr) => SLACK_REPLY_EVENTS.has(tr.event_type))) return actions;
  return actions.map((a) => (a.type !== "start_session" || a.slack_thread_mode != null || !a.slack_channel_id ? a : ({ ...a, slack_channel_id: undefined, slack_team_id: undefined } as Action)));
}

/** `Na`: Slack thread mode carried by the `start_session` action. */
export function slackReplyModeOf(actions: Action[]): SlackThreadMode | undefined {
  const s = actions.find((a) => a.type === "start_session");
  return s?.type === "start_session" ? s.slack_thread_mode : undefined;
}

/** `ja`: drop trigger reply entries superseded by the action's Slack thread mode (applied when the mode changes to a non-null value). */
export function syncRepliesWithSlackMode(triggers: Trigger[], mode: SlackThreadMode | undefined): Trigger[] {
  const modern = mode === "notify" || mode === "attach" || mode === "post_response";
  const stale = (tr: Trigger, r: Reply) => r.type === "notify_thread" || r.type === "attach_thread" || (modern && r.type === "post_response" && (mode === "post_response" || SLACK_REPLY_EVENTS.has(tr.event_type)));
  return triggers.map((tr) => ((tr.replies ?? []).some((r) => stale(tr, r)) ? { ...tr, replies: (tr.replies ?? []).filter((r) => !stale(tr, r)) } : tr));
}

/** `dr`: Slack channel ids selected on `slack:message` triggers. */
function slackChannelIds(triggers: Trigger[]): string[] {
  return triggers.flatMap((tr) => tr.conditions.flat().filter((c) => c.field === "channel").flatMap((c) => (Array.isArray(c.value) ? c.value : [c.value]).filter((v): v is string => typeof v === "string" && !!v)));
}

/* ---------------- Validation (spec §14; module Ca 2254-2393) ---------------- */
export type ValidationResult = {
  ok: boolean;
  /** Module check order; `errors[0]` is the message Devin toasts on attempt. */
  errors: string[];
  triggerErrors: Set<number>;
  actionErrors: Set<number>;
  /** `nn`: incomplete metadata pair — disables Save once errors are revealed (module 3255, 4054). */
  metadataError: string | null;
  /** `tn`: ACU limit outside 1–1000 — disables Save (module 3252). */
  acuError: string | null;
};

export function validate(f: FormState): ValidationResult {
  const errors: string[] = [];
  const triggerErrors = new Set<number>();
  const actionErrors = new Set<number>();
  const fail = (msg: string) => { if (!errors.includes(msg)) errors.push(msg); };
  if (!f.name.trim()) fail(t("nameRequired"));
  if (f.triggers.length === 0) fail(t("addAtLeastOneTrigger"));
  f.triggers.forEach((tr, i) => { if (!tr.event_type) { triggerErrors.add(i); fail(t("allTriggersMustHaveType")); } });
  f.triggers.forEach((tr, i) => {
    const schema = tr.event_type ? schemaFor(tr.event_type) : undefined;
    if (!schema) return;
    const flat = tr.conditions.flat();
    for (const field of schema.fields) {
      if (!field.required) continue;
      const c = flat.find((x) => x.field === field.field);
      if (!c || isBlankValue(c.value)) { triggerErrors.add(i); fail(`${schema.name} trigger requires a filter on '${field.label}'`); }
    }
  });
  f.triggers.forEach((tr, i) => {
    if (!tr.event_type.startsWith("incident_io:")) return;
    if (!tr.conditions.flat().some((c) => (c.field === "team" || c.field === "team_id") && !isBlankValue(c.value))) { triggerErrors.add(i); fail(`${schemaFor(tr.event_type)?.name ?? "incident.io"} trigger requires a Team selection`); }
  });
  f.triggers.forEach((tr, i) => {
    if (tr.event_type !== "schedule:recurring") return;
    const raw = rruleOf(tr);
    if (!raw.trim()) { triggerErrors.add(i); fail(t("scheduleTriggerRequired")); return; }
    const p = parseRRule(raw);
    if (p?.count === 1 && !isOneTimeInFuture(p)) { triggerErrors.add(i); fail(t("scheduledTimeMustBeFuture")); }
  });
  if (f.actions.length === 0) fail(t("addAtLeastOneAction"));
  f.actions.forEach((a, i) => { if (!a.type) { actionErrors.add(i); fail(t("allActionsMustHaveType")); } });
  f.actions.forEach((a, i) => { if (a.type === "start_session" && !a.prompt?.trim()) { actionErrors.add(i); fail(t("instructionsRequired")); } });
  f.actions.forEach((a, i) => { if ((a.type === "monitor_session" || a.type === "triage_session") && !a.setup_prompt?.trim()) { actionErrors.add(i); fail(t("instructionsRequired")); } });
  f.actions.forEach((a, i) => { if (a.type === "scan_new_commits" && !a.scan_id?.trim()) { actionErrors.add(i); fail(t("scanRequired")); } });
  f.actions.forEach((a, i) => { if (a.type === "message_session" && !a.auto_create && !a.target_devin_id) { actionErrors.add(i); fail(t("destinationSessionRequired")); } });
  f.actions.forEach((a, i) => { if (a.type === "start_session" && (a.slack_thread_mode === "forward" || a.slack_thread_mode === "post_response") && !a.slack_channel_id) { actionErrors.add(i); fail(t("destChannelRequired")); } });
  // Monitor/triage invariants (`c`): exactly one action, only Slack Message triggers, source channel among trigger channels.
  const slackTriggers = f.triggers.filter((tr) => tr.event_type === "slack:message");
  const triggerChannels = slackChannelIds(slackTriggers);
  const checkMonitor = (i: number, source: string | undefined, noTrigger: string, mismatch: string) => {
    if (f.actions.length !== 1) return fail(t("monitorMustHaveOneAction"));
    if (slackTriggers.length < 1) return fail(noTrigger);
    if (slackTriggers.length !== f.triggers.length) return fail(t("monitorCannotHaveNonSlackTriggers"));
    if (!source) { actionErrors.add(i); return fail(t("selectSlackChannelForTriage")); }
    if (triggerChannels.length > 0 && !triggerChannels.includes(source)) { actionErrors.add(i); fail(mismatch); }
  };
  const mi = f.actions.findIndex((a) => a.type === "monitor_session");
  const monitor = f.actions[mi];
  if (monitor?.type === "monitor_session") checkMonitor(mi, monitor.slack_monitor_config.source_channel_id, t("monitorMustHaveSlackTrigger"), t("monitorChannelMismatch"));
  const ti = f.actions.findIndex((a) => a.type === "triage_session");
  const triage = f.actions[ti];
  if (triage?.type === "triage_session") checkMonitor(ti, triage.slack_config.source_channel_id, t("triageMustHaveSlackTrigger"), t("triageChannelMismatch"));
  const metadataError = f.metadata.some((m) => !m.key || !m.value) ? t("metadataIncomplete") : null;
  const acu = f.limitsEnabled ? f.maxAcuLimit : null;
  const acuError = acu !== null && (!Number.isInteger(acu) || acu < 1 || acu > 1000) ? t("maxAcuLimit") : null;
  return { ok: errors.length === 0 && !metadataError && !acuError, errors, triggerErrors, actionErrors, metadataError, acuError };
}

/* ---------------- Serialization (spec §15; Appendix A; module 3156-3233 create, 4201-4285 update, Ki 1816-1849 security) ---------------- */
export type SlackDmScope = "disabled" | "org_members" | "workspace";
export type SecurityUpdateParams = { secure_mode_selection?: "inherit" | "disabled" | "profile"; secure_mode_profile_id?: string };
export type NetPolicy = { allow: NetPolicyEntry[] } | null;

export type CreateAutomationRequest = {
  name: string;
  triggers: Trigger[];
  actions: Action[];
  enabled: true;
  automation_id?: string;
  max_acu_limit: number | null;
  invocation_limit: number | null;
  invocation_limit_window_seconds: number | null;
  max_concurrent_runs: number | null;
  max_queue_depth: number | null;
  template_id?: string;
  recommended_mcps?: string[];
  slack_tool_channels?: [string, string][];
  slack_dm_scope: SlackDmScope;
  linear_tools_enabled: boolean;
  scratchpad_enabled: boolean;
  net_policy: NetPolicy;
  devin_mode: string | null;
  run_as_user: boolean;
  tags?: Record<string, string>;
} & SecurityUpdateParams;

export type UpdateAutomationRequest = {
  name: string;
  triggers?: Trigger[];
  actions?: Action[];
  enabled: boolean;
  max_acu_limit: number | null;
  invocation_limit: number | null;
  invocation_limit_window_seconds: number | null;
  clear_max_acu_limit: boolean;
  clear_invocation_limit: boolean;
  max_concurrent_runs: number | null;
  max_queue_depth: number | null;
  clear_max_concurrent_runs: boolean;
  clear_max_queue_depth: boolean;
  recommended_mcps: string[];
  slack_tool_channels?: [string, string][];
  slack_dm_scope: SlackDmScope;
  linear_tools_enabled: boolean;
  scratchpad_enabled: boolean;
  devin_mode: string | null;
  clear_devin_mode: boolean;
  run_as_user?: boolean;
  net_policy: NetPolicy;
  clear_net_policy: boolean;
  tags: Record<string, string>;
} & SecurityUpdateParams;

export type SerializeOptions = {
  /** Pre-minted webhook credentials: id enters the create body, hash enters the webhook trigger (`fr`). */
  webhook?: { automationId: string; hash: string } | null;
  /** Monitor source channel → `[workspace_id, channel_id]` (module 3190-3204). */
  resolveChannel?: (channelId: string) => { workspace_id: string; id: string } | undefined;
  /** `K || q`: monitor/triage mode forces the scratchpad on (module 4264). */
  forceScratchpad?: boolean;
  /** Triggers/actions are sent only while their editor is active for this type (`Wi || bi`, module 4231). */
  includeDefinition?: boolean;
  /** Security baseline the draft is compared against (`Ki`); defaults to the loaded record / inherit. */
  securityBaseline?: SecuritySelection;
};

/** `Ki.updateParams`: security fields are emitted only when the draft differs from the baseline. */
export function securityUpdateParams(sel: SecuritySelection, baseline: SecuritySelection): SecurityUpdateParams {
  if (sel.mode === baseline.mode && (sel.profileId ?? null) === (baseline.profileId ?? null)) return {};
  if (sel.mode === "inherit") return { secure_mode_selection: "inherit" };
  if (sel.mode === "none") return { secure_mode_selection: "disabled" };
  return { secure_mode_selection: "profile", secure_mode_profile_id: sel.profileId ?? undefined };
}

export function securitySelectionOf(a: Automation | null | undefined): SecuritySelection {
  return a?.secure_mode_selection === "disabled" ? { mode: "none" } : a?.secure_mode_selection === "profile" ? { mode: "profile", profileId: a.secure_mode_profile_id ?? null } : { mode: "inherit" };
}

/** User tags exclude reserved keys (`En`), then retained reserved tags are merged back (`Ta`). */
function userTags(f: FormState): Record<string, string> {
  return Object.fromEntries(f.metadata.filter((m) => m.key && m.value && !isReservedTagKey(m.key)).map((m) => [m.key, m.value]));
}

/** `Yt`/`ri`: normalized net policy — enabled → `{allow}` without blank/duplicate entries, otherwise null. */
export function netPolicyOf(f: FormState): NetPolicy {
  if (!f.netPolicyEnabled) return null;
  const seen = new Set<string>();
  const allow = f.netPolicyEntries.filter((e) => { const k = `${e.type}:${e.value.trim().toLowerCase()}`; if (!e.value.trim() || seen.has(k)) return false; seen.add(k); return true; });
  return { allow };
}

/** `fr`: replace/insert the `_webhook_secret_hash` condition group on webhook triggers. */
function withSecretHash(triggers: Trigger[], hash: string): Trigger[] {
  return triggers.map((tr) => (tr.event_type !== "webhook:incoming" ? tr : { ...tr, conditions: [...tr.conditions.map((g) => g.filter((c) => c.field !== "_webhook_secret_hash")).filter((g) => g.length > 0), [{ field: "_webhook_secret_hash", operator: "equals", value: hash }]] }));
}

/** Slack tool channels (`wt`/`Rn` gate + monitor source-channel insertion unless wildcard/exact coverage exists). */
function slackChannelsOf(f: FormState, opts: SerializeOptions): [string, string][] {
  const list: [string, string][] = f.slackToolsEnabled ? [...f.slackToolChannels] : [];
  const monitor = f.actions.find((a) => a.type === "monitor_session");
  if (f.slackToolsEnabled && monitor?.type === "monitor_session" && monitor.slack_monitor_config.source_channel_id) {
    const ch = opts.resolveChannel?.(monitor.slack_monitor_config.source_channel_id);
    if (ch && !list.some(([w, c]) => w === "*" && c === "*") && !list.some(([w, c]) => w === ch.workspace_id && c === ch.id)) list.push([ch.workspace_id, ch.id]);
  }
  return list;
}

/** `ba(l)`: DM scope when Slack tools + DMs are on. Org-member restriction flag is not modeled; `workspace` is the default branch. */
function dmScopeOf(f: FormState): SlackDmScope {
  return f.slackToolsEnabled && f.slackDmEnabled ? "workspace" : "disabled";
}

export function serializedDefinition(f: FormState, opts: SerializeOptions = {}): { triggers: Trigger[]; actions: Action[] } {
  const hasStart = f.actions.some((a) => a.type === "start_session");
  const normalized = normalizeTriggers(f.triggers, hasStart);
  return {
    triggers: opts.webhook ? withSecretHash(normalized, opts.webhook.hash) : normalized,
    actions: reconcileSlackDestination(normalizeActions(f.actions), f.triggers),
  };
}

/** §15.1 create body (module 3156-3233). */
export function toCreatePayload(f: FormState, opts: SerializeOptions = {}): CreateAutomationRequest {
  const def = serializedDefinition(f, opts);
  const channels = slackChannelsOf(f, opts);
  const tags = { ...userTags(f), ...f.reservedTags };
  return {
    name: f.name.trim(),
    triggers: def.triggers,
    ...(opts.webhook ? { automation_id: opts.webhook.automationId } : {}),
    actions: def.actions,
    enabled: true,
    max_acu_limit: f.maxAcuLimit,
    invocation_limit: f.limitsEnabled ? f.invocationLimit : null,
    invocation_limit_window_seconds: f.limitsEnabled ? f.invocationLimitWindowSeconds : null,
    max_concurrent_runs: f.maxConcurrentRuns,
    max_queue_depth: f.maxConcurrentRuns === null ? null : f.maxQueueDepth,
    ...(f.templateId ? { template_id: f.templateId } : {}),
    ...(f.recommendedMcps.size > 0 ? { recommended_mcps: [...f.recommendedMcps] } : {}),
    ...(channels.length > 0 ? { slack_tool_channels: channels } : {}),
    slack_dm_scope: dmScopeOf(f),
    linear_tools_enabled: !!f.linearToolsEnabled,
    scratchpad_enabled: f.scratchpadEnabled !== false,
    net_policy: netPolicyOf(f),
    devin_mode: f.devinMode,
    run_as_user: f.runAsUser,
    ...securityUpdateParams(f.security, opts.securityBaseline ?? { mode: "inherit" }),
    ...(Object.keys(tags).length > 0 ? { tags } : {}),
  };
}

/** Structural equality used by the update body (`Gt`). */
export function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** §15.2 update body with clear flags relative to the loaded record (module 4201-4285). */
export function toUpdatePayload(f: FormState, loaded: Automation, opts: SerializeOptions = {}): UpdateAutomationRequest {
  const def = serializedDefinition(f, opts);
  const channels = slackChannelsOf(f, opts);
  const invocation = f.limitsEnabled ? f.invocationLimit : null;
  const netPolicy = netPolicyOf(f);
  return {
    name: f.name.trim(),
    ...((opts.includeDefinition ?? true) || opts.webhook ? { triggers: def.triggers, actions: def.actions } : {}),
    enabled: loaded.enabled,
    max_acu_limit: f.maxAcuLimit,
    invocation_limit: invocation,
    invocation_limit_window_seconds: f.limitsEnabled ? f.invocationLimitWindowSeconds : null,
    clear_max_acu_limit: f.maxAcuLimit === null && loaded.max_acu_limit != null,
    clear_invocation_limit: invocation === null && loaded.invocation_limit != null,
    max_concurrent_runs: f.maxConcurrentRuns,
    max_queue_depth: f.maxConcurrentRuns === null ? null : f.maxQueueDepth,
    clear_max_concurrent_runs: f.maxConcurrentRuns === null && loaded.max_concurrent_runs != null,
    clear_max_queue_depth: (f.maxConcurrentRuns === null || f.maxQueueDepth === null) && loaded.max_queue_depth != null,
    recommended_mcps: [...f.recommendedMcps],
    ...(deepEqual(channels, loaded.slack_tool_channels ?? []) ? {} : { slack_tool_channels: channels }),
    slack_dm_scope: dmScopeOf(f),
    linear_tools_enabled: !!f.linearToolsEnabled,
    scratchpad_enabled: !!(opts.forceScratchpad || f.scratchpadEnabled),
    devin_mode: f.devinMode,
    clear_devin_mode: f.devinMode === null && loaded.devin_mode != null,
    ...(f.runAsUser === loaded.run_as_user ? {} : { run_as_user: f.runAsUser }),
    net_policy: netPolicy,
    clear_net_policy: netPolicy === null && loaded.net_policy != null,
    tags: { ...userTags(f), ...f.reservedTags },
    ...securityUpdateParams(f.security, opts.securityBaseline ?? securitySelectionOf(loaded)),
  };
}

/**
 * Canonical projection for dirty detection (spec §8.3; module Ui 3992-4050): normalized triggers (`Oa`) and actions (`ka`),
 * sorted MCP set, gated limits/Slack fields, user tags as an object, security draft. Cosmetic differences compare equal.
 */
export function canonical(f: FormState): string {
  return JSON.stringify({
    name: f.name,
    triggers: compareTriggers(f.triggers),
    actions: normalizeActions(f.actions),
    max_acu_limit: f.maxAcuLimit,
    invocation_limit: f.limitsEnabled ? f.invocationLimit : null,
    invocation_limit_window_seconds: f.limitsEnabled ? f.invocationLimitWindowSeconds : null,
    max_concurrent_runs: f.maxConcurrentRuns,
    max_queue_depth: f.maxQueueDepth,
    recommended_mcps: [...f.recommendedMcps].sort(),
    slack_tool_channels: f.slackToolsEnabled ? f.slackToolChannels : [],
    slack_tools_enabled: f.slackToolsEnabled,
    slack_dm_enabled: f.slackToolsEnabled && f.slackDmEnabled,
    linear_tools_enabled: f.linearToolsEnabled !== false,
    scratchpad_enabled: f.scratchpadEnabled !== false,
    devin_mode: f.devinMode,
    run_as_user: f.runAsUser,
    net_policy: netPolicyOf(f),
    tags: userTags(f),
    security: { mode: f.security.mode, profileId: f.security.mode === "profile" ? f.security.profileId ?? null : null },
  });
}

/** Structural dirty check between the current draft and its loaded/initial baseline. */
export function isDirty(f: FormState, baseline: FormState | null): boolean {
  return !!baseline && canonical(f) !== canonical(baseline);
}
