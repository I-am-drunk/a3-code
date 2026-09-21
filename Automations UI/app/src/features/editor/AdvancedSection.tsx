import { Check, ChevronDown, Copy, Info, Plus, Trash2, TriangleAlert, X } from "lucide-react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { useEffect, useMemo, useRef, useState, type ClipboardEvent, type ReactNode } from "react";
import type { NetPolicyEntry, ResolvedSecurity, SecurityProfile } from "@/model/types";
import type { FormState, MetadataRow, SecuritySelection } from "./form";
import { DEFAULT_INVOCATION_LIMIT } from "./form";
import { cn } from "@/lib/cn";
import { t } from "@/i18n/t";
import { store, useQuery } from "@/data/store";
import { useCapabilities } from "@/data/capabilities";
import { Badge } from "@/ui/badge";
import { Button, selectTriggerClass } from "@/ui/button";
import { IconButton } from "@/ui/icon-button";
import { Switch } from "@/ui/switch";
import { Select } from "@/ui/select";
import { Tooltip } from "@/ui/tooltip";
import { Input } from "@/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/ui/input-group";
import { Popover, PopoverAnchor, PopoverContent } from "@/ui/popover";
import { SettingsCard, SettingsCardGroup, SettingsRow } from "@/ui/settings";
import { ConfirmDialog } from "@/ui/dialog";
import { tagDotColor, isReservedTagKey } from "@/model/tags";

type Patch = (p: Partial<FormState>) => void;

/* ---------------- Advanced accordion (AutomationEditorPage `ct`/`dt`, module 5178–5310) ---------------- */
export function AdvancedAccordion({ open, onOpenChange, children }: { open: boolean; onOpenChange: (o: boolean) => void; children: ReactNode }) {
  return (
    <div className="flex flex-col">
      <button type="button" aria-expanded={open} onClick={() => onOpenChange(!open)} className="flex w-fit items-center gap-1.5 text-13 font-medium text-text-primary hover:text-text-primary">
        {t("advanced")}<ChevronDown size={14} className={cn("text-text-secondary transition-transform", open && "rotate-180")} />
      </button>
      {open && <div className="mt-4 flex flex-col gap-6 pb-2">{children}</div>}
    </div>
  );
}

/* ---------------- Shared security queries (useSecurityProfiles-CaMt22id.js:188-274) ---------------- */
type DraftSelection = "inherit" | "disabled" | "profile";
type SecurityDraft = { selection: DraftSelection | null; profileId: string | null };

/** Local selection → resolved-profile draft parameters (Appendix A editor encoding). */
function draftOf(sec: SecuritySelection): SecurityDraft {
  return {
    selection: sec.mode === "none" ? "disabled" : sec.mode === "profile" ? "profile" : "inherit",
    profileId: sec.mode === "profile" ? sec.profileId ?? null : null,
  };
}

/** Selectable profiles split by scope (`useSelectableSecurityProfiles`). */
function useSecurityProfiles(enabled: boolean) {
  const q = useQuery("security-profiles", () => store.securityProfiles(), { enabled });
  const all = q.data ?? [];
  return {
    all,
    enterpriseProfiles: all.filter((p) => p.scope === "enterprise"),
    orgProfiles: all.filter((p) => p.scope === "org"),
    isLoading: enabled && q.isLoading,
    isLoaded: q.data !== undefined && !q.isLoading && !q.isError,
    isError: q.isError,
  };
}

/** Resolved governing profile; cache identity = automation id + draft selection + draft profile id (spec §13.3, §20.4). */
function useResolvedSecurity(automationId: string | null | undefined, draft: SecurityDraft | null, enabled = true) {
  const sel = draft?.selection ?? null;
  const pid = draft?.profileId ?? null;
  const q = useQuery(`resolved-security:${automationId ?? "null"}:${sel ?? "null"}:${pid ?? "null"}`, () => store.resolvedSecurity(automationId ?? null, sel, pid), { enabled });
  const d: ResolvedSecurity | undefined = q.data;
  return {
    resolvedDefault: d?.resolved_default ?? null,
    governingProfileName: d?.governing_profile_name ?? null,
    governingScope: d?.governing_scope ?? null,
    governingProfileScope: d?.governing_profile_scope ?? null,
    governingHasNetPolicy: d?.governing_has_net_policy ?? false,
    governingNetPolicy: d?.governing_net_policy ?? null,
    governingUnresolved: d?.governing_unresolved ?? false,
    isLoaded: d !== undefined && !q.isLoading && !q.isError,
    isError: q.isError,
  };
}

/* ---------------- Security profile select (SecurityProfileSelect-B8zdT-I1.js `S`) ---------------- */
const USE_DEFAULTS = "__use_defaults__";
const NO_PROFILE = "__no_profile__";
const selectItemClass = "relative flex h-[30px] cursor-default select-none items-center rounded-[6px] px-2.5 pr-8 text-13 text-text-primary outline-none data-[highlighted]:bg-tint-secondary data-[disabled]:pointer-events-none";
const groupLabelClass = "px-2.5 py-1.5 text-11 font-medium text-text-secondary";

export function SecurityProfileSelect({
  selection, profileId, profiles, showScopeLabels = false, enterpriseProfiles = [], orgProfiles = [], disabled = false,
  inheritLabel, noProfileLabel = t("securityProfileNone"), inheritedProfileId, triggerClassName, onChange,
}: {
  selection: SecuritySelection["mode"]; profileId?: string | null; profiles: SecurityProfile[]; showScopeLabels?: boolean;
  enterpriseProfiles?: SecurityProfile[]; orgProfiles?: SecurityProfile[]; disabled?: boolean; inheritLabel: string; noProfileLabel?: string;
  inheritedProfileId?: string | null; triggerClassName?: string; onChange: (next: SecuritySelection) => void;
}) {
  const selectedName = profiles.find((p) => p.secure_mode_profile_id === profileId)?.name ?? t("unknownProfile", { defaultValue: "Unknown profile" });
  const value = selection === "profile" && profileId ? profileId : selection === "none" ? NO_PROFILE : USE_DEFAULTS;
  // The inherited (org default) profile is de-duplicated out of the pickable list unless it is the explicit selection.
  const hidden = inheritedProfileId && !(selection === "profile" && profileId === inheritedProfileId) ? inheritedProfileId : null;
  const { pickable, ent, org } = useMemo(() => {
    const keep = (p: SecurityProfile) => p.secure_mode_profile_id !== hidden;
    return { pickable: hidden ? profiles.filter(keep) : profiles, ent: hidden ? enterpriseProfiles.filter(keep) : enterpriseProfiles, org: hidden ? orgProfiles.filter(keep) : orgProfiles };
  }, [hidden, profiles, enterpriseProfiles, orgProfiles]);
  const grouped = showScopeLabels && ent.length > 0 && org.length > 0;
  const display = value === USE_DEFAULTS ? inheritLabel : value === NO_PROFILE ? noProfileLabel : selectedName;
  const item = (v: string, label: ReactNode) => (
    <SelectPrimitive.Item key={v} value={v} className={selectItemClass}>
      <SelectPrimitive.ItemText>{label}</SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator className="absolute right-2.5 top-1/2 -translate-y-1/2"><Check className="size-4" /></SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  );
  const profileItem = (p: SecurityProfile) => item(p.secure_mode_profile_id, p.name);
  return (
    <SelectPrimitive.Root
      value={value}
      disabled={disabled}
      onValueChange={(v) => onChange(v && v !== USE_DEFAULTS && v !== NO_PROFILE ? { mode: "profile", profileId: v } : v === NO_PROFILE ? { mode: "none", profileId: null } : { mode: "inherit", profileId: null })}
    >
      <SelectPrimitive.Trigger aria-label={t("securityProfile")} className={cn(selectTriggerClass, triggerClassName)}>
        <span className="min-w-0 truncate text-left">{display}</span>
        <SelectPrimitive.Icon asChild><ChevronDown className="!size-4 shrink-0 text-text-secondary" /></SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content position="popper" align="end" sideOffset={4} className="z-[70] max-h-[var(--radix-select-content-available-height)] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-[8px] border border-border-secondary bg-bg-elevated p-1 text-text-primary shadow-L3 menu-in">
          <SelectPrimitive.Viewport className="max-h-[320px]">
            {item(USE_DEFAULTS, inheritLabel)}
            {item(NO_PROFILE, noProfileLabel)}
            {grouped ? (
              <>
                <SelectPrimitive.Group>
                  <SelectPrimitive.Label className={groupLabelClass}>{t("enterpriseProfiles", { defaultValue: "Enterprise profiles" })}</SelectPrimitive.Label>
                  {ent.map(profileItem)}
                </SelectPrimitive.Group>
                <SelectPrimitive.Group>
                  <SelectPrimitive.Label className={groupLabelClass}>{t("orgProfiles", { defaultValue: "Org profiles" })}</SelectPrimitive.Label>
                  {org.map(profileItem)}
                </SelectPrimitive.Group>
              </>
            ) : pickable.map(profileItem)}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}

/* ---------------- Security profile row (spec §13.3; AutomationEditorPage `Oi`, module 460–560) ---------------- */
export function SecurityProfileRow({ form, patch, readOnly, automationId, saving, bindingLoadFailed }: {
  form?: FormState; patch?: Patch; readOnly?: boolean; automationId?: string | null; saving?: boolean;
  /** Force the live-observed binding load-error state. */
  bindingLoadFailed?: boolean;
}) {
  const caps = useCapabilities();
  const canManage = caps.permissions.manageSecurityProfiles !== null;
  const wired = !!form && !!patch;
  const profiles = useSecurityProfiles(canManage && wired);
  const resolved = useResolvedSecurity(automationId, null, wired);
  const description = t("securityProfileDescription");
  const warning = (
    <p className="flex items-start gap-1.5 text-12 text-text-secondary">
      <TriangleAlert size={12} className="mt-0.5 shrink-0 text-text-orange" aria-hidden="true" />
      <span>{t("securityProfileInjectionWarning")}</span>
    </p>
  );
  const row = (children: ReactNode) => <SettingsRow boldLabel label={t("securityProfile")} description={description} content={warning}>{children}</SettingsRow>;
  if (!form || !patch || bindingLoadFailed || (canManage && profiles.isError)) {
    return row(<span className="text-13 text-text-secondary">{t("securityProfileBindingLoadFailed")}</span>);
  }
  const sel = form.security;
  if (!canManage || readOnly) {
    const name = profiles.all.find((p) => p.secure_mode_profile_id === sel.profileId)?.name;
    const text = sel.mode === "none" ? t("securityProfileNone") : sel.mode === "profile" ? name ?? sel.profileId ?? null : null;
    return text ? row(<span className="text-13 text-text-secondary">{text}</span>) : null;
  }
  if (profiles.isLoaded && resolved.isLoaded && profiles.all.length === 0 && !resolved.resolvedDefault && sel.mode === "inherit") return null;
  const showScopeLabels = profiles.enterpriseProfiles.length > 0 && profiles.orgProfiles.length > 0;
  const noneResolved = resolved.isLoaded && !resolved.isError && !resolved.governingUnresolved && !resolved.resolvedDefault;
  const inheritLabel = resolved.resolvedDefault
    ? t("securityProfileUseOrgDefault_named", { name: resolved.resolvedDefault.name })
    : t(noneResolved ? "securityProfileUseOrgDefault_none" : "securityProfileUseOrgDefault");
  return row(
    <SecurityProfileSelect
      selection={sel.mode}
      profileId={sel.profileId}
      profiles={profiles.all}
      showScopeLabels={showScopeLabels}
      enterpriseProfiles={profiles.enterpriseProfiles}
      orgProfiles={profiles.orgProfiles}
      disabled={profiles.isLoading || !!saving}
      inheritLabel={inheritLabel}
      noProfileLabel={t("securityProfileNone")}
      inheritedProfileId={resolved.resolvedDefault?.secure_mode_profile_id}
      onChange={(security) => patch({ security })}
    />,
  );
}

/* ---------------- Network policy (spec §13.4; network-policy-editor-CvHMbvLE.js + editor `Wt`/`Bt`/`zt`) ---------------- */
type NetPolicyType = NetPolicyEntry["type"];
type GoverningNetPolicy = NonNullable<ResolvedSecurity["governing_net_policy"]>;
/** MCP-derived read-only entry (spec §11.6): hostname from the server URL, slug as label, `source: "mcp"`. */
export type McpNetEntry = { value: string; label?: string; source?: string };
/** Org default allowlist rows (`source: "default"`): live UI shows `git-manager.devin.ai` with its row switch on. */
export const DEFAULT_NET_POLICY_HOSTS = ["git-manager.devin.ai"];

/** Entry type classifier (`we`): dotted quad → ipv4, colon → ipv6, else hostname. */
export function classifyNetValue(raw: string): NetPolicyType {
  const v = raw.trim();
  if (/^\d{1,3}(\.\d{1,3}){3}(\/\d{1,2})?$/.test(v)) return "ipv4";
  if (v.includes(":")) return "ipv6";
  return "hostname";
}
/** Multi-value splitter (`Se`): whitespace/comma separated, trimmed, empties dropped. */
export function splitNetValues(text: string): string[] {
  return text.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
}
function mkEntry(value: string, enabled: boolean): NetPolicyEntry {
  const type = classifyNetValue(value);
  return type === "ipv4" ? { type, value, enabled } : type === "ipv6" ? { type, value, enabled } : { type: "hostname", value, enabled };
}
function hostAllowed(host: string, pattern: string): boolean {
  const h = host.toLowerCase(), p = pattern.toLowerCase();
  if (p === "*") return true;
  if (p.startsWith("*.")) {
    const base = p.slice(2);
    const bare = h.startsWith("*.") ? h.slice(2) : h;
    return bare === base || bare.endsWith(`.${base}`);
  }
  return h === p;
}
function allowedByPolicy(type: NetPolicyType, value: string, policy: GoverningNetPolicy): boolean {
  return policy.allow.some((a) => {
    if ("hostname" in a) return type === "hostname" && hostAllowed(value, a.hostname);
    if ("ipv4" in a) return type === "ipv4" && a.ipv4 === value;
    return type === "ipv6" && a.ipv6.toLowerCase() === value.toLowerCase();
  });
}
/** `zt(value, policy)`: blocked when any token of the value is not allowed by the governing allowlist. */
export function isBlockedByPolicy(value: string, policy: GoverningNetPolicy | null | undefined): boolean {
  if (!policy) return false;
  return splitNetValues(value).some((part) => !allowedByPolicy(classifyNetValue(part), part, policy));
}

type CustomRow = { entry: NetPolicyEntry; index: number };
type DefaultRow = { entry: NetPolicyEntry; index: number | null };

/** Editable allowlist (network-policy-editor `D`): custom rows newest-first, then default rows, then MCP rows. */
function NetworkPolicyEditor({ entries, onEntriesChange, defaultHosts, extraEntries, readOnly, blockedValues }: {
  entries: NetPolicyEntry[]; onEntriesChange: (next: NetPolicyEntry[]) => void; defaultHosts: string[]; extraEntries: McpNetEntry[]; readOnly?: boolean; blockedValues: string[];
}) {
  const newestRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const scrollTopPending = useRef(false);
  const [focusNewest, setFocusNewest] = useState(false);
  useEffect(() => {
    if (focusNewest && newestRef.current) { newestRef.current.focus(); setFocusNewest(false); }
  }, [focusNewest, entries]);
  useEffect(() => {
    if (scrollTopPending.current && listRef.current) { listRef.current.scrollTop = 0; scrollTopPending.current = false; }
  }, [entries]);

  const defaults = useMemo(() => new Set(defaultHosts.map((h) => h.toLowerCase())), [defaultHosts]);
  const custom: CustomRow[] = entries.map((entry, index) => ({ entry, index })).filter((r) => !defaults.has(r.entry.value.trim().toLowerCase()));
  const defaultRows: DefaultRow[] = defaultHosts.map((h) => {
    const index = entries.findIndex((e) => e.value.trim().toLowerCase() === h.toLowerCase());
    return index >= 0 ? { entry: entries[index]!, index } : { entry: { type: "hostname", value: h, enabled: false }, index: null };
  });
  const present = new Set([...entries.map((e) => e.value.trim()), ...defaultHosts]);
  const extras = extraEntries.filter((x) => !present.has(x.value.trim()));
  const newestFirst = [...custom].reverse();
  const blocked = useMemo(() => new Set(blockedValues.map((v) => v.trim())), [blockedValues]);
  const duplicates = useMemo(() => {
    const seen = new Map<string, number>(); const dup = new Set<number>();
    entries.forEach((e, i) => { const v = e.value.trim(); if (!v) return; if (seen.has(v)) dup.add(i); else seen.set(v, i); });
    return dup;
  }, [entries]);

  const update = (i: number, value: string) => onEntriesChange(entries.map((e, j) => (j === i ? mkEntry(value, e.enabled) : e)));
  const remove = (i: number) => onEntriesChange(entries.filter((_, j) => j !== i));
  const add = () => { onEntriesChange([...entries, { type: "hostname", value: "", enabled: true }]); setFocusNewest(true); scrollTopPending.current = true; };
  const blurRow = (i: number) => { if (!entries[i]?.value.trim()) remove(i); };
  const toggleDefault = (row: DefaultRow) => {
    if (row.index === null) onEntriesChange([...entries, { type: "hostname", value: row.entry.value, enabled: true }]);
    else onEntriesChange(entries.map((e, j) => (j === row.index ? { ...e, enabled: !e.enabled } : e)));
  };
  const paste = (ev: ClipboardEvent<HTMLInputElement>, i: number) => {
    if (readOnly) return;
    const text = ev.clipboardData.getData("text");
    if (!/[\s,]/.test(text)) return;
    ev.preventDefault();
    const el = ev.currentTarget; const cur = el.value;
    const start = el.selectionStart ?? cur.length; const end = el.selectionEnd ?? cur.length;
    const parts = splitNetValues(cur.slice(0, start) + text + cur.slice(end));
    if (parts.length === 0) return;
    const next = [...entries];
    next[i] = mkEntry(parts[0]!, next[i]?.enabled ?? true);
    next.splice(i, 0, ...parts.slice(1).map((v) => mkEntry(v, true)).reverse());
    onEntriesChange(next); scrollTopPending.current = true;
  };

  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const copyTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(copyTimer.current), []);
  const copyAll = () => {
    const values = [...entries, ...extras.map((x) => ({ value: x.value, enabled: true }))].filter((e) => e.enabled).map((e) => e.value.trim()).filter(Boolean);
    if (values.length === 0) return;
    Promise.resolve(navigator.clipboard?.writeText(values.join("\n")))
      .then(() => setCopyState("copied"), () => setCopyState("failed"))
      .finally(() => { window.clearTimeout(copyTimer.current); copyTimer.current = window.setTimeout(() => setCopyState("idle"), 2000); });
  };

  const blockedBadge = (
    <Tooltip content={t("blockedByProfileTooltip")}>
      <span className="inline-flex"><Badge variant="warning" className="cursor-pointer select-none">{t("blockedByProfile")}</Badge></span>
    </Tooltip>
  );

  return (
    <div className="bg-bg-elevated border-border-secondary flex flex-col overflow-hidden rounded-[10px] border">
      <div className="border-border-secondary flex h-[32px] shrink-0 items-stretch border-b">
        {readOnly ? <div className="flex-1" /> : (
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={add} className="text-text-secondary hover:text-text-primary hover:bg-tint-secondary text-13 flex min-w-0 flex-1 items-center gap-2 px-3">
            <Plus size={14} /><span>{t("addDomain")}</span>
          </button>
        )}
        <Tooltip content={copyState === "copied" ? t("copied") : copyState === "failed" ? t("copyFailed") : t("copyAllDomains")} side="top">
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={copyAll} aria-label={t("copyAllDomains")} className="border-border-secondary text-text-secondary hover:text-text-primary hover:bg-tint-secondary flex items-center border-l px-3"><Copy size={14} /></button>
        </Tooltip>
      </div>
      <div ref={listRef} className="divide-border-secondary divide-y overflow-y-auto max-h-[50vh]">
        {newestFirst.map(({ entry, index }, n) => {
          const v = entry.value.trim(); const dup = duplicates.has(index);
          return (
            <form key={`custom-${index}`} className="flex h-[32px] items-center gap-2 px-3" onSubmit={(e) => { e.preventDefault(); if (!readOnly) add(); }}>
              <Input
                ref={n === 0 ? newestRef : undefined}
                value={entry.value}
                onChange={(e) => update(index, e.target.value)}
                onBlur={() => blurRow(index)}
                onPaste={(e) => paste(e, index)}
                placeholder={t("domainPlaceholder")}
                className="text-13 min-w-0 flex-1 rounded-none border-none bg-transparent p-0 focus-visible:ring-0"
                readOnly={readOnly}
              />
              {dup && (
                <Tooltip content={t("duplicateRemovedOnSave")}>
                  <span className="inline-flex"><Badge variant="warning" className="cursor-pointer select-none">{t("duplicateDomain")}</Badge></span>
                </Tooltip>
              )}
              {entry.enabled && blocked.has(v) && !dup && blockedBadge}
              {!readOnly && (
                <Button variant="ghost" size="sm" type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => remove(index)} aria-label={t("removeDomain", { value: entry.value || t("domainEntry") })}><X size={14} /></Button>
              )}
            </form>
          );
        })}
        {defaultRows.map((row) => (
          <div key={`default-${row.entry.value}`} className="flex h-[32px] items-center gap-2 px-3">
            <span className={cn("text-13 min-w-0 flex-1 truncate", row.entry.enabled ? "text-text-primary" : "text-text-disabled line-through")}>{row.entry.value}</span>
            {row.entry.enabled && blocked.has(row.entry.value.trim()) && blockedBadge}
            <Switch checked={row.entry.enabled} disabled={readOnly} onCheckedChange={() => toggleDefault(row)} aria-label={row.entry.value} />
          </div>
        ))}
        {extras.map((x) => (
          <div key={`mcp-${x.value}`} className="flex h-[32px] items-center gap-2 px-3">
            <span className="text-text-primary text-13 min-w-0 flex-1 truncate">{x.value}</span>
            {x.label && <span className="text-text-secondary text-12">{x.label}</span>}
            {blocked.has(x.value.trim()) && blockedBadge}
            <Badge variant="blue">{x.source ?? "mcp"}</Badge>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Network policy row (editor `Wt`): switch, governed description, blocked summary + Update-profile link, destructive off-confirmation. */
export function NetworkPolicyRow({ form, patch, readOnly, mcpHosts, mcpEntries, automationId, defaultHosts = DEFAULT_NET_POLICY_HOSTS }: {
  form: FormState; patch: Patch; readOnly?: boolean;
  /** Legacy: bare MCP hostnames (rendered as `source: "mcp"` rows). Prefer `mcpEntries`. */
  mcpHosts?: string[];
  /** MCP-derived entries with slug labels (spec §11.6). */
  mcpEntries?: McpNetEntry[];
  automationId?: string | null;
  /** Org default allowlist rows shown with a row switch. */
  defaultHosts?: string[];
}) {
  const caps = useCapabilities();
  const [confirmOff, setConfirmOff] = useState(false);
  const extras = useMemo<McpNetEntry[]>(() => mcpEntries ?? (mcpHosts ?? []).map((value) => ({ value, source: "mcp" })), [mcpEntries, mcpHosts]);
  const g = useResolvedSecurity(automationId, draftOf(form.security));
  const loaded = g.isLoaded && !g.governingUnresolved;
  const failed = g.isError || g.governingUnresolved;
  const name = g.governingProfileName;
  const scopeLabel =
    g.governingScope === "enterprise" ? t("securityProfileScope_enterprise")
      : g.governingScope === "automations_default" ? t("securityProfileScope_automationsDefault")
        : g.governingScope === "automation" ? t("securityProfileScope_automation")
          : g.governingScope === "org" ? t("securityProfileScope_organization")
            : null;
  const entries = form.netPolicyEntries;
  const policy = g.governingNetPolicy;
  const blocked = useMemo(
    () => (policy ? [...new Set([...entries, ...extras.map((x) => ({ value: x.value, enabled: true }))].filter((e) => e.enabled && isBlockedByPolicy(e.value, policy)).map((e) => e.value.trim()))] : []),
    [entries, extras, policy],
  );
  const enterpriseScoped = g.governingProfileScope === "enterprise";
  const perm = caps.permissions.manageSecurityProfiles;
  const canUpdate = enterpriseScoped ? perm === "enterprise" : perm !== null;
  let link: ReactNode = null;
  if (canUpdate && name) {
    const params = new URLSearchParams({ editProfile: name });
    if (blocked.length > 0) params.set("allowDestination", blocked.join(","));
    const href = `${enterpriseScoped ? "/settings/enterprise-devin" : "/settings/devin"}?${params.toString()}#${enterpriseScoped ? "enterprise-security-profile-default" : "security-profile-default"}`;
    link = <a href={href} target="_blank" rel="noopener noreferrer" className="text-text-link hover:text-text-link-strong hover:underline">{t("updateSecurityProfile")}</a>;
  }
  const setEnabled = (on: boolean) => {
    if (!on && form.netPolicyEnabled && !g.governingHasNetPolicy) { setConfirmOff(true); return; }
    if (on && entries.length === 0 && defaultHosts.length > 0) {
      patch({ netPolicyEnabled: true, netPolicyEntries: defaultHosts.map((value): NetPolicyEntry => ({ type: "hostname", value, enabled: true })) });
      return;
    }
    patch({ netPolicyEnabled: on });
  };
  return (
    <SettingsRow
      boldLabel
      label={t("networkPolicy")}
      description={t(scopeLabel ? "networkPolicyControlDescription_governed" : "networkPolicyControlDescription")}
      content={
        <>
          {form.netPolicyEnabled ? (
            <>
              <NetworkPolicyEditor entries={entries} onEntriesChange={(netPolicyEntries) => patch({ netPolicyEntries })} defaultHosts={defaultHosts} extraEntries={extras} readOnly={readOnly} blockedValues={blocked} />
              {blocked.length > 0 && (
                <p className="text-13 text-text-orange">
                  {name ? t("entriesBlockedByProfile_named", { count: blocked.length, name }) : t("entriesBlockedByProfile", { count: blocked.length })}
                  {" "}
                  {link ?? t("entriesBlockedContactAdmin", { count: blocked.length })}
                </p>
              )}
              {!scopeLabel && failed ? <p className="text-13 text-text-secondary">{t("securityProfileLookupFailed")}</p> : null}
            </>
          ) : scopeLabel ? (
            <p className="text-13 text-text-secondary">{name ? t("securityProfileGoverns_named", { scope: scopeLabel, name }) : t("securityProfileGoverns", { scope: scopeLabel })}</p>
          ) : loaded ? (
            <p className="text-13 text-text-secondary">{t("unrestrictedAccess")}</p>
          ) : failed ? (
            <p className="text-13 text-text-secondary">{t("securityProfileLookupFailed")}</p>
          ) : null}
          <ConfirmDialog
            open={confirmOff}
            onOpenChange={setConfirmOff}
            title={t("disableNetworkControlsTitle")}
            description={t("disableNetworkControlsDescription")}
            confirmLabel={t("disable")}
            cancelLabel={t("cancel")}
            onConfirm={() => { patch({ netPolicyEnabled: false }); setConfirmOff(false); }}
          />
        </>
      }
    >
      <Switch checked={form.netPolicyEnabled} disabled={readOnly} onCheckedChange={setEnabled} aria-label={t("networkPolicy")} />
    </SettingsRow>
  );
}

/* ---------------- Metadata (spec §13.6; useRunAsIdentityChange `Gt`/`Kt`) ---------------- */
/** Key/value combobox: substring-filtered suggestions, read-only shows a dimmed static box. */
function SuggestInput({ value, onChange, suggestions, placeholder, readOnly }: { value: string; onChange: (v: string) => void; suggestions: string[]; placeholder: string; readOnly?: boolean }) {
  const [open, setOpen] = useState(false);
  const filtered = useMemo(() => suggestions.filter((s) => s.toLowerCase().includes(value.toLowerCase())), [suggestions, value]);
  if (readOnly) {
    return <div className="flex-1 rounded-[6px] border border-border-secondary bg-bg-elevated px-2.5 py-1.5 text-13 text-text-primary opacity-60">{value || <span className="text-text-secondary">{placeholder}</span>}</div>;
  }
  const show = open && filtered.length > 0;
  return (
    <Popover open={show} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <Input
          value={value}
          placeholder={placeholder}
          className="min-w-0 flex-1 !px-2.5 !py-1.5"
          role="combobox"
          aria-expanded={show}
          aria-autocomplete="list"
          onChange={(e) => { onChange(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
        />
      </PopoverAnchor>
      <PopoverContent
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
        onMouseDown={(e) => e.preventDefault()}
        className="max-h-[240px] w-[var(--radix-popper-anchor-width)] min-w-[200px] overflow-y-auto p-1"
      >
        {filtered.length === 0 ? (
          <div className="px-2.5 py-1.5 text-13 text-text-secondary">{t("noSuggestions")}</div>
        ) : filtered.map((s) => (
          <button key={s} type="button" role="option" aria-selected={s === value} className="flex h-[30px] w-full items-center rounded-[6px] px-2.5 text-left text-13 text-text-primary hover:bg-tint-secondary" onClick={() => { onChange(s); setOpen(false); }}>
            <span className="block truncate" title={s}>{s}</span>
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

export function MetadataRows({ rows, onChange, readOnly, showErrors, suggestions, tagItems, error, label, description }: {
  rows: MetadataRow[]; onChange: (r: MetadataRow[]) => void; readOnly?: boolean; showErrors?: boolean;
  /** Key → values from `store.tags()`. */
  suggestions?: Record<string, string[]>;
  /** Alternative flat tag list (`tagItems` in the shipped props). */
  tagItems?: MetadataRow[];
  /** Externally revealed error copy (overrides the internal incomplete check). */
  error?: string; label?: ReactNode; description?: ReactNode;
}) {
  // Stable row identity across edits (WeakMap keyed by row object; edited rows inherit the id).
  const ids = useRef(new WeakMap<MetadataRow, number>());
  const counter = useRef(0);
  const idOf = (r: MetadataRow) => { let id = ids.current.get(r); if (id === undefined) { id = counter.current++; ids.current.set(r, id); } return id; };
  const byKey = useMemo(() => {
    const out: Record<string, string[]> = {};
    if (tagItems) {
      for (const it of tagItems) { if (isReservedTagKey(it.key)) continue; const list = (out[it.key] ??= []); if (!list.includes(it.value)) list.push(it.value); }
    } else {
      for (const [k, vs] of Object.entries(suggestions ?? {})) if (!isReservedTagKey(k)) out[k] = vs;
    }
    return out;
  }, [tagItems, suggestions]);
  const keys = useMemo(() => Object.keys(byKey), [byKey]);
  const incomplete = !!showErrors && rows.some((r) => !r.key.trim() || !r.value.trim());
  const err = error ?? (incomplete ? t("metadataIncomplete") : undefined);
  const reserved = rows.find((r) => isReservedTagKey(r.key));
  const set = (i: number, field: "key" | "value", v: string) => {
    const cur = rows[i]!;
    const next: MetadataRow = field === "key" ? { ...cur, key: v } : { ...cur, value: v };
    ids.current.set(next, idOf(cur));
    onChange(rows.map((r, j) => (j === i ? next : r)));
  };
  const remove = (i: number) => { const cur = rows[i]; if (cur) ids.current.delete(cur); onChange(rows.filter((_, j) => j !== i)); };
  return (
    <SettingsRow
      boldLabel
      label={label ?? t("metadata")}
      description={description ?? t("metadataDescription")}
      content={
        <div className="flex flex-col gap-1.5">
          <div className={cn("flex flex-col overflow-hidden rounded-[10px] border border-border-secondary bg-bg-elevated", err && "ring-1 ring-text-destructive")}>
            {rows.length > 0 && (
              <div className="flex flex-col divide-y divide-border-secondary">
                {rows.map((r, i) => (
                  <div key={idOf(r)} className="flex items-center gap-2 px-3 py-2">
                    <span className={cn("size-2 shrink-0 rounded-full", r.key ? tagDotColor(r.key) : "bg-border-secondary")} />
                    <SuggestInput value={r.key} onChange={(v) => set(i, "key", v)} suggestions={keys} placeholder={t("metadataKeyPlaceholder")} readOnly={readOnly} />
                    <span className="text-12 text-text-secondary">:</span>
                    <SuggestInput value={r.value} onChange={(v) => set(i, "value", v)} suggestions={byKey[r.key] ?? []} placeholder={t("metadataValuePlaceholder")} readOnly={readOnly} />
                    {!readOnly && (
                      <Tooltip content={t("removeMetadata")}>
                        <IconButton size="xs" variant="ghost" aria-label={t("removeMetadata")} onClick={() => remove(i)}><Trash2 size={14} /></IconButton>
                      </Tooltip>
                    )}
                  </div>
                ))}
              </div>
            )}
            {!readOnly && (
              <button type="button" onClick={() => onChange([...rows, { key: "", value: "" }])} className={cn("flex h-[32px] shrink-0 items-center gap-2 px-3 text-13 text-text-secondary hover:bg-tint-secondary hover:text-text-primary", rows.length > 0 && "border-t border-border-secondary")}>
                <Plus size={14} /><span>{t("addMetadata")}</span>
              </button>
            )}
          </div>
          {err && <p className="text-12 text-text-destructive">{err}</p>}
          {reserved && <p className="text-12 text-text-destructive">{t("reservedMetadataKey", { key: reserved.key })}</p>}
        </div>
      }
    />
  );
}

/* ---------------- Limits (spec §13.7; useRunAsIdentityChange `x`/`S`/`C`/`w`/`j`/`P`) ---------------- */
const MAX_ACU = 1000;
const DEFAULT_WINDOW_SECONDS = 3600;
const WINDOWS = [900, 3600, 21600, 43200, 86400, 604800];
const WINDOW_KEY: Record<number, string> = {
  900: "rateLimitWindow15Minutes", 3600: "rateLimitWindow1Hour", 21600: "rateLimitWindow6Hours",
  43200: "rateLimitWindow12Hours", 86400: "rateLimitWindow24Hours", 604800: "rateLimitWindow7Days",
};
const NO_WINDOW = "none";
const parseNum = (s: string): number | null => { if (s.trim() === "") return null; const n = Number(s); return Number.isFinite(n) ? n : null; };

/** Validation order as shipped: null → ok; < 1 → min; > 1000 → max; non-integer → whole/increment. */
export function acuLimitError(value: number | null, showAcu: boolean): string | null {
  if (value === null) return null;
  if (value < 1) return showAcu ? t("minAcuLimit") : t("minDollarLimit", { min: 2 });
  if (value > MAX_ACU) return showAcu ? t("maxAcuLimit") : t("maxDollarLimit", { max: MAX_ACU * 2 });
  return Number.isInteger(value) ? null : showAcu ? t("wholeAcuLimit") : t("dollarIncrementLimit", { increment: 2 });
}

/** ACU/spend field (`j`): internal value is ACU; currency display is ACU × 2 with `$` prefix and step 2. */
export function AcuLimitField({ value, onChange, showAcu, readOnly, min = 1, max = MAX_ACU, placeholder, error, className }: {
  value: number | null; onChange: (v: number | null) => void; showAcu: boolean; readOnly?: boolean; min?: number; max?: number; placeholder?: string; error?: string | null; className?: string;
}) {
  const display = value === null || showAcu ? value : value * 2;
  return (
    <InputGroup className={className ?? "w-[120px]"} aria-invalid={error ? true : undefined}>
      {!showAcu && <InputGroupAddon>$</InputGroupAddon>}
      <InputGroupInput
        type="number"
        min={showAcu ? min : min * 2}
        max={showAcu ? max : max * 2}
        step={showAcu ? 1 : 2}
        placeholder={placeholder ?? t("noLimit")}
        value={display ?? ""}
        readOnly={readOnly}
        aria-invalid={error ? true : undefined}
        onChange={(e) => { const n = parseNum(e.target.value); onChange(n === null || showAcu ? n : n / 2); }}
      />
      {showAcu && <InputGroupAddon align="inline-end">{t("acus")}</InputGroupAddon>}
    </InputGroup>
  );
}

export function LimitsRow({ form, patch, readOnly, showAcu, enabled, onEnabledChange, defaultInvocationLimit = DEFAULT_INVOCATION_LIMIT }: {
  form: FormState; patch: Patch; readOnly?: boolean;
  /** Defaults to the org consumption display (`acu` → ACUs, otherwise currency). */
  showAcu?: boolean;
  /** Optional controlled switch state (`enabled`/`onEnabledChange` in the shipped props). */
  enabled?: boolean; onEnabledChange?: (v: boolean) => void; defaultInvocationLimit?: number;
}) {
  const caps = useCapabilities();
  const acuMode = showAcu ?? caps.consumptionDisplay === "acu";
  const hasValue = form.maxAcuLimit !== null || form.invocationLimit !== null || form.invocationLimitWindowSeconds !== null;
  const [localOn, setLocalOn] = useState(hasValue);
  useEffect(() => { if (hasValue) setLocalOn(true); }, [hasValue]);
  const on = enabled ?? localOn;
  const setOn = (v: boolean) => {
    (onEnabledChange ?? setLocalOn)(v);
    if (v) {
      const p: Partial<FormState> = {};
      if (form.invocationLimit === null) p.invocationLimit = defaultInvocationLimit;
      if (form.invocationLimitWindowSeconds === null) p.invocationLimitWindowSeconds = DEFAULT_WINDOW_SECONDS;
      if (Object.keys(p).length > 0) patch(p);
    } else {
      patch({ maxAcuLimit: null, invocationLimit: null, invocationLimitWindowSeconds: null });
    }
  };
  const err = acuLimitError(form.maxAcuLimit, acuMode);
  const windowOptions = [{ value: NO_WINDOW, label: t("rateLimitNone") }, ...WINDOWS.map((w) => ({ value: String(w), label: t(WINDOW_KEY[w]!) }))];
  const onCount = (raw: string) => {
    const n = parseNum(raw);
    if (n === null) { patch({ invocationLimit: null, invocationLimitWindowSeconds: null }); return; }
    patch({ invocationLimit: Math.max(1, n), ...(form.invocationLimitWindowSeconds === null ? { invocationLimitWindowSeconds: DEFAULT_WINDOW_SECONDS } : {}) });
  };
  const onWindow = (v: string) => {
    if (v === NO_WINDOW) { patch({ invocationLimitWindowSeconds: null, invocationLimit: null }); return; }
    patch({ invocationLimitWindowSeconds: parseInt(v, 10), ...(form.invocationLimit === null && on ? { invocationLimit: defaultInvocationLimit } : {}) });
  };
  return (
    <SettingsRow
      boldLabel
      label={t("limits")}
      description={t("limitsDescription")}
      content={on ? (
        <div className="flex flex-col rounded-[10px] border border-border-secondary bg-bg-elevated px-3">
          <SettingsRow boldLabel label={t(acuMode ? "acuLimitPerSession" : "spendLimitPerSession")} description={t(acuMode ? "maxAcusDescription" : "maxSpendDescription")} content={err ? <p className="text-11 text-text-red">{err}</p> : undefined}>
            <AcuLimitField value={form.maxAcuLimit} onChange={(maxAcuLimit) => patch({ maxAcuLimit })} showAcu={acuMode} readOnly={readOnly} error={err} />
          </SettingsRow>
          <SettingsRow boldLabel className="border-t border-border-secondary" label={t("rateLimit")} description={t("rateLimitDescription")}>
            <div className="flex items-center gap-2">
              <InputGroup className="w-[120px]">
                <InputGroupInput type="number" min={1} placeholder={t("noLimit")} value={form.invocationLimit ?? ""} readOnly={readOnly} onChange={(e) => onCount(e.target.value)} />
                <InputGroupAddon align="inline-end">{t("per")}</InputGroupAddon>
              </InputGroup>
              <Select
                options={windowOptions}
                value={form.invocationLimitWindowSeconds === null ? NO_WINDOW : String(form.invocationLimitWindowSeconds)}
                onValueChange={onWindow}
                disabled={readOnly || form.invocationLimit === null}
                size="compact"
                triggerClassName="min-w-[unset] w-fit"
                ariaLabel={t("rateLimit")}
              />
            </div>
          </SettingsRow>
        </div>
      ) : undefined}
    >
      <Switch checked={on} onCheckedChange={setOn} disabled={readOnly} aria-label={t("limits")} />
    </SettingsRow>
  );
}

/* ---------------- Queueing (spec §13.8; AutomationEditorPage `Ia`, module 2590–2684) ---------------- */
export function QueueingRow({ form, patch, readOnly }: { form: FormState; patch: Patch; readOnly?: boolean }) {
  const hasValue = form.maxConcurrentRuns !== null || form.maxQueueDepth !== null;
  const [on, setOn] = useState(hasValue);
  useEffect(() => { if (hasValue) setOn(true); }, [hasValue]);
  return (
    <SettingsRow
      boldLabel
      className="border-t border-border-secondary"
      label={t("queueing")}
      description={t("queueingDescription")}
      content={on ? (
        <div className="flex flex-col rounded-[10px] border border-border-secondary bg-bg-elevated px-3">
          <SettingsRow
            boldLabel
            label={<span className="flex items-center gap-1.5">{t("maxConcurrentRuns")}<Tooltip content={t("maxConcurrentRunsTooltip")}><Info size={12} className="opacity-60 hover:opacity-80" /></Tooltip></span>}
            description={t("maxConcurrentRunsDescription")}
          >
            <InputGroup className="w-[120px]">
              <InputGroupInput type="number" min={1} placeholder={t("noLimit")} value={form.maxConcurrentRuns ?? ""} readOnly={readOnly} onChange={(e) => { const v = e.target.value; if (v === "") { patch({ maxConcurrentRuns: null }); return; } const n = Number(v); if (Number.isFinite(n)) patch({ maxConcurrentRuns: Math.max(1, n) }); }} />
            </InputGroup>
          </SettingsRow>
          <SettingsRow boldLabel className="border-t border-border-secondary" label={t("maxQueueDepth")} description={t("maxQueueDepthDescription")}>
            <InputGroup className="w-[120px]">
              <InputGroupInput type="number" min={0} placeholder={t("noLimit")} value={form.maxQueueDepth ?? ""} disabled={form.maxConcurrentRuns === null} readOnly={readOnly} onChange={(e) => { const v = e.target.value; if (v === "") { patch({ maxQueueDepth: null }); return; } const n = Number(v); if (Number.isFinite(n)) patch({ maxQueueDepth: Math.max(0, n) }); }} />
            </InputGroup>
          </SettingsRow>
        </div>
      ) : undefined}
    >
      <Switch checked={on} disabled={readOnly} onCheckedChange={(v) => { setOn(v); if (v) patch({ maxConcurrentRuns: 1 }); else patch({ maxConcurrentRuns: null, maxQueueDepth: null }); }} aria-label={t("queueing")} />
    </SettingsRow>
  );
}

/* ---------------- Child sessions (spec §13.1; module 5178–5310) ---------------- */
export function ChildSessionsRow({ form, patch, readOnly }: { form: FormState; patch: Patch; readOnly?: boolean }) {
  if (!form.actions.some((a) => a.type === "start_session")) return null;
  const checked = form.actions.some((a) => a.type === "start_session" && a.bypass_approval);
  return (
    <SettingsRow boldLabel label={t("allowChildSessions")} description={t("allowChildSessionsDescription")}>
      <Switch checked={checked} disabled={readOnly} onCheckedChange={(v) => patch({ actions: form.actions.map((a) => (a.type === "start_session" ? { ...a, bypass_approval: v } : a)) })} aria-label={t("allowChildSessions")} />
    </SettingsRow>
  );
}

/* ---------------- Shared scratchpad (spec §13.2; AutomationEditorPage `ra`, module 2105–2131) ---------------- */
export function ScratchpadRow({ form, patch, readOnly, forceEnabled, onBrowse }: {
  form: FormState; patch: Patch; readOnly?: boolean;
  /** Defaults to: any triage or incident action forces the scratchpad on. */
  forceEnabled?: boolean;
  /** Opens the scratchpad folder dialog (`Browse files`). */
  onBrowse?: () => void;
}) {
  const forced = forceEnabled ?? form.actions.some((a) => a.type === "triage_session" || a.type === "incident_session");
  return (
    <SettingsRow boldLabel label={t("sharedScratchpad")} description={t("scratchpadDescription")}>
      <div className="flex items-center gap-3">
        <Button variant="secondary" size="sm" type="button" onClick={onBrowse}>{t("browseFiles")}</Button>
        <Tooltip content={t("scratchpadForceEnabledTooltip")} disabled={!forced}>
          <Switch checked={forced || form.scratchpadEnabled} disabled={readOnly || forced} onCheckedChange={(v) => patch({ scratchpadEnabled: v })} aria-label={t("sharedScratchpad")} />
        </Tooltip>
      </div>
    </SettingsRow>
  );
}

export { SettingsCard, SettingsCardGroup };
