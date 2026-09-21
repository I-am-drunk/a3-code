import { Check, ChevronDown, MessageSquare, Plus, Search, Settings2, TriangleAlert, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import type { Action, McpServer, MessageSessionAction, SlackChannel, StartSessionAction } from "@/model/types";
import { store, useQuery } from "@/data/store";
import { useCapabilities } from "@/data/capabilities";
import { cn } from "@/lib/cn";
import { t } from "@/i18n/t";
import { Button, selectTriggerClass } from "@/ui/button";
import { Select, type SelectOption } from "@/ui/select";
import { Checkbox } from "@/ui/checkbox";
import { Badge } from "@/ui/badge";
import { Tooltip } from "@/ui/tooltip";
import { Skeleton } from "@/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/ui/popover";
import { LabeledControlRow } from "@/ui/settings";
import { inputClass } from "@/ui/input";
import { LinearIcon, McpGenericIcon, SentryIcon, DatadogIcon, JiraIcon, SlackIcon, PylonIcon } from "@/icons/brand";
import { getMcpIcon } from "@/features/templates/TemplateCard";
import { stripDevinPrefix } from "./useGenerateWithDevin";

/** Stable fallback so a loading catalog does not yield a new array (and new derived hosts) on every render. */
const EMPTY_SERVERS: McpServer[] = [];

/* ---------------- Agent type (spec §10.1; NotificationsSection-nD9RC7ou.js `V`/`H`/`Ee`) ---------------- */
export type AgentTypeValue = "start_session" | "long_running" | "auto_triage" | "remediate_finding";
/** `X` — the two session agent types that stay switchable after creation. */
const SESSION_AGENT_TYPES: AgentTypeValue[] = ["start_session", "long_running"];

function agentTypeOf(a: Action): AgentTypeValue {
  if (a.type === "message_session") return "long_running";
  if (a.type === "triage_session" || a.type === "monitor_session") return "auto_triage";
  if (a.type === "remediate_finding") return "remediate_finding";
  return "start_session";
}

type AgentTypeOptionDef = { value: AgentTypeValue; labelKey: string; descriptionKey: string };
/** `K` — base option order; `J` (Remediate) is prepended for code-scan finding mode. */
const BASE_AGENT_TYPE_OPTIONS: AgentTypeOptionDef[] = [
  { value: "start_session", labelKey: "agentTypeNewSession", descriptionKey: "agentTypeNewSessionDescription" },
  { value: "long_running", labelKey: "agentTypeLongRunning", descriptionKey: "agentTypeLongRunningDescription" },
  { value: "auto_triage", labelKey: "agentTypeAutoTriage", descriptionKey: "agentTypeAutoTriageDescription" },
];
const REMEDIATE_OPTION: AgentTypeOptionDef = { value: "remediate_finding", labelKey: "agentTypeRemediate", descriptionKey: "agentTypeRemediateDescription" };

/** Exact port of `V` (module lines 39600-39640): availability + disabled reasons per option. */
export function buildAgentTypeOptions({
  currentAgentType, isCodeScan, hasSlackMessageTrigger, triageV2Enabled = true, disableNewSession = false, monitorMode = false, lockNonSessionTypes = false, lockedReason,
}: {
  currentAgentType: AgentTypeValue; isCodeScan: boolean; hasSlackMessageTrigger: boolean; triageV2Enabled?: boolean;
  disableNewSession?: boolean; monitorMode?: boolean; lockNonSessionTypes?: boolean; lockedReason?: string;
}): SelectOption<AgentTypeValue>[] {
  const defs = isCodeScan ? [REMEDIATE_OPTION, ...BASE_AGENT_TYPE_OPTIONS] : BASE_AGENT_TYPE_OPTIONS;
  const triageUnavailable = !(triageV2Enabled && hasSlackMessageTrigger);
  return defs.map((d) => {
    const lockedOut = lockNonSessionTypes && !SESSION_AGENT_TYPES.includes(d.value);
    const disabled = monitorMode
      ? d.value !== "auto_triage"
      : lockedOut || (d.value === "auto_triage" && triageUnavailable) || (d.value === "start_session" && currentAgentType !== "start_session" && disableNewSession);
    const disabledReason = disabled
      ? monitorMode
        ? t("agentTypeWatchingSlackChannel")
        : lockedOut
          ? lockedReason ?? t("agentTypeOptionLocked")
          : d.value === "auto_triage"
            ? t("agentTypeAutoTriageSlackOnly")
            : d.value === "start_session"
              ? t("agentTypeOnlyOneNewSession")
              : undefined
      : undefined;
    return {
      value: d.value,
      label: t(d.labelKey),
      description: t(d.value === "auto_triage" && triageV2Enabled ? "agentTypeAutoTriageV2Description" : d.descriptionKey),
      disabled,
      disabledReason,
    };
  });
}

/** `H` — 220px trigger, optional lock tooltip on a span wrapper, items with description/disabled reason. */
export function AgentTypeSelect({
  value, onValueChange, hasSlackMessageTrigger, isCodeScan, disabled, lockedTooltip, triageV2Enabled, disableNewSession, monitorMode, lockNonSessionTypes, options,
}: {
  value: AgentTypeValue; onValueChange: (v: AgentTypeValue) => void; hasSlackMessageTrigger: boolean; isCodeScan: boolean; disabled?: boolean; lockedTooltip?: string;
  triageV2Enabled?: boolean; disableNewSession?: boolean; monitorMode?: boolean; lockNonSessionTypes?: boolean;
  /** Precomputed options (from `buildAgentTypeOptions`); derived from the flags when omitted. */
  options?: SelectOption<AgentTypeValue>[];
}) {
  const opts = options ?? buildAgentTypeOptions({ currentAgentType: value, isCodeScan, hasSlackMessageTrigger, triageV2Enabled, disableNewSession, monitorMode, lockNonSessionTypes });
  const sel = (
    <Select
      value={value}
      options={opts}
      onValueChange={(v) => { if (!v || v === value || opts.find((o) => o.value === v)?.disabled) return; onValueChange(v); }}
      disabled={disabled}
      itemsWithDescription
      triggerClassName="w-[220px] shrink-0 justify-between"
      contentClassName="w-[340px]"
      ariaLabel={t("agentType")}
    />
  );
  return lockedTooltip ? <Tooltip content={lockedTooltip}><span>{sel}</span></Tooltip> : sel;
}

/* ---------------- Agent mode (spec §10.5; AgentModeOptionText = label + text-12 secondary description) ---------------- */
export const MODE_OPTIONS: SelectOption<string>[] = [
  { value: "__org_default__", label: t("orgDefaultMode") + " (Normal)", description: t("orgDefaultModeDescription", { defaultValue: "Follows the organization default and updates if it changes" }) },
  { value: "normal", label: "Normal", description: "Fast and good at long-horizon planning" },
  { value: "fusion", label: "Fusion", description: "Frontier intelligence with cost-efficient execution" },
  { value: "fast", label: "Fast", description: "2.5× faster, 2× more expensive, same intelligence" },
  { value: "lite", label: "Lite", description: "Tuned for smaller defined tasks, 60% cheaper" },
  { value: "ultra", label: "Ultra", description: "Most powerful and hardest thinking, significantly more expensive" },
];

/* ---------------- Run as (RunAsSelect-BVWa2gvo.js `Jt`, `Yt`) ---------------- */
export function RunAsSelect({ runAsUser, disabled, onRunAsUserChange }: { runAsUser: boolean; disabled?: boolean; onRunAsUserChange: (v: boolean) => void }) {
  const options: SelectOption<"system" | "creator">[] = [
    { value: "system", label: t("runAsSystem"), description: t("runAsSystemDescription") },
    { value: "creator", label: t("runAsCreatorYou"), description: t("runAsCreatorYouDescription") },
  ];
  return (
    <Select
      value={runAsUser ? "creator" : "system"}
      options={options}
      onValueChange={(v) => { if (v) onRunAsUserChange(v === "creator"); }}
      itemsWithDescription
      triggerClassName="w-[220px] shrink-0 justify-between"
      contentClassName="w-[300px]"
      ariaLabel={t("runAs")}
      disabled={disabled}
    />
  );
}

/** `Yt` — orange warning listing connectors removed by the creator→system identity switch. */
export function McpAutoUnselectedNotice({ names, className }: { names: string[]; className?: string }) {
  if (names.length === 0) return null;
  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <TriangleAlert size={14} className="shrink-0 text-text-orange" aria-hidden="true" />
      <p className="text-12 text-text-secondary">{t("mcpsAutoUnselected", { names: names.join(", ") })}</p>
    </div>
  );
}

/* ---------------- MCP catalog helpers (spec §11, §20.4; useDevinModeOptions-DUD254GY.js) ---------------- */
/** Slugs whose built-in replacement should be used instead (row badge `Not recommended` + tooltip). */
const NOT_RECOMMENDED: Record<string, string> = {
  linear: t("useBuiltInLinearInstead"),
  slack: t("useBuiltInSlackInstead"),
  "slack-remote": t("useBuiltInSlackInstead"),
};
export const PYLON_NATIVE_ID = "native:pylon";

type McpServerExt = McpServer & { marketplace_server_id?: string; server_id?: string; oauth_refresh_invalid?: boolean };

/** Installed + enabled; OAuth additionally needs tokens and no invalid-refresh state (Appendix A). */
function usable(s: McpServer): boolean {
  const x = s as McpServerExt;
  return s.is_installed && s.is_enabled && (s.auth_type !== "oauth" || (!!s.has_tokens && !x.oauth_refresh_invalid));
}
/** `L` (useRunAsIdentityChange:287-294): a non-user installation of the slug exists. */
function hasNonUserInstallation(slug: string, servers: McpServer[]): boolean {
  return servers.some((o) => o.slug === slug && o.is_installed && o.is_enabled && o.scope !== "user");
}
function creatorOnly(s: McpServer, servers: McpServer[]): boolean {
  return s.scope === "user" && !hasNonUserInstallation(s.slug, servers);
}

/** §11.6 — read-only hostnames from selected MCPs with a parseable URL, enabled, executing on the session machine. */
export function mcpDerivedHosts(servers: McpServer[], selected: Set<string>): string[] {
  const out: string[] = [];
  for (const s of servers) {
    if (!selected.has(s.slug) || !s.url || !s.is_enabled || !s.executes_on_session_machine) continue;
    try {
      const host = new URL(s.url).hostname;
      if (host && !out.includes(host)) out.push(host);
    } catch { /* unparseable URL: skipped (M-09) */ }
  }
  return out;
}

/** §11.3 — selected entries not allowed by `governing_mcp_server_ids` (native ids literal; catalog slugs by any id). */
export function blockedMcpSlugs(selected: Set<string>, servers: McpServer[], governingIds: string[] | null | undefined): Set<string> {
  const out = new Set<string>();
  if (!governingIds) return out;
  const allow = new Set(governingIds);
  for (const slug of selected) {
    if (slug.startsWith("native:")) { if (!allow.has(slug)) out.add(slug); continue; }
    const rows = servers.filter((s) => s.slug === slug) as McpServerExt[];
    if (rows.length === 0) continue;
    const permitted = rows.some((s) => [s.installation_id, s.marketplace_server_id, s.server_id].some((id) => !!id && allow.has(id)));
    if (!permitted) out.add(slug);
  }
  return out;
}

/**
 * Port of useRunAsIdentityChange-dM4qm5p5.js `V` (spec §10.5, §20.4, M-06/M-07): switching creator→system removes
 * selected user-scoped installations without a non-user twin (deferred until the catalog is complete) and returns
 * their names for the warning; switching back clears the warning and does not restore selections.
 */
export function useRunAsIdentityChange({ runAsUser, servers, catalogReady, selected, onChange }: {
  runAsUser: boolean; servers: McpServer[] | undefined; catalogReady: boolean; selected: Set<string>; onChange: (s: Set<string>) => void;
}): string[] {
  const [names, setNames] = useState<string[]>([]);
  const prev = useRef(runAsUser);
  const pending = useRef(false);
  const latest = useRef({ servers, selected, onChange });
  latest.current = { servers, selected, onChange };
  useEffect(() => {
    if (prev.current !== runAsUser) {
      prev.current = runAsUser;
      if (runAsUser) { pending.current = false; setNames([]); return; }
      pending.current = true;
    }
    if (!pending.current || !catalogReady) return;
    const { servers: srv, selected: sel, onChange: emit } = latest.current;
    if (!srv) return;
    pending.current = false;
    const removed = srv.filter((s) => sel.has(s.slug) && creatorOnly(s, srv));
    if (removed.length === 0) return;
    const next = new Set(sel);
    removed.forEach((s) => next.delete(s.slug));
    emit(next);
    setNames(removed.map((s) => s.name));
  }, [runAsUser, catalogReady]);
  return names;
}

function ServerIcon({ slug, className }: { slug: string; className?: string }) {
  const icon = getMcpIcon(slug, 16);
  if (icon) return <span className={cn("flex items-center justify-center", className)}>{icon}</span>;
  switch (slug) {
    case "sentry": return <SentryIcon size={16} className={className} />;
    case "datadog": return <DatadogIcon size={16} className={className} />;
    case "atlassian": return <JiraIcon size={16} className={className} />;
    default: return <McpGenericIcon size={16} className={className} />;
  }
}

/* ---------------- Built-in Slack tools row (spec §11.4; useDevinModeOptions 47600-47860) ---------------- */
const WILDCARD: [string, string] = ["*", "*"];
const isWildcard = (p: [string, string]) => p[0] === "*" && p[1] === "*";

function CheckRow({ checked, disabled, onClick, children, trailing }: { checked: boolean; disabled?: boolean; onClick: () => void; children: ReactNode; trailing?: ReactNode }) {
  return (
    <button type="button" role="menuitemcheckbox" aria-checked={checked} disabled={disabled} onClick={onClick}
      className="flex h-[30px] w-full items-center gap-2 rounded-[6px] px-2 text-left text-13 text-text-primary outline-none can-hover:hover:bg-tint-secondary focus-visible:bg-tint-secondary disabled:pointer-events-none disabled:text-text-disabled">
      <span className="flex size-4 shrink-0 items-center justify-center">{checked && <Check size={14} />}</span>
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {trailing}
    </button>
  );
}

export function SlackToolsRow({ channels, onChannelsChange, enabled, onEnabledChange, dmEnabled, onDmEnabledChange, forceEnabled, lockedChannelId, readOnly }: {
  channels: [string, string][]; onChannelsChange: (v: [string, string][]) => void; enabled: boolean; onEnabledChange?: (v: boolean) => void;
  dmEnabled?: boolean; onDmEnabledChange?: (v: boolean) => void; forceEnabled?: boolean; lockedChannelId?: string | null; readOnly?: boolean;
}) {
  const catalog = useQuery("slack-channels", () => store.slackChannels());
  const [q, setQ] = useState("");
  const all: SlackChannel[] = catalog.data ?? [];
  const locked = lockedChannelId ? all.find((c) => c.channel_id === lockedChannelId) : undefined;
  const lockedPrivate = !!locked?.is_private;
  const isPublic = channels.some(isWildcard);
  const specific = channels.filter((p) => !isWildcard(p));
  const mode: "public" | "specific" = isPublic ? "public" : "specific";
  const label = (c: SlackChannel) => (all.some((x) => x.name === c.name && x.channel_id !== c.channel_id) ? `#${c.name} (${c.workspace_name})` : `#${c.name}`);
  const summary = isPublic
    ? t(dmEnabled ? "publicChannelsWithDms" : "publicChannels")
    : specific.length > 0
      ? t(dmEnabled ? "channelCountWithDms" : "channelCount", { count: specific.length })
      : t(dmEnabled ? "dmsOnly" : "noAccess");

  const setEnabled = (on: boolean) => {
    if (!on) { onChannelsChange([]); onDmEnabledChange?.(false); onEnabledChange?.(false); return; }
    if (channels.length === 0) {
      if (lockedPrivate) { if (locked) onChannelsChange([[locked.workspace_id, locked.channel_id]]); }
      else onChannelsChange([WILDCARD]);
    }
    onDmEnabledChange?.(true);
    onEnabledChange?.(true);
  };
  const setMode = (m: "public" | "specific") => {
    if (m === mode) return;
    onChannelsChange(m === "public" ? [WILDCARD] : locked ? [[locked.workspace_id, locked.channel_id]] : []);
  };
  const toggleChannel = (c: SlackChannel) => {
    if (c.channel_id === lockedChannelId) return;
    const has = specific.some(([w, id]) => w === c.workspace_id && id === c.channel_id);
    onChannelsChange(has ? specific.filter(([w, id]) => !(w === c.workspace_id && id === c.channel_id)) : [...specific, [c.workspace_id, c.channel_id]]);
  };
  const s = q.trim().toLowerCase();
  const filtered = all.filter((c) => !s || `#${c.name}`.toLowerCase().includes(s) || c.workspace_name.toLowerCase().includes(s));
  const workspaces = [...new Set(filtered.map((c) => c.workspace_id))];

  return (
    <div className="flex h-[34px] items-center gap-2 rounded-md px-2">
      <Tooltip content={t("requiredForAutomationType")} disabled={!forceEnabled}>
        <Checkbox checked={enabled} onCheckedChange={(v) => setEnabled(!!v)} disabled={forceEnabled || readOnly} aria-label="Slack" />
      </Tooltip>
      <div className="flex size-4 shrink-0 items-center justify-center"><SlackIcon size={14} /></div>
      <span className="min-w-0 shrink-0 text-13 font-medium text-text-primary">Slack</span>
      <div className="min-w-0 flex-1" />
      {enabled && (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" disabled={readOnly} className="shrink-0 font-normal text-text-secondary">{summary}<ChevronDown size={14} /></Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-[300px] p-1">
            <p className="px-2 py-1 text-12 text-text-secondary">{t("onlyJoinedChannelsAvailable")}</p>
            <Tooltip content={t("notAvailableForPrivateChannels")} disabled={!lockedPrivate}>
              <span className="block"><CheckRow checked={mode === "public"} disabled={lockedPrivate} onClick={() => setMode("public")}>{t("allPublicChannels")}</CheckRow></span>
            </Tooltip>
            <CheckRow checked={mode === "specific"} onClick={() => setMode("specific")}>{t("specificChannels")}</CheckRow>
            {mode === "specific" && (
              <>
                <div className="my-1 h-px bg-border-secondary" />
                <div className="px-2 pb-1.5 pt-0.5">
                  <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("searchChannels")} aria-label={t("searchSlackChannels")} className={cn(inputClass, "h-8 w-full text-13")} />
                </div>
                <div className="max-h-[220px] overflow-y-auto">
                  {catalog.isLoading ? (
                    <div className="px-2 py-1.5 text-13 text-text-secondary">{t("loadingChannels")}</div>
                  ) : filtered.length === 0 ? (
                    <div className="px-2 py-1.5 text-13 text-text-secondary">{t(s ? "noChannelsFound" : "noSlackChannelsFound")}</div>
                  ) : workspaces.map((ws) => (
                    <div key={ws}>
                      {workspaces.length > 1 && <div className="px-2.5 pb-1 pt-1.5 text-12 font-medium uppercase text-text-secondary">{filtered.find((c) => c.workspace_id === ws)?.workspace_name}</div>}
                      {filtered.filter((c) => c.workspace_id === ws).map((c) => {
                        const isLocked = c.channel_id === lockedChannelId;
                        const checked = isLocked || specific.some(([w, id]) => w === c.workspace_id && id === c.channel_id);
                        return (
                          <CheckRow key={c.channel_id} checked={checked} disabled={isLocked} onClick={() => toggleChannel(c)}
                            trailing={isLocked ? <span className="ml-auto shrink-0 text-text-secondary">{t("triggerChannel")}</span> : undefined}>
                            {label(c)}
                          </CheckRow>
                        );
                      })}
                    </div>
                  ))}
                </div>
                <p className="px-2 pb-1 pt-1.5 text-12 text-text-secondary">{t("inviteDevinToChannelToAdd")}</p>
              </>
            )}
            {onDmEnabledChange && (
              <div className="px-1 pb-1">
                <div className="my-1 h-px bg-border-secondary" />
                <CheckRow checked={!!dmEnabled} onClick={() => onDmEnabledChange(!dmEnabled)}>{t("directMessages")}</CheckRow>
              </div>
            )}
          </PopoverContent>
        </Popover>
      )}
      <Badge variant="blue">{t("builtIn")}</Badge>
    </div>
  );
}

/* ---------------- MCP selector (spec §11.1–11.5; useDevinModeOptions-DUD254GY.js 48100-48405) ---------------- */
/** Draft security selection used to resolve the governing profile (`profileDraft: Wn`). Accepts the form shape or the API shape. */
export type ProfileDraft = { mode?: "inherit" | "none" | "profile"; selection?: "inherit" | "disabled" | "profile" | null; profileId?: string | null };

export function McpSelector({
  selected, onChange, recommended, runAsUser, linearEnabled, onLinearEnabledChange, readOnly, onAutoUnselect,
  slackToolChannels, onSlackToolChannelsChange, slackToolsEnabled, onSlackToolsEnabledChange, slackDmEnabled, onSlackDmEnabledChange, slackForceEnabled, lockedSlackChannelId,
  profileDraft, automationId, governingMcpServerIds, governingProfileName, showGoverningProfileWarnings = true, onMcpHostsChange, onBlockedChange,
}: {
  selected: Set<string>; onChange: (s: Set<string>) => void; recommended: Set<string>; runAsUser: boolean; linearEnabled: boolean; onLinearEnabledChange: (v: boolean) => void; readOnly?: boolean;
  onAutoUnselect?: (names: string[]) => void;
  /** §11.4 built-in Slack tools — the row renders only when Slack is connected and `onSlackToolChannelsChange` is provided. */
  slackToolChannels?: [string, string][]; onSlackToolChannelsChange?: (v: [string, string][]) => void; slackToolsEnabled?: boolean; onSlackToolsEnabledChange?: (v: boolean) => void;
  slackDmEnabled?: boolean; onSlackDmEnabledChange?: (v: boolean) => void; slackForceEnabled?: boolean; lockedSlackChannelId?: string | null;
  /** §11.3 governing-profile intersection — resolved from `profileDraft` via the store, or supplied directly. */
  profileDraft?: ProfileDraft; automationId?: string | null; governingMcpServerIds?: string[] | null; governingProfileName?: string | null; showGoverningProfileWarnings?: boolean;
  /** §11.6 hostnames derived from selected session-machine MCPs (for the Advanced network list); blocked slugs for save-time notices. */
  onMcpHostsChange?: (hosts: string[]) => void; onBlockedChange?: (slugs: string[]) => void;
}) {
  const caps = useCapabilities();
  const catalog = useQuery("mcp-servers", () => store.mcpServers());
  const [q, setQ] = useState("");
  const servers = useMemo(() => catalog.data ?? EMPTY_SERVERS, [catalog.data]);
  const catalogReady = !catalog.isLoading && !catalog.isError && !!catalog.data;

  // §11.2 — document visibility returning to `visible` invalidates the catalog.
  const refetchRef = useRef(catalog.refetch);
  refetchRef.current = catalog.refetch;
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === "visible") refetchRef.current(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  // §11.3 — resolved governing profile for the draft selection (cache identity = automation + selection + profile).
  const selection = profileDraft ? (profileDraft.selection ?? (profileDraft.mode === "none" ? "disabled" : profileDraft.mode ?? "inherit")) : null;
  const security = useQuery(
    `resolved-security:${automationId ?? "new"}:${selection ?? ""}:${profileDraft?.profileId ?? ""}`,
    () => store.resolvedSecurity(automationId ?? null, selection, profileDraft?.profileId ?? null),
    { enabled: !!profileDraft && showGoverningProfileWarnings, keepPrevious: true },
  );
  const governingIds = governingMcpServerIds !== undefined ? governingMcpServerIds : security.data?.governing_mcp_server_ids;
  const profileName = governingProfileName ?? security.data?.governing_profile_name ?? null;
  const blocked = useMemo(() => (showGoverningProfileWarnings ? blockedMcpSlugs(selected, servers, governingIds) : new Set<string>()), [selected, servers, governingIds, showGoverningProfileWarnings]);

  const available = useMemo(() => servers.filter((s) => usable(s) || selected.has(s.slug)), [servers, selected]);
  const setupList = useMemo(() => servers.filter((s) => !usable(s) && !selected.has(s.slug) && recommended.has(s.slug)), [servers, recommended, selected]);
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    const list = s ? available.filter((x) => x.name.toLowerCase().includes(s)) : available;
    return [...list].sort((a, b) => {
      const ra = a.slug in NOT_RECOMMENDED ? 1 : 0, rb = b.slug in NOT_RECOMMENDED ? 1 : 0;
      if (ra !== rb) return ra - rb;
      const sa = recommended.has(a.slug) ? 0 : 1, sb = recommended.has(b.slug) ? 0 : 1;
      if (sa !== sb) return sa - sb;
      return a.name.localeCompare(b.name);
    });
  }, [available, q, recommended]);
  const filteredSetup = useMemo(() => { const s = q.trim().toLowerCase(); return s ? setupList.filter((x) => x.name.toLowerCase().includes(s)) : setupList; }, [setupList, q]);

  const isCreatorOnly = (s: McpServer) => !runAsUser && creatorOnly(s, servers);
  const selectable = filtered.filter((s) => !isCreatorOnly(s));
  const allSelected = selectable.length > 0 && selectable.every((s) => selected.has(s.slug));
  const someSelected = selectable.some((s) => selected.has(s.slug));
  const toggle = (slug: string) => { const n = new Set(selected); if (n.has(slug)) n.delete(slug); else n.add(slug); onChange(n); };
  const toggleAll = () => { const n = new Set(selected); if (allSelected) selectable.forEach((s) => n.delete(s.slug)); else selectable.forEach((s) => n.add(s.slug)); onChange(n); };
  const showBuiltIns = !q.trim();
  const showLinear = showBuiltIns && caps.connections.linear === "connected";
  const showPylon = showBuiltIns && (caps.connections.pylon === "connected" || selected.has(PYLON_NATIVE_ID));
  const showSlack = showBuiltIns && caps.connections.slack === "connected" && !!onSlackToolChannelsChange;
  const selectedCount = selected.size + (showLinear && linearEnabled ? 1 : 0);

  // §10.5 identity switch pruning (creator→system), reported upward for the warning row.
  const autoUnselected = useRunAsIdentityChange({ runAsUser, servers: catalog.data, catalogReady, selected, onChange });
  const onAutoUnselectRef = useRef(onAutoUnselect);
  onAutoUnselectRef.current = onAutoUnselect;
  useEffect(() => { onAutoUnselectRef.current?.(autoUnselected); }, [autoUnselected]);

  // M-05 — once the catalog is complete, drop unknown selected slugs (built-in `native:*` ids are kept).
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  useEffect(() => {
    if (!catalogReady) return;
    const known = new Set(servers.map((s) => s.slug));
    const stale = [...selected].filter((slug) => !known.has(slug) && !slug.startsWith("native:"));
    if (stale.length === 0) return;
    const next = new Set(selected);
    stale.forEach((s) => next.delete(s));
    onChangeRef.current(next);
  }, [catalogReady, servers, selected]);

  // §11.6 / §11.3 — derived hosts and blocked slugs for the page/Advanced section.
  const hosts = useMemo(() => mcpDerivedHosts(servers, selected), [servers, selected]);
  const hostsRef = useRef(onMcpHostsChange);
  hostsRef.current = onMcpHostsChange;
  const hostsKey = hosts.join("\u0000");
  const lastHostsKey = useRef<string | null>(null);
  useEffect(() => {
    if (lastHostsKey.current === hostsKey) return;
    lastHostsKey.current = hostsKey;
    hostsRef.current?.(hosts);
  }, [hostsKey, hosts]);
  const blockedRef = useRef(onBlockedChange);
  blockedRef.current = onBlockedChange;
  const blockedKey = [...blocked].sort().join("\u0000");
  const lastBlockedKey = useRef<string | null>(null);
  useEffect(() => {
    if (lastBlockedKey.current === blockedKey) return;
    lastBlockedKey.current = blockedKey;
    blockedRef.current?.([...blocked]);
  }, [blockedKey, blocked]);

  const blockedBadge = (
    <Tooltip content={t("mcpBlockedByProfileTooltip")}><span className="flex items-center"><Badge variant="warning">{t("blockedByProfile")}</Badge></span></Tooltip>
  );

  return (
    <div role="group" aria-label={t("mcps")} className="flex flex-col overflow-hidden rounded-[10px] border border-border-secondary">
      <div className="flex h-[42px] items-center gap-2 border-b border-border-secondary pl-4 pr-3.5">
        <div className="flex flex-1 items-center gap-2">
          <Checkbox checked={allSelected ? true : someSelected ? "indeterminate" : false} onCheckedChange={toggleAll} disabled={readOnly || selectable.length === 0} aria-label={t("mcps")} />
          <Search size={16} className="shrink-0 text-text-secondary" />
          <input type="text" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("searchMcps")} className="min-w-0 flex-1 bg-transparent text-13 text-text-primary outline-none placeholder:text-text-disabled" />
        </div>
        {selectedCount > 0 && <span className="shrink-0 text-13 text-text-secondary">{t("selected", { count: selectedCount })}</span>}
      </div>
      <div className="max-h-[265px] overflow-y-auto p-2">
        {showLinear && (
          <label className="flex h-[34px] cursor-pointer items-center gap-2 rounded-md px-2">
            <Checkbox checked={linearEnabled} onCheckedChange={(v) => onLinearEnabledChange(!!v)} disabled={readOnly} />
            <div className="flex size-4 shrink-0 items-center justify-center"><LinearIcon size={14} /></div>
            <span className="min-w-0 flex-1 truncate text-13 font-medium text-text-primary">Linear</span>
            <Badge variant="blue">{t("builtIn")}</Badge>
          </label>
        )}
        {showPylon && (
          <label className="flex h-[34px] cursor-pointer items-center gap-2 rounded-md px-2">
            <Checkbox checked={selected.has(PYLON_NATIVE_ID)} onCheckedChange={() => toggle(PYLON_NATIVE_ID)} disabled={readOnly} />
            <div className="flex size-4 shrink-0 items-center justify-center"><PylonIcon size={14} /></div>
            <span className="min-w-0 flex-1 truncate text-13 font-medium text-text-primary">{t("pylonReadOnly")}</span>
            {blocked.has(PYLON_NATIVE_ID) && blockedBadge}
            <Badge variant="blue">{t("builtIn")}</Badge>
          </label>
        )}
        {showSlack && onSlackToolChannelsChange && (
          <SlackToolsRow
            channels={slackToolChannels ?? []}
            onChannelsChange={onSlackToolChannelsChange}
            enabled={slackToolsEnabled ?? (slackToolChannels ?? []).length > 0}
            onEnabledChange={onSlackToolsEnabledChange}
            dmEnabled={slackDmEnabled}
            onDmEnabledChange={onSlackDmEnabledChange}
            forceEnabled={slackForceEnabled}
            lockedChannelId={lockedSlackChannelId}
            readOnly={readOnly}
          />
        )}
        {catalog.isLoading ? (
          <div className="flex flex-col gap-1 p-2">{[0, 1, 2].map((i) => <div key={i} className="flex h-[34px] items-center gap-2 px-2"><Skeleton className="size-4 shrink-0" /><Skeleton className="h-3.5 w-40" /></div>)}</div>
        ) : catalog.isError ? (
          <div className="flex flex-col items-center gap-2 px-2 py-4"><span className="text-13 text-text-secondary">{t("mcpCatalogError")}</span><Button size="sm" variant="secondary" onClick={() => catalog.refetch()}>{t("retry")}</Button></div>
        ) : filtered.length === 0 && filteredSetup.length === 0 ? (
          <div className="px-2 py-4 text-center text-13">{q.trim() ? t("noMcpsMatching", { query: q.trim() }) : t("noMcpsAvailable")}</div>
        ) : (
          <>
            {filtered.map((s) => {
              const nr = NOT_RECOMMENDED[s.slug];
              const co = isCreatorOnly(s);
              const row = (
                <label key={s.slug} className={cn("flex h-[34px] items-center gap-2 rounded-md px-2", !co && "cursor-pointer")}>
                  <Checkbox checked={selected.has(s.slug)} onCheckedChange={() => toggle(s.slug)} disabled={readOnly || co} />
                  <ServerIcon slug={s.slug} className={nr || co ? "size-4 opacity-50" : "size-4"} />
                  <span className={co ? "min-w-0 flex-1 truncate text-13 font-medium text-text-disabled" : nr ? "min-w-0 flex-1 truncate text-13 font-medium" : "min-w-0 flex-1 truncate text-13 font-medium text-text-primary"}>{s.name}{nr && " (MCP)"}</span>
                  {co && <Tooltip content={t("mcpRunAsCreatorOnly")}><span className="flex items-center"><TriangleAlert size={14} className="shrink-0 text-text-orange" /></span></Tooltip>}
                  {blocked.has(s.slug) && blockedBadge}
                  {nr ? <Badge>{t("notRecommended")}</Badge> : recommended.has(s.slug) && <Badge variant="blue">{t("suggested")}</Badge>}
                </label>
              );
              return nr ? <Tooltip key={s.slug} content={nr}>{row}</Tooltip> : row;
            })}
            {filteredSetup.map((s) => (
              <div key={s.slug} className="flex h-[34px] items-center gap-2 rounded-md px-2">
                <Checkbox checked={selected.has(s.slug)} onCheckedChange={() => toggle(s.slug)} disabled={readOnly} />
                <ServerIcon slug={s.slug} className="size-4 opacity-50" />
                <span className="min-w-0 flex-1 truncate text-13 font-medium">{s.name}</span>
                <Link to="/settings/$" params={{ _splat: `mcp-marketplace/setup/${s.slug}` }} target="_blank" onClick={(e) => e.stopPropagation()}><Button size="sm" variant="secondary">{t("setup")}</Button></Link>
              </div>
            ))}
          </>
        )}
      </div>
      {showGoverningProfileWarnings && blocked.size > 0 && (
        <p className="border-t border-border-secondary px-4 py-2 text-13 text-text-orange">
          {profileName ? t("mcpsBlockedByProfile_named", { count: blocked.size, name: profileName }) : t("mcpsBlockedByProfile", { count: blocked.size })}
        </p>
      )}
    </div>
  );
}

/* ---------------- Session destination combobox (spec §10.4; SessionSelect-Ck6Tlg2o.js `P`/`F`/`I`/`z`, RunAsSelect `Pt`) ---------------- */
export type SessionSummary = { devin_id: string; title?: string | null; updated_at?: string | null; created_at?: string | null; author?: string | null };
export type SessionPinnedOption = { value: string; label: string; description?: string; icon?: ReactNode };

/** `P` — accepts a session id or any URL whose path contains `/sessions/<id>`. */
export function parseSessionRef(input: string | null | undefined): string | null {
  if (!input || !input.trim()) return null;
  try {
    const m = new URL(input.trim()).pathname.match(/\/sessions\/([a-zA-Z0-9_-]+)/);
    return m && m[1] ? m[1] : null;
  } catch {
    return /^[a-zA-Z0-9_-]+$/.test(input) ? input : null;
  }
}
/** `we` — canonical Devin identifier persisted in `target_devin_id`. */
export function toDevinId(id: string): string { return id.startsWith("devin-") ? id : `devin-${id}`; }
/** `F` — the combobox emits the session URL; the destination select re-parses it. */
const sessionUrl = (id: string) => `${window.location.origin}/sessions/${stripDevinPrefix(id)}`;

/** `I` — relative timestamp used in session rows. */
function relativeTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const minutes = Math.floor((Date.now() - d.getTime()) / 6e4);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  return minutes < 1 ? "just now" : minutes < 60 ? `${minutes}m ago` : hours < 24 ? `${hours}h ago` : days < 7 ? `${days}d ago` : d.toLocaleDateString();
}

const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();
/** Session search is not part of the store port; these rows stand in until the page passes `sessions`. */
const DEFAULT_SESSIONS: SessionSummary[] = [
  { devin_id: "devin-b1f4e8c2a9d34f6e", title: "Slack support inbox — long-running", updated_at: hoursAgo(1), author: store.users[0]?.name },
  { devin_id: "devin-7c2d9a41e5b34c08", title: "Nightly dependency review", updated_at: hoursAgo(26), author: store.users[1]?.name },
  { devin_id: "devin-e93a5f0c7d214b7a", title: "Sentry alert investigations", updated_at: hoursAgo(24 * 9), author: store.users[2]?.name },
];

function SessionOptionRow({ selected, onSelect, icon, label, description, meta, className }: {
  selected: boolean; onSelect: () => void; icon?: ReactNode; label: string; description?: string; meta?: ReactNode; className?: string;
}) {
  return (
    <button type="button" role="option" aria-selected={selected} onClick={onSelect}
      className={cn("group flex w-full items-start gap-4 px-3 py-2 text-left text-13 text-text-primary outline-none can-hover:hover:bg-tint-secondary focus-visible:bg-tint-secondary", className)}>
      <div className="relative mt-0.5 h-3.5 w-3.5 flex-shrink-0">
        {selected ? <Check size={14} className="absolute inset-0" /> : <span className="text-text-secondary">{icon}</span>}
      </div>
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate">{label}</span>
        {description && <span className="text-12 text-text-secondary">{description}</span>}
        {meta}
      </div>
    </button>
  );
}

/** `z` — searchable session combobox with an optional pinned option (`Create new session`). */
export function SessionSelect({ value, onChange, placeholder = "Search for a session...", className, disabled, pinnedOption, sessions = DEFAULT_SESSIONS }: {
  value: string; onChange: (value: string, title?: string) => void; placeholder?: string; className?: string; disabled?: boolean; pinnedOption?: SessionPinnedOption; sessions?: SessionSummary[];
}) {
  const [input, setInput] = useState("");
  const [open, setOpen] = useState(false);
  const pinnedSelected = !!pinnedOption && value === pinnedOption.value;
  const ref = useMemo(() => (pinnedSelected ? null : parseSessionRef(value)), [value, pinnedSelected]);
  const selected = ref ? sessions.find((s) => stripDevinPrefix(s.devin_id) === stripDevinPrefix(ref)) : undefined;
  const display = pinnedSelected ? pinnedOption.label : selected ? selected.title || selected.devin_id : ref || null;
  const needle = (parseSessionRef(input) ?? input).trim().toLowerCase();
  const filtered = needle
    ? sessions.filter((s) => (s.title ?? "").toLowerCase().includes(needle) || stripDevinPrefix(s.devin_id).toLowerCase().includes(stripDevinPrefix(needle)))
    : sessions;
  const pick = (v: string) => {
    setOpen(false);
    if (!v) { onChange(""); return; }
    if (pinnedOption && v === pinnedOption.value) { onChange(pinnedOption.value); return; }
    onChange(sessionUrl(v), sessions.find((s) => s.devin_id === v)?.title ?? undefined);
  };
  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setInput(""); }}>
      <PopoverTrigger asChild disabled={disabled}>
        <button type="button" className={cn(selectTriggerClass, "w-full max-w-[400px] justify-between", className)} aria-label={placeholder} disabled={disabled}>
          <span className="min-w-0 flex-1 truncate text-left">
            {display ? (
              <span className="flex min-w-0 items-center gap-2"><MessageSquare size={16} className="flex-shrink-0 text-text-secondary" /><span className="truncate" title={display}>{display}</span></span>
            ) : <span className="text-text-secondary">{placeholder}</span>}
          </span>
          <ChevronDown className="!size-4 shrink-0 text-text-secondary" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="min-w-[400px] p-0" onOpenAutoFocus={(e) => e.preventDefault()}>
        <div className="border-b border-border-secondary px-3 py-1.5">
          <input autoFocus value={input} onChange={(e) => setInput(e.target.value)} placeholder={t("sessionSelect.searchSessions", { defaultValue: "Search sessions..." })} className="w-full bg-transparent text-13 text-text-primary outline-none placeholder:text-text-disabled" />
        </div>
        {pinnedOption && !input && (
          <SessionOptionRow selected={pinnedSelected} onSelect={() => pick(pinnedOption.value)} icon={pinnedOption.icon} label={pinnedOption.label} description={pinnedOption.description} className="border-b border-border-secondary" />
        )}
        {filtered.length === 0 && <div className="px-3 py-1.5 text-13 text-text-secondary">No sessions found.</div>}
        {filtered.length > 0 && (
          <div className="max-h-[240px] overflow-y-auto" role="listbox">
            {filtered.map((s) => (
              <SessionOptionRow
                key={s.devin_id}
                selected={!!selected && selected.devin_id === s.devin_id}
                onSelect={() => pick(s.devin_id)}
                icon={<MessageSquare size={14} />}
                label={s.title || s.devin_id}
                meta={<div className="flex items-center gap-1 text-12 text-text-secondary"><span>{relativeTime(s.updated_at || s.created_at)}</span>{s.author && <><span>·</span><span>{s.author}</span></>}</div>}
              />
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

const AUTO_CREATE_VALUE = "__auto_create__"; // `X`

/** `Pt` — destination for `message_session`: pinned `Create new session` sets `auto_create`, picking a session stores the canonical id. */
export function DestinationSessionSelect({ action, onChange, readonly, variant = "inline", sessions }: {
  action: MessageSessionAction; onChange: (a: MessageSessionAction) => void; readonly?: boolean; variant?: "inline" | "section"; sessions?: SessionSummary[];
}) {
  const select = (
    <SessionSelect
      disabled={readonly}
      value={action.target_devin_id ? stripDevinPrefix(action.target_devin_id) : action.auto_create ? AUTO_CREATE_VALUE : ""}
      onChange={(v) => {
        if (!v) { onChange({ ...action, target_devin_id: "", auto_create: false }); return; }
        if (v === AUTO_CREATE_VALUE) { onChange({ ...action, target_devin_id: "", auto_create: true }); return; }
        const m = v.match(/\/sessions\/([a-zA-Z0-9_-]+)/);
        onChange({ ...action, target_devin_id: toDevinId(m ? m[1] : v), auto_create: false });
      }}
      placeholder={t(readonly ? "noSessionSelected" : "selectSession")}
      className={variant === "section" ? "w-[220px] max-w-full" : undefined}
      pinnedOption={action.auto_create && action.target_devin_id ? undefined : { value: AUTO_CREATE_VALUE, label: t("autoCreateSessionOption"), description: t("autoCreateSessionOptionDescription"), icon: <Plus size={14} /> }}
      sessions={sessions}
    />
  );
  return variant === "section" ? (
    <div className="flex items-center justify-between gap-4">
      <div className="flex flex-col gap-0.5">
        <label className="text-13 font-medium text-text-primary">{t("destinationSession")}</label>
        <p className="text-13 text-text-secondary">{t("destinationSessionDescription")}</p>
      </div>
      <div className="shrink-0">{select}</div>
    </div>
  ) : (
    <span className="flex items-center gap-2 pl-2 text-13 text-text-primary">{t("toLabel")}{select}</span>
  );
}

/* ---------------- Agent card (NotificationsSection-nD9RC7ou.js `Ee` + editor footer rows 23205-23258) ---------------- */
export function AgentCard({
  action, index, count, onChange, onRemove, readonly, showError, hasSlackMessageTrigger, isCodeScan, locked,
  devinMode, onDevinModeChange, runAsUser, onRunAsUserChange, mcps, onMcpsChange, recommendedMcps, linearEnabled, onLinearEnabledChange, isLast,
  disableNewSession, triageV2Enabled, monitorMode, showRunAs = true, runAsDisabled, modeOptions, sessions,
  slackToolChannels, onSlackToolChannelsChange, slackToolsEnabled, onSlackToolsEnabledChange, slackDmEnabled, onSlackDmEnabledChange, slackForceEnabled, lockedSlackChannelId,
  profileDraft, automationId, governingMcpServerIds, governingProfileName, onMcpHostsChange, onBlockedMcpsChange,
}: {
  action: Action; index: number; count: number; onChange: (a: Action) => void; onRemove?: () => void; readonly?: boolean; showError?: boolean;
  hasSlackMessageTrigger: boolean; isCodeScan: boolean;
  /** Post-create lock (`agentTypeLocked`): pass `isEdit` — session types stay switchable between themselves, others lock. */
  locked?: boolean;
  devinMode: string | null; onDevinModeChange: (m: string | null) => void; runAsUser: boolean; onRunAsUserChange: (v: boolean) => void;
  mcps: Set<string>; onMcpsChange: (s: Set<string>) => void; recommendedMcps: Set<string>; linearEnabled: boolean; onLinearEnabledChange: (v: boolean) => void; isLast: boolean;
  /** Another `start_session` exists → `Start new session` disabled with `agentTypeOnlyOneNewSession`. */
  disableNewSession?: boolean; triageV2Enabled?: boolean; monitorMode?: boolean;
  showRunAs?: boolean; runAsDisabled?: boolean; modeOptions?: SelectOption<string>[]; sessions?: SessionSummary[];
  slackToolChannels?: [string, string][]; onSlackToolChannelsChange?: (v: [string, string][]) => void; slackToolsEnabled?: boolean; onSlackToolsEnabledChange?: (v: boolean) => void;
  slackDmEnabled?: boolean; onSlackDmEnabledChange?: (v: boolean) => void; slackForceEnabled?: boolean; lockedSlackChannelId?: string | null;
  profileDraft?: ProfileDraft; automationId?: string | null; governingMcpServerIds?: string[] | null; governingProfileName?: string | null;
  onMcpHostsChange?: (hosts: string[]) => void; onBlockedMcpsChange?: (slugs: string[]) => void;
}) {
  const [autoUnselected, setAutoUnselected] = useState<string[]>([]);
  const type = agentTypeOf(action);
  // `b` — per-type drafts so switching back restores fields (spec §10.1).
  const drafts = useRef<Partial<Record<Action["type"], Action>>>({});
  drafts.current[action.type] = action;
  const prompt = action.type === "start_session" || action.type === "message_session" ? action.prompt : action.type === "monitor_session" || action.type === "triage_session" ? action.setup_prompt : "";
  const setPrompt = (v: string) => {
    if (action.type === "start_session" || action.type === "message_session") onChange({ ...action, prompt: v });
    else if (action.type === "monitor_session" || action.type === "triage_session") onChange({ ...action, setup_prompt: v });
  };
  const isSessionType = SESSION_AGENT_TYPES.includes(type); // `T`
  const selectLocked = !!locked && !isSessionType; // `E`
  const options = buildAgentTypeOptions({
    currentAgentType: type, isCodeScan, hasSlackMessageTrigger, triageV2Enabled, disableNewSession, monitorMode,
    lockNonSessionTypes: !!locked && isSessionType, lockedReason: t("agentTypeOptionLocked"),
  });
  const switchType = (v: AgentTypeValue) => {
    if (!v || v === type || options.find((o) => o.value === v)?.disabled) return;
    const p = action.type === "remediate_finding" ? "" : prompt;
    if (v === "remediate_finding") { onChange({ type: "remediate_finding" }); return; }
    if (v === "auto_triage") { onChange({ type: "triage_session", setup_prompt: p, slack_config: { source_channel_id: "" } }); return; }
    if (v === "long_running") {
      const draft = drafts.current.message_session as MessageSessionAction | undefined;
      onChange({ ...(draft ?? { target_devin_id: "", auto_create: true }), type: "message_session", prompt: p });
      return;
    }
    const rest: Partial<StartSessionAction> = { ...((drafts.current.start_session as StartSessionAction | undefined) ?? {}) };
    delete rest.playbook_id;
    delete rest.repos;
    onChange({ bypass_approval: true, ...rest, type: "start_session", prompt: p } as StartSessionAction);
  };
  const modeOpts = modeOptions ?? MODE_OPTIONS;

  return (
    <div className={cn("flex flex-col gap-4 rounded-[10px] border border-border-secondary bg-bg-elevated p-3.5", showError && "ring-1 ring-text-destructive")}>
      <div className="flex items-start gap-3">
        <div className="flex min-w-0 flex-1 items-center justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-0.5">
            <div className="flex items-center gap-1">
              <label className="text-13 font-medium text-text-primary">{t("agentType")}</label>
              {count > 1 && <span className="text-13 font-normal">{t("agentNumberSuffix", { number: index + 1 })}</span>}
            </div>
            <p className="text-13 text-text-secondary">{t("agentTypeDescription")}</p>
          </div>
          <AgentTypeSelect value={type} options={options} onValueChange={switchType} hasSlackMessageTrigger={hasSlackMessageTrigger} isCodeScan={isCodeScan} disabled={readonly || selectLocked} lockedTooltip={selectLocked && !readonly ? t("agentTypeLocked") : undefined} />
        </div>
        {count > 1 && (
          <Tooltip content={locked ? t("agentTypeLocked") : t("remove")}>
            <span><Button variant="ghost" size="sm" onClick={onRemove} disabled={locked} aria-label={t("remove")} className="ml-auto shrink-0"><X size={14} /></Button></span>
          </Tooltip>
        )}
      </div>
      {action.type === "message_session" && <DestinationSessionSelect action={action} onChange={onChange} readonly={readonly} variant="section" sessions={sessions} />}
      {action.type !== "remediate_finding" && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-0.5">
            <label className="text-13 font-medium text-text-primary">{t("instructions")}</label>
            <p className="text-13 text-text-secondary">{action.type === "monitor_session" ? t("instructionsDescriptionMonitor") : t("instructionsAgentDescription")}</p>
          </div>
          {readonly ? (
            <div className="min-h-20 whitespace-pre-wrap rounded-2xl bg-tint-tertiary p-3 text-13 text-text-primary">{prompt || (action.type === "triage_session" || action.type === "monitor_session" ? t("noStartingInstructions") : t("noPrompt"))}</div>
          ) : (
            <div className={cn("relative flex w-full flex-col overflow-y-auto scrollbar-thin rounded-[10px] border border-border-secondary bg-bg-elevated text-13 text-text-primary", showError && !prompt.trim() && "ring-1 ring-text-destructive")} style={{ minHeight: 120, maxHeight: "max(250px, 30vh)" }}>
              <textarea
                ref={(el) => { if (el) { el.style.height = "0px"; el.style.height = `${Math.max(118, el.scrollHeight)}px`; } }}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={action.type === "triage_session" || action.type === "monitor_session" ? t("triagePromptPlaceholder") : t("promptPlaceholder")}
                className="w-full shrink-0 resize-none overflow-hidden rounded-none bg-transparent px-3.5 py-3 text-13 leading-[18px] text-text-primary placeholder:text-text-secondary focus:outline-none"
              />
            </div>
          )}
        </div>
      )}
      {isLast && action.type !== "remediate_finding" && (
        <>
          {modeOpts.length > 1 && (
            <LabeledControlRow
              label={t("devinMode")}
              description={t("devinModeDescription")}
              control={<Select value={devinMode ?? "__org_default__"} options={modeOpts} onValueChange={(v) => onDevinModeChange(v === "__org_default__" ? null : v)} itemsWithDescription triggerClassName="w-[220px] shrink-0 justify-between" contentClassName="w-[300px]" ariaLabel={t("selectAgentMode")} disabled={readonly} />}
            />
          )}
          {showRunAs && (
            <LabeledControlRow
              label={t("runAs")}
              description={t("runAsDescription")}
              control={<RunAsSelect runAsUser={runAsUser} onRunAsUserChange={onRunAsUserChange} disabled={readonly || runAsDisabled} />}
            />
          )}
          <div className="flex flex-col gap-3">
            <LabeledControlRow
              label={t("mcps")}
              description={t("mcpsDescription")}
              control={<Button variant="secondary" asChild><Link to="/settings/$" params={{ _splat: "connections" }} search={{ tab: "mcps" } as never} target="_blank"><Settings2 size={16} />{t("manageMcps")}</Link></Button>}
            />
            <McpSelector
              selected={mcps} onChange={onMcpsChange} recommended={recommendedMcps} runAsUser={runAsUser}
              linearEnabled={linearEnabled} onLinearEnabledChange={onLinearEnabledChange} readOnly={readonly} onAutoUnselect={setAutoUnselected}
              slackToolChannels={slackToolChannels} onSlackToolChannelsChange={onSlackToolChannelsChange} slackToolsEnabled={slackToolsEnabled} onSlackToolsEnabledChange={onSlackToolsEnabledChange}
              slackDmEnabled={slackDmEnabled} onSlackDmEnabledChange={onSlackDmEnabledChange} slackForceEnabled={slackForceEnabled} lockedSlackChannelId={lockedSlackChannelId}
              profileDraft={profileDraft} automationId={automationId} governingMcpServerIds={governingMcpServerIds} governingProfileName={governingProfileName}
              onMcpHostsChange={onMcpHostsChange} onBlockedChange={onBlockedMcpsChange}
            />
            {!runAsUser && <McpAutoUnselectedNotice names={autoUnselected} className="-mt-2.5" />}
          </div>
        </>
      )}
    </div>
  );
}
