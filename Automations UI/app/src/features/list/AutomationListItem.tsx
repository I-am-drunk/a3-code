import { Link } from "@tanstack/react-router";
import { Ellipsis } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import type { Automation } from "@/model/types";
import { sourceOf, SourceIcon, hasSourceIcon } from "@/model/sources";
import { cn } from "@/lib/cn";
import { absoluteDate, shortAgo } from "@/lib/time";
import { t } from "@/i18n/t";
import { Tooltip } from "@/ui/tooltip";
import { Badge } from "@/ui/badge";
import { Skeleton } from "@/ui/skeleton";
import { Button } from "@/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/ui/menu";
import { ConfirmDialog } from "@/ui/dialog";
import { useTheme } from "@/shell/AppShell";

/**
 * `U` — 91×20 activity sparkline. Null on empty buckets; flat centerline when all zero;
 * otherwise normalized to max bucket with 1px inset. Gradient light #93C5FD→#3B82F6, dark #1E40AF→#4489FF.
 */
export function Sparkline({ buckets, width = 91, height = 20, className }: { buckets: number[]; width?: number; height?: number; className?: string }) {
  const id = useId();
  const dark = useTheme().theme === "dark";
  const allZero = buckets.length > 0 && buckets.every((b) => b === 0);
  const points = useMemo(() => {
    if (buckets.length === 0) return "";
    if (allZero) {
      const w = width - 2, mid = height / 2;
      return `1,${mid} ${1 + w},${mid}`;
    }
    const max = Math.max(...buckets, 1), w = width - 2, h = height - 2;
    const step = buckets.length > 1 ? w / (buckets.length - 1) : 0;
    return buckets.map((b, i) => `${1 + i * step},${1 + h - (b / max) * h}`).join(" ");
  }, [buckets, width, height, allZero]);
  if (buckets.length === 0) return null;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={className} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="1" y2="0">
          <stop offset="0%" stopColor={dark ? "#1E40AF" : "#93C5FD"} />
          <stop offset="100%" stopColor={dark ? "#4489FF" : "#3B82F6"} />
        </linearGradient>
      </defs>
      <polyline points={points} fill="none" stroke={`url(#${id})`} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** `ne(name)` — clamp detection: tooltip only when the single-line name is truncated. */
function useIsClamped(dep: string) {
  const ref = useRef<HTMLSpanElement>(null);
  const [isClamped, setClamped] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => setClamped(el.scrollWidth > el.clientWidth + 1);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [dep]);
  return { ref, isClamped };
}

export type SparklineState = "ready" | "loading" | "error";

export function AutomationListItem({
  automation: a, sparklineBuckets, sparklineState = "ready", canManage = false, creatorName, monitorChannelLabel, subtitle,
  basePath = "/automations", dateColumnClassName = "w-[70px]", dateField, absoluteDate: useAbsolute = false, hideActions = false,
  hideDuplicate = false, onToggleEnabled, onDeleteAutomation, isTogglePending,
}: {
  automation: Automation; sparklineBuckets?: number[]; sparklineState?: SparklineState; canManage?: boolean; creatorName: string;
  monitorChannelLabel?: string | null; subtitle?: ReactNode; basePath?: string; dateColumnClassName?: string; dateField: "lastTriggered" | "created";
  absoluteDate?: boolean; hideActions?: boolean; hideDuplicate?: boolean; onToggleEnabled?: (id: string, enabled: boolean) => void;
  onDeleteAutomation?: (id: string) => Promise<void>; isTogglePending?: (id: string) => boolean;
}) {
  const { ref, isClamped } = useIsClamped(a.name);
  const dateValue = dateField === "lastTriggered" ? a.last_invocation_at : a.created_at;
  const dateText = dateValue ? (useAbsolute ? absoluteDate(dateValue) : shortAgo(dateValue)) : dateField === "lastTriggered" ? "—" : "";
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const source = sourceOf(a.triggers[0]?.event_type);
  const glyph = a.triggers.length > 0 && hasSourceIcon(source) ? <SourceIcon source={source} size={16} /> : null;

  return (
    <>
      <Link to={basePath === "/automations" ? "/automations/$id" : "/security/automations/$id"} params={{ id: a.automation_id }} className="group/row flex items-center gap-5 overflow-clip rounded-md px-3 py-2 hover:bg-tint-secondary">
        <div className="flex min-w-0 flex-1 gap-2.5">
          {glyph && <div className="flex h-[18px] shrink-0 items-center justify-center py-px text-text-primary">{glyph}</div>}
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="flex min-w-0 items-center gap-1.5 text-13 font-medium leading-[18px] text-text-primary first-letter:uppercase">
              <Tooltip disabled={!isClamped} content={a.name}>
                <span ref={ref} className="min-w-0 truncate">{a.name}</span>
              </Tooltip>
              {!a.enabled && <Badge className="shrink-0">{t("disabled")}</Badge>}
              {a.run_as_user && <Badge className="shrink-0">{t("personal")}</Badge>}
            </span>
            <span className="truncate text-13 leading-[18px] text-text-secondary">
              {subtitle ?? (monitorChannelLabel ? (<>{creatorName} · <span className="text-text-accent-primary">{monitorChannelLabel}</span></>) : creatorName)}
            </span>
          </div>
        </div>
        <div className="flex h-5 w-[91px] shrink-0 items-center">
          {sparklineBuckets ? <Sparkline buckets={sparklineBuckets} /> : sparklineState === "loading" ? <Skeleton className="h-5 w-[91px] rounded" /> : null}
        </div>
        <div className={cn("relative shrink-0", dateColumnClassName)}>
          {useAbsolute ? (
            <Tooltip disabled={!dateValue} content={dateValue && absoluteDate(dateValue)}>
              <span className="block text-right text-12 tabular-nums leading-4 text-text-secondary">{dateText}</span>
            </Tooltip>
          ) : hideActions ? (
            <Tooltip disabled={!dateValue} content={dateValue && absoluteDate(dateValue)}>
              <span className="block text-right text-12 leading-4 text-text-secondary">{dateText}</span>
            </Tooltip>
          ) : (
            !menuOpen && <span className="block text-right text-12 leading-4 text-text-secondary group-hover/row:invisible group-has-[:focus-visible]/row:invisible">{dateText}</span>
          )}
          {!useAbsolute && !hideActions && canManage && (
            <div
              role="presentation"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
              className={cn(
                "absolute inset-0 flex items-center justify-end",
                !menuOpen && "pointer-events-none opacity-0 group-hover/row:pointer-events-auto group-hover/row:opacity-100 group-has-[:focus-visible]/row:pointer-events-auto group-has-[:focus-visible]/row:opacity-100",
              )}
            >
              <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" aria-label={t("moreActions")}><Ellipsis /></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem disabled={isTogglePending?.(a.automation_id)} onClick={() => onToggleEnabled?.(a.automation_id, !a.enabled)}>
                    {a.enabled ? t("disable") : t("enable")}
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild><Link to="/sessions" search={{ automation: a.automation_id }}>{t("viewSessions")}</Link></DropdownMenuItem>
                  {!hideDuplicate && (
                    <DropdownMenuItem asChild>
                      <Link to={a.triggers.some((tr) => tr.event_type === "code_scan:finding") ? "/security/automations/create" : "/automations/create"} onClick={() => sessionStorage.setItem("automation-prefill", JSON.stringify(duplicatePrefill(a, t("copyOfName", { name: a.name }))))}>{t("duplicate")}</Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onClick={() => setDeleteOpen(true)}>{t("delete")}</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>
      </Link>
      {canManage && (
        <ConfirmDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          title={t("deleteAutomation")}
          description={t("deleteConfirmation", { name: a.name || t("untitledAutomation") })}
          confirmLabel={t("delete")}
          loading={deleting}
          onConfirm={async () => {
            setDeleting(true);
            try { await onDeleteAutomation?.(a.automation_id); } finally { setDeleting(false); setDeleteOpen(false); }
          }}
        />
      )}
    </>
  );
}

/** prefill-Du9dEb4D.js `r` — duplicate transform (shallow, drops IDs/enabled/timestamps). */
export function duplicatePrefill(a: Automation, name: string) {
  const tags: Record<string, string> = {};
  for (const [k, v] of Object.entries(a.tags ?? {})) if (!(k === "oncall_responder" || k === "oncall_digest" || k === "oncall_incident" || k.startsWith("oncall_report:"))) tags[k] = v;
  return {
    name,
    creation_method: "duplicate" as const,
    triggers: a.triggers.map((tr) => ({ event_type: tr.event_type, conditions: tr.conditions, replies: tr.replies })),
    actions: a.actions,
    max_acu_limit: a.max_acu_limit ?? null,
    invocation_limit: a.invocation_limit ?? null,
    invocation_limit_window_seconds: a.invocation_limit_window_seconds ?? null,
    max_concurrent_runs: a.max_concurrent_runs ?? null,
    max_queue_depth: a.max_queue_depth ?? null,
    recommended_mcps: a.recommended_mcps?.length ? a.recommended_mcps : undefined,
    slack_tool_channels: a.slack_tool_channels?.length ? a.slack_tool_channels : undefined,
    slack_dm_scope: a.slack_dm_scope,
    linear_tools_enabled: a.linear_tools_enabled,
    scratchpad_enabled: a.scratchpad_enabled,
    net_policy: a.net_policy,
    devin_mode: a.devin_mode,
    run_as_user: a.run_as_user,
    tags,
  };
}
