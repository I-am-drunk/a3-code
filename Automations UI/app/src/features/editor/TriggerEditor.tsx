import { Calendar, Check, ChevronDown, Copy, Eye, EyeOff, Lock, Plus, RefreshCw, Trash2, TriangleAlert, X } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import type { Condition, Reply, SlackThreadMode, Trigger } from "@/model/types";
import { DEFAULT_CONDITIONS, EVENT_SCHEMAS, OPERATOR_LABEL, REPLY_EXCLUDED_EVENTS, REPLY_SOURCES, SINGLETON_EVENTS, SourceIcon, eventName, operatorsFor, rruleOf, schemaFor, sourceLabel, sourceOf, type SchemaField } from "@/model/sources";
import { browserTz, classify, isSubHourly, jitteredMinute, oneTimeRule, parseRRule, presetRule, serializeRRule, summarize, timeLabel, validateRRule, WEEKDAY_OPTIONS, type Freq, type Preset } from "@/model/rrule";
import { timezoneOptions } from "@/data/timezones";
import { useCapabilities } from "@/data/capabilities";
import { store, useQuery } from "@/data/store";
import { cn } from "@/lib/cn";
import { t } from "@/i18n/t";
import { Button } from "@/ui/button";
import { Tooltip } from "@/ui/tooltip";
import { Select } from "@/ui/select";
import { Input, Textarea } from "@/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/ui/popover";
import { DropdownMenu, DropdownMenuCheckItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from "@/ui/menu";
import { ACCENT_CHIP } from "@/ui/settings";
import { ConfirmDialog } from "@/ui/dialog";

/* ---------------- Module constants (TriggerEditor-D8VGRxC1.js:2349-2403) ---------------- */
export type WebhookCreds = { automation_id: string; webhook_secret: string; webhook_secret_hash: string } | null;

/** `Jn` — synthetic menu sentinel: choosing it mutates replies, not conditions. */
export const REPLY_SENTINEL = "__reply__";
/** `er` — virtual Watch-channel picker item (converted to `slack:message` + monitor mode). */
export const SLACK_MONITOR_TYPE = "slack:monitor";
/** `Zn` / `Qn` — code-scan `lte` condition field and default displayed maximum. */
export const MAX_FINDINGS_FIELD = "max_findings_per_scan";
export const DEFAULT_MAX_FINDINGS = 50;
/** `$n` / `dn` — reserved incoming-webhook condition fields. */
export const WEBHOOK_BODY_REGEX_FIELD = "_webhook_body_regex";
export const WEBHOOK_SECRET_HASH_FIELD = "_webhook_secret_hash";
/** `Kn` / `qn` — reply-copy selectors. */
const GITHUB_PR_REPLY_EVENTS = new Set(["github:pull_request", "github:pull_request_review", "github:pull_request_review_comment"]);
const GITLAB_MR_REPLY_EVENTS = new Set(["gitlab:merge_request", "gitlab:note"]);
/** `tr` (Hourly, Daily, Weekly, Custom) with `nr` (Run once) inserted between Weekly and Custom. */
const SCHEDULE_ITEMS: { key: Preset; value: string; labelKey: string }[] = [
  { key: "hourly", value: "schedule:hourly", labelKey: "scheduleEveryHour" },
  { key: "daily", value: "schedule:daily", labelKey: "scheduleEveryDay" },
  { key: "weekly", value: "schedule:weekly", labelKey: "scheduleEveryWeek" },
  { key: "one_time", value: "schedule:one_time", labelKey: "scheduleRunOnce" },
  { key: "custom", value: "schedule:custom", labelKey: "scheduleCustom" },
];
/** Field types rendered with an "in …" prefix instead of a field selector (TypePicker `er`, `xt`). */
const IDENTITY_TYPES = new Set<SchemaField["type"]>(["repo", "channel"]);
const THREAD_REPLY_FIELD = "is_thread_reply";

const pylonLockedTooltip = () => t("pylon.triggerLockedTooltip", { defaultValue: "This trigger is disabled for your Pylon connection." });

/* ---------------- Pure helpers ---------------- */
/** `_n` — deterministic initial conditions per event type (TriggerEditor-D8VGRxC1.js:373-391). */
const EXTRA_DEFAULT_CONDITIONS: Record<string, Condition[]> = {
  "pylon:issue_tag_added": [{ field: "tag_ids", operator: "eq", value: "" }],
  "pylon:issue_status_changed": [{ field: "status_slug", operator: "eq", value: "" }],
  "jira:status_changed": [{ field: "data.status.name", operator: "eq", value: "" }],
  "incident_io:status_changed": [{ field: "new_status", operator: "eq", value: "" }],
  "incident_io:severity_changed": [{ field: "new_severity", operator: "eq", value: "" }],
};
export function defaultConditionsFor(eventType: string): Condition[][] {
  const d = DEFAULT_CONDITIONS[eventType] ?? EXTRA_DEFAULT_CONDITIONS[eventType];
  return d ? [structuredClone(d)] : [];
}

/** `gn` — default replies for a freshly added trigger (TriggerEditor-D8VGRxC1.js:365-373). */
export function defaultReplies(eventType: string, ctx: { postResponseEnabled?: boolean; hasStartSessionAction: boolean; slackReplyMode?: SlackThreadMode }): Reply[] | undefined {
  if (ctx.postResponseEnabled === false || !ctx.hasStartSessionAction) return undefined;
  const src = sourceOf(eventType);
  if (REPLY_SOURCES.has(src) && !REPLY_EXCLUDED_EVENTS.has(eventType) && ctx.slackReplyMode !== "post_response") return [{ type: "post_response" }];
  if (src === "slack" && ctx.slackReplyMode == null) return [{ type: "attach_thread" }];
  return undefined;
}

/** Type change keeps `post_response` only within the same source (never into push/check/pipeline) and thread replies only into Slack (TriggerEditor-D8VGRxC1.js:1230-1240). */
export function filterRepliesForType(replies: Reply[] | undefined, fromType: string, toType: string): Reply[] | undefined {
  if (!replies?.length) return replies;
  const sameSource = sourceOf(fromType) === sourceOf(toType) && !REPLY_EXCLUDED_EVENTS.has(toType);
  const toSlack = sourceOf(toType) === "slack";
  const kept = replies.filter((r) => (r.type !== "post_response" || sameSource) && ((r.type !== "attach_thread" && r.type !== "notify_thread") || toSlack));
  return kept.length ? kept : undefined;
}

/** `vn` / `yn` / `bn` — code-scan `max_findings_per_scan` accessors (TriggerEditor-D8VGRxC1.js:394-411). */
export function maxFindingsOf(conditions: Condition[][]): number | null {
  for (const g of conditions) for (const c of g) if (c.field === MAX_FINDINGS_FIELD && typeof c.value === "number") return c.value;
  return null;
}
export function stripMaxFindings(conditions: Condition[][]): Condition[][] {
  return conditions.map((g) => g.filter((c) => c.field !== MAX_FINDINGS_FIELD));
}
export function withMaxFindings(conditions: Condition[][], n: number | null): Condition[][] {
  const base = stripMaxFindings(conditions);
  return n === null ? base : [[...(base[0] ?? []), { field: MAX_FINDINGS_FIELD, operator: "lte", value: n }], ...base.slice(1)];
}

/** `ln` — insert the webhook secret hash (replacing any prior) into the first group. */
export function withWebhookSecretHash(conditions: Condition[][], hash: string): Condition[][] {
  const first = (conditions[0] ?? []).filter((c) => c.field !== WEBHOOK_SECRET_HASH_FIELD);
  return [[...first, { field: WEBHOOK_SECRET_HASH_FIELD, operator: "matches", value: hash }]];
}
/** `Sn` — optional body regex; empty removes it. */
export function withWebhookBodyRegex(conditions: Condition[][], regex: string): Condition[][] {
  const first = (conditions[0] ?? []).filter((c) => c.field !== WEBHOOK_BODY_REGEX_FIELD);
  return [regex ? [...first, { field: WEBHOOK_BODY_REGEX_FIELD, operator: "matches", value: regex }] : first, ...conditions.slice(1)];
}
/** `un` — copyable cURL template. */
export function webhookCurl(url: string): string {
  return `curl -X POST '${url}' \\\n  -H 'Content-Type: application/json' \\\n  -H 'Authorization: Bearer <REPLACE_WITH_SECRET>' \\\n  -d '{"test": true}'`;
}

/** Triage normalizer — removes `is_thread_reply` from every Slack message trigger while preserving other conditions. */
export function stripThreadReplyCondition(triggers: Trigger[]): Trigger[] {
  return triggers.map((tr) => tr.event_type !== "slack:message" ? tr : { ...tr, conditions: tr.conditions.map((g) => g.filter((c) => c.field !== THREAD_REPLY_FIELD)) });
}

/** Slack channel ids across every `slack:message` `channel` condition, scalar or array. */
export function slackChannelIdsOf(trigger: Trigger): string[] {
  const out: string[] = [];
  for (const g of trigger.conditions) for (const c of g) {
    if (c.field !== "channel") continue;
    for (const v of Array.isArray(c.value) ? c.value : [c.value]) if (typeof v === "string" && v && !out.includes(v)) out.push(v);
  }
  return out;
}
/** Monitor channel serialization: none → no conditions, one → `eq`, many → `in`. */
export function withMonitorChannels(trigger: Trigger, ids: string[]): Trigger {
  const cond: Condition[][] = ids.length === 0 ? [] : ids.length === 1 ? [[{ field: "channel", operator: "eq", value: ids[0] }]] : [[{ field: "channel", operator: "in", value: ids }]];
  return { ...trigger, conditions: cond };
}

/** JitteredScheduleTimeSelect-BSFBBNau.js:16-33 — enterprise passes; null plan fails; unknown slug passes; rank ≥ teams-v2. */
const PLAN_RANK: Record<string, number> = { free: 0, "pro-trial": 1, pro: 2, core: 2, "teams-v2": 3, team: 3, max: 4 };
export function subHourlyAllowed(planSlug: string | null | undefined, isEnterprise = planSlug === "enterprise"): boolean {
  if (isEnterprise) return true;
  if (planSlug == null) return false;
  const rank = PLAN_RANK[planSlug];
  return rank === undefined || rank >= PLAN_RANK["teams-v2"]!;
}
export function hasSubHourlySchedule(triggers: Trigger[]): boolean {
  return triggers.some((tr) => tr.event_type === "schedule:recurring" && tr.conditions.some((g) => g.some((c) => c.field === "rrule" && typeof c.value === "string" && isSubHourly(parseRRule(c.value)))));
}

export function presetOf(trigger: Trigger): Preset {
  return classify(parseRRule(rruleOf(trigger)));
}
function scheduleRule(preset: Preset, minute = jitteredMinute(), tz = browserTz()): string {
  switch (preset) {
    case "hourly": return presetRule("hourly", minute, tz);
    case "weekly": return presetRule("weekly", minute, tz);
    case "one_time": { const d = new Date(Date.now() + 3_600_000); d.setSeconds(0, 0); return oneTimeRule(d, tz); }
    case "custom": return "";
    default: return presetRule("daily", minute, tz);
  }
}

/** Picker → stored trigger. Schedule pseudo-types persist as `schedule:recurring` + one `rrule matches` condition; `slack:monitor` becomes a blank `slack:message`. */
export function newTriggerFor(eventType: string, preset?: Preset): Trigger {
  if (eventType.startsWith("schedule:")) {
    const p = preset ?? SCHEDULE_ITEMS.find((it) => it.value === eventType)?.key ?? "daily";
    return { event_type: "schedule:recurring", conditions: [[{ field: "rrule", operator: "matches", value: scheduleRule(p) }]] };
  }
  if (eventType === SLACK_MONITOR_TYPE) return { event_type: "slack:message", conditions: [] };
  return { event_type: eventType, conditions: defaultConditionsFor(eventType) };
}

export function scheduleTimeLabel(tr: Trigger): string {
  const p = parseRRule(rruleOf(tr));
  return p ? timeLabel(p.byHour, p.byMinute) : "";
}

/** Minimal `Trans`: `<tag>text</tag>` and `<tag />` placeholders in catalog copy. */
function rich(text: string, comps: Record<string, (children: string, key: string) => ReactNode>): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /<(\w+)(?:\s*\/>|>([\s\S]*?)<\/\1>)/g;
  let last = 0; let i = 0; let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const render = comps[m[1]!];
    out.push(render ? render(m[2] ?? "", `${m[1]}-${i++}`) : m[0]);
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}
const asStrings = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : v === undefined || v === null || v === "" ? [] : [String(v)]);

/* ---------------- Add trigger / event picker (`An` groups → `Ot` menu) ---------------- */
type PickerItem = { value: string; label: string; disabled?: boolean; lockedTooltip?: string };
type PickerGroup = { source: string; label: string; items: PickerItem[] };

/** `An` — groups follow `Object.entries(schemasBySource)`; Schedule is replaced by the fixed preset list; Slack may prepend Watch channel. */
function buildPickerGroups(opts: { disabledEventTypes: Set<string>; restricted: Set<string>; currentEventType?: string; showMonitor: boolean }): PickerGroup[] {
  const groups: PickerGroup[] = [];
  for (const [source, schemas] of Object.entries(EVENT_SCHEMAS)) {
    if (source === "schedule") {
      groups.push({ source, label: sourceLabel(source), items: SCHEDULE_ITEMS.map((it) => ({ value: it.value, label: t(it.labelKey) })) });
      continue;
    }
    const items: PickerItem[] = schemas.map((s) => {
      const isCurrent = s.event_type === opts.currentEventType;
      const locked = opts.restricted.has(s.event_type) && !isCurrent;
      return { value: s.event_type, label: s.name, disabled: locked || (opts.disabledEventTypes.has(s.event_type) && !isCurrent), lockedTooltip: locked ? pylonLockedTooltip() : undefined };
    });
    if (source === "slack" && opts.showMonitor) items.unshift({ value: SLACK_MONITOR_TYPE, label: t("triggerWatchChannel") });
    groups.push({ source, label: sourceLabel(source), items });
  }
  return groups;
}

function PickerMenuItem({ item, onSelect }: { item: PickerItem; onSelect: () => void }) {
  const node = (
    <DropdownMenuItem disabled={item.disabled} onSelect={onSelect}>
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {item.lockedTooltip && <Lock size={14} className="ml-auto shrink-0" aria-hidden="true" />}
    </DropdownMenuItem>
  );
  return item.lockedTooltip ? <Tooltip content={item.lockedTooltip} side="right">{node}</Tooltip> : node;
}

export function AddTriggerMenu({
  triggers, onAdd, label, chipClass, currentEventType, disabledEventTypes, showMonitor = false, onSelectMonitor, disabled,
}: {
  triggers: Trigger[]; onAdd: (tr: Trigger) => void; label?: string; chipClass?: string;
  /** Row usage: the row's own type is exempt from singleton/lock disabling (`disabledEventTypes` excludes it). */
  currentEventType?: string;
  /** Extra disabled types (other rows' singletons, `slack:message` while another row monitors). */
  disabledEventTypes?: Set<string>;
  /** Prepend the virtual Watch channel item to the Slack group. */
  showMonitor?: boolean;
  /** Watch channel chosen — page replaces triggers with one blank `slack:message` and enables monitor mode. Falls back to `onAdd(blank slack:message)`. */
  onSelectMonitor?: () => void;
  disabled?: boolean;
}) {
  const caps = useCapabilities();
  const present = new Set(triggers.filter((x) => SINGLETON_EVENTS.has(x.event_type)).map((x) => x.event_type));
  const merged = new Set<string>([...present, ...(disabledEventTypes ?? [])]);
  const groups = buildPickerGroups({ disabledEventTypes: merged, restricted: new Set(caps.unsupportedEventTypes), currentEventType, showMonitor });
  const pick = (value: string) => {
    if (value === SLACK_MONITOR_TYPE) { if (onSelectMonitor) onSelectMonitor(); else onAdd(newTriggerFor(SLACK_MONITOR_TYPE)); return; }
    onAdd(newTriggerFor(value));
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={disabled}>
        {chipClass ? (
          <button type="button" disabled={disabled} className={cn(chipClass, "gap-1 cursor-default")}>{label ?? t("addTriggerPicker")}<ChevronDown size={14} /></button>
        ) : (
          <Button variant="secondary" disabled={disabled}><Plus />{label ?? t("addTrigger")}</Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[216px]">
        {groups.map((g) => {
          const icon = <SourceIcon source={g.source} size={16} />;
          if (g.items.length === 1 && g.source !== "schedule") {
            const it = g.items[0]!;
            return <PickerMenuItem key={g.source} item={{ ...it, label: g.label }} onSelect={() => pick(it.value)} />;
          }
          return (
            <DropdownMenuSub key={g.source}>
              <DropdownMenuSubTrigger>{icon}{g.label}</DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {g.items.map((it) => <PickerMenuItem key={it.value} item={it} onSelect={() => pick(it.value)} />)}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ---------------- Schedule inline controls (schedule-time-select `X`, tz select) ---------------- */
const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0"));

function TimeSelect({ hour, minute, onChange, showHour = true, disabled }: { hour: number | null; minute: number | null; onChange: (v: { hour: number; minute: number }) => void; showHour?: boolean; disabled?: boolean }) {
  const h = String(hour ?? 0).padStart(2, "0");
  const m = String(minute ?? 0).padStart(2, "0");
  const minuteOptions = MINUTES.includes(m) ? MINUTES : [...MINUTES, m].sort();
  return (
    <div className="flex items-center gap-1">
      {showHour && (
        <>
          <Select size="inline" ariaLabel={t("selectHour")} value={h} options={HOURS.map((v) => ({ value: v, label: v }))} onValueChange={(v) => onChange({ hour: parseInt(v, 10), minute: minute ?? 0 })} disabled={disabled} />
          <span className="text-text-secondary">:</span>
        </>
      )}
      <Select size="inline" ariaLabel={t("minuteWithinHour")} value={m} options={minuteOptions.map((v) => ({ value: v, label: v }))} onValueChange={(v) => onChange({ hour: hour ?? 0, minute: parseInt(v, 10) })} disabled={disabled} />
    </div>
  );
}

function TimezoneSelect({ value, onChange, disabled }: { value: string; onChange: (tz: string) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const options = useMemo(() => timezoneOptions(), []);
  const current = options.find((o) => o.value === value)?.label ?? value;
  const filtered = useMemo(() => { const s = q.trim().toLowerCase(); return s ? options.filter((o) => o.label.toLowerCase().includes(s) || o.value.toLowerCase().includes(s)) : options; }, [options, q]);
  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (o) setQ(""); }}>
      <PopoverTrigger asChild>
        <button type="button" disabled={disabled} aria-label={t("selectTimezone")} className={cn(ACCENT_CHIP, "w-[300px] min-w-0 justify-between gap-1 cursor-default")}><span className="truncate">{current}</span><ChevronDown size={14} className="shrink-0" /></button>
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={4} className="w-[320px] p-0">
        <div className="border-b border-border-secondary px-3 py-2">
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("searchTimezones")} className="w-full bg-transparent text-13 text-text-primary outline-none placeholder:text-text-secondary" />
        </div>
        <div className="max-h-[280px] overflow-y-auto p-1">
          {filtered.length === 0 && <div className="px-2 py-3 text-center text-13 text-text-secondary">{t("noTimezonesFound")}</div>}
          {filtered.slice(0, 400).map((o) => (
            <button key={o.value} type="button" onClick={() => { onChange(o.value); setOpen(false); }} className={cn("flex w-full items-center gap-2 rounded-[6px] px-2 py-1.5 text-left text-13 text-text-primary hover:bg-tint-secondary", o.value === value && "bg-tint-secondary")}>
              <span className="min-w-0 flex-1 truncate">{o.label}</span>{o.value === value && <Check size={14} className="shrink-0 text-text-accent-primary" />}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* ---------------- Custom RRULE popover (RRuleEditor-CoIr8z0T.js: 340px, Visual / RRULE modes) ---------------- */
const FREQS: { value: Freq; labelKey: string }[] = [
  { value: "MINUTELY", labelKey: "freqMinute" }, { value: "HOURLY", labelKey: "freqHour" }, { value: "DAILY", labelKey: "freqDay" }, { value: "WEEKLY", labelKey: "freqWeek" }, { value: "MONTHLY", labelKey: "freqMonth" },
];
/** Sunday-first toggle row with initials + full-name aria labels (RRuleEditor-CoIr8z0T.js:352-377). */
const DAY_TOGGLES: { value: number; initialKey: string; nameKey: string }[] = [
  { value: 0, initialKey: "dayInitialSunday", nameKey: "sunday" }, { value: 1, initialKey: "dayInitialMonday", nameKey: "monday" }, { value: 2, initialKey: "dayInitialTuesday", nameKey: "tuesday" },
  { value: 3, initialKey: "dayInitialWednesday", nameKey: "wednesday" }, { value: 4, initialKey: "dayInitialThursday", nameKey: "thursday" }, { value: 5, initialKey: "dayInitialFriday", nameKey: "friday" }, { value: 6, initialKey: "dayInitialSaturday", nameKey: "saturday" },
];

function RRuleEditor({ value, onApply, children }: { value: string; onApply: (rrule: string) => void; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"visual" | "rrule">("visual");
  const parsed = parseRRule(value);
  const [freq, setFreq] = useState<Freq>(parsed?.freq ?? "WEEKLY");
  const [interval, setInterval_] = useState(parsed?.interval ?? 1);
  const [byDay, setByDay] = useState<number[]>(parsed?.byDay.length ? parsed.byDay : [1]);
  const [monthDay, setMonthDay] = useState(parsed?.byMonthDay ?? 1);
  const [hour, setHour] = useState(parsed?.byHour ?? 9);
  const [minute, setMinute] = useState(parsed?.byMinute ?? 0);
  const [raw, setRaw] = useState(value.replace(/;TZID=.*$/, ""));
  const [err, setErr] = useState<string | null>(null);
  const tz = parsed?.tz ?? browserTz();
  const visualRule = () => serializeRRule({ freq, interval, byDay: freq === "WEEKLY" ? byDay : [], byMonthDay: freq === "MONTHLY" ? monthDay : null, byHour: freq === "MINUTELY" || freq === "HOURLY" ? null : hour, byMinute: freq === "MINUTELY" ? null : minute, tz, dtstart: null, count: null });
  const rawRule = () => (raw.includes("TZID=") ? raw : `${raw};TZID=${tz}`);
  const apply = () => {
    if (mode === "rrule") { const e = validateRRule(rawRule()); if (e) { setErr(e); return; } onApply(rawRule()); setOpen(false); return; }
    onApply(visualRule()); setOpen(false);
  };
  const Field = ({ label, children }: { label: ReactNode; children: ReactNode }) => (<div><div className="mb-1.5 text-12 font-medium text-text-primary">{label}</div>{children}</div>);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align="start" sideOffset={4} className="w-[340px] p-3">
        <div className="min-h-[180px] space-y-4">
          <div className="flex gap-2 border-b border-border-secondary pb-3">
            <Button variant={mode === "visual" ? "secondary" : "ghost"} size="sm" className="flex-1" onClick={() => setMode("visual")}>{t("rruleVisualMode")}</Button>
            <Button variant={mode === "rrule" ? "secondary" : "ghost"} size="sm" className="flex-1" onClick={() => setMode("rrule")}>RRULE</Button>
          </div>
          {mode === "visual" ? (
            <>
              <Field label={t("repeatEvery")}>
                <div className="flex items-center gap-2">
                  <Input type="number" min={1} value={interval} onChange={(e) => setInterval_(Math.max(1, parseInt(e.target.value, 10) || 1))} className="w-[80px]" aria-label={t("repeatEvery")} />
                  <Select value={freq} options={FREQS.map((f) => ({ value: f.value, label: t(f.labelKey) }))} onValueChange={(v) => setFreq(v)} size="compact" className="flex-1" ariaLabel={t("selectFrequency")} />
                </div>
              </Field>
              {freq === "WEEKLY" && (
                <Field label={t("repeatOn")}>
                  <div className="flex justify-center gap-1.5">
                    {DAY_TOGGLES.map((d) => {
                      const on = byDay.includes(d.value);
                      return (
                        <button key={d.value} type="button" aria-label={t(d.nameKey)} aria-pressed={on} onClick={() => setByDay((cur) => (on ? (cur.length > 1 ? cur.filter((x) => x !== d.value) : cur) : [...cur, d.value]))} className={cn("flex size-8 items-center justify-center rounded-full text-12 font-medium", on ? "bg-tint-accent-secondary text-text-accent-primary" : "bg-tint-secondary text-text-secondary")}>
                          {t(d.initialKey)}
                        </button>
                      );
                    })}
                  </div>
                </Field>
              )}
              {freq === "MONTHLY" && <Field label={t("dayOfMonth")}><Input type="number" min={1} max={31} value={monthDay} onChange={(e) => setMonthDay(Math.min(31, Math.max(1, parseInt(e.target.value, 10) || 1)))} aria-label={t("dayOfMonth")} /></Field>}
              {freq === "HOURLY" && <Field label={t("minuteWithinHour")}><Input type="number" min={0} max={59} value={minute} onChange={(e) => setMinute(Math.min(59, Math.max(0, parseInt(e.target.value, 10) || 0)))} aria-label={t("minuteWithinHour")} /></Field>}
              {(freq === "DAILY" || freq === "WEEKLY" || freq === "MONTHLY") && (
                <Field label={<span className="flex items-center gap-1">{t("time")}<span className="font-normal text-text-secondary">({tz})</span></span>}>
                  <div className="flex items-center gap-2">
                    <div className="flex-1"><label className="mb-1 block text-12 text-text-secondary">{t("hourRange")}</label><Input type="number" min={0} max={23} value={hour} onChange={(e) => setHour(Math.min(23, Math.max(0, parseInt(e.target.value, 10) || 0)))} aria-label={t("hourRange")} /></div>
                    <div className="flex-1"><label className="mb-1 block text-12 text-text-secondary">{t("minuteRange")}</label><Input type="number" min={0} max={59} value={minute} onChange={(e) => setMinute(Math.min(59, Math.max(0, parseInt(e.target.value, 10) || 0)))} aria-label={t("minuteRange")} /></div>
                  </div>
                </Field>
              )}
            </>
          ) : (
            <Field label={t("rruleString")}>
              <Textarea rows={3} value={raw} onChange={(e) => { setRaw(e.target.value); setErr(null); }} placeholder="FREQ=WEEKLY;BYDAY=MO;BYHOUR=9;BYMINUTE=0" className="font-mono" aria-label={t("rruleString")} />
              <p className="mt-2 text-12 text-text-secondary">{t("rruleUtcHint")}</p>
              {err && <p className="mt-1 text-12 text-text-destructive">{err}</p>}
            </Field>
          )}
          <div className="flex flex-col gap-2">
            <p className="text-12 text-text-secondary">{summarize(mode === "rrule" ? rawRule() : visualRule())}</p>
            <Button variant="primary" className="w-full" onClick={apply}>{t("apply")}</Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* ---------------- Schedule phrase (`Nn`) — frequency control is the row's type chip ---------------- */
function SchedulePhrase({ trigger, onChange, readonly, frequencyControl }: { trigger: Trigger; onChange: (tr: Trigger) => void; readonly?: boolean; frequencyControl: ReactNode }) {
  const raw = rruleOf(trigger);
  const p = parseRRule(raw);
  const preset = classify(p);
  const setRule = (rule: string) => onChange({ ...trigger, conditions: [[{ field: "rrule", operator: "matches", value: rule }]] });
  const tz = p?.tz ?? browserTz();
  if (readonly) return null;
  const row = "flex flex-wrap items-center gap-2 text-13 text-text-primary";
  if (!p) return <div className={row}>{frequencyControl}<RRuleEditor value={raw} onApply={setRule}><button type="button" className={cn(ACCENT_CHIP, "cursor-pointer")}>{t("selectSchedule")}</button></RRuleEditor></div>;
  const time = (
    <span className="inline-flex items-center gap-2">
      <TimeSelect hour={p.byHour} minute={p.byMinute} showHour={preset !== "hourly"} onChange={({ hour, minute }) => setRule(serializeRRule({ ...p, byHour: preset === "hourly" ? null : hour, byMinute: minute }))} />
      {preset !== "hourly" && <TimezoneSelect value={tz} onChange={(z) => setRule(serializeRRule({ ...p, tz: z }))} />}
    </span>
  );
  const phrase = (key: string, parts: Record<string, ReactNode>) => rich(t(key), Object.fromEntries(Object.entries(parts).map(([k, node]) => [k, (_c: string, id: string) => <span key={id} className="inline-flex items-center gap-2">{node}</span>])));
  if (preset === "hourly") return <div className={row}>{phrase("scheduleHourlyPhrase", { frequency: frequencyControl, minute: time })}</div>;
  if (preset === "daily") return <div className={row}>{phrase("scheduleDailyPhrase", { frequency: frequencyControl, time })}</div>;
  if (preset === "weekly") {
    const weekday = <Select size="inline" value={String(p.byDay[0] ?? 1)} options={WEEKDAY_OPTIONS.map((d) => ({ value: String(d.value), label: d.label }))} onValueChange={(v) => setRule(serializeRRule({ ...p, byDay: [parseInt(v, 10)] }))} ariaLabel={t("selectWeekday")} />;
    return <div className={row}>{phrase("scheduleWeeklyPhrase", { frequency: frequencyControl, weekday, time })}</div>;
  }
  if (preset === "one_time") {
    const d = p.dtstart ? new Date(+p.dtstart.slice(0, 4), +p.dtstart.slice(4, 6) - 1, +p.dtstart.slice(6, 8), +p.dtstart.slice(9, 11), +p.dtstart.slice(11, 13)) : new Date();
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    const future = d.getTime() > Date.now();
    return (
      <div className={cn(row, "gap-y-1")}>
        {frequencyControl}<span>{t("scheduleAt")}</span>
        <input type="datetime-local" value={local} onChange={(e) => { const nd = new Date(e.target.value); if (!isNaN(nd.getTime())) setRule(oneTimeRule(nd, tz)); }} className={cn(ACCENT_CHIP, "cursor-pointer whitespace-nowrap [color-scheme:dark]")} aria-label={t("scheduleRunOnce")} />
        <TimezoneSelect value={tz} onChange={(z) => setRule(oneTimeRule(d, z))} />
        {!future && <span className="text-11 text-text-destructive">{t("scheduledTimeMustBeInFuture")}</span>}
      </div>
    );
  }
  return <div className={row}>{frequencyControl}<RRuleEditor value={raw} onApply={setRule}><button type="button" className={cn(ACCENT_CHIP, "cursor-pointer")}>{summarize(raw)}</button></RRuleEditor></div>;
}

/* ---------------- Slack channels (`Pn` monitor multi-select, channel-typed condition values) ---------------- */
function useSlackChannels(enabled = true) {
  const q = useQuery("slack-channels", () => store.slackChannels(), { enabled });
  const byId = useMemo(() => new Map((q.data ?? []).map((c) => [c.channel_id, c])), [q.data]);
  const label = (id: string): string | undefined => { const c = byId.get(id); return c ? `#${c.name}` : undefined; };
  return { channels: q.data ?? [], isLoading: q.isLoading, label };
}

function ChannelSelect({
  value, multiple, onChange, disabled, className, chip, showError, disabledChannelIds,
}: {
  value: string[]; multiple: boolean; onChange: (ids: string[]) => void; disabled?: boolean; className?: string; chip?: boolean; showError?: boolean; disabledChannelIds?: Set<string>;
}) {
  const { channels, label } = useSlackChannels();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const filtered = channels.filter((c) => !q.trim() || c.name.toLowerCase().includes(q.trim().toLowerCase()));
  const text = value.length ? value.map((id) => label(id) ?? id).join(", ") : t("selectChannelPlaceholder");
  const toggle = (id: string) => {
    if (!multiple) { onChange([id]); setOpen(false); return; }
    onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  };
  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (o) setQ(""); }}>
      <PopoverTrigger asChild>
        <button
          type="button" disabled={disabled} aria-label={t("selectConditionValue")}
          className={cn(
            chip ? cn(ACCENT_CHIP, "max-w-[300px] gap-1 cursor-default") : "inline-flex h-8 w-[300px] max-w-full items-center justify-between gap-1 rounded-[6px] border border-border-secondary bg-bg-elevated px-2.5 text-13 font-medium text-text-primary",
            showError && value.length === 0 && "ring-1 ring-text-destructive",
            !value.length && !chip && "text-text-secondary",
            className,
          )}
        >
          <span className="min-w-0 truncate">{text}</span><ChevronDown size={14} className="shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={4} className="w-[300px] p-0">
        <div className="border-b border-border-secondary px-3 py-2">
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("searchChannels")} className="w-full bg-transparent text-13 text-text-primary outline-none placeholder:text-text-secondary" />
        </div>
        <div className="max-h-[260px] overflow-y-auto p-1">
          {filtered.length === 0 && <div className="px-2 py-3 text-center text-13 text-text-secondary">{t("noChannelsFound")}</div>}
          {filtered.map((c) => {
            const on = value.includes(c.channel_id);
            const off = disabledChannelIds?.has(c.channel_id) && !on;
            return (
              <button key={c.channel_id} type="button" disabled={off} onClick={() => toggle(c.channel_id)} className={cn("flex w-full items-center gap-2 rounded-[6px] px-2 py-1.5 text-left text-13 text-text-primary hover:bg-tint-secondary disabled:opacity-50", on && "bg-tint-secondary")}>
                <span className="min-w-0 flex-1 truncate">#{c.name}</span>
                <span className="shrink-0 text-11 text-text-secondary">{c.workspace_name}</span>
                {on && <Check size={14} className="shrink-0 text-text-accent-primary" />}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Monitor row channel picker with join flow (`Pn` + join hints, TriggerEditor-D8VGRxC1.js:911-948,1827-1866). */
function MonitorChannelRow({ trigger, onChange, readonly, showError, disabledChannelIds }: { trigger: Trigger; onChange: (tr: Trigger) => void; readonly?: boolean; showError?: boolean; disabledChannelIds?: Set<string> }) {
  const ids = slackChannelIdsOf(trigger);
  const { label, isLoading } = useSlackChannels();
  const [joinError, setJoinError] = useState<"missing_scope" | null>(null);
  const [willJoin, setWillJoin] = useState<string | null>(null);
  const [reconnecting, setReconnecting] = useState(false);
  if (readonly) {
    const labels = ids.map(label);
    return <span className="text-13 text-text-primary">{labels.some((l) => l == null) && isLoading ? "" : labels.map((l, i) => l ?? ids[i]).join(", ")}</span>;
  }
  const join = async (id: string) => {
    const res = await store.joinSlackChannel(id);
    if (res.ok) { setJoinError(null); setWillJoin(label(id) ?? id); }
    else if (res.error === "missing_scope") setJoinError("missing_scope");
  };
  const change = (next: string[]) => {
    onChange(withMonitorChannels(trigger, next));
    const added = next.find((id) => !ids.includes(id));
    if (added) void join(added);
    if (next.length === 0) { setWillJoin(null); setJoinError(null); }
  };
  const reconnect = async () => { setReconnecting(true); setJoinError(null); for (const id of ids) await join(id); setReconnecting(false); };
  return (
    <div className="relative">
      <ChannelSelect value={ids} multiple onChange={change} showError={showError} disabledChannelIds={disabledChannelIds} />
      {(joinError === "missing_scope" || willJoin) && (
        <div className="absolute left-2.5 top-full mt-[-2px] w-max max-w-[300px]">
          {joinError === "missing_scope" ? (
            <span className="text-11 text-text-destructive">
              {rich(t("monitorJoinMissingScope"), { reconnect: (c, k) => <button key={k} type="button" onClick={() => void reconnect()} disabled={reconnecting} className="font-medium underline underline-offset-2 disabled:opacity-60">{c}</button> })}
            </span>
          ) : (
            <span className="text-11 text-text-orange">{t("devinWillJoinChannel", { channel: willJoin })}</span>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------------- Condition editor (TypePicker condition rows; `Et` row) ---------------- */
function identityPrefix(field: SchemaField): string | null {
  if (field.type === "channel") return t("inChannel");
  if (field.type === "repo") return t("inRepo");
  return null;
}
function initialValueFor(field: SchemaField, operator: string): unknown {
  if (operator === "is_empty") return null;
  if (operator === "in" || operator === "not_in" || operator === "globs") return [];
  if (field.type === "boolean") return true;
  if (field.type === "enum") return field.options?.[0]?.value ?? "";
  return "";
}
/** Read-only value formatting (TypePicker-B3dMVFd0.js:2429-2485). */
function formatValue(c: Condition, field: SchemaField | undefined, channelLabel: (id: string) => string | undefined): string {
  if (c.operator === "is_empty") return "";
  if (c.operator === "globs") return asStrings(c.value).map((v) => v.trim()).filter(Boolean).join(", ");
  if (c.operator === "in" || c.operator === "not_in") {
    const arr = asStrings(c.value);
    if (field?.type === "enum") { const m = Object.fromEntries((field.options ?? []).map((o) => [o.value, o.label])); return arr.map((v) => m[v] ?? v).join(", "); }
    if (field?.type === "channel") return arr.map((v) => channelLabel(v) ?? v).join(", ");
    return arr.join(", ");
  }
  if (field?.type === "boolean") return c.value ? t("booleanTrue") : t("booleanFalse");
  if (field?.type === "enum") return field.options?.find((o) => o.value === String(c.value))?.label ?? String(c.value ?? "");
  if (field?.type === "channel") return channelLabel(String(c.value ?? "")) ?? String(c.value ?? "");
  return asStrings(c.value).join(", ");
}

/** Grouped field menu items (`Dt` grouping: schema `group` label, ungrouped first). */
function FieldMenuItems({ fields, onPick }: { fields: SchemaField[]; onPick: (f: SchemaField) => void }) {
  const groups = new Map<string, SchemaField[]>();
  for (const f of fields) { const k = f.group ?? ""; if (!groups.has(k)) groups.set(k, []); groups.get(k)!.push(f); }
  return (
    <>
      {[...groups.entries()].map(([g, list], i) => (
        <span key={g || "_top"}>
          {i > 0 && <DropdownMenuSeparator />}
          {g && <DropdownMenuLabel>{g}</DropdownMenuLabel>}
          {list.map((f) => <DropdownMenuItem key={f.field} onSelect={() => onPick(f)}>{f.label}</DropdownMenuItem>)}
        </span>
      ))}
    </>
  );
}

function ValueEditor({ field, condition, onChange }: { field: SchemaField | undefined; condition: Condition; onChange: (value: unknown) => void }) {
  const multi = condition.operator === "in" || condition.operator === "not_in";
  const aria = t("selectConditionValue");
  if (field?.type === "boolean") {
    return <Select size="inline" value={condition.value === false ? "false" : "true"} options={[{ value: "true", label: t("booleanTrue") }, { value: "false", label: t("booleanFalse") }]} onValueChange={(v) => onChange(v === "true")} ariaLabel={aria} />;
  }
  if (field?.type === "enum") {
    if (multi) {
      const cur = asStrings(condition.value);
      const labels = cur.map((v) => field.options?.find((o) => o.value === v)?.label ?? v);
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild><button type="button" aria-label={aria} className={cn(ACCENT_CHIP, "gap-1 cursor-default", !cur.length && "text-text-secondary")}><span className="max-w-[240px] truncate">{labels.length ? labels.join(", ") : t("selectPlaceholder")}</span><ChevronDown size={14} /></button></DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {(field.options ?? []).map((o) => <DropdownMenuCheckItem key={o.value} checked={cur.includes(o.value)} onSelect={(e) => { e.preventDefault(); onChange(cur.includes(o.value) ? cur.filter((x) => x !== o.value) : [...cur, o.value]); }}>{o.label}</DropdownMenuCheckItem>)}
          </DropdownMenuContent>
        </DropdownMenu>
      );
    }
    return <Select size="inline" value={String(condition.value ?? "")} options={field.options ?? []} onValueChange={(v) => onChange(v)} ariaLabel={aria} placeholder={t("selectPlaceholder")} />;
  }
  if (field?.type === "channel") {
    return <ChannelSelect chip multiple={multi} value={asStrings(condition.value)} onChange={(ids) => onChange(multi ? ids : ids[0] ?? "")} />;
  }
  if (field?.type === "number") {
    return <Input type="text" inputMode="numeric" value={condition.value === null || condition.value === undefined ? "" : String(condition.value)} onChange={(e) => { const n = Number(e.target.value); onChange(e.target.value.trim() === "" || Number.isNaN(n) ? e.target.value : n); }} aria-label={aria} className="h-[24px] w-[80px] px-1.5 text-13" />;
  }
  const listy = condition.operator === "globs" || multi;
  return (
    <Input
      value={listy ? asStrings(condition.value).join(", ") : String(condition.value ?? "")}
      onChange={(e) => onChange(listy ? e.target.value.split(",").map((s) => s.trim()).filter(Boolean) : e.target.value)}
      aria-label={aria} placeholder={t("selectPlaceholder")} className="h-[24px] w-auto min-w-[120px] max-w-[320px] field-sizing-content px-1.5 text-13"
    />
  );
}

function ConditionEditor({
  trigger, onChange, readonly, prefix, suffix, hiddenFields, extraMenu, onPickExtra, trailing,
}: {
  trigger: Trigger; onChange: (tr: Trigger) => void; readonly?: boolean; prefix: ReactNode; suffix: ReactNode;
  hiddenFields?: Set<string>;
  /** `Jn` — append a synthetic Reply option to the add menu. */
  extraMenu?: { value: string; label: string } | null;
  onPickExtra?: (value: string) => void;
  trailing?: ReactNode;
}) {
  const schema = schemaFor(trigger.event_type);
  const { label: channelLabel } = useSlackChannels(sourceOf(trigger.event_type) === "slack");
  const fields = (schema?.fields ?? []).filter((f) => !hiddenFields?.has(f.field));
  const group = (trigger.conditions[0] ?? []).filter((c) => !hiddenFields?.has(c.field) && c.field !== MAX_FINDINGS_FIELD && c.field !== WEBHOOK_SECRET_HASH_FIELD && c.field !== WEBHOOK_BODY_REGEX_FIELD);
  const reserved = (trigger.conditions[0] ?? []).filter((c) => c.field === MAX_FINDINGS_FIELD || c.field === WEBHOOK_SECRET_HASH_FIELD || c.field === WEBHOOK_BODY_REGEX_FIELD);
  const setGroup = (g: Condition[]) => { const first = [...g, ...reserved]; onChange({ ...trigger, conditions: first.length ? [first, ...trigger.conditions.slice(1)] : trigger.conditions.slice(1) }); };
  const usedFields = new Set(group.map((c) => c.field));
  const addable = fields.filter((f) => !(IDENTITY_TYPES.has(f.type) && usedFields.has(f.field)));
  return (
    <div className="flex min-h-7 flex-wrap items-center gap-x-2 gap-y-1 text-13 text-text-primary">
      {prefix}
      {group.map((c, idx) => {
        const field = fields.find((f) => f.field === c.field) ?? schema?.fields.find((f) => f.field === c.field);
        const ops = field ? operatorsFor(field) : [c.operator];
        const setC = (patch: Partial<Condition>) => setGroup(group.map((x, i) => (i === idx ? { ...x, ...patch } : x)));
        const prefixLabel = field ? identityPrefix(field) : null;
        const swappable = fields.filter((f) => f.field === c.field || !usedFields.has(f.field));
        return (
          <span key={`${c.field}-${idx}`} className="flex flex-wrap items-center gap-2">
            {idx > 0 && <span className="whitespace-nowrap text-text-secondary">{t("and")}</span>}
            {prefixLabel || readonly ? (
              <span className="whitespace-nowrap">{prefixLabel ?? field?.label ?? c.field.split(".").pop() ?? c.field}</span>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild><button type="button" aria-label={t("selectConditionField")} className={cn(ACCENT_CHIP, "gap-1 cursor-default")}>{field?.label ?? (c.field || t("fieldPlaceholder"))}<ChevronDown size={14} /></button></DropdownMenuTrigger>
                <DropdownMenuContent align="start"><FieldMenuItems fields={swappable} onPick={(f) => { const op = operatorsFor(f)[0]!; setC({ field: f.field, operator: op, value: initialValueFor(f, op) }); }} /></DropdownMenuContent>
              </DropdownMenu>
            )}
            {readonly ? (
              <span className="whitespace-nowrap text-text-secondary">{OPERATOR_LABEL[c.operator] ?? c.operator}</span>
            ) : (ops.length > 1 || c.operator === "globs") && (
              <Select size="inline" value={c.operator} options={ops.map((o) => ({ value: o, label: OPERATOR_LABEL[o] ?? o }))} onValueChange={(v) => setC({ operator: v, value: field ? ((v === "in" || v === "not_in" || v === "globs") !== (c.operator === "in" || c.operator === "not_in" || c.operator === "globs") || v === "is_empty" ? initialValueFor(field, v) : c.value) : c.value })} ariaLabel={t("selectConditionOperator")} placeholder={t("operatorPlaceholder")} />
            )}
            {c.operator !== "is_empty" && (readonly
              ? <span className={ACCENT_CHIP}>{formatValue(c, field, channelLabel)}</span>
              : <ValueEditor field={field} condition={c} onChange={(value) => setC({ value })} />)}
            {!readonly && <Button variant="ghost" size="sm" aria-label={t("removeCondition")} onClick={() => setGroup(group.filter((_, i) => i !== idx))}><X size={12} /></Button>}
          </span>
        );
      })}
      {trailing}
      {!readonly && (addable.length > 0 || extraMenu) && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button variant="ghost" size="sm" aria-label={t("addCondition")}><Plus size={10} /></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <FieldMenuItems fields={addable} onPick={(f) => { const op = operatorsFor(f)[0]!; setGroup([...group, { field: f.field, operator: op, value: initialValueFor(f, op) }]); }} />
            {extraMenu && addable.length > 0 && <DropdownMenuSeparator />}
            {extraMenu && <DropdownMenuItem onSelect={() => onPickExtra?.(extraMenu.value)}>{extraMenu.label}</DropdownMenuItem>}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      {suffix}
    </div>
  );
}

/* ---------------- Webhook card body (`wn` URL row, `Tn` secret row, `En` test command) ---------------- */
function CopyIconButton({ text, label, copiedLabel, className }: { text: string; label: string; copiedLabel: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Tooltip content={copied ? copiedLabel : label}>
      <Button variant="ghost" size="sm" className={cn("shrink-0", className)} aria-label={label} onClick={() => { void navigator.clipboard?.writeText(text); setCopied(true); window.setTimeout(() => setCopied(false), 1500); }}><Copy size={14} /></Button>
    </Tooltip>
  );
}

function WebhookUrlRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-13 text-text-primary">{label}</label>
      <div className="flex max-w-[600px] items-center gap-1.5">
        <code className="min-w-0 flex-1 truncate rounded border border-border-secondary bg-tint-secondary px-2 py-1.5 font-mono text-12 text-text-primary">{value}</code>
        <CopyIconButton text={value} label={t("copyLabel", { label })} copiedLabel={t("copiedLabel", { label })} />
      </div>
    </div>
  );
}

/** `Tn` — without regeneration the secret starts visible with Hide/Show; with regeneration that control becomes Regenerate (disabled while regenerating). */
function WebhookSecretRow({ secret, onRegenerate, regenerating, note }: { secret?: string; onRegenerate?: () => void; regenerating?: boolean; note?: ReactNode }) {
  const [visible, setVisible] = useState(true);
  const hasSecret = !!secret;
  const canRegenerate = !!onRegenerate;
  const shown = hasSecret && (canRegenerate || visible);
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-13 text-text-primary">{t("secret")}</label>
      <div className="flex max-w-[600px] items-center gap-1.5">
        <code className="min-w-0 flex-1 truncate rounded border border-border-secondary bg-tint-secondary px-2 py-1.5 font-mono text-12 text-text-primary">{shown ? secret : "•".repeat(24)}</code>
        {canRegenerate ? (
          <Tooltip content={t("regenerateSecret")}>
            <Button variant="ghost" size="sm" aria-label={t("regenerateSecret")} onClick={onRegenerate} disabled={regenerating}><RefreshCw size={14} className={cn(regenerating && "animate-spin")} /></Button>
          </Tooltip>
        ) : hasSecret && (
          <Tooltip content={t(visible ? "hideSecret" : "showSecret")}>
            <Button variant="ghost" size="sm" aria-label={t(visible ? "hideSecret" : "showSecret")} onClick={() => setVisible((v) => !v)}>{visible ? <EyeOff size={14} /> : <Eye size={14} />}</Button>
          </Tooltip>
        )}
        {hasSecret && <CopyIconButton text={secret!} label={t("copySecret")} copiedLabel={t("copiedSecret")} />}
      </div>
      {hasSecret && note && <p className="text-11">{note}</p>}
    </div>
  );
}

function WebhookTestCommand({ webhookUrl }: { webhookUrl: string }) {
  const cmd = webhookCurl(webhookUrl);
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-13 text-text-primary">{t("testCommand")}</label>
      <div className="flex max-w-[600px] items-start gap-1.5">
        <pre className="min-w-0 flex-1 overflow-x-auto whitespace-pre rounded border border-border-secondary bg-tint-secondary px-2 py-1.5 font-mono text-12 text-text-primary">{cmd}</pre>
        <CopyIconButton text={cmd} label={t("copyTestCommand")} copiedLabel={t("copiedTestCommand")} />
      </div>
      <p className="text-11">{rich(t("webhookTestCommandHelp", { secretPlaceholder: "<REPLACE_WITH_SECRET>" }), { code: (c, k) => <code key={k} className="font-mono">{c}</code> })}</p>
    </div>
  );
}

function WebhookBody({
  trigger, onChange, creds, webhookUrl, readonly, onRegenerate, regenerating, note, showTestCommand = true,
}: { trigger: Trigger; onChange: (tr: Trigger) => void; creds: WebhookCreds; webhookUrl: string; readonly?: boolean; onRegenerate?: () => void; regenerating?: boolean; note?: ReactNode; showTestCommand?: boolean }) {
  const regex = trigger.conditions[0]?.find((c) => c.field === WEBHOOK_BODY_REGEX_FIELD);
  const regexValue = typeof regex?.value === "string" ? regex.value : "";
  const [confirmRegen, setConfirmRegen] = useState(false);
  const secret = creds?.webhook_secret;
  return (
    <>
      {webhookUrl && <WebhookUrlRow label={t("webhookUrl")} value={webhookUrl} />}
      {webhookUrl && (!readonly || secret) && (
        <WebhookSecretRow secret={secret} onRegenerate={onRegenerate && !readonly ? () => setConfirmRegen(true) : undefined} regenerating={regenerating} note={note ?? (secret ? t("webhookSecretNote") : undefined)} />
      )}
      {onRegenerate && (
        <ConfirmDialog open={confirmRegen} onOpenChange={setConfirmRegen} title={t("regenerateWebhookSecretTitle")} description={t("regenerateWebhookSecretDescription")} confirmLabel={t("regenerate")} onConfirm={() => { setConfirmRegen(false); onRegenerate(); }} />
      )}
      <div className="flex flex-col gap-1.5">
        {!readonly && (
          <>
            <label className="text-13 text-text-primary">{t("payloadFilterOptional")}</label>
            <Input value={regexValue} onChange={(e) => onChange({ ...trigger, conditions: withWebhookBodyRegex(trigger.conditions, e.target.value) })} placeholder={t("payloadFilterPlaceholder")} className="max-w-[400px] font-mono text-13" />
            <p className="text-11">{rich(t("payloadFilterHelp"), { code: (c, k) => <code key={k}>{c}</code> })}</p>
          </>
        )}
        {readonly && regexValue && (
          <p className="text-12 text-text-primary"><span className="text-text-secondary">{t("payloadFilterLabel")}</span> <code className="font-mono">{regexValue}</code></p>
        )}
      </div>
      {showTestCommand && webhookUrl && !readonly && <WebhookTestCommand webhookUrl={webhookUrl} />}
    </>
  );
}

/* ---------------- Code-scan findings limit (`kt`) ---------------- */
function CodeScanLimit({ trigger, onChange, readonly }: { trigger: Trigger; onChange: (tr: Trigger) => void; readonly?: boolean }) {
  const current = maxFindingsOf(trigger.conditions);
  const [draft, setDraft] = useState<string | null>(null);
  const change = (v: string) => {
    setDraft(v);
    if (v.trim() === "") { onChange({ ...trigger, conditions: withMaxFindings(trigger.conditions, null) }); return; }
    const n = parseInt(v, 10);
    if (Number.isFinite(n)) onChange({ ...trigger, conditions: withMaxFindings(trigger.conditions, Math.max(1, n)) });
  };
  return (
    <div className="flex shrink-0 items-center gap-2 text-13 text-text-primary">
      <span>{t("forUpTo")}</span>
      {readonly ? <span>{current ?? DEFAULT_MAX_FINDINGS}</span> : (
        <Tooltip content={t("findingsPerScanTooltip")}>
          <Input type="text" inputMode="numeric" value={draft ?? String(current ?? DEFAULT_MAX_FINDINGS)} onChange={(e) => change(e.target.value)} onBlur={() => setDraft(null)} aria-label={t("findingsPerScanLimit")} className="h-[24px] w-[52px] px-1.5 text-13" />
        </Tooltip>
      )}
      <span>{t("newFindingsPerScan")}</span>
    </div>
  );
}

/* ---------------- Reply model (`jt`/`Nt`/`Mt`/`Xt`, TriggerEditor-D8VGRxC1.js:1343-1410) ---------------- */
function useReplyModel(trigger: Trigger, onChange: (tr: Trigger) => void, opts: {
  readonly?: boolean; monitorMode?: boolean; postResponseEnabled: boolean; hasStartSessionAction: boolean; slackReplyMode: SlackThreadMode; onClearSlackReplyMode?: () => void;
}) {
  const source = sourceOf(trigger.event_type);
  const replies = trigger.replies ?? [];
  const hasPost = replies.some((r) => r.type === "post_response");
  const mode = opts.slackReplyMode;
  const postEligible = opts.postResponseEnabled && opts.hasStartSessionAction && REPLY_SOURCES.has(source) && !REPLY_EXCLUDED_EVENTS.has(trigger.event_type) && (mode !== "post_response" || hasPost);
  const slackRow = source === "slack" && !opts.monitorMode;
  const threadReply = replies.find((r) => r.type === "attach_thread" || r.type === "notify_thread");
  const slackMode: "attach" | "notify" | "post" | null = threadReply ? (threadReply.type === "attach_thread" ? "attach" : "notify") : slackRow && hasPost ? "post" : mode === "attach" || mode === "notify" ? mode : null;
  const slackEligible = slackRow && opts.hasStartSessionAction && (mode !== "forward" || hasPost) && (mode !== "post_response" || hasPost || !!threadReply);
  const nonThread = replies.filter((r) => r.type !== "attach_thread" && r.type !== "notify_thread");
  const afterRemove = slackRow && !threadReply && hasPost ? nonThread.filter((r) => r.type !== "post_response") : nonThread;
  const canAdd = !opts.readonly && ((postEligible && !hasPost) || (slackEligible && !slackMode));
  const show = (postEligible && hasPost) || (slackEligible && !!slackMode);
  const add = (conditions?: Condition[][]) => {
    const base = conditions === undefined ? trigger : { ...trigger, conditions };
    if (postEligible) onChange({ ...base, replies: [...replies, { type: "post_response" }] });
    else if (slackEligible) { onChange({ ...base, replies: [...nonThread, { type: "attach_thread" }] }); opts.onClearSlackReplyMode?.(); }
    else if (conditions !== undefined) onChange(base);
  };
  const remove = () => {
    if (postEligible && hasPost) onChange({ ...trigger, replies: replies.filter((r) => r.type !== "post_response") });
    else { onChange({ ...trigger, replies: afterRemove }); opts.onClearSlackReplyMode?.(); }
  };
  /** Swapping the Reply chip for a schema field: add that condition and drop the reply. */
  const swapForCondition = (cond: Condition) => {
    const next = { ...trigger, conditions: [[...(trigger.conditions[0] ?? []), cond], ...trigger.conditions.slice(1)] };
    if (postEligible && hasPost) onChange({ ...next, replies: replies.filter((r) => r.type !== "post_response") });
    else { onChange({ ...next, replies: afterRemove }); opts.onClearSlackReplyMode?.(); }
  };
  const notify = slackRow && slackMode === "notify";
  const slackPost = slackRow && slackMode === "post";
  const qualifier = t(notify ? "withSessionLink" : "withResponse");
  const description = notify ? t("replyPostsSessionLink") : slackPost ? t("replyApiOnly") : slackRow ? t("replyOnThread") : GITHUB_PR_REPLY_EVENTS.has(trigger.event_type) ? t("replyCommentsOnPr") : GITLAB_MR_REPLY_EVENTS.has(trigger.event_type) ? t("replyCommentsOnMergeRequest") : t("replyCommentsOnIssue");
  return { canAdd, show, add, remove, swapForCondition, qualifier, description };
}

function ReplyRow({ trigger, readonly, model, hiddenFields }: { trigger: Trigger; readonly?: boolean; model: ReturnType<typeof useReplyModel>; hiddenFields?: Set<string> }) {
  const used = new Set((trigger.conditions[0] ?? []).map((c) => c.field));
  const remaining = (schemaFor(trigger.event_type)?.fields ?? []).filter((f) => !hiddenFields?.has(f.field) && !(IDENTITY_TYPES.has(f.type) && used.has(f.field)));
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2 text-13 text-text-primary">
      <span className="shrink-0">{t("then")}</span>
      {readonly ? <span className={ACCENT_CHIP}>{t("reply")}</span> : (
        <DropdownMenu>
          <DropdownMenuTrigger asChild><button type="button" aria-label={t("selectReplyField")} className={cn(ACCENT_CHIP, "gap-1 cursor-default")}>{t("reply")}<ChevronDown size={14} /></button></DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <FieldMenuItems fields={remaining} onPick={(f) => { const op = operatorsFor(f)[0]!; model.swapForCondition({ field: f.field, operator: op, value: initialValueFor(f, op) }); }} />
            {remaining.length > 0 && <DropdownMenuSeparator />}
            <DropdownMenuCheckItem checked>{t("reply")}</DropdownMenuCheckItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      <span className="shrink-0">{model.qualifier}</span>
      <span className="translate-y-px truncate text-12 leading-[18px] text-text-secondary">{model.description}</span>
      {!readonly && (
        <Tooltip content={t("removeReply")}>
          <Button variant="ghost" size="sm" onClick={model.remove} aria-label={t("removeReply")} className="ml-auto"><X size={16} /></Button>
        </Tooltip>
      )}
    </div>
  );
}

/* ---------------- Inline warning row (`In`) ---------------- */
/**
 * `In` rendered inside the card module's footer strip (`card-BnFC4Qyi.js` export `a`): a tinted band tucked under the
 * trigger card (`mt-[-22px] pt-8`), icon top-aligned, message in a `min-w-0` span, optional action pushed right.
 */
function WarningRow({ message, action }: { message: ReactNode; action?: ReactNode }) {
  return (
    <div className={cn("bg-tint-tertiary text-text-primary text-13 rounded-b-[10px] px-[14px] pb-2.5 pt-8 mt-[-22px]", "flex items-start gap-1.5", action && "justify-between gap-2")}>
      <span className="flex items-start gap-1.5"><TriangleAlert size={14} className="mt-0.5 shrink-0" aria-hidden="true" /><span className="min-w-0">{message}</span></span>
      {action}
    </div>
  );
}

/* ---------------- Public repository gate (`ln`/`un`, TriggerEditor-D8VGRxC1.js module lines 1605-1650) ---------------- */
const PUBLIC_WARNING_SOURCES = new Set(["github", "gitlab"]);
function repositoryValues(trigger: Trigger): string[] {
  const out: string[] = [];
  for (const group of trigger.conditions ?? []) {
    for (const c of group) {
      if (c.field !== "repository") continue;
      if (Array.isArray(c.value)) out.push(...c.value.map(String).filter(Boolean));
      else if (typeof c.value === "string" && c.value.trim()) out.push(c.value.trim());
    }
  }
  return out;
}
/**
 * Port of `ln` (blocked predicate) and `un` (warning element): GitHub triggers on connections without a PAT
 * warn when the org disallows public repositories and no selected repository is known to be private; the
 * warning waits for both the connections and repositories queries. The settings-link variant depends on an
 * integration settings path that is not in evidence, so the plain `publicRepoWarning` branch is rendered.
 */
function usePublicRepoWarning(trigger: Trigger, source: string | null | undefined, readonly: boolean | undefined): ReactNode {
  const isGithub = source === "github" && !readonly;
  const selectedKey = repositoryValues(trigger).join("\u0000");
  const conns = useQuery("git-connections", () => store.gitConnections(), { enabled: isGithub });
  const repos = useQuery("repos:all", () => store.repos(), { enabled: isGithub && selectedKey.length > 0 });
  const blocked = useMemo(() => {
    if (!isGithub) return false;
    if (conns.isLoading || conns.isError || conns.data === undefined) return true;
    const noPat = conns.data.filter((c) => !c.has_pat);
    if (noPat.length === 0) return true;
    const allAllow = noPat.every((c) => c.allow_owned_public_repos_in_automations === true);
    const selected = selectedKey ? selectedKey.split("\u0000") : [];
    if (selected.length === 0) return !allAllow;
    if (repos.isLoading || repos.isError || repos.data === undefined) return true;
    const byName = new Map(repos.data.map((r) => [r.full_name, r]));
    return selected.some((name) => {
      const r = byName.get(name);
      if (!r) return !allAllow;
      if (r.visibility !== null && r.visibility !== undefined && r.visibility !== "public") return false;
      return noPat.find((c) => c.git_connection_id === r.connection_id)?.allow_owned_public_repos_in_automations !== true;
    });
  }, [isGithub, conns.isLoading, conns.isError, conns.data, repos.isLoading, repos.isError, repos.data, selectedKey]);
  if (!source || !PUBLIC_WARNING_SOURCES.has(source) || readonly || !blocked) return null;
  if (source === "github" && (conns.isLoading || repos.isLoading)) return null;
  return <WarningRow message={source === "gitlab" ? t("gitlabPublicProjectWarning") : t("publicRepoWarning")} />;
}

/* ---------------- Trigger card (`br` row) ---------------- */
export type TriggerCardProps = {
  trigger: Trigger; onChange: (tr: Trigger) => void; onRemove?: () => void; readonly?: boolean; showError?: boolean; canRemove?: boolean;
  webhookCreds?: WebhookCreds; webhookUrl?: string; onRegenerateSecret?: () => void; connections?: Record<string, boolean>;
  /** Other rows' singleton types (and `slack:message` while another row monitors) — disabled in this row's picker. */
  disabledEventTypes?: Set<string>;
  /** `lockRestrictedTriggers` — a `code_scan:*` row cannot be removed and shows a static type label. */
  lockRestrictedTriggers?: boolean;
  /** Reply-mode inputs from the action editor (`hasStartSessionAction`, `slackReplyMode`, `onClearSlackReplyMode`). */
  hasStartSessionAction?: boolean;
  postResponseEnabled?: boolean;
  slackReplyMode?: SlackThreadMode;
  onClearSlackReplyMode?: () => void;
  /** Watch-channel (monitor) mode for this row; `showMonitor` controls the virtual picker item; `onMonitorChange` fires on enter/leave. */
  monitorMode?: boolean;
  showMonitor?: boolean;
  onMonitorChange?: (on: boolean) => void;
  /** Triage mode hides `is_thread_reply`. */
  triageMode?: boolean;
  disabledChannelIds?: Set<string>;
  /** Webhook secret row note (e.g. `webhookSecretNote` / `webhookSecretNoteSaved`), regenerate spinner, test-command visibility. */
  webhookSecretNote?: ReactNode;
  regeneratingWebhookSecret?: boolean;
  showWebhookTestCommand?: boolean;
};

export function TriggerCard({
  trigger, onChange, onRemove, readonly, showError, canRemove, webhookCreds, webhookUrl, onRegenerateSecret, connections,
  disabledEventTypes, lockRestrictedTriggers, hasStartSessionAction = true, postResponseEnabled = true, slackReplyMode = null, onClearSlackReplyMode,
  monitorMode = false, showMonitor = false, onMonitorChange, triageMode = false, disabledChannelIds, webhookSecretNote, regeneratingWebhookSecret, showWebhookTestCommand = true,
}: TriggerCardProps) {
  const caps = useCapabilities();
  const source = sourceOf(trigger.event_type);
  const isSchedule = trigger.event_type === "schedule:recurring";
  const isWebhook = trigger.event_type === "webhook:incoming";
  const isMonitorRow = monitorMode && trigger.event_type === "slack:message";
  const isCodeScan = trigger.event_type === "code_scan:finding";
  const locked = !!lockRestrictedTriggers && source === "code_scan";
  const internal = !source || ["schedule", "webhook", "code_scan", "snapshot_build"].includes(source);
  const connected = internal || (connections ? connections[source] !== false : caps.connections[source] !== "disconnected");
  const parsed = isSchedule ? parseRRule(rruleOf(trigger)) : null;
  const subHourlyBlocked = isSchedule && !subHourlyAllowed(caps.planSlug) && isSubHourly(parsed);
  const hiddenFields = triageMode ? new Set([THREAD_REPLY_FIELD]) : undefined;
  const reply = useReplyModel(trigger, onChange, { readonly, monitorMode: isMonitorRow, postResponseEnabled, hasStartSessionAction, slackReplyMode, onClearSlackReplyMode });

  const changeType = (next: Trigger) => {
    if (isMonitorRow && next.event_type !== "slack:message") onMonitorChange?.(false);
    onChange({ ...next, replies: filterRepliesForType(trigger.replies, trigger.event_type, next.event_type), trigger_id: trigger.trigger_id });
  };
  const selectMonitor = () => { onMonitorChange?.(true); onChange({ event_type: "slack:message", conditions: [], trigger_id: trigger.trigger_id }); };

  const publicRepoWarning = usePublicRepoWarning(trigger, source ? String(source) : null, readonly);
  const icon = source ? <span className="shrink-0 text-text-primary"><SourceIcon source={source} size={16} /></span> : null;
  const typeLabel = isMonitorRow ? t("triggerWatchChannel") : isSchedule ? t(SCHEDULE_ITEMS.find((it) => it.key === classify(parsed))?.labelKey ?? "scheduleCustom") : trigger.event_type ? eventName(trigger.event_type) : t("addTriggerPicker");
  const typeChip = locked
    ? <span className="text-13 text-text-primary">{eventName(trigger.event_type)}</span>
    : <AddTriggerMenu triggers={[trigger]} onAdd={changeType} label={typeLabel} chipClass={ACCENT_CHIP} currentEventType={isMonitorRow ? SLACK_MONITOR_TYPE : trigger.event_type} disabledEventTypes={disabledEventTypes} showMonitor={showMonitor} onSelectMonitor={selectMonitor} />;
  const header = readonly
    ? <div className="flex min-h-7 items-center gap-2 text-13 text-text-primary">{icon}{isSchedule ? summarize(rruleOf(trigger)) : typeLabel}</div>
    : <div className="flex items-center gap-2.5">{icon}{typeChip}</div>;
  const removeBtn = !readonly && canRemove && onRemove && !locked ? (
    <div className="ml-auto flex shrink-0 items-center gap-1">
      <Tooltip content={t("removeTrigger")}><Button variant="ghost" size="sm" onClick={onRemove} aria-label={t("removeTrigger")}><Trash2 size={14} /></Button></Tooltip>
    </div>
  ) : null;

  return (
    <div>
      <div className={cn("relative flex flex-col overflow-hidden rounded-[10px] border border-border-secondary bg-bg-elevated p-2.5 pl-3.5", showError && "ring-1 ring-text-destructive")}>
        {!trigger.event_type && <div className="flex items-center">{header}{removeBtn}</div>}
        {isSchedule && (
          <div className="flex flex-wrap items-center gap-2">
            {readonly ? header : <><span className="shrink-0 text-text-primary"><Calendar size={16} aria-hidden="true" /></span><div className="min-w-0 flex-1"><SchedulePhrase trigger={trigger} onChange={onChange} frequencyControl={typeChip} /></div></>}
            {removeBtn}
          </div>
        )}
        {isWebhook && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center">{header}{removeBtn}</div>
            <WebhookBody trigger={trigger} onChange={onChange} creds={webhookCreds ?? null} webhookUrl={webhookUrl ?? ""} readonly={readonly} onRegenerate={onRegenerateSecret} regenerating={regeneratingWebhookSecret} note={webhookSecretNote} showTestCommand={showWebhookTestCommand} />
          </div>
        )}
        {isMonitorRow && (
          <div className="flex flex-col">
            <div className="flex flex-wrap items-center gap-2.5">
              {header}
              <MonitorChannelRow trigger={trigger} onChange={onChange} readonly={readonly} showError={showError} disabledChannelIds={disabledChannelIds} />
              {removeBtn}
            </div>
            <div aria-hidden="true" className="h-3" />
          </div>
        )}
        {trigger.event_type && !isSchedule && !isWebhook && !isMonitorRow && (
          <>
            <ConditionEditor
              trigger={trigger} onChange={onChange} readonly={readonly} prefix={header} suffix={removeBtn} hiddenFields={hiddenFields}
              extraMenu={reply.canAdd ? { value: REPLY_SENTINEL, label: t("reply") } : null} onPickExtra={() => reply.add()}
              trailing={isCodeScan ? <CodeScanLimit trigger={trigger} onChange={onChange} readonly={readonly} /> : undefined}
            />
            {reply.show && <div className="mt-1.5 flex items-center pl-[26px]"><ReplyRow trigger={trigger} readonly={readonly} model={reply} hiddenFields={hiddenFields} /></div>}
          </>
        )}
      </div>
      {!connected && (
        <WarningRow message={t("connectToUseTrigger", { source: sourceLabel(source) })} action={<Button variant="primary" size="sm">{t("connect")}</Button>} />
      )}
      {publicRepoWarning}
      {subHourlyBlocked && (
        <WarningRow message={t("subHourlyBlockMessage")} action={<Button variant="primary" size="sm" asChild><a href="/settings/plans" target="_blank" rel="noreferrer">{t("upgrade")}</a></Button>} />
      )}
    </div>
  );
}

/* ---------------- Pylon trigger-disabled banner (PylonTriggerDisabledBanner-DZX-gc1i.js) ---------------- */
export function pylonDisabledTriggers(triggers: Trigger[], unsupported: Iterable<string>): Trigger[] {
  const set = new Set(unsupported);
  return triggers.filter((tr) => sourceOf(tr.event_type) === "pylon" && set.has(tr.event_type));
}

export function PylonTriggerDisabledBanner({ triggers }: { triggers: Trigger[] }) {
  const caps = useCapabilities();
  const affected = pylonDisabledTriggers(triggers, caps.unsupportedEventTypes);
  if (affected.length === 0) return null;
  const all = affected.length === triggers.length;
  const names = affected.map((tr) => eventName(tr.event_type)).join(", ");
  return (
    <div role="alert" className="flex gap-2.5 rounded-[10px] border border-border-secondary bg-bg-elevated px-3 py-2.5 text-13">
      <TriangleAlert size={16} className="mt-0.5 shrink-0 text-text-orange" aria-hidden="true" />
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="font-medium text-text-primary">{t(all ? "pylon.triggerDisabledTitle" : "pylon.triggerPartiallyDisabledTitle", { defaultValue: all ? "Pylon triggers are disabled" : "Some Pylon triggers are disabled" })}</span>
        <span className="text-text-secondary">
          {t(all ? "pylon.triggerDisabledDescription" : "pylon.triggerPartiallyDisabledDescription", { triggers: names, defaultValue: all ? `This automation won't run because its Pylon triggers (${names}) are disabled for your Pylon connection.` : `The following Pylon triggers are disabled for your Pylon connection and won't fire: ${names}.` })}
          {" "}
          <a href="/settings/connections/pylon" className="text-text-link hover:text-text-link-strong hover:underline">{t("pylon.triggerDisabledLink", { defaultValue: "Manage Pylon connection" })}</a>
        </span>
      </div>
    </div>
  );
}

/** Compact status shown only when every trigger is a disabled Pylon trigger. */
export function PylonTriggerDisabledStatus({ triggers }: { triggers: Trigger[] }) {
  const caps = useCapabilities();
  const affected = pylonDisabledTriggers(triggers, caps.unsupportedEventTypes);
  if (affected.length === 0 || affected.length !== triggers.length) return null;
  return <span className="flex items-center gap-1.5 text-text-orange"><TriangleAlert size={16} aria-hidden="true" />{t("pylon.triggerDisabledStatus", { defaultValue: "Pylon triggers disabled" })}</span>;
}
