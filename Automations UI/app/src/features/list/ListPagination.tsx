import { ChevronDown, ChevronUp } from "lucide-react";
import { useCallback, useMemo, useState, type ReactNode } from "react";
import type { Automation } from "@/model/types";
import { cn } from "@/lib/cn";
import { t } from "@/i18n/t";
import { Button } from "@/ui/button";
import { Skeleton } from "@/ui/skeleton";
import { matchesTagFilters, type TagFilter } from "@/model/tags";
import { AutomationListItem, type SparklineState } from "./AutomationListItem";

/* ---------------- Sortable-Bn_1Jy3Z.js ---------------- */
export type SortDirection = "asc" | "desc" | null;
export type SortState<C extends string = string> = { column: C | null; direction: SortDirection };
export type SortHandlers<C extends string = string> = { handleSort: (c: C) => void; getSortIndicator: (c: C) => string };

function isDate(v: unknown): v is Date { return v instanceof Date && !isNaN(v.getTime()); }
function isDateString(v: unknown): v is string { return typeof v === "string" && !isNaN(Date.parse(v)); }
function toTime(v: Date | string): number { return isDate(v) ? v.getTime() : Date.parse(v); }

export function useSortable<T, C extends string>(items: T[], accessors: Partial<Record<C, (item: T) => unknown>> = {}, initialColumn?: C | null, initialDirection?: SortDirection) {
  const [direction, setDirection] = useState<SortDirection>(initialDirection ?? null);
  const [column, setColumn] = useState<C | null>(initialColumn ?? null);
  const sortState = useMemo<SortState<C>>(() => ({ column, direction }), [column, direction]);
  const sortHandlers = useMemo<SortHandlers<C>>(() => ({
    handleSort: (c) => {
      if (sortState.column === c) {
        if (sortState.direction === "asc") setDirection("desc");
        else { setColumn(null); setDirection(null); }
      } else { setColumn(c); setDirection("asc"); }
    },
    getSortIndicator: (c) => (sortState.column === c ? (sortState.direction === "asc" ? " ↑" : " ↓") : ""),
  }), [sortState]);
  const sortedItems = useMemo(() => {
    if (!column || !direction || !items?.length) return items;
    const acc = accessors[column] ?? ((it: T) => (it as Record<string, unknown>)[column]);
    const dir = direction === "asc" ? 1 : -1;
    return [...items].sort((a, b) => {
      const x = acc(a), y = acc(b);
      if (x == null && y == null) return 0;
      if (x == null) return dir;
      if (y == null) return -dir;
      if ((isDate(x) || isDateString(x)) && (isDate(y) || isDateString(y))) return dir * (toTime(x) - toTime(y));
      if (typeof x === "number" && typeof y === "number") return dir * (x - y);
      return dir * String(x).trim().localeCompare(String(y).trim());
    });
  }, [items, column, direction, accessors]);
  return { sortedItems, sortHandlers, sortState };
}

/* ---------------- ListPagination-CEa4Aq4o.js ---------------- */
export const AUTOMATIONS_PAGE_SIZE = 50;

/** `C` — initial four-row skeleton. */
export function ListSkeleton() {
  return (
    <div className="flex flex-col gap-0.5 pt-4">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="flex items-center gap-5 px-3 py-2">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <Skeleton className="h-[14px] w-48 rounded" />
            <Skeleton className="h-[14px] w-32 rounded" />
          </div>
          <Skeleton className="h-5 w-[91px] shrink-0 rounded" />
          <Skeleton className="h-4 w-16 shrink-0 rounded" />
        </div>
      ))}
    </div>
  );
}

/** `E` — table frame. */
export function ListFrame({ header, children }: { header: ReactNode; children: ReactNode }) {
  return (
    <div className="mx-1 rounded-lg border border-border-secondary bg-bg-elevated">
      <div className="flex items-center gap-5 border-b border-border-secondary px-4 py-2 text-12 font-medium leading-4 text-text-secondary">{header}</div>
      <div className="flex flex-col gap-0.5 p-1">{children}</div>
    </div>
  );
}

/** `D` — sortable heading button (no aria-sort emitted, matching the shipped bundle). */
export function SortHeader<C extends string>({ column, sortState, sortHandlers, align = "left", className, children }: {
  column: C; sortState: SortState<C>; sortHandlers: SortHandlers<C>; align?: "left" | "right"; className?: string; children: ReactNode;
}) {
  const right = align === "right";
  const ind = sortState.column === column && sortState.direction ? (sortState.direction === "asc" ? <ChevronUp size={12} /> : <ChevronDown size={12} />) : null;
  return (
    <button type="button" onClick={() => sortHandlers.handleSort(column)} className={cn("flex cursor-pointer items-center gap-1 hover:text-text-primary", right && "justify-end", className)}>
      {right && ind}<span>{children}</span>{!right && ind}
    </button>
  );
}

export type SortColumn = "name" | "last_invocation_at";

/** `A` — automation row list with header. */
export function AutomationsTable({
  automations, sparklineMap, sparklineIsLoading = false, sparklineIsError = false, getCreatorName, getMonitorChannelLabel, getSubtitle, firstColumnLabel,
  dateField, dateColumnClassName = "w-[70px]", absoluteDate = false, basePath = "/automations", getBasePath, sortState, sortHandlers,
}: {
  automations: Automation[]; sparklineMap: Map<string, number[]>; sparklineIsLoading?: boolean; sparklineIsError?: boolean;
  getCreatorName: (a: Automation) => string; getMonitorChannelLabel?: (a: Automation) => string | null | undefined; getSubtitle?: (a: Automation) => ReactNode;
  firstColumnLabel: string; dateField: "lastTriggered" | "created"; dateColumnClassName?: string; absoluteDate?: boolean; basePath?: string;
  getBasePath?: (a: Automation) => string | undefined; sortState: SortState<SortColumn>; sortHandlers: SortHandlers<SortColumn>;
}) {
  const state: SparklineState = sparklineIsLoading ? "loading" : sparklineIsError ? "error" : "ready";
  return (
    <ListFrame
      header={
        <>
          <SortHeader column="name" sortState={sortState} sortHandlers={sortHandlers} className="min-w-0 flex-1">{firstColumnLabel}</SortHeader>
          <span className="w-[91px] text-right">{t("lastNDays", { days: 30 })}</span>
          <SortHeader column="last_invocation_at" sortState={sortState} sortHandlers={sortHandlers} align="right" className={cn(dateColumnClassName, "whitespace-nowrap")}>{t("lastTriggered")}</SortHeader>
        </>
      }
    >
      {automations.map((a) => (
        <AutomationListItem
          key={a.automation_id}
          automation={a}
          sparklineBuckets={sparklineMap.get(a.automation_id)}
          sparklineState={state}
          canManage={false}
          creatorName={getCreatorName(a)}
          monitorChannelLabel={getMonitorChannelLabel?.(a)}
          subtitle={getSubtitle?.(a)}
          basePath={getBasePath?.(a) ?? basePath}
          hideActions
          dateField={dateField}
          dateColumnClassName={dateColumnClassName}
          absoluteDate={absoluteDate}
        />
      ))}
    </ListFrame>
  );
}

/** `N` — default comparator: enabled first, newer last_invocation_at, newer created_at. */
export function defaultAutomationCompare(a: Automation, b: Automation): number {
  if (a.enabled !== b.enabled) return a.enabled ? -1 : 1;
  const x = a.last_invocation_at ? new Date(a.last_invocation_at).getTime() : 0;
  const y = b.last_invocation_at ? new Date(b.last_invocation_at).getTime() : 0;
  if (x === y) return new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime();
  return y - x;
}

const DEFAULT_ACCESSORS: Partial<Record<SortColumn, (a: Automation) => unknown>> = {
  last_invocation_at: (a) => (a.last_invocation_at ? new Date(a.last_invocation_at).getTime() : 0),
};

/** `P` — search/filter/sort/page pipeline with identity-reset paging. */
export function useListPaging({
  items, search, tagFilters, getCreatorName, getChannelLabel, getSearchableText, pageSize = AUTOMATIONS_PAGE_SIZE, resetKey,
}: {
  items: Automation[]; search: string; tagFilters: TagFilter[]; getCreatorName: (a: Automation) => string; getChannelLabel?: (a: Automation) => string | null | undefined;
  getSearchableText?: (a: Automation) => string; pageSize?: number; resetKey?: unknown;
}) {
  const q = search.trim().toLowerCase();
  const base = useMemo(() => [...items].sort(defaultAutomationCompare), [items]);
  const { sortedItems, sortHandlers, sortState } = useSortable<Automation, SortColumn>(base, DEFAULT_ACCESSORS);
  const tagIdentity = useMemo(() => Array.from(new Set(tagFilters.map(({ key, value }) => JSON.stringify([key, value])))).sort(), [tagFilters]);
  const identity = JSON.stringify([q, tagIdentity, sortState.column === null ? null : String(sortState.column), sortState.direction, resetKey === undefined ? null : [typeof resetKey, resetKey]]);
  const [pageState, setPageState] = useState(() => ({ identity, requestedPage: 0 }));
  if (pageState.identity !== identity) setPageState({ identity, requestedPage: 0 });

  const visibleItems = useMemo(() => {
    const match = (a: Automation) => {
      if (!q) return true;
      const name = (a.name ?? "").toLowerCase();
      const creator = getCreatorName(a).toLowerCase();
      const channel = (getChannelLabel?.(a) ?? "").toLowerCase();
      const extra = (getSearchableText?.(a) ?? "").toLowerCase();
      return name.includes(q) || creator.includes(q) || channel.includes(q) || extra.includes(q);
    };
    return sortedItems.filter((a) => match(a) && matchesTagFilters(a, tagFilters));
  }, [sortedItems, q, tagFilters, getCreatorName, getChannelLabel, getSearchableText]);

  const total = visibleItems.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const requested = pageState.identity === identity ? pageState.requestedPage : 0;
  const page = Math.min(Math.max(0, requested), pageCount - 1);
  const from = page * pageSize;
  const to = Math.min(from + pageSize, total);
  const pagedItems = visibleItems.slice(from, to);

  const onPrevious = useCallback(() => setPageState((s) => {
    const cur = Math.min(Math.max(0, s.identity === identity ? s.requestedPage : 0), pageCount - 1);
    const next = Math.max(0, cur - 1);
    return s.identity === identity && s.requestedPage === next ? s : { identity, requestedPage: next };
  }), [identity, pageCount]);
  const onNext = useCallback(() => setPageState((s) => {
    const cur = Math.min(Math.max(0, s.identity === identity ? s.requestedPage : 0), pageCount - 1);
    const next = Math.min(pageCount - 1, cur + 1);
    return s.identity === identity && s.requestedPage === next ? s : { identity, requestedPage: next };
  }), [identity, pageCount]);

  return {
    visibleItems, pagedItems, sortState, sortHandlers,
    pagination: { page, pageCount, from: total === 0 ? 0 : from + 1, to, total, previousDisabled: page === 0, nextDisabled: page >= pageCount - 1, onPrevious, onNext },
  };
}

/** `z` — pagination footer. */
export function ListPagination({ from, to, total, previousDisabled, nextDisabled, onPrevious, onNext }: {
  from: number; to: number; total: number; previousDisabled: boolean; nextDisabled: boolean; onPrevious: () => void; onNext: () => void;
}) {
  return (
    <div className="flex items-center justify-between px-3 text-12 text-text-secondary">
      <span className="tabular-nums">{t("showingRange", { from, to, total })}</span>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="sm" disabled={previousDisabled} onClick={onPrevious}>{t("previous")}</Button>
        <Button variant="ghost" size="sm" disabled={nextDisabled} onClick={onNext}>{t("next")}</Button>
      </div>
    </div>
  );
}
