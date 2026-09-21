import { Link, useLocation, useNavigate, useParams } from "@tanstack/react-router";
import { CircleCheck, CircleDashed, CircleX, Clock, Copy, Ellipsis, Filter, Info, Lock, Pencil, Play, Search, SquarePen, TriangleAlert } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Action, Automation, AutomationEvent, Condition, EventStatus, Trigger } from "@/model/types";
import { isNotFoundError, store, useQuery, useTogglePending } from "@/data/store";
import { useCapabilities } from "@/data/capabilities";
import { HeaderActions } from "@/shell/header-portals";
import { IconButton } from "@/ui/icon-button";
import { sourceOf, SourceIcon, hasSourceIcon, sourceLabel, eventName, rruleOf, schemaFor, operatorsFor, OPERATOR_LABEL, type SchemaField } from "@/model/sources";
import { summarize } from "@/model/rrule";
import { tagDotColor, isReservedTagKey } from "@/model/tags";
import { cn } from "@/lib/cn";
import { absoluteDate, eventDate, utcTimestamp } from "@/lib/time";
import { t } from "@/i18n/t";
import { Button } from "@/ui/button";
import { Tooltip } from "@/ui/tooltip";
import { Skeleton } from "@/ui/skeleton";
import { Badge } from "@/ui/badge";
import { Textarea } from "@/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/ui/input-group";
import { Dialog, DialogContent, ConfirmDialog } from "@/ui/dialog";
import { DropdownMenu, DropdownMenuCheckItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/ui/menu";
import { DevinMark } from "@/icons/devin";
import { SpendingFrozenTooltipContent } from "@/ui/spending-frozen";
import { useGenerateWithDevin } from "@/features/editor/useGenerateWithDevin";
import { ORG_ID } from "@/data/seed";
import { duplicatePrefill } from "@/features/list/AutomationListItem";
import { EVENTS_PAGE, STATUS_ORDER } from "./constants";
import { type Preset, rangeFor, ActivitySummary, ConsumptionSummary, DateRangeControl } from "./analytics";
import { IssuesSection } from "./IssuesSection";

/** Events poll every 5s only while a row is queued/running (spec App. A "Events" row). */
const EVENTS_ACTIVE_POLL_MS = 5000;
const CODE_SCAN_EVENT = "code_scan:finding";

/* ---------------- Search snippet/highlight (§18.3; AutomationViewPage 1545-1610) ---------------- */
type SnippetMatch = { start: number; end: number; matchStart: number; matchEnd: number; text: string };
/** First case-insensitive match; snippet keeps ≤40 preceding and ≤200 following source characters, clipped starts get `… `. */
function findSnippet(text: string, query: string): SnippetMatch | null {
  const idx = text.toLowerCase().indexOf(query);
  if (idx < 0) return null;
  const matchEnd = idx + query.length;
  const start = Math.max(0, idx - 40), end = Math.min(text.length, matchEnd + 200);
  return { start, end, matchStart: idx, matchEnd, text: (start > 0 ? "… " : "") + text.slice(start, end) };
}
function Highlight({ text, query }: { text: string; query: string }) {
  const idx = query ? text.toLowerCase().indexOf(query) : -1;
  if (idx < 0) return <>{text}</>;
  return <>{text.slice(0, idx)}<span className="font-semibold text-text-primary">{text.slice(idx, idx + query.length)}</span>{text.slice(idx + query.length)}</>;
}

/* ---------------- Events table (§18.3) ---------------- */
function StatusGlyph({ status, label }: { status: EventStatus; label: string }) {
  switch (status) {
    case "succeeded": return <CircleCheck size={14} aria-label={label} className="shrink-0 text-text-green" />;
    case "running": return <span aria-label={label} className="size-2 shrink-0 rounded-full bg-text-green motion-safe:animate-pulse" />;
    case "queued": return <Clock size={14} aria-label={label} className="shrink-0 text-text-secondary" />;
    case "skipped": case "canceled": return <CircleDashed size={14} aria-label={label} className="shrink-0 text-text-secondary" />;
    default: return <CircleX size={14} aria-label={label} className="shrink-0 text-text-red" />;
  }
}

/** Display message precedence: trimmed `event_message` → synthesized schedule line → `No message` (AutomationViewPage 1585-1600). */
function displayMessage(e: AutomationEvent, triggers: Trigger[]): string {
  const m = e.event_message?.trim();
  if (m) return m;
  const scheduleIds = new Set(triggers.filter((x) => x.event_type.startsWith("schedule")).map((x) => x.trigger_id));
  const allSchedules = triggers.length > 0 && triggers.every((x) => x.event_type.startsWith("schedule"));
  const typeOf = e.event_type ?? (e.trigger_id ? triggers.find((x) => x.trigger_id === e.trigger_id)?.event_type : null);
  const isSchedule = typeOf?.startsWith("schedule") || (e.trigger_id === null ? allSchedules : scheduleIds.has(e.trigger_id ?? undefined));
  if (isSchedule) return t("scheduleTriggeredAt", { timestamp: new Date(e.created_at).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) });
  return t("noEventMessage");
}

type RenderedPart = { text: string; resource_url?: string | null; accessibleText: string; highlightStart: number; highlightEnd: number };
/** Project `event_message_parts` onto the search snippet window, keeping each part's resource link (AutomationViewPage 2020-2060). */
function partsFor(parts: Array<{ text: string; resource_url?: string | null }>, match: SnippetMatch | null): RenderedPart[] {
  if (!match) return parts.map((p) => ({ ...p, accessibleText: p.text, highlightStart: -1, highlightEnd: -1 }));
  let cursor = 0, first = true;
  return parts.flatMap((p) => {
    const from = cursor, to = from + p.text.length;
    cursor = to;
    const a = Math.max(from, match.start), b = Math.min(to, match.end);
    if (a >= b) return [];
    const prefix = first && match.start > 0 ? "… " : "";
    first = false;
    const hs = Math.max(a, match.matchStart), he = Math.min(b, match.matchEnd);
    return [{ ...p, accessibleText: p.text, text: prefix + p.text.slice(a - from, b - from), highlightStart: hs < he ? prefix.length + hs - a : -1, highlightEnd: hs < he ? prefix.length + he - a : -1 }];
  });
}

function EventsSection({ automationId, automationEnabled, since, until, triggers }: { automationId: string; automationEnabled: boolean; since: Date; until: Date; triggers: Trigger[] }) {
  const caps = useCapabilities();
  const [page, setPage] = useState(0);
  const [statuses, setStatuses] = useState<EventStatus[]>([]);
  const [search, setSearch] = useState("");
  const rangeKey = `${since.toISOString()}:${until.toISOString()}`;
  useEffect(() => { setPage(0); }, [rangeKey, statuses.join(","), search]);
  const q = useQuery(
    `events:${automationId}:${rangeKey}:${statuses.join(",")}:${page}`,
    () => store.events(automationId, { since: since.toISOString(), until: until.toISOString(), status: statuses.length ? statuses : undefined, limit: EVENTS_PAGE, offset: page * EVENTS_PAGE, include_message: true }),
    { keepPrevious: true, refetchInterval: (d) => (d?.data.some((e) => e.status === "queued" || e.status === "running") ? EVENTS_ACTIVE_POLL_MS : false) },
  );
  const rows = q.data?.data ?? [];
  const total = q.data?.total ?? 0;
  // Lifetime existence probe behind the Preflight capability: `No events yet` only when nothing ever ran (AutomationViewPage 1560-1566).
  const probe = !q.isLoading && rows.length === 0 && statuses.length === 0 && automationEnabled === true && caps.preflight;
  const lifetime = useQuery(`events-any:${automationId}`, () => store.hasAnyEvents(automationId), { enabled: probe });
  const neverRan = probe && lifetime.data === false;
  const s = search.trim().toLowerCase();
  const visible = s ? rows.filter((e) => displayMessage(e, triggers).toLowerCase().includes(s)) : rows;
  const labelOf = (st: EventStatus) => t(STATUS_ORDER.find((x) => x.value === st)!.labelKey);
  const sourceIconFor = (e: AutomationEvent) => { const type = e.event_type ?? (e.trigger_id ? triggers.find((x) => x.trigger_id === e.trigger_id)?.event_type : null); const src = type ? sourceOf(type) : null; return src && hasSourceIcon(src) ? <SourceIcon source={src} size={16} /> : null; };

  const filterMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" aria-label={t("filter")} className="relative"><Filter />{statuses.length > 0 && <Badge variant="blue" className="absolute -right-0.5 -top-0.5 h-auto min-w-[16px] rounded-full px-1 py-0 text-11 justify-center">{statuses.length}</Badge>}</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={4}>
        {STATUS_ORDER.map((o) => <DropdownMenuCheckItem key={o.value} checked={statuses.includes(o.value)} onClick={(e) => { e.preventDefault(); setStatuses((cur) => (cur.includes(o.value) ? cur.filter((x) => x !== o.value) : [...cur, o.value])); }}>{t(o.labelKey)}</DropdownMenuCheckItem>)}
        {statuses.length > 0 && <><DropdownMenuSeparator /><DropdownMenuItem onClick={() => setStatuses([])}>{t("clearFilter")}</DropdownMenuItem></>}
      </DropdownMenuContent>
    </DropdownMenu>
  );
  const errorAlert = (bordered: boolean) => (
    <div role="alert" className={cn("flex items-center justify-center gap-3", bordered ? "rounded-lg border border-border-secondary px-4 py-3" : "py-12")}>
      <span id="automation-events-load-error" className="text-13 leading-[18px] text-text-secondary">{t("eventsLoadError")}</span>
      <Button variant="secondary" size="sm" aria-describedby="automation-events-load-error" onClick={() => q.refetch()}>{t("retry")}</Button>
    </div>
  );

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-14 font-medium text-text-primary">{t("events")}</h2>
      {q.isError && rows.length > 0 && errorAlert(true)}
      {q.isLoading && !q.data ? (
        <div className="flex flex-col gap-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-14 w-full rounded-[10px]" />)}</div>
      ) : q.isError && rows.length === 0 ? (
        errorAlert(false)
      ) : rows.length === 0 && statuses.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-[10px] border border-dashed border-border-primary px-6 py-12 text-center text-13 text-text-secondary">
          {t(neverRan ? "codeStep.noEventsYetHeading" : "noEvents")}
          {neverRan && <span className="text-12 text-text-tertiary">{t("codeStep.noEventsPreflight")}</span>}
        </div>
      ) : (
        <div className="rounded-[10px] border border-border-secondary bg-bg-elevated">
          <InputGroup className="h-9 rounded-b-none border-0 border-b border-border-secondary shadow-none">
            <InputGroupAddon><Search /></InputGroupAddon>
            <InputGroupInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("searchEventsPlaceholder")} />
            <InputGroupAddon align="inline-end">{filterMenu}</InputGroupAddon>
          </InputGroup>
          {visible.length === 0 && <p className="px-3 py-6 text-center text-13 leading-[18px] text-text-secondary">{s ? (total > EVENTS_PAGE ? t("noMatchingEvents") : t("noMatchingEventsSinglePage")) : t("noFilteredEvents")}</p>}
          <div className="[&>*+*]:border-t [&>*+*]:border-border-secondary">
            {visible.map((e) => {
              const label = labelOf(e.status);
              const sid = (e.investigation_devin_id ?? e.devin_session_id)?.replace(/^devin-/, "") ?? null;
              const msg = displayMessage(e, triggers);
              const icon = sourceIconFor(e);
              const match = s ? findSnippet(msg, s) : null;
              const messageId = `automation-event-message-${e.event_id}`, sessionId = `automation-event-session-${e.event_id}`;
              const parts = e.event_message_parts?.filter((p) => p.text) ?? [];
              const rendered = partsFor(parts, match);
              const body = match ? <Highlight text={match.text} query={s} /> : <>{msg}</>;
              const message = parts.length ? (
                <Tooltip content={msg}>
                  <span className="min-w-0 flex-1 truncate text-13 text-text-primary">
                    {rendered.map((p, i) => {
                      const inner = p.highlightStart >= 0 ? <>{p.text.slice(0, p.highlightStart)}<span className="font-semibold text-text-primary">{p.text.slice(p.highlightStart, p.highlightEnd)}</span>{p.text.slice(p.highlightEnd)}</> : p.text;
                      return p.resource_url
                        ? <a key={`${i}-${p.text}`} href={p.resource_url} target="_blank" rel="noopener noreferrer" aria-label={p.accessibleText} className="relative z-10 text-text-link hover:text-text-link-strong">{inner}</a>
                        : <span key={`${i}-${p.text}`}>{inner}</span>;
                    })}
                  </span>
                </Tooltip>
              ) : e.event_resource_url ? (
                <Tooltip content={msg}><span className="relative z-10 min-w-0 max-w-full truncate"><a href={e.event_resource_url} target="_blank" rel="noopener noreferrer" className="text-13 text-text-link hover:text-text-link-strong">{body}</a></span></Tooltip>
              ) : <span className="min-w-0 flex-1 truncate text-13 text-text-primary" title={msg}>{body}</span>;
              return (
                <div key={e.event_id} className={cn("group/row relative flex items-center gap-5 px-4 py-3", sid && "hover:bg-tint-tertiary")}>
                  {sid && <Link to="/sessions/$id" params={{ id: sid }} aria-labelledby={`${sessionId} ${messageId}`} className="absolute inset-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-border-secondary" />}
                  <Tooltip content={e.error_message && e.status !== "succeeded" && e.status !== "running" && e.status !== "queued" ? e.error_message : label}>
                    <span className="relative z-10 flex w-4 shrink-0 items-center justify-center" aria-label={label}><StatusGlyph status={e.status} label={label} /></span>
                  </Tooltip>
                  <span id={messageId} aria-label={msg} className="flex min-w-0 flex-1 items-center gap-2">
                    {icon && <span className="flex size-4 shrink-0" aria-hidden="true">{icon}</span>}
                    {message}
                  </span>
                  <Tooltip content={utcTimestamp(e.created_at)}><span className="relative z-10 shrink-0 text-12 leading-4 text-text-disabled">{eventDate(e.created_at)}</span></Tooltip>
                  {sid ? <span id={sessionId} className="shrink-0 whitespace-nowrap text-12 text-text-link group-hover/row:text-text-link-strong">{t("viewSession")}</span>
                    : <span className="relative shrink-0 whitespace-nowrap text-12 text-text-disabled"><span aria-hidden="true" className="invisible">{t("viewSession")}</span><span className="absolute inset-0 text-right">—</span></span>}
                </div>
              );
            })}
          </div>
        </div>
      )}
      {total > EVENTS_PAGE && (
        <div className="flex items-center justify-between text-12 text-text-secondary">
          <span>{s ? t("eventsSearchPageMatches", { count: visible.length }) : t("eventsRange", { from: page * EVENTS_PAGE + 1, to: page * EVENTS_PAGE + rows.length, total })}</span>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" disabled={page === 0 || q.isLoading} onClick={() => setPage((p) => Math.max(0, p - 1))}>{t("previous")}</Button>
            <Button variant="ghost" size="sm" disabled={!q.data?.has_next || q.isLoading} onClick={() => setPage((p) => p + 1)}>{t("next")}</Button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- Metadata chips (two-row clamp, §17.2; AutomationViewPage 2938-3054) ---------------- */
function MetadataChips({ tags }: { tags: Record<string, string> }) {
  const entries = Object.entries(tags).filter(([k]) => !isReservedTagKey(k));
  const [expanded, setExpanded] = useState(false);
  const [limit, setLimit] = useState(entries.length);
  const measure = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = measure.current; if (!el) return;
    const compute = () => {
      const chips = [...el.children] as HTMLElement[]; if (!chips.length) return;
      const rowTop = chips[0]!.offsetTop; let rows = 1, count = chips.length; const tops = new Set<number>();
      for (let i = 0; i < chips.length; i++) { const top = chips[i]!.offsetTop; if (top !== rowTop) tops.add(top); rows = tops.size + 1; if (rows > 2) { count = i; break; } }
      setLimit(count);
    };
    compute(); const ro = new ResizeObserver(compute); ro.observe(el); return () => ro.disconnect();
  }, [entries.length]);
  if (!entries.length) return null;
  const shown = expanded ? entries : entries.slice(0, Math.max(1, limit - (limit < entries.length ? 1 : 0)));
  const chip = ([k, v]: [string, string]) => (
    <span key={k} className="inline-flex max-w-full items-center gap-1 rounded-[4px] bg-tint-secondary px-1.5 py-0.5 text-12 text-text-secondary">
      <span className={cn("size-1.5 shrink-0 rounded-full", tagDotColor(k))} /><span className="min-w-0 max-w-[160px] truncate">{k}</span><span className="shrink-0">:</span><span className="min-w-0 max-w-[160px] truncate font-medium text-text-primary">{v}</span>
    </span>
  );
  return (
    <div className="relative mt-1 w-full">
      <div className="flex flex-wrap gap-1.5">
        {shown.map(chip)}
        {(entries.length > shown.length || expanded) && (
          <button type="button" aria-expanded={expanded} onClick={() => setExpanded((e) => !e)} className="inline-flex shrink-0 items-center rounded-[4px] bg-tint-secondary px-1.5 py-0.5 text-12 text-text-secondary hover:bg-tint-primary focus-ring">{expanded ? t("showLessTags") : t("showMoreTags", { count: entries.length - shown.length })}</button>
        )}
      </div>
      <div ref={measure} aria-hidden="true" className="pointer-events-none invisible absolute inset-x-0 top-0 flex flex-wrap gap-1.5">{entries.map(chip)}</div>
    </div>
  );
}

/* ---------------- Run dialog (§17.4; AutomationViewPage 199-303) ---------------- */
function RunDialog({ open, onOpenChange, onTrigger, showPrompt = true, description }: { open: boolean; onOpenChange: (o: boolean) => void; onTrigger: (prompt: string | undefined) => Promise<boolean>; showPrompt?: boolean; description?: string }) {
  const [prompt, setPrompt] = useState("");
  const [status, setStatus] = useState<"idle" | "triggering" | "success">("idle");
  const guard = useRef(false);
  useEffect(() => { if (!open) { setPrompt(""); setStatus("idle"); guard.current = false; } }, [open]);
  const close = () => onOpenChange(false);
  const run = async () => {
    if (guard.current) return;
    guard.current = true; setStatus("triggering");
    try { const ok = await onTrigger(prompt || undefined); setStatus(ok ? "success" : "idle"); }
    catch { setStatus("idle"); }
    finally { guard.current = false; }
  };
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) close(); }}>
      {status === "success" ? (
        <DialogContent title={t("automationTriggered")} description={t("triggerSuccessDescription")} footer={<Button variant="secondary" onClick={close}>{t("close")}</Button>} />
      ) : (
        <DialogContent
          title={t("triggerAutomation")}
          description={description ?? t(showPrompt ? "triggerPromptDescription" : "triggerNoPromptDescription")}
          footer={<><Button variant="secondary" onClick={close} disabled={status === "triggering"}>{t("cancel")}</Button><Button variant="primary" onClick={run} disabled={status === "triggering"}>{t("trigger")}</Button></>}
        >
          {showPrompt && <Textarea rows={4} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder={t("triggerPlaceholder")} disabled={status === "triggering"} />}
        </DialogContent>
      )}
    </Dialog>
  );
}

/* ---------------- Run-now gates (§17.3; AutomationViewPage 442-521) ---------------- */
function RunNowButton({ automation, canRun, spendingFrozen, pylonOff, label, dialogDescription, onError }: { automation: Automation; canRun: boolean; spendingFrozen: boolean; pylonOff: boolean; label: string; dialogDescription?: string; onError: (message: string) => void }) {
  const [open, setOpen] = useState(false);
  const isIncident = automation.actions.some((x) => x.type === "incident_session");
  const content = <><Play size={16} />{label}</>;
  if (isIncident) return <Tooltip content={t("incidentTriggerNowDisabled")}><span><Button variant="primary" disabled>{content}</Button></span></Tooltip>;
  if (!canRun) {
    return (
      <Tooltip content={<span className="flex items-center gap-1.5"><Lock size={14} /><span>{t("noPermissionRun")}</span></span>}>
        <span><Button variant="primary" disabled>{content}</Button></span>
      </Tooltip>
    );
  }
  return (
    <>
      <Tooltip content={spendingFrozen ? <SpendingFrozenTooltipContent /> : t("pylon.triggerDisabledStatus", { defaultValue: "Won't run — Pylon trigger is off" })} disabled={!spendingFrozen && !pylonOff}>
        <Button variant="primary" disabled={!automation.enabled || spendingFrozen || pylonOff} onClick={() => setOpen(true)}>{content}</Button>
      </Tooltip>
      <RunDialog open={open} onOpenChange={setOpen} onTrigger={async (prompt) => { try { return await store.trigger(automation.automation_id, prompt ? { prompt } : undefined); } catch (e) { console.error("Error triggering automation:", e); onError(t("failedToTriggerAutomation")); return false; } }} showPrompt={!automation.triggers.some((tr) => tr.event_type === "schedule:recurring")} description={dialogDescription} />
    </>
  );
}

/* ---------------- Read-only trigger card (shared editor `readonly:true`; TriggerEditor 27690-27890, TypePicker 53148-53340) ---------------- */
type ChannelLabel = (id: string) => string | undefined;
/** Read-only value text per field type (TypePicker `ir` readonly branch): joined lists, option labels, resolved channels, booleans; `is_empty` renders nothing. */
function conditionValueText(c: Condition, field: SchemaField | undefined, channelLabel: ChannelLabel): string {
  if (c.operator === "is_empty") return "";
  if (c.operator === "between" && Array.isArray(c.value)) return `${c.value[0]} – ${c.value[1]}`;
  if (c.operator === "globs" && Array.isArray(c.value)) return c.value.map((v) => String(v).trim()).filter(Boolean).join(", ");
  if (Array.isArray(c.value)) {
    const opts = field?.options ? Object.fromEntries(field.options.map((o) => [o.value, o.label])) : null;
    return c.value.map((v) => (field?.type === "channel" ? channelLabel(String(v)) : opts?.[String(v)]) ?? String(v)).join(", ");
  }
  if (field?.type === "boolean") return t(c.value ? "booleanTrue" : "booleanFalse");
  if (field?.type === "enum") return field.options?.find((o) => o.value === String(c.value))?.label ?? String(c.value ?? "");
  if (field?.type === "channel") return channelLabel(String(c.value ?? "")) ?? String(c.value ?? "");
  return String(c.value ?? "");
}
function ReadOnlyCondition({ condition: c, eventType, channelLabel }: { condition: Condition; eventType: string; channelLabel: ChannelLabel }) {
  const field = schemaFor(eventType)?.fields.find((f) => f.field === c.field);
  const operators = field ? operatorsFor(field) : [];
  const showOperator = (operators.length > 1 || c.operator === "globs") && c.operator !== "is_empty";
  const value = conditionValueText(c, field, channelLabel);
  return (
    <div className="flex min-h-7 flex-wrap items-center gap-x-2 gap-y-1 text-13 text-text-primary">
      <span className="whitespace-nowrap">{field?.label ?? c.field.split(".").pop() ?? c.field}</span>
      {showOperator && <span className="whitespace-nowrap">{OPERATOR_LABEL[c.operator] ?? c.operator}</span>}
      {value ? <span>{value}</span> : null}
    </div>
  );
}
function ReadOnlyTriggerCard({ trigger: tr, webhookUrl, channelLabel, onCopied }: { trigger: Trigger; webhookUrl: string; channelLabel: ChannelLabel; onCopied: (message: string) => void }) {
  const src = sourceOf(tr.event_type);
  const isSchedule = tr.event_type === "schedule:recurring", isWebhook = tr.event_type === "webhook:incoming";
  const conds = (tr.conditions[0] ?? []).filter((c) => !c.field.startsWith("_webhook") && c.field !== "rrule");
  const payloadFilter = tr.conditions.flat().find((c) => c.field === "_webhook_body_regex");
  const leading = (
    <div className="flex min-h-7 items-center gap-2 text-13 text-text-primary">
      {hasSourceIcon(src) && <span className="text-text-primary"><SourceIcon source={src} size={16} /></span>}
      {isSchedule ? summarize(rruleOf(tr)) : eventName(tr.event_type)}
    </div>
  );
  const [first, ...rest] = conds;
  return (
    <div className="relative flex flex-col overflow-hidden rounded-[10px] border border-border-secondary bg-bg-elevated p-2.5 pl-3.5">
      {isWebhook ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-center">{leading}</div>
          <div className="flex flex-col gap-1.5">
            <label className="text-13 text-text-primary">{t("webhookUrl")}</label>
            <div className="flex max-w-[600px] items-center gap-1.5">
              <code className="min-w-0 flex-1 truncate rounded border border-border-secondary bg-tint-secondary px-2 py-1.5 font-mono text-12 text-text-primary">{webhookUrl}</code>
              <CopyValueButton value={webhookUrl} label={t("webhookUrl")} onCopied={onCopied} />
            </div>
          </div>
          {/* Read-only detail passes no secret, so only an existing payload regex is echoed (TriggerEditor 27838-27882). */}
          {payloadFilter && typeof payloadFilter.value === "string" && payloadFilter.value && (
            <div className="flex flex-col gap-1.5"><p className="text-12 text-text-primary"><span className="text-text-secondary">{t("payloadFilterLabel")}</span> <code className="font-mono text-12">{payloadFilter.value}</code></p></div>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            {leading}
            {first && <ReadOnlyCondition condition={first} eventType={tr.event_type} channelLabel={channelLabel} />}
          </div>
          {rest.length > 0 && (
            <div className="flex">
              <div className="-mt-1 mb-2 ml-2 mr-4 shrink-0 border-b border-l border-border-primary" style={{ width: 10, borderBottomLeftRadius: 24 }} />
              <div className="flex flex-1 flex-col gap-1.5">
                {rest.map((c, i) => (
                  <div key={`${c.field}-${i}`} className="flex items-center gap-2">
                    <span className="shrink-0 text-13 text-text-primary">{t("and")}</span>
                    <ReadOnlyCondition condition={c} eventType={tr.event_type} channelLabel={channelLabel} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------------- Copy control for read-only webhook values (TriggerEditor 26284-26312) ---------------- */
function CopyValueButton({ value, label, onCopied }: { value: string; label: string; onCopied: (message: string) => void }) {
  return (
    <Tooltip content={t("copyLabel", { label })}>
      <IconButton variant="ghost" size="sm" aria-label={t("copyLabel", { label })} onClick={() => { void navigator.clipboard?.writeText(value).then(() => onCopied(t("copiedLabel", { label }))); }}><Copy size={14} /></IconButton>
    </Tooltip>
  );
}

/* ---------------- Transient status toast (the bundle uses a shared toaster; this app has none, so a local live region stands in) ---------------- */
function LocalToast({ message, onDone }: { message: string | null; onDone: (next: null) => void }) {
  useEffect(() => { if (!message) return; const h = window.setTimeout(() => onDone(null), 4000); return () => window.clearTimeout(h); }, [message, onDone]);
  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed bottom-4 right-4 z-50">
      {message && <div className="pointer-events-auto rounded-lg border border-border-secondary bg-bg-elevated px-3 py-2 text-13 text-text-primary shadow-md">{message}</div>}
    </div>
  );
}

/* ---------------- Legacy monitor → issue tracking banner (§17.7; AutomationViewPage 664-706, TriggerEditor 164-201) ---------------- */
function legacyMigration(a: Automation): { triggers: Trigger[]; actions: Action[] } {
  const monitor = a.actions.find((x) => x.type === "monitor_session");
  if (!monitor || monitor.type !== "monitor_session") return { triggers: a.triggers.map((tr) => ({ event_type: tr.event_type, conditions: tr.conditions })), actions: a.actions };
  const channel = monitor.slack_monitor_config.source_channel_id;
  return {
    triggers: [{ event_type: "slack:message", conditions: channel ? [[{ field: "channel", operator: "eq", value: channel }]] : [] }],
    actions: [{ type: "triage_session", setup_prompt: monitor.setup_prompt, repos: monitor.repos, slack_config: { source_channel_id: channel } }],
  };
}
function LegacyMonitorBanner({ automation, canManage }: { automation: Automation; canManage: boolean }) {
  const [busy, setBusy] = useState(false);
  const enable = async () => {
    setBusy(true);
    try {
      const { triggers, actions } = legacyMigration(automation);
      await store.update(automation.automation_id, { triggers, actions, ...(automation.scratchpad_enabled === false ? { scratchpad_enabled: true } : {}) });
    } finally { setBusy(false); }
  };
  return (
    <div role="status" className="flex items-start gap-3 rounded-[10px] border border-border-secondary bg-tint-blue p-3">
      <Info size={16} className="mt-0.5 shrink-0 text-text-blue" aria-hidden="true" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-13 font-medium text-text-primary">{t("enableIssueTrackingTitle")}</span>
        <span className="text-13 text-text-secondary">{t(canManage ? "enableIssueTrackingBody" : "enableIssueTrackingBodyReadOnly")}</span>
      </div>
      {canManage && <Button variant="primary" size="sm" onClick={enable} disabled={busy}>{t("enable")}</Button>}
    </div>
  );
}

/* ---------------- Read-only instructions (§17.6; AutomationViewPage 2891-2936) ---------------- */
function hasInstructions(x: Action): boolean {
  switch (x.type) {
    case "start_session": case "message_session": return typeof x.prompt === "string" && x.prompt.trim().length > 0;
    case "monitor_session": case "triage_session": return typeof x.setup_prompt === "string" && x.setup_prompt.trim().length > 0;
    default: return false;
  }
}
function InstructionPanel({ action }: { action: Action }) {
  const style = { scrollbarWidth: "thin" as const, maxHeight: "max(160px, 19vh)" };
  switch (action.type) {
    case "start_session": case "message_session":
      return <div className="min-h-[100px] overflow-y-auto whitespace-pre-wrap rounded-2xl bg-tint-tertiary p-3 text-13 text-text-primary" style={style}>{action.prompt}</div>;
    case "monitor_session": case "triage_session":
      return <div className="min-h-[72px] overflow-y-auto whitespace-pre-wrap rounded-2xl bg-tint-tertiary p-3 text-13 text-text-primary" style={style}>{action.setup_prompt}</div>;
    default: return null;
  }
}

/* ---------------- Origin line (AutomationViewPage 559-629) ---------------- */
function OriginLine({ automation: a, showDivider, showTrailingDivider }: { automation: Automation; showDivider: boolean; showTrailingDivider: boolean }) {
  const creator = a.created_by_service_user_name ?? store.userName(a.created_by);
  const editor = store.userName(a.updated_by);
  const differs = (a.updated_by ?? null) !== (a.created_by_service_user_id ?? a.created_by ?? null);
  if (!creator && !editor) return null;
  const who = (differs ? editor : null) ?? creator;
  const updated = who ? t("lastUpdatedByUser", { name: who, when: absoluteDate(a.updated_at) }) : null;
  const created = creator ? t("createdByOn", { name: creator, date: absoluteDate(a.created_at) }) : null;
  const divider = <span aria-hidden="true" className="text-text-secondary">·</span>;
  return (
    <>
      {showDivider && divider}
      {created ? <Tooltip content={created}><span tabIndex={0} className="text-13 text-text-secondary">{updated}</span></Tooltip> : <span className="text-13 text-text-secondary">{updated}</span>}
      {showTrailingDivider && divider}
    </>
  );
}

/* ---------------- Detail page (§17; AutomationViewPage 3159-3569) ---------------- */
export function AutomationDetailPage() {
  const { id } = useParams({ strict: false }) as { id: string };
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const caps = useCapabilities();
  const q = useQuery(`automation:${id}`, () => store.get(id));
  const a = q.data;
  const togglePending = useTogglePending(id);
  const [toast, setToast] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [preset, setPreset] = useState<Preset>("4weeks");
  const [custom, setCustom] = useState<{ from: Date; to?: Date } | undefined>();
  const [tab, setTab] = useState<"issues" | "events" | "consumption">("events");
  const [tabChosen, setTabChosen] = useState(false);
  const { improveWithDevin, isGenerating } = useGenerateWithDevin();
  const { since, until } = useMemo(() => rangeFor(preset, custom), [preset, custom]);
  // Slack monitor cards resolve stored channel IDs to labels and fall back to raw IDs (TriggerEditor 912-931).
  const needsChannels = !!a?.triggers.some((tr) => tr.conditions.flat().some((c) => schemaFor(tr.event_type)?.fields.find((f) => f.field === c.field)?.type === "channel"));
  const slackChannels = useQuery("slack-channels", () => store.slackChannels(), { enabled: needsChannels });
  useEffect(() => { document.title = a?.name || t("automationTitle"); }, [a?.name]);

  if (q.isLoading && !a) {
    return (
      <div className="flex h-full min-w-0 flex-1"><div style={{ scrollbarGutter: "stable" }} className="min-w-0 flex-1 overflow-y-auto"><div className="mx-auto h-fit w-full max-w-[800px] px-3 py-[28px]"><div className="flex flex-col gap-6">
        <div className="flex flex-col gap-1"><Skeleton className="h-[26px] w-64 rounded" /><Skeleton className="h-[19px] w-80 rounded" /></div>
        <div className="flex flex-col gap-3"><Skeleton className="h-[21px] w-20 rounded" /><Skeleton className="h-[76px] w-full rounded-[10px]" /></div>
        <div className="flex flex-col gap-3"><Skeleton className="h-[21px] w-28 rounded" /><Skeleton className="h-[120px] w-full rounded-[10px]" /></div>
        <div className="flex flex-col gap-3"><Skeleton className="h-[21px] w-16 rounded" /><Skeleton className="h-[116px] w-full rounded-[10px]" /></div>
      </div></div></div></div>
    );
  }
  if (!a && isNotFoundError(q.error)) {
    return <div className="flex h-full min-w-0 flex-1 items-center justify-center px-3 py-[28px]"><p className="text-text-secondary">{t("automationNotFound")}</p></div>;
  }
  if (!a) {
    return (
      <div role="alert" className="flex h-full min-w-0 flex-1 items-center justify-center gap-3 px-3 py-[28px]">
        <span id="automation-detail-load-error" className="text-13 leading-[18px] text-text-secondary">{t("automationLoadError")}</span>
        <Button variant="secondary" size="sm" aria-describedby="automation-detail-load-error" onClick={() => q.refetch()}>{t("retry")}</Button>
      </div>
    );
  }

  // Type-aware gates (§20.5): code-scan automations use the Security predicate/routes; incident responders hide Improve/Instructions/Duplicate and use On-call destinations.
  const isCodeScan = a.triggers.some((tr) => tr.event_type === CODE_SCAN_EVENT);
  const isIncident = a.actions.some((x) => x.type === "incident_session");
  const responderView = isIncident;
  const securityRoute = pathname.startsWith("/security/");
  const canManage = isCodeScan ? caps.canManageCodeScan : caps.canManageAutomations;
  const spendingFrozen = caps.spendingFrozen;
  const pylonOff = a.triggers.some((tr) => tr.event_type.startsWith("pylon:")) && caps.connections.pylon === "disconnected";
  const isTriage = a.actions.some((x) => x.type === "triage_session");
  const effectiveTab = !tabChosen && isTriage ? "issues" : tab;
  const sources = [...new Set(a.triggers.map((tr) => sourceOf(tr.event_type)).filter((s) => s && hasSourceIcon(s)))];
  const instructions = a.actions.filter(hasInstructions);
  const webhookUrl = `${window.location.origin}/api/webhooks/automations/${ORG_ID}/${a.automation_id}`;
  const channelLabel: ChannelLabel = (id) => slackChannels.data?.find((ch) => ch.channel_id === id)?.name;
  const showLegacyBanner = caps.legacyMonitorMigration && a.actions.some((x) => x.type === "monitor_session");
  const editTo = securityRoute || isCodeScan ? "/security/automations/$id/edit" : "/automations/$id/edit";

  // Optimistic toggle; the controller restores its snapshot and the failure is toasted (`useQuery` 1054-1058).
  const toggle = async () => {
    try { await store.toggleEnabled(a.automation_id, !a.enabled); }
    catch (e) { console.error("Error toggling automation:", e); setToast(t("failedToUpdateAutomation")); }
  };
  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await store.delete(a.automation_id);
      if (isIncident) navigate({ to: "/oncall" });
      else if (isCodeScan) navigate({ to: "/security", search: { tab: "automations" } as never });
      else navigate({ to: "/automations" });
    } finally { setDeleting(false); setDeleteOpen(false); }
  };

  return (
    <div className="flex h-full min-w-0 flex-1">
      <div style={{ scrollbarGutter: "stable" }} className="min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto h-fit w-full max-w-[800px] px-3 py-[28px]">
          {/* Action bar (§17.2): Edit, Improve with Devin, Run, overflow */}
          <HeaderActions>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-3">
                <Button variant="secondary" asChild><Link to={editTo} params={{ id: a.automation_id }}>{responderView ? <Pencil size={16} /> : <SquarePen size={16} />}{t("edit")}</Link></Button>
                {!responderView && !isCodeScan && (
                  <Button variant="secondary" onClick={() => improveWithDevin(a.automation_id)} disabled={isGenerating || spendingFrozen} data-dd-action-name="Improve automation with Devin"><DevinMark size={16} className="text-text-primary" />{isGenerating ? t("starting") : t("improveWithDevin")}</Button>
                )}
              </div>
              <RunNowButton automation={a} canRun={canManage} spendingFrozen={spendingFrozen} pylonOff={pylonOff} label={t("runAutomation")} onError={setToast} />
              <DropdownMenu>
                <Tooltip content={t("moreActions")}><DropdownMenuTrigger asChild><IconButton variant="ghost" aria-label={t("moreActions")}><Ellipsis size={16} /></IconButton></DropdownMenuTrigger></Tooltip>
                <DropdownMenuContent align="end">
                  {canManage && <DropdownMenuItem disabled={togglePending} onClick={toggle}>{a.enabled ? t("disable") : t("enable")}</DropdownMenuItem>}
                  {canManage && !isIncident && (
                    <DropdownMenuItem asChild>
                      <Link to={isCodeScan ? "/security/automations/create" : "/automations/create"} onClick={() => sessionStorage.setItem("automation-prefill", JSON.stringify(duplicatePrefill(a, t("copyOfName", { name: a.name }))))}>{t("duplicate")}</Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem asChild><Link to="/sessions" search={{ automation: a.automation_id }}>{t("viewSessions")}</Link></DropdownMenuItem>
                  {caps.errorLogs && <DropdownMenuItem asChild><Link to="/automations/$id/error-logs" params={{ id: a.automation_id }}>{t("viewErrors")}</Link></DropdownMenuItem>}
                  {canManage && <><DropdownMenuSeparator /><DropdownMenuItem variant="destructive" onClick={() => setDeleteOpen(true)}>{t("delete")}</DropdownMenuItem></>}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </HeaderActions>

          <div className="flex flex-col gap-6">
            {q.isError && (
              <div role="alert" className="flex items-center justify-center gap-3 rounded-lg border border-border-secondary px-4 py-3">
                <span id="automation-detail-load-error" className="text-13 leading-[18px] text-text-secondary">{t("automationLoadError")}</span>
                <Button variant="secondary" size="sm" aria-describedby="automation-detail-load-error" onClick={() => q.refetch()}>{t("retry")}</Button>
              </div>
            )}

            {/* Header */}
            <div className="flex flex-col gap-1">
              <h1 className="text-17 font-medium text-text-primary">{a.name || t("untitledAutomation")}</h1>
              <div className="flex flex-wrap items-center gap-2 text-13">
                {sources.length > 0 && <span className="flex items-center gap-1.5 text-text-secondary" aria-label={t("triggerIntegrations")}>{sources.map((s) => <span key={s} role="img" aria-label={sourceLabel(s)} title={sourceLabel(s)}><SourceIcon source={s} size={16} /></span>)}</span>}
                <OriginLine automation={a} showDivider={sources.length > 0} showTrailingDivider />
                {a.enabled && pylonOff
                  ? <span className="flex items-center gap-1.5 text-text-orange"><TriangleAlert size={16} aria-hidden="true" />{t("pylon.triggerDisabledStatus", { defaultValue: "Won't run — Pylon trigger is off" })}</span>
                  : <span className="flex items-center gap-1.5 text-text-secondary">{a.enabled ? <CircleCheck size={16} className="text-text-accent-primary" /> : <CircleDashed size={16} />}{a.enabled ? t("active") : t("inactive")}</span>}
              </div>
              {a.tags && <MetadataChips tags={a.tags} />}
            </div>

            {showLegacyBanner && <LegacyMonitorBanner automation={a} canManage={canManage} />}

            {/* Triggers (read-only, §17.6) */}
            <div className="flex flex-col gap-3">
              <h2 className="text-14 font-medium text-text-primary">{t("triggers")}</h2>
              <div className="flex flex-col gap-2">
                {a.triggers.map((tr, i) => <ReadOnlyTriggerCard key={tr.trigger_id ?? i} trigger={tr} webhookUrl={webhookUrl} channelLabel={channelLabel} onCopied={setToast} />)}
              </div>
            </div>

            {/* Instructions (hidden for responder views, §17.6) */}
            {!responderView && instructions.length > 0 && (
              <div className="flex flex-col gap-3">
                <h2 className="text-14 font-medium text-text-primary">{t("instructions")}</h2>
                <div className="flex flex-col gap-2">{instructions.map((x, i) => <InstructionPanel key={i} action={x} />)}</div>
              </div>
            )}

            {/* Analytics */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1">
                  {isTriage && <Button variant={effectiveTab === "issues" ? "secondary" : "ghost"} onClick={() => { setTab("issues"); setTabChosen(true); }}>{t("issues")}</Button>}
                  <Button variant={effectiveTab === "events" ? "secondary" : "ghost"} onClick={() => { setTab("events"); setTabChosen(true); }}>{t("events")}</Button>
                  <Button variant={effectiveTab === "consumption" ? "secondary" : "ghost"} onClick={() => { setTab("consumption"); setTabChosen(true); }}>{t("consumption")}</Button>
                </div>
                <DateRangeControl preset={preset} onPresetChange={setPreset} custom={custom} onCustomChange={setCustom} />
              </div>
              {effectiveTab === "consumption" ? <ConsumptionSummary automationId={a.automation_id} since={since} until={until} />
                : effectiveTab === "issues" ? null
                : <ActivitySummary automationId={a.automation_id} since={since} until={until} />}
            </div>
            {effectiveTab === "issues" ? <IssuesSection automationId={a.automation_id} since={since} until={until} /> : <EventsSection automationId={a.automation_id} automationEnabled={a.enabled} since={since} until={until} triggers={a.triggers} />}
          </div>
        </div>
      </div>

      <LocalToast message={toast} onDone={setToast} />
      <ConfirmDialog open={deleteOpen} onOpenChange={setDeleteOpen} title={t("deleteAutomation")} description={t("deleteConfirmation", { name: a.name || t("untitledAutomation") })} confirmLabel={t("delete")} loading={deleting} onConfirm={confirmDelete} />
    </div>
  );
}

