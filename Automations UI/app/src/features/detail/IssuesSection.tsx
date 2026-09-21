import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ArrowUpRight, Search, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip as ChartTooltip, XAxis, YAxis } from "recharts";
import type { AutomationIssue, Invocation } from "@/model/types";
import { store, useQuery } from "@/data/store";
import { cn } from "@/lib/cn";
import { eventDate, localYmdHms, utcTimestamp } from "@/lib/time";
import { t } from "@/i18n/t";
import { Button } from "@/ui/button";
import { IconButton } from "@/ui/icon-button";
import { Skeleton } from "@/ui/skeleton";
import { Badge } from "@/ui/badge";
import { Tooltip } from "@/ui/tooltip";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/ui/input-group";
import { CHART_THEME, shortMonthDay } from "./analytics";
import { INVOCATIONS_LIMIT } from "./constants";

/* ---------------- Search highlight (`Hr`/`Ur`/`Wr`/`Kr`, module 1435-1489) ---------------- */
/** First case-insensitive match, mapped back onto code-point-safe source offsets. */
function findMatch(text: string, query: string): { start: number; end: number } | null {
  const q = query.toLowerCase();
  if (!q) return null;
  const lower = text.toLowerCase();
  const offsets = [0];
  for (let i = 0; i < text.length;) {
    const cp = text.codePointAt(i);
    if (cp === undefined) return null;
    i += String.fromCodePoint(cp).length;
    offsets.push(i);
  }
  const at = lower.indexOf(q);
  if (at === -1) return null;
  const to = at + q.length;
  let start = 0, end = text.length;
  for (const o of offsets) {
    const n = text.slice(0, o).toLowerCase().length;
    if (n <= at) start = o;
    if (n >= to) { end = o; break; }
  }
  return { start, end };
}
/** `Wr` — snippet with ≤40 preceding and ≤200 following source characters; clipped starts receive `… `. */
export function matchSnippet(text: string, query: string): string | null {
  const m = findMatch(text, query);
  if (!m) return null;
  const from = Math.max(0, m.start - 40), to = Math.min(text.length, m.end + 200);
  return (from > 0 ? "… " : "") + text.slice(from, to);
}
/** `Kr` — bolds only the first match. */
export function Highlight({ text, query }: { text: string; query: string }) {
  const m = findMatch(text, query);
  if (!m) return <>{text}</>;
  return <>{text.slice(0, m.start)}<span className="font-semibold text-text-primary">{text.slice(m.start, m.end)}</span>{text.slice(m.end)}</>;
}

/* ---------------- New-issues chart (`si`/`ci`, module 2349-2518) ---------------- */
const dayStart = (ts: number) => { const d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime(); };
const nextDay = (ts: number) => { const d = new Date(ts); d.setDate(d.getDate() + 1); return d.getTime(); };

function newIssuePoints(issues: AutomationIssue[], since: number, until: number) {
  const start = dayStart(since), end = dayStart(until);
  const map = new Map<number, number>();
  for (let ts = start; ts <= end; ts = nextDay(ts)) map.set(ts, 0);
  for (const issue of issues) {
    if (!issue.first_invocation_at) continue;
    const day = dayStart(new Date(issue.first_invocation_at).getTime());
    if (day < start || day > end) continue;
    map.set(day, (map.get(day) ?? 0) + 1);
  }
  return [...map.entries()].sort(([a], [b]) => a - b).map(([timestamp, count]) => ({ timestamp, label: shortMonthDay(timestamp), count }));
}

function IssuesLoadError({ inline, onRetry }: { inline?: boolean; onRetry: () => void }) {
  return (
    <div role="alert" className={inline ? "flex items-center justify-center gap-3 rounded-lg border border-border-secondary px-4 py-3" : "flex h-[166px] items-center justify-center gap-3 rounded-[10px] border border-border-secondary"}>
      <span id="automation-issues-load-error" className="text-13 leading-[18px] text-text-secondary">{t("issuesLoadError")}</span>
      <Button variant="secondary" size="sm" aria-describedby="automation-issues-load-error" onClick={onRetry}>{t("retry")}</Button>
    </div>
  );
}

export function NewIssuesChart({ issues, isLoading, isError, onRetry, since, until }: { issues: AutomationIssue[]; isLoading: boolean; isError: boolean; onRetry: () => void; since: Date | number; until: Date | number }) {
  const sinceMs = useMemo(() => new Date(since).getTime(), [since]);
  const untilMs = useMemo(() => new Date(until).getTime(), [until]);
  const points = useMemo(() => newIssuePoints(issues, sinceMs, untilMs), [issues, sinceMs, untilMs]);
  const eventTotal = useMemo(() => issues.reduce((sum, i) => sum + (i.occurrence_count ?? 0), 0), [issues]);
  if (isLoading) return <div className="flex flex-col gap-3"><Skeleton className="h-4 w-48 rounded" /><Skeleton className="h-[166px] w-full rounded-[10px]" /></div>;
  if (isError && issues.length === 0) return <IssuesLoadError onRetry={onRetry} />;
  if (issues.length === 0) return null;
  const step = Math.max(1, Math.ceil(points.length / 7));
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border-secondary p-5">
      {isError && <IssuesLoadError inline onRetry={onRetry} />}
      <div className="text-13 font-medium text-text-primary">{t("issueCount", { count: issues.length })}{" ("}{t("fromEventCount", { count: eventTotal })}{")"}</div>
      <div style={{ height: 166 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={points} margin={{ top: 4, right: 0, bottom: 0, left: 0 }} accessibilityLayer={false}>
            <CartesianGrid strokeDasharray="4 4" stroke={CHART_THEME.borderPrimary} vertical={false} />
            <XAxis dataKey="label" tick={{ fill: CHART_THEME.textSecondary, fontSize: 11 }} tickLine={false} axisLine={{ stroke: CHART_THEME.borderPrimary }} interval={step - 1} dy={4} />
            <YAxis tick={{ fill: CHART_THEME.textSecondary, fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} width={30} tickFormatter={(v) => (Number(v) === 0 ? "" : Math.round(Number(v)).toString())} />
            <ChartTooltip cursor={{ fill: CHART_THEME.bgElevated, opacity: 0.5 }} content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0]?.payload as { timestamp: number; count: number };
              if (p.count === 0) return null;
              return (
                <div className="rounded-lg border border-border-secondary bg-bg-elevated px-3 py-2 shadow-lg">
                  <p className="text-12 font-medium text-text-secondary">{shortMonthDay(p.timestamp)}</p>
                  <p className="mt-1 text-12 text-text-primary">{t("newIssueCount", { count: p.count })}</p>
                </div>
              );
            }} />
            <Bar dataKey="count" fill={CHART_THEME.accent} radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* ---------------- Linked invocations (`di`/`fi`, module 2524-2620) ---------------- */
function InvocationCard({ inv }: { inv: Invocation }) {
  const investigation = inv.investigation_devin_id ? inv.investigation_devin_id.replace("devin-", "") : null;
  const session = inv.devin_session_id ? inv.devin_session_id.replace("devin-", "") : null;
  const investigated = !!investigation;
  const target = investigation ?? session;
  return (
    <div className="flex flex-col gap-2 rounded-[10px] border border-border-secondary bg-bg-elevated p-4">
      <div className="flex items-start gap-2">
        <Badge variant={investigated ? "success" : "default"} className="shrink-0">{t(investigated ? "investigated" : "grouped")}</Badge>
        {target && (
          <Tooltip content={t("viewSession")}>
            <IconButton variant="ghost" size="xs" className="ml-auto shrink-0" aria-label={t("viewSession")} asChild>
              <Link to="/sessions/$id" params={{ id: target }}><ArrowUpRight /></Link>
            </IconButton>
          </Tooltip>
        )}
      </div>
      <div className="flex flex-col gap-2 pl-[6px]">
        <Tooltip content={utcTimestamp(inv.created_at)}><span className="self-start text-12 tabular-nums text-text-secondary">{localYmdHms(inv.created_at)}</span></Tooltip>
        <p className="break-words text-13 leading-[18px] text-text-secondary">{inv.event_message?.trim() || t("noEventMessage")}</p>
      </div>
    </div>
  );
}

function LinkedInvocations({ automationId, issueId }: { automationId: string; issueId: string }) {
  const q = useQuery(`invocations:${automationId}:${issueId}`, () => store.invocations(automationId, { issue_id: issueId, include_message: true, limit: INVOCATIONS_LIMIT }));
  const rows = q.data;
  const { investigated, groupedOrSkipped } = useMemo(() => {
    const list = rows ?? [];
    return { investigated: list.filter((r) => !!r.investigation_devin_id), groupedOrSkipped: list.filter((r) => !r.investigation_devin_id) };
  }, [rows]);
  if (q.isLoading) return <div className="flex flex-col gap-3"><Skeleton className="h-[104px] w-full rounded-lg" /><Skeleton className="h-[104px] w-full rounded-lg" /></div>;
  if (investigated.length === 0 && groupedOrSkipped.length === 0) return <p className="text-13 text-text-secondary">{t("noLinkedEvents")}</p>;
  return (
    <div className="flex flex-col gap-3">
      {investigated.map((inv) => <InvocationCard key={inv.invocation_id} inv={inv} />)}
      {groupedOrSkipped.length > 0 && (
        <>
          <h4 className="mt-2 text-13 font-medium text-text-secondary">{t("grouped")}</h4>
          {groupedOrSkipped.map((inv) => <InvocationCard key={inv.invocation_id} inv={inv} />)}
        </>
      )}
    </div>
  );
}

/* ---------------- Issue sheet (`pi`, module 2621-2686) ---------------- */
type SheetPhase = "closed" | "starting" | "open" | "ending";

function IssueSheet({ automationId, open, issue, onClose }: { automationId: string; open: boolean; issue: AutomationIssue | null; onClose: () => void }) {
  // Base UI's `data-starting-style`/`data-ending-style` presence attributes, reproduced over Radix so the
  // verbatim 300 ms motion-safe slide classes actually run (entering and leaving).
  const [phase, setPhase] = useState<SheetPhase>(open ? "starting" : "closed");
  useEffect(() => {
    if (open) { setPhase((p) => (p === "open" ? p : "starting")); return; }
    setPhase((p) => (p === "closed" ? p : "ending"));
    const tm = window.setTimeout(() => setPhase("closed"), 300);
    return () => window.clearTimeout(tm);
  }, [open]);
  useEffect(() => {
    if (phase !== "starting") return;
    let inner = 0;
    const outer = requestAnimationFrame(() => { inner = requestAnimationFrame(() => setPhase("open")); });
    return () => { cancelAnimationFrame(outer); cancelAnimationFrame(inner); };
  }, [phase]);
  const mounted = phase !== "closed";
  return (
    <DialogPrimitive.Root open={mounted} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className={cn("fixed inset-0 z-[80] bg-bg-scrim fade-in", phase === "ending" && "opacity-0 transition-opacity duration-300")} />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          data-starting-style={phase === "starting" ? "" : undefined}
          data-ending-style={phase === "ending" ? "" : undefined}
          className={cn(
            "fixed inset-y-0 right-0 z-[81] flex w-[560px] max-w-[100vw] flex-col border-l border-border-secondary bg-bg-elevated p-5 text-text-primary shadow-L4 outline-none",
            "gap-5 overflow-y-auto",
            "duration-300 ease-in-out motion-safe:transition-transform motion-reduce:transition-none",
            "data-[ending-style]:translate-x-full data-[starting-style]:translate-x-full",
          )}
        >
          <div className="flex items-center justify-between">
            <DialogPrimitive.Title className="text-13 font-medium text-text-secondary">{t("issuePanelLabel")}</DialogPrimitive.Title>
            <Tooltip content={t("close")}>
              <DialogPrimitive.Close asChild><IconButton variant="ghost" size="xs" aria-label={t("close")}><X /></IconButton></DialogPrimitive.Close>
            </Tooltip>
          </div>
          {issue ? (
            <>
              <div className="flex flex-col gap-2">
                <h2 className="break-words text-15 font-semibold leading-[20px] text-text-primary">{issue.title || t("untitledIssue")}</h2>
                {issue.short_description && <p className="break-words text-13 leading-[18px] text-text-secondary">{issue.short_description}</p>}
              </div>
              <h3 className="text-14 font-medium text-text-primary">{t("events")}</h3>
              <LinkedInvocations automationId={automationId} issueId={issue.issue_id} />
            </>
          ) : <p className="text-13 leading-[18px] text-text-secondary">{t("issueNotFound")}</p>}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/* ---------------- Issues list (`mi`, module 2687-2849) ---------------- */
export function IssuesList({ automationId, issues, isLoading, isError, initialExpandedIssueId }: { automationId: string; issues: AutomationIssue[]; isLoading: boolean; isError: boolean; initialExpandedIssueId?: string }) {
  const [selectedId, setSelectedId] = useState<string | null>(initialExpandedIssueId ?? null);
  useEffect(() => { if (initialExpandedIssueId) setSelectedId(initialExpandedIssueId); }, [initialExpandedIssueId]);
  const scrolledFor = useRef<string | null>(null);
  const deepLinkRef = useCallback((el: HTMLButtonElement | null) => {
    if (el && scrolledFor.current !== initialExpandedIssueId) { scrolledFor.current = initialExpandedIssueId ?? null; el.scrollIntoView({ block: "center" }); }
  }, [initialExpandedIssueId]);
  const [search, setSearch] = useState("");
  const query = search.trim().toLowerCase();
  const visible = useMemo(() => issues
    .filter((i) => !query || (i.title ?? "").toLowerCase().includes(query) || (i.short_description ?? "").toLowerCase().includes(query))
    .sort((a, b) => (b.last_invocation_at ? new Date(b.last_invocation_at).getTime() : 0) - (a.last_invocation_at ? new Date(a.last_invocation_at).getTime() : 0)), [issues, query]);
  const selected = useMemo(() => issues.find((i) => i.issue_id === selectedId) ?? null, [issues, selectedId]);
  const navigate = useNavigate();
  const close = useCallback(() => {
    setSelectedId(null);
    if (initialExpandedIssueId) {
      void navigate({ to: "/automations/$id", params: { id: automationId }, replace: true, search: ((prev: Record<string, unknown>) => { const rest = { ...prev }; delete rest.issue; return rest; }) as never });
    }
  }, [initialExpandedIssueId, navigate, automationId]);

  if (!isLoading && isError && issues.length === 0) return null;
  let body: ReactNode;
  if (isLoading) body = <div className="flex flex-col gap-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-14 w-full rounded-[10px]" />)}</div>;
  else if (issues.length === 0) body = <div className="flex flex-col items-center gap-2 rounded-[10px] border border-dashed border-border-primary px-6 py-12 text-center text-13 text-text-secondary">{t("noIssues")}</div>;
  else body = (
    <div className="rounded-[10px] border border-border-secondary bg-bg-elevated">
      <InputGroup className="h-9 rounded-b-none border-0 border-b border-border-secondary shadow-none">
        <InputGroupAddon><Search /></InputGroupAddon>
        <InputGroupInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("searchIssuesPlaceholder")} />
      </InputGroup>
      {visible.length > 0 ? visible.map((issue) => {
        const last = issue.last_invocation_at;
        const snippet = query ? matchSnippet(issue.short_description ?? "", query) : null;
        return (
          <button key={issue.issue_id} type="button" ref={issue.issue_id === initialExpandedIssueId ? deepLinkRef : undefined} onClick={() => setSelectedId(issue.issue_id)}
            className="flex w-full items-start gap-5 border-t border-border-secondary px-4 py-3 text-left first-of-type:border-t-0 hover:bg-tint-tertiary">
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="flex min-w-0 items-baseline gap-2">
                <span className="min-w-0 truncate text-13 font-medium leading-[18px] text-text-primary"><Highlight text={issue.title || t("untitledIssue")} query={query} /></span>
                <span className="shrink-0 text-12 text-text-secondary">{t("occurrenceCount", { count: issue.occurrence_count ?? 0 })}</span>
              </span>
              {issue.short_description && <span className="line-clamp-2 text-13 leading-[19px] text-text-secondary">{snippet ? <Highlight text={snippet} query={query} /> : issue.short_description}</span>}
            </span>
            {last && <Tooltip content={utcTimestamp(last)}><span className="shrink-0 pt-px text-12 leading-4 text-text-disabled">{eventDate(last)}</span></Tooltip>}
          </button>
        );
      }) : <p className="px-3 py-6 text-center text-13 leading-[18px] text-text-secondary">{t("noMatchingIssues")}</p>}
    </div>
  );
  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-14 font-medium text-text-primary">{t("issues")}</h2>
      {body}
      <IssueSheet automationId={automationId} open={selectedId !== null && (!!selected || (!isLoading && !isError))} issue={selected} onClose={close} />
    </div>
  );
}

/* ---------------- Issues section (page composition, module 3183-3213 + 3537-3556) ---------------- */
export function IssuesSection({ automationId, since, until, showChart = true }: { automationId: string; since: Date; until: Date; /** Render the New-Issues summary card above the list (default true). */ showChart?: boolean }) {
  const { issue: initialIssueId } = useSearch({ strict: false }) as { issue?: string };
  const q = useQuery(`issues:${automationId}`, () => store.issues(automationId), { keepPrevious: true });
  const sinceMs = since.getTime(), untilMs = until.getTime();
  const all = q.data;
  const inRange = useMemo(() => (all ?? []).filter((i) => {
    if (!i.first_invocation_at) return false;
    const ts = new Date(i.first_invocation_at).getTime();
    return ts >= sinceMs && ts <= untilMs;
  }), [all, sinceMs, untilMs]);
  const listIssues = useMemo(() => {
    if (!initialIssueId || inRange.some((i) => i.issue_id === initialIssueId)) return inRange;
    const extra = (all ?? []).find((i) => i.issue_id === initialIssueId);
    return extra ? [...inRange, extra] : inRange;
  }, [inRange, all, initialIssueId]);
  return (
    <>
      {showChart && <NewIssuesChart issues={inRange} isLoading={q.isLoading} isError={q.isError} onRetry={() => void q.refetch()} since={sinceMs} until={untilMs} />}
      <IssuesList automationId={automationId} issues={listIssues} isLoading={q.isLoading} isError={q.isError} initialExpandedIssueId={initialIssueId} />
    </>
  );
}
