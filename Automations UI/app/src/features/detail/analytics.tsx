import { CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Bar, BarChart, CartesianGrid, Rectangle, ResponsiveContainer, Tooltip as ChartTooltip, XAxis, YAxis } from "recharts";
import type { AutomationEvent } from "@/model/types";
import { store, useQuery } from "@/data/store";
import { useCapabilities } from "@/data/capabilities";
import { cn } from "@/lib/cn";
import { t } from "@/i18n/t";
import { Button } from "@/ui/button";
import { IconButton } from "@/ui/icon-button";
import { Skeleton } from "@/ui/skeleton";
import { Popover, PopoverAnchor, PopoverContent } from "@/ui/popover";
import { DropdownMenu, DropdownMenuCheckItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/ui/menu";
import { COLOR_SUCCESS, COLOR_FAILURE, COLOR_SKIPPED, COLOR_PROGRESS, ACTIVITY_LIMIT, HOURLY_MAX_MS, POLL_INTERVAL_MS, USD_PER_ACU } from "./constants";

/* ---------------- Date range (`gi`/`_i`/`vi`, module 2883-2902) ---------------- */
export type Preset = "week" | "4weeks" | "custom";
export type DateRange = { from: Date; to?: Date };

function startOfDay(d: Date | number) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function endOfDay(d: Date | number) { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; }

export function rangeFor(preset: Preset, custom?: DateRange): { since: Date; until: Date } {
  if (preset === "custom" && custom?.from) return { since: startOfDay(custom.from), until: endOfDay(custom.to ?? custom.from) };
  const now = new Date();
  const since = new Date(now); since.setDate(since.getDate() - (preset === "week" ? 7 : 28));
  return { since, until: endOfDay(now) };
}

/** `Dn()` chart theme tokens (useChartTheme-CRND0EQr.js) resolved through the app's CSS variables. */
export const CHART_THEME = {
  borderPrimary: "rgb(var(--border-primary))",
  textSecondary: "rgb(var(--text-secondary))",
  bgElevated: "rgb(var(--bg-elevated))",
  accent: "rgb(var(--text-accent-primary))",
};

/** `mr` — localized short month/day. */
export function shortMonthDay(ts: number | string | Date) {
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/* ---------------- Activity aggregation (`hr`…`Sr`, module 736-848) ---------------- */
export type Granularity = "hour" | "day";
export type Bucket = { timestamp: number; success: number; failure: number; skipped: number; skippedTotal: number; canceled: number; queued: number; running: number; inProgress: number };
type SegmentKey = "success" | "failure" | "skipped" | "inProgress";

function bucketLabel(ts: number, g: Granularity) {
  return g === "day" ? shortMonthDay(ts) : new Date(ts).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric" });
}
function floorTo(ts: number, g: Granularity) {
  const d = new Date(ts);
  if (g === "hour") d.setMinutes(0, 0, 0); else d.setHours(0, 0, 0, 0);
  return d.getTime();
}
function nextBucket(ts: number, g: Granularity) {
  const d = new Date(ts);
  if (g === "hour") d.setHours(d.getHours() + 1); else d.setDate(d.getDate() + 1);
  return d.getTime();
}
export function granularityFor(since: number, until: number): Granularity { return until - since <= HOURLY_MAX_MS ? "hour" : "day"; }
function isPreferredTick(ts: number, g: Granularity) { const d = new Date(ts); return g === "hour" ? d.getHours() === 0 : d.getDay() === 0; }
const emptyBucket = () => ({ success: 0, failure: 0, skipped: 0, skippedTotal: 0, canceled: 0, queued: 0, running: 0, inProgress: 0 });

/** `Sr(events, since, until, truncated)` — seeds buckets, drops the partially fetched oldest bucket when the page is truncated. */
export function aggregate(events: AutomationEvent[], since: number, until: number, truncated: boolean) {
  const granularity = granularityFor(since, until);
  const end = floorTo(until, granularity);
  const extent = truncated
    ? events.reduce<{ oldest: number; newest: number } | undefined>((acc, e) => {
      const n = new Date(e.created_at).getTime();
      return acc ? { oldest: Math.min(acc.oldest, n), newest: Math.max(acc.newest, n) } : { oldest: n, newest: n };
    }, undefined)
    : undefined;
  const oldestBucket = extent ? floorTo(extent.oldest, granularity) : undefined;
  const newestBucket = extent ? floorTo(extent.newest, granularity) : undefined;
  const afterOldest = oldestBucket !== undefined ? nextBucket(oldestBucket, granularity) : undefined;
  const skipPartial = afterOldest !== undefined && afterOldest <= end && newestBucket !== oldestBucket;
  const start = skipPartial ? afterOldest! : floorTo(since, granularity);
  const map = new Map<number, ReturnType<typeof emptyBucket>>();
  for (let ts = start; ts <= end; ts = nextBucket(ts, granularity)) map.set(ts, emptyBucket());
  let successCount = 0, failureCount = 0, chartedCount = 0;
  for (const e of events) {
    const own = floorTo(new Date(e.created_at).getTime(), granularity);
    const b = map.get(skipPartial ? own : Math.min(Math.max(own, start), end));
    if (!b) continue;
    chartedCount++;
    switch (e.status) {
      case "succeeded": b.success++; successCount++; break;
      case "failed": b.failure++; failureCount++; break;
      case "skipped": b.skipped++; b.skippedTotal++; break;
      case "canceled": b.skippedTotal++; b.canceled++; break;
      case "queued": b.queued++; b.inProgress++; break;
      case "running": b.running++; b.inProgress++; break;
      default: continue;
    }
  }
  const points: Bucket[] = [...map.entries()].sort(([a], [b]) => a - b).map(([timestamp, v]) => ({ timestamp, ...v }));
  const preferred = points.filter((p) => isPreferredTick(p.timestamp, granularity)).map((p) => p.timestamp);
  return { points, ticks: preferred.length ? preferred : [points[0]?.timestamp ?? start], granularity, successCount, failureCount, chartedCount };
}

/** `pr` — only the top nonzero segment of a stack receives the 2px top radii. */
function isTopSegment(p: Partial<Bucket> | undefined, key: SegmentKey) {
  return ((p?.inProgress ?? 0) > 0 ? "inProgress" : (p?.skippedTotal ?? 0) > 0 ? "skipped" : (p?.failure ?? 0) > 0 ? "failure" : "success") === key;
}

type ShapeProps = { x?: number; y?: number; width?: number; height?: number; fill?: string; payload?: Bucket };
function Segment({ shape, segment }: { shape: ShapeProps; segment: SegmentKey }) {
  return <Rectangle {...(shape as object)} radius={isTopSegment(shape.payload, segment) ? [2, 2, 0, 0] : undefined} />;
}

export function ChartCard({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex flex-col gap-3 rounded-lg border border-border-secondary p-5", className)}>{children}</div>;
}

function LoadError({ id, message, onRetry, inline }: { id: string; message: string; onRetry: () => void; inline?: boolean }) {
  return (
    <div role="alert" className={inline ? "flex items-center justify-center gap-3 rounded-lg border border-border-secondary px-4 py-3" : "flex h-[166px] items-center justify-center gap-3 rounded-[10px] border border-border-secondary"}>
      <span id={id} className="text-13 leading-[18px] text-text-secondary">{message}</span>
      <Button variant="secondary" size="sm" aria-describedby={id} onClick={onRetry}>{t("retry")}</Button>
    </div>
  );
}

const ChartSkeleton = () => <div className="flex flex-col gap-3"><Skeleton className="h-4 w-48 rounded" /><Skeleton className="h-[166px] w-full rounded-[10px]" /></div>;

/* ---------------- Activity chart (`Cr`, module 849-1203) ---------------- */
export function ActivitySummary({ automationId, since, until }: { automationId: string; since: Date; until: Date }) {
  const sinceIso = since.toISOString(), untilIso = until.toISOString();
  const sinceMs = useMemo(() => new Date(sinceIso).getTime(), [sinceIso]);
  const untilMs = useMemo(() => new Date(untilIso).getTime(), [untilIso]);
  const q = useQuery(
    `activity:${automationId}:${sinceIso}:${untilIso}`,
    () => store.events(automationId, { since: sinceIso, until: untilIso, limit: ACTIVITY_LIMIT, offset: 0, include_message: false }),
    { keepPrevious: true, refetchInterval: (d) => (d?.data.some((e) => e.status === "queued" || e.status === "running") ? POLL_INTERVAL_MS : false) },
  );
  const caps = useCapabilities();
  const navigate = useNavigate();
  const data = q.data;
  const agg = useMemo(() => {
    if (!data?.data) return { points: [] as Bucket[], ticks: [] as number[], granularity: granularityFor(sinceMs, untilMs), totalRuns: 0, fetchedEventCount: 0, successRate: null as number | null };
    const r = aggregate(data.data, sinceMs, untilMs, data.has_next);
    const denom = r.successCount + r.failureCount;
    return { points: r.points, ticks: r.ticks, granularity: r.granularity, totalRuns: r.chartedCount, fetchedEventCount: data.data.length, successRate: denom > 0 ? Math.round((r.successCount / denom) * 100) : null };
  }, [data, sinceMs, untilMs]);
  const { points, ticks, granularity, totalRuns, fetchedEventCount, successRate } = agg;
  const total = data?.total ?? 0;
  const hasNext = data?.has_next ?? false;
  const errorLogsHref = `/automations/${automationId}/error-logs`;

  const failureShape = (shape: ShapeProps) => {
    const seg = <Segment shape={shape} segment="failure" />;
    if ((shape.payload?.failure ?? 0) <= 0 || !caps.errorLogs) return seg;
    return (
      <a href={errorLogsHref} style={{ cursor: "pointer" }} onClick={(e: MouseEvent<HTMLAnchorElement>) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        void navigate({ to: "/automations/$id/error-logs", params: { id: automationId } });
      }}>{seg}</a>
    );
  };

  if (q.isLoading) return <ChartSkeleton />;
  const noneCharted = fetchedEventCount > 0 && totalRuns === 0;
  if (q.isError && (points.length === 0 || noneCharted)) return <LoadError id="automation-activity-load-error" message={t("activityLoadError")} onRetry={() => void q.refetch()} />;
  if (points.length === 0 || noneCharted) return null;
  return (
    <ChartCard>
      {q.isError && <LoadError inline id="automation-activity-load-error" message={t("activityLoadError")} onRetry={() => void q.refetch()} />}
      <div className="flex items-center gap-1 text-13">
        <span className="font-medium text-text-primary">{t("eventsCount", { count: totalRuns })}</span>
        {hasNext ? <><span className="text-text-secondary">•</span><span className="text-text-secondary">{t("showingNewestEvents", { count: total, formattedTotal: total.toLocaleString(), visibleCount: totalRuns.toLocaleString() })}</span></> : null}
        {successRate == null ? null : <><span className="text-text-secondary">•</span><span className="text-text-primary">{t("successRate", { rate: successRate })}</span></>}
      </div>
      <div style={{ height: 166 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={points} margin={{ top: 4, right: 0, bottom: 0, left: 0 }} accessibilityLayer={false}>
            <CartesianGrid strokeDasharray="4 4" stroke={CHART_THEME.borderPrimary} vertical={false} />
            <XAxis dataKey="timestamp" ticks={ticks} tickFormatter={(v) => shortMonthDay(Number(v))} tick={{ fill: CHART_THEME.textSecondary, fontSize: 11 }} tickLine={false} axisLine={{ stroke: CHART_THEME.borderPrimary }} interval={0} dy={4} />
            <YAxis tick={{ fill: CHART_THEME.textSecondary, fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} width={30} tickFormatter={(v) => (Number(v) === 0 ? "" : Math.round(Number(v)).toString())} />
            <ChartTooltip cursor={{ fill: CHART_THEME.bgElevated, opacity: 0.5 }} content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const b = payload[0]?.payload as Bucket;
              if (b.success + b.failure + b.skippedTotal + b.inProgress === 0) return null;
              return (
                <div className="rounded-lg border border-border-secondary bg-bg-elevated px-3 py-2 shadow-lg">
                  <p className="text-12 font-medium text-text-secondary">{bucketLabel(b.timestamp, granularity)}</p>
                  {b.success > 0 && <p className="mt-1 text-12" style={{ color: COLOR_SUCCESS }}>{t("successful", { count: b.success })}</p>}
                  {b.failure > 0 && <p className="mt-0.5 text-12" style={{ color: COLOR_FAILURE }}>{t("failed", { count: b.failure })}</p>}
                  {b.skipped > 0 && <p className="mt-0.5 text-12" style={{ color: COLOR_SKIPPED }}>{t("skippedCount", { count: b.skipped })}</p>}
                  {b.canceled > 0 && <p className="mt-0.5 text-12" style={{ color: COLOR_SKIPPED }}>{t("canceledCount", { count: b.canceled })}</p>}
                  {b.queued > 0 && <p className="mt-0.5 text-12" style={{ color: COLOR_PROGRESS }}>{t("queuedCount", { count: b.queued })}</p>}
                  {b.running > 0 && <p className="mt-0.5 text-12" style={{ color: COLOR_PROGRESS }}>{t("runningCount", { count: b.running })}</p>}
                </div>
              );
            }} />
            <Bar dataKey="success" stackId="runs" fill={COLOR_SUCCESS} shape={((p: ShapeProps) => <Segment shape={p} segment="success" />) as never} />
            <Bar dataKey="failure" stackId="runs" fill={COLOR_FAILURE} shape={failureShape as never} />
            <Bar dataKey="skippedTotal" stackId="runs" fill={COLOR_SKIPPED} shape={((p: ShapeProps) => <Segment shape={p} segment="skipped" />) as never} />
            <Bar dataKey="inProgress" stackId="runs" fill={COLOR_PROGRESS} shape={((p: ShapeProps) => <Segment shape={p} segment="inProgress" />) as never} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-1 flex items-center justify-center gap-3.5 text-12 text-text-secondary">
        {([[COLOR_SUCCESS, "statusSucceeded"], [COLOR_FAILURE, "statusFailed"], [COLOR_SKIPPED, "statusSkipped"], [COLOR_PROGRESS, "statusInProgress"]] as const).map(([c, k]) => (
          <span key={k} className="inline-flex items-center gap-1.5"><span className="size-2 rounded-[2px]" style={{ background: c }} />{t(k)}</span>
        ))}
      </div>
    </ChartCard>
  );
}

/* ---------------- Consumption (`zr`, module 1260-1429) ---------------- */
type ConsumptionPoint = { timestamp: number; label: string; acus: number; hasUsage: boolean };

/** Shared ACU/USD formatter (`pt().formatAcuValue`), keyed off `caps.consumptionDisplay`. */
export function useAcuFormatter() {
  const { consumptionDisplay } = useCapabilities();
  const showAcu = consumptionDisplay === "acu";
  const formatAcuValue = (acus: number, opts?: { showUnit?: boolean }) => {
    if (showAcu) {
      const n = acus.toLocaleString(undefined, { maximumFractionDigits: 2 });
      return opts?.showUnit === false ? n : t("acusValue", { acus: n });
    }
    return (acus * USD_PER_ACU).toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 2 });
  };
  return { formatAcuValue, showAcu };
}

export function ConsumptionSummary({ automationId, since, until }: { automationId: string; since: Date; until: Date }) {
  const sinceIso = since.toISOString(), untilIso = until.toISOString();
  const sinceMs = useMemo(() => new Date(sinceIso).getTime(), [sinceIso]);
  const untilMs = useMemo(() => new Date(untilIso).getTime(), [untilIso]);
  const { formatAcuValue, showAcu } = useAcuFormatter();
  const q = useQuery(`consumption:${automationId}:${sinceIso}:${untilIso}`, () => store.consumption(automationId, sinceIso, untilIso), { keepPrevious: true });
  const rows = q.data;
  const { points, totalAcus, hasData } = useMemo(() => {
    const list = rows ?? [];
    const map = new Map<number, { acus: number; hasUsage: boolean }>();
    for (let ts = floorTo(sinceMs, "day"), end = floorTo(untilMs, "day"); ts <= end; ts = nextBucket(ts, "day")) map.set(ts, { acus: 0, hasUsage: false });
    let total = 0;
    for (const r of list) {
      const [y, m, d] = r.created_at.split("-").map(Number);
      const key = new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1).getTime();
      let b = map.get(key);
      if (!b) { b = { acus: 0, hasUsage: false }; map.set(key, b); }
      b.acus += r.acu_used; b.hasUsage = true; total += r.acu_used;
    }
    const pts: ConsumptionPoint[] = [...map.entries()].sort(([a], [b]) => a - b).map(([timestamp, v]) => ({ timestamp, label: shortMonthDay(timestamp), acus: v.acus, hasUsage: v.hasUsage }));
    return { points: pts, totalAcus: total, hasData: list.length > 0 };
  }, [rows, sinceMs, untilMs]);

  if (q.isLoading) return <ChartSkeleton />;
  if (q.isError && !hasData) return <LoadError id="automation-consumption-load-error" message={t("consumptionLoadError")} onRetry={() => void q.refetch()} />;
  if (!hasData) return <div className="flex h-[166px] items-center justify-center rounded-[10px] border border-border-secondary"><p className="text-13 text-text-secondary">{t("noConsumption")}</p></div>;
  const step = Math.max(1, Math.ceil(points.length / 7));
  return (
    <ChartCard>
      {q.isError && <LoadError inline id="automation-consumption-load-error" message={t("consumptionLoadError")} onRetry={() => void q.refetch()} />}
      <div className="flex items-center gap-1 text-13"><span className="font-medium text-text-primary">{formatAcuValue(totalAcus)}</span></div>
      <div style={{ height: 166 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={points} margin={{ top: 4, right: 0, bottom: 0, left: 0 }} accessibilityLayer={false}>
            <CartesianGrid strokeDasharray="4 4" stroke={CHART_THEME.borderPrimary} vertical={false} />
            <XAxis dataKey="label" tick={{ fill: CHART_THEME.textSecondary, fontSize: 11 }} tickLine={false} axisLine={{ stroke: CHART_THEME.borderPrimary }} interval={step - 1} dy={4} />
            <YAxis tick={{ fill: CHART_THEME.textSecondary, fontSize: 11 }} tickLine={false} axisLine={false} width={showAcu ? 30 : 44} tickFormatter={(v) => (Number(v) === 0 ? "" : formatAcuValue(Number(v), { showUnit: false }))} />
            <ChartTooltip cursor={{ fill: CHART_THEME.bgElevated, opacity: 0.5 }} content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0]?.payload as ConsumptionPoint;
              if (!p.hasUsage) return null;
              return (
                <div className="rounded-lg border border-border-secondary bg-bg-elevated px-3 py-2 shadow-lg">
                  <p className="text-12 font-medium text-text-secondary">{shortMonthDay(p.timestamp)}</p>
                  <p className="mt-1 text-12 text-text-primary">{formatAcuValue(p.acus)}</p>
                </div>
              );
            }} />
            <Bar dataKey="acus" fill={CHART_THEME.accent} radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

/* ---------------- Two-month range calendar (`Te` — numberOfMonths:2, disableFuture) ---------------- */
const isSameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const addMonths = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth() + n, 1);

/** react-day-picker `addToRange` (min 0, max 0, not required) — the bundled range semantics (decompile 15546-15575). */
export function addToRange(day: Date, range: DateRange | null | undefined): DateRange | undefined {
  const from = range?.from, to = range?.to;
  if (!from && !to) return { from: day, to: day };
  if (from && !to) return isSameDay(from, day) ? { from, to: day } : day < from ? { from: day, to: from } : { from, to: day };
  if (from && to) {
    if (isSameDay(from, day) && isSameDay(to, day)) return undefined;
    if (isSameDay(from, day)) return { from, to: day };
    if (isSameDay(to, day)) return { from: day, to: day };
    if (day < from) return { from: day, to };
    return { from, to: day };
  }
  return { from: day, to: undefined };
}

function MonthGrid({ month, value, today, disableFuture, onSelect }: { month: Date; value: DateRange | null; today: Date; disableFuture: boolean; onSelect: (d: Date) => void }) {
  const first = startOfMonth(month);
  const lead = first.getDay();
  const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const cells: (Date | null)[] = [...Array<null>(lead).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => new Date(first.getFullYear(), first.getMonth(), i + 1))];
  while (cells.length % 7) cells.push(null);
  const weekdays = Array.from({ length: 7 }, (_, i) => new Date(2024, 0, 7 + i).toLocaleDateString(undefined, { weekday: "short" }).slice(0, 2));
  const from = value?.from ? startOfDay(value.from) : null, to = value?.to ? startOfDay(value.to) : null;
  return (
    <table role="grid" className="border-collapse" aria-label={month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}>
      <thead><tr>{weekdays.map((w, i) => <th key={i} scope="col" className="size-8 text-center text-11 font-normal text-text-secondary">{w}</th>)}</tr></thead>
      <tbody>
        {Array.from({ length: cells.length / 7 }, (_, r) => (
          <tr key={r}>
            {cells.slice(r * 7, r * 7 + 7).map((d, c) => {
              if (!d) return <td key={c} className="size-8" />;
              const disabled = disableFuture && d > today;
              const isFrom = !!from && isSameDay(d, from), isTo = !!to && isSameDay(d, to);
              const inside = !!from && !!to && d > from && d < to;
              const edge = isFrom || isTo;
              return (
                <td key={c} role="gridcell" aria-selected={edge || inside || undefined} className={cn("size-8 p-0 text-center", inside && "bg-tint-tertiary", from && to && !isSameDay(from, to) && isFrom && "rounded-l-[6px] bg-tint-tertiary", from && to && !isSameDay(from, to) && isTo && "rounded-r-[6px] bg-tint-tertiary")}>
                  <button type="button" disabled={disabled} aria-label={d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })} onClick={() => onSelect(d)}
                    className={cn("size-8 rounded-[6px] text-13 tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-border-secondary",
                      edge ? "bg-text-primary font-medium text-text-primary-inverse" : inside ? "text-text-primary hover:bg-tint-secondary" : "text-text-primary hover:bg-tint-tertiary",
                      !edge && isSameDay(d, today) && "font-semibold text-text-accent-primary", disabled && "pointer-events-none text-text-disabled")}>
                    {d.getDate()}
                  </button>
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function RangeCalendar({ value, onValueChange, numberOfMonths = 2, disableFuture = false, className }: { value: DateRange | null; onValueChange: (r: DateRange | undefined) => void; numberOfMonths?: number; disableFuture?: boolean; className?: string }) {
  const today = startOfDay(new Date());
  const lastMonth = startOfMonth(today);
  const [month, setMonth] = useState(() => {
    const wanted = startOfMonth(value?.from ?? today);
    const latestStart = addMonths(lastMonth, -(numberOfMonths - 1));
    return disableFuture && wanted > latestStart ? latestStart : wanted;
  });
  const canNext = !disableFuture || addMonths(month, numberOfMonths - 1) < lastMonth;
  const months = Array.from({ length: numberOfMonths }, (_, i) => addMonths(month, i));
  return (
    <div className={cn("flex items-start gap-4", className)}>
      {months.map((m, i) => (
        <div key={m.getTime()} className="flex flex-col gap-1">
          <div className="flex h-8 items-center justify-between">
            {i === 0 ? <IconButton variant="ghost" size="sm" aria-label={t("previous")} onClick={() => setMonth((x) => addMonths(x, -1))}><ChevronLeft /></IconButton> : <span className="size-7" aria-hidden="true" />}
            <span className="text-13 font-medium text-text-primary" aria-live="polite">{m.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</span>
            {i === months.length - 1 ? <IconButton variant="ghost" size="sm" aria-label={t("next")} disabled={!canNext} onClick={() => setMonth((x) => addMonths(x, 1))}><ChevronRight /></IconButton> : <span className="size-7" aria-hidden="true" />}
          </div>
          <MonthGrid month={m} value={value} today={today} disableFuture={disableFuture} onSelect={(d) => onValueChange(addToRange(d, value))} />
        </div>
      ))}
    </div>
  );
}

/* ---------------- Date range control (`wi`, module 3056-3157) ---------------- */
export function DateRangeControl({ preset, onPresetChange, custom, onCustomChange, since, until }: {
  preset: Preset; onPresetChange: (p: Preset) => void; custom?: DateRange; onCustomChange: (c: DateRange | undefined) => void;
  /** Optional resolved bounds (ISO or Date); derived from `rangeFor(preset, custom)` when omitted. */
  since?: Date | string; until?: Date | string;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  // The menu's deferred focus-return to the trigger must not count as an outside interaction for the calendar popover.
  const openingPickerRef = useRef(false);
  const openPicker = () => { openingPickerRef.current = true; setPickerOpen(true); };
  const resolved = useMemo(() => rangeFor(preset, custom), [preset, custom]);
  const sinceD = since ? new Date(since) : resolved.since, untilD = until ? new Date(until) : resolved.until;
  const rangeLabel = `${shortMonthDay(sinceD)} – ${shortMonthDay(untilD)}`;
  const label = preset === "week" ? t("lastWeek") : preset === "4weeks" ? t("last4Weeks") : rangeLabel;
  const value: DateRange = custom ?? { from: sinceD, to: untilD };
  return (
    <Popover open={pickerOpen} onOpenChange={(o) => { setPickerOpen(o); if (!o) triggerRef.current?.focus(); }}>
      <PopoverAnchor asChild>
        <div ref={anchorRef} className="flex items-center">
          <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
            <DropdownMenuTrigger asChild><Button ref={triggerRef} variant="secondary"><CalendarDays />{label}{" "}<ChevronDown /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end" onCloseAutoFocus={(e) => { if (openingPickerRef.current) { openingPickerRef.current = false; e.preventDefault(); } }}>
              <DropdownMenuCheckItem checked={preset === "week"} onSelect={() => { onPresetChange("week"); setMenuOpen(false); }}>{t("lastWeek")}</DropdownMenuCheckItem>
              <DropdownMenuCheckItem checked={preset === "4weeks"} onSelect={() => { onPresetChange("4weeks"); setMenuOpen(false); }}>{t("last4Weeks")}</DropdownMenuCheckItem>
              <DropdownMenuItem onSelect={openPicker}>
                <span className="mr-auto min-w-0">{t("customRange")}</span>
                {preset === "custom" && <Check size={16} className="text-text-secondary" />}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </PopoverAnchor>
      <PopoverContent align="end" className="w-auto p-0" onFocusOutside={(e) => { if (anchorRef.current?.contains(e.target as Node)) e.preventDefault(); }}>
        <RangeCalendar numberOfMonths={2} disableFuture className="p-2" value={value.from ? { from: value.from, ...(value.to ? { to: value.to } : {}) } : null}
          onValueChange={(r) => { onCustomChange(r ?? undefined); if (r?.from) onPresetChange("custom"); }} />
      </PopoverContent>
    </Popover>
  );
}
